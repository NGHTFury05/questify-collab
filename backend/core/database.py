from typing import Optional
from supabase import create_client, Client  # pip install supabase
from .config import get_settings


_supabase_client: Optional[Client] = None


def get_supabase() -> Client:
    """
    Returns a singleton Supabase client initialized with the service role key.
    Service role is required for server-side operations (e.g., inserting into public tables).
    """
    global _supabase_client
    if _supabase_client is not None:
        return _supabase_client

    settings = get_settings()
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE_KEY:
        raise RuntimeError(
            "Supabase configuration missing. Ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in backend/.env"
        )

    _supabase_client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
    return _supabase_client