#!/usr/bin/env python3
"""
Schema checker for Questify Collab

Runs quick existence checks for required tables/views using the Supabase service client.
This does NOT create schema (DDL via PostgREST is not supported); it only reports status
and points you to the SQL migrations to apply.

Usage:
  cd questify-collab & backend\.venv\Scripts\python -m backend.scripts.check_schema
"""

from __future__ import annotations

from typing import Tuple
from backend.core.database import get_supabase
from backend.core.config import get_settings


def exists_table(sb, table: str) -> Tuple[bool, str]:
    """
    Returns (exists, info_message). Uses a lightweight select to detect PGRST205.
    """
    try:
        # Selecting a cheap column + limit for existence probing
        sb.table(table).select("*", count="exact").limit(1).execute()
        return True, "ok"
    except Exception as e:
        msg = str(getattr(e, "message", "")) or str(e)
        if "PGRST205" in msg or "Could not find the table" in msg or "schema cache" in msg:
            return False, "missing (PGRST205)"
        return False, msg


def main() -> None:
    st = get_settings()
    print("== Questify Collab Schema Check ==")
    print("Project:", st.API_NAME, "v" + st.API_VERSION)
    print("SUPABASE_URL:", st.SUPABASE_URL)

    sb = get_supabase()

    required_tables = [
        # Core
        "users",
        "posts",
        "answers",
        # Social
        "friendships",
        "messages",
        # Feed/votes/flags/notes
        "post_votes",
        "answer_votes",
        "post_flags",
        "answer_flags",
        "community_notes",
        # Personalization
        "user_topic_interests",
        "user_lesson_completions",
    ]

    print("\n-- Table existence --")
    missing = []
    for t in required_tables:
        ok, info = exists_table(sb, t)
        print(f"{t:24s}: {'OK' if ok else 'MISSING'}  ({info})")
        if not ok:
            missing.append(t)

    if missing:
        print("\nSome required tables are missing:")
        for t in missing:
            print(" -", t)

        print("\nApply the SQL migrations in Supabase SQL editor (or via psql):")
        print("  1) Open Supabase dashboard for your project")
        print("  2) SQL Editor -> paste and run these files in order:")
        print("     - backend/db/001_init.sql")
        print("     - backend/db/002_community_quality.sql")
        print("\nAfter applying, try again:")
        print("  backend\\.venv\\Scripts\\python -m backend.scripts.check_schema")
        print("\nNote: Direct messaging requires the 'messages' table from 001_init.sql.")
    else:
        print("\nAll required tables are present.")


if __name__ == "__main__":
    main()