import os
from dataclasses import dataclass
from pathlib import Path
from typing import List
from dotenv import load_dotenv


def _load_backend_env() -> None:
    """
    Load environment variables from backend/.env if present.
    This ensures running from repo root still picks up backend secrets.
    """
    core_dir = Path(__file__).resolve().parent
    backend_dir = core_dir.parent
    dotenv_path = backend_dir / ".env"
    # Load if the file exists; do not override existing process env
    load_dotenv(dotenv_path, override=False)


def _parse_cors(origins_raw: str | None) -> List[str]:
    if not origins_raw:
        return []
    # Split on comma or semicolon, trim, and drop empties
    parts = [o.strip() for o in origins_raw.replace(";", ",").split(",")]
    return [p for p in parts if p]


@dataclass(frozen=True)
class Settings:
    # App
    API_NAME: str
    API_VERSION: str

    # Supabase
    SUPABASE_URL: str
    SUPABASE_SERVICE_ROLE_KEY: str
    SUPABASE_JWT_SECRET: str

    # AI / Groq
    GROQ_API_KEY: str
    AI_MODEL: str

    # CORS
    CORS_ORIGINS: List[str]

    # Security
    JWT_LEEWAY: int


_SETTINGS_SINGLETON: Settings | None = None


def get_settings() -> Settings:
    """
    Returns a singleton Settings instance populated from environment variables.
    """
    global _SETTINGS_SINGLETON
    if _SETTINGS_SINGLETON is not None:
        return _SETTINGS_SINGLETON

    _load_backend_env()

    api_name = os.getenv("API_NAME", "Questify Collab API")
    api_version = os.getenv("API_VERSION", "1.0.0")

    supabase_url = os.getenv("SUPABASE_URL", "")
    supabase_service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    supabase_jwt_secret = os.getenv("SUPABASE_JWT_SECRET", "")

    groq_api_key = os.getenv("GROQ_API_KEY", "")
    # Default to a current, non-decommissioned Groq model. Override via AI_MODEL in backend/.env
    ai_model = os.getenv("AI_MODEL", "llama-3.1-8b-instant")

    # Security leeway (seconds) to tolerate minor clock skew when validating JWT exp/iat
    jwt_leeway = int(os.getenv("JWT_LEEWAY", "60"))
    
    # CORS origins: merge env with sensible local defaults (preserve order, de-dup)
    base_cors = ["http://localhost:5173", "http://localhost:5175"]
    user_cors = _parse_cors(os.getenv("CORS_ORIGINS"))
    cors_origins = list(dict.fromkeys((user_cors or []) + base_cors))

    _SETTINGS_SINGLETON = Settings(
        API_NAME=api_name,
        API_VERSION=api_version,
        SUPABASE_URL=supabase_url,
        SUPABASE_SERVICE_ROLE_KEY=supabase_service_role_key,
        SUPABASE_JWT_SECRET=supabase_jwt_secret,
        GROQ_API_KEY=groq_api_key,
        AI_MODEL=ai_model,
        CORS_ORIGINS=cors_origins,
        JWT_LEEWAY=jwt_leeway,
    )
    return _SETTINGS_SINGLETON


# Convenience accessors
def cors_origins() -> List[str]:
    return get_settings().CORS_ORIGINS


def ai_model() -> str:
    return get_settings().AI_MODEL