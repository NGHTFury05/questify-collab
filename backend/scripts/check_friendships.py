#!/usr/bin/env python3
"""
Verify that 'public.friendships' exists and is visible via PostgREST (Supabase REST).
Run:
  cd questify-collab & backend\.venv\Scripts\python -m backend.scripts.check_friendships
"""

from backend.core.database import get_supabase
from backend.core.config import get_settings


def main() -> None:
    settings = get_settings()
    print("SUPABASE_URL:", settings.SUPABASE_URL)

    sb = get_supabase()
    try:
        res = sb.table("friendships").select("id").limit(1).execute()
        rows = len(res.data or [])
        print("friendships_table_ok:", True, "sample_rows:", rows)
    except Exception as e:
        print("friendships_table_ok:", False, "error:", e)


if __name__ == "__main__":
    main()