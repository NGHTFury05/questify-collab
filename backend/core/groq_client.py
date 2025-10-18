from __future__ import annotations

import json
from typing import Any, Dict

from groq import Groq  # pip install groq
from .config import get_settings


class GroqService:
    """
    Thin wrapper around Groq client with helpers for the three AI tasks.
    Ensures JSON-only responses by using response_format={'type': 'json_object'}.
    """

    def __init__(self) -> None:
        settings = get_settings()
        if not settings.GROQ_API_KEY:
            raise RuntimeError("GROQ_API_KEY missing. Set it in backend/.env")
        self.client = Groq(api_key=settings.GROQ_API_KEY)
        self.model = settings.AI_MODEL

    def _chat_json(self, system_prompt: str, user_prompt: str, temperature: float = 0.2) -> Dict[str, Any]:
        """
        Calls Groq Chat Completions with response_format json_object and parses the JSON.
        """
        completion = self.client.chat.completions.create(
            model=self.model,
            temperature=temperature,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        )
        content = completion.choices[0].message.content
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            # Fallback: wrap as object to avoid breaking the API contract
            return {"raw": content}

    # =========================
    # Prompts and Generators
    # =========================

    @staticmethod
    def _course_blueprint_prompts(goal_type: str, topic: str, level: str, objective: str) -> tuple[str, str]:
        system_prompt = (
            "You are an expert curriculum design AI. Your task is to generate a high-level, modular course outline "
            "based on a user's learning goal. You must strictly follow the user's request and output ONLY a valid JSON object."
        )
        user_prompt = (
            "Generate a course blueprint based on the following details:\n"
            f"- Goal Type: {goal_type}\n"
            f"- Topic: {topic}\n"
            f"- User's Level: {level}\n"
            f"- Objective: {objective}\n\n"
            "The blueprint should contain between 5 to 7 modules. Each module must have a title and a brief, one-sentence description.\n\n"
            'JSON Output Format:\n'
            '{ "course_title": "...", "modules": [{"id": 1, "title": "...", "description": "..."}, ...] }'
        )
        return system_prompt, user_prompt

    @staticmethod
    def _lesson_generation_prompts(course_title: str, module_title: str, level: str) -> tuple[str, str]:
        system_prompt = (
            "You are an expert educator AI. Produce concise, concept-focused lesson material. "
            "Avoid code snippets. Output ONLY valid JSON matching the schema."
        )
        user_prompt = (
            f'Create lesson content for the module "{module_title}" within the course "{course_title}". '
            f'The learner level is "{level}". Focus on the key ideas students must master.\n'
            "- Provide an engaging overview paragraph summarizing the module.\n"
            "- List the 4-6 most important key concepts as short bullet-style strings.\n"
            "- Include 3-5 detailed explanations in an array named important_details, where each entry has a \"heading\" and \"description\" explaining why the idea matters or how to apply it.\n"
            "- Finish with an actionable summary listing next steps or reflections.\n\n"
            'JSON Output Format:\n'
            '{\n'
            '  "module_title": "...",\n'
            '  "lesson_content": {\n'
            '    "overview": "...",\n'
            '    "key_concepts": ["...", "..."],\n'
            '    "important_details": [ {"heading": "...", "description": "..."}, ... ],\n'
            '    "summary": "..."\n'
            '  }\n'
            '}'
        )
        return system_prompt, user_prompt

    @staticmethod
    def _quiz_generation_prompts(lesson_content: Dict[str, Any]) -> tuple[str, str]:
        system_prompt = (
            "You are a Socratic quiz designer AI. Create focused assessments that reinforce the lesson's key ideas. "
            "Output ONLY valid JSON."
        )
        lesson_str = json.dumps(lesson_content, ensure_ascii=False)
        user_prompt = (
            "Generate a 5-question multiple-choice quiz that assesses the learner's understanding of the lesson described below. "
            "Prioritize questions that map directly to the key concepts and important_details. Each question must have exactly four options, "
            "the index of the correct answer, and a concise explanation referencing the lesson rationale.\n\n"
            f"Lesson JSON: {lesson_str}\n\n"
            'JSON Output Format:\n'
            '{ "quiz_title": "...", "questions": [{"question_text": "...", "options": ["...","...","...","..."], "correct_answer_index": N, "explanation": "..."}, ...] }'
        )
        return system_prompt, user_prompt

    # Public methods

    def generate_blueprint(self, goal_type: str, topic: str, level: str, objective: str) -> Dict[str, Any]:
        sys_p, usr_p = self._course_blueprint_prompts(goal_type, topic, level, objective)
        return self._chat_json(sys_p, usr_p)

    def generate_lesson(self, course_title: str, module_title: str, level: str) -> Dict[str, Any]:
        sys_p, usr_p = self._lesson_generation_prompts(course_title, module_title, level)
        return self._chat_json(sys_p, usr_p)

    def generate_quiz(self, lesson_content: Dict[str, Any]) -> Dict[str, Any]:
        sys_p, usr_p = self._quiz_generation_prompts(lesson_content)
        return self._chat_json(sys_p, usr_p)

    # --------------
    # Lightweight helper to fetch a JSON array of lowercase strings.
    # Returns a Python list[str] or None if parsing fails.
    # --------------
    def simple_json_array(self, user_prompt: str, temperature: float = 0.2):
        """
        Ask the model to return ONLY a JSON object with an 'items' array of lowercase strings.
        Example expected response: { "items": ["python","react"] }
        """
        system_prompt = (
            "You are a helpful assistant. Return ONLY a JSON object with an 'items' array of lowercase strings. "
            "Do not include any prose, comments, or additional fields."
        )
        try:
            obj = self._chat_json(system_prompt, user_prompt, temperature=temperature)
            # Accept common variants
            if isinstance(obj, dict):
                if "items" in obj and isinstance(obj["items"], list):
                    return [str(x).strip().lower() for x in obj["items"] if str(x).strip()]
                if "tags" in obj and isinstance(obj["tags"], list):
                    return [str(x).strip().lower() for x in obj["tags"] if str(x).strip()]
                if "raw" in obj and isinstance(obj["raw"], str):
                    # Try to parse raw as a JSON array
                    import json as _json
                    try:
                        arr = _json.loads(obj["raw"])
                        if isinstance(arr, list):
                            return [str(x).strip().lower() for x in arr if str(x).strip()]
                    except Exception:
                        return None
            return None
        except Exception:
            return None


# Singleton accessor
_groq_service: GroqService | None = None


def get_groq_service() -> GroqService:
    global _groq_service
    if _groq_service is None:
        _groq_service = GroqService()
    return _groq_service