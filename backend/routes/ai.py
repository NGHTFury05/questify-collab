from fastapi import APIRouter, Depends, HTTPException
from typing import Any, Dict

from backend.core.security import get_current_user
from backend.core.groq_client import get_groq_service
from backend.models.schemas import (
    BlueprintRequest,
    LessonRequest,
    QuizRequest,
    BlueprintOut,
    LessonOut,
    QuizOut,
)

router = APIRouter()

# Fallback generators for dev/local use when Groq is unavailable
def _fallback_blueprint(goal_type: str, topic: str, level: str, objective: str) -> Dict[str, Any]:
    modules = [
        {
            "id": i + 1,
            "title": f"{topic} - Module {i + 1}",
            "description": f"Core concepts of {topic} ({level}) - part {i + 1}.",
        }
        for i in range(6)
    ]
    return {
        "course_title": f"{goal_type}: {topic} ({level})",
        "modules": modules,
    }


def _fallback_lesson(course_title: str, module_title: str, level: str) -> Dict[str, Any]:
    return {
        "module_title": module_title,
        "lesson_content": {
            "overview": (
                f"This is an overview of '{module_title}' in '{course_title}' for {level} learners. "
                "It focuses on the essential ideas to understand the topic."
            ),
            "key_concepts": [
                "Core definition and purpose",
                "When to use it",
                "Common pitfalls",
                "Best practices",
            ],
            "important_details": [
                {"heading": "Intuition", "description": "Build mental models of why this concept matters."},
                {"heading": "Application", "description": "Where and how to apply the concept in real tasks."},
                {"heading": "Trade-offs", "description": "Recognize limitations and alternatives."},
            ],
            "summary": "Recap the key insights and plan a short practice to reinforce them.",
        },
    }


def _fallback_quiz(lesson_content: Dict[str, Any]) -> Dict[str, Any]:
    questions = []
    for i in range(5):
        questions.append(
            {
                "question_text": f"Concept check {i + 1}: What is a key idea from this lesson?",
                "options": ["Option A", "Option B", "Option C", "Option D"],
                "correct_answer_index": 0,
                "explanation": "Option A captures the primary concept introduced.",
            }
        )
    return {"quiz_title": "Practice Quiz", "questions": questions}


@router.post("/generate-blueprint", response_model=BlueprintOut)
def generate_blueprint(payload: BlueprintRequest, user=Depends(get_current_user)) -> BlueprintOut:
    """
    Protected: Generates a course blueprint JSON using Groq.
    """
    service = get_groq_service()
    try:
        result = service.generate_blueprint(
            goal_type=payload.goal_type,
            topic=payload.topic,
            level=payload.level,
            objective=payload.objective,
        )
        return result
    except Exception:
        # Dev fallback if Groq is not available
        return _fallback_blueprint(
            goal_type=payload.goal_type,
            topic=payload.topic,
            level=payload.level,
            objective=payload.objective,
        )


@router.post("/generate-lesson", response_model=LessonOut)
def generate_lesson(payload: LessonRequest, user=Depends(get_current_user)) -> LessonOut:
    """
    Protected: Generates a lesson JSON for a given course module using Groq.
    """
    service = get_groq_service()
    try:
        result = service.generate_lesson(
            course_title=payload.course_title,
            module_title=payload.module_title,
            level=payload.level,
        )
        return result
    except Exception:
        # Dev fallback if Groq is not available
        return _fallback_lesson(
            course_title=payload.course_title,
            module_title=payload.module_title,
            level=payload.level,
        )


@router.post("/generate-quiz", response_model=QuizOut)
def generate_quiz(payload: QuizRequest, user=Depends(get_current_user)) -> QuizOut:
    """
    Protected: Generates a 5-question MCQ quiz based on the given lesson content using Groq.
    """
    service = get_groq_service()
    try:
        result = service.generate_quiz(lesson_content=payload.lesson_content)
        return result
    except Exception:
        # Dev fallback if Groq is not available
        return _fallback_quiz(lesson_content=payload.lesson_content)