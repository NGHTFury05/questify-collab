#!/usr/bin/env python3
"""
Clear all community posts and related data:
- community_notes (for posts/answers)
- answer_flags, post_flags
- answer_votes, post_votes
- answers
- posts

Uses the Supabase service role via backend.core.database.get_supabase().
Run from repo root:
  python -m backend.scripts.clear_community
"""

from typing import Callable, Optional
from backend.core.database import get_supabase


def count_rows(sb, table: str, filters: Optional[Callable] = None) -> Optional[int]:
    try:
        q = sb.table(table).select("id", count="exact")
        if filters:
            q = filters(q)
        res = q.execute()
        # Supabase-py v2 returns .count; fallback to len(data) if needed
        return getattr(res, "count", None) if getattr(res, "count", None) is not None else len(res.data or [])
    except Exception as e:
        print(f"[WARN] Unable to count rows in {table}: {e}")
        return None


def delete_all(sb, table: str, apply_filters: Optional[Callable] = None) -> bool:
    """
    Delete all rows from a table. PostgREST typically expects a filter;
    we use a broad filter: id > 0 (for bigserial) or a domain-specific filter where needed.
    """
    try:
        q = sb.table(table).delete()
        if apply_filters:
            q = apply_filters(q)
        else:
            # Most targets here have an integer bigserial 'id'
            q = q.gt("id", 0)
        _ = q.execute()
        return True
    except Exception as e:
        print(f"[ERROR] Deleting from {table} failed: {e}")
        return False


def main() -> None:
    sb = get_supabase()

    # (table, filter-applier) pairs
    targets: list[tuple[str, Optional[Callable]]] = [
        # Only delete notes for posts/answers
        ("community_notes", lambda q: q.in_("entity_type", ["post", "answer"])),
        ("answer_flags", None),
        ("post_flags", None),
        ("answer_votes", None),
        ("post_votes", None),
        ("answers", None),
        ("posts", None),
    ]

    print("=== Community cleanup starting ===")
    for table, filt in targets:
        before = count_rows(sb, table, filters=filt)
        print(f"{table}: rows before delete = {before}")

        ok = delete_all(sb, table, apply_filters=filt)
        if not ok:
            print(f"{table}: delete FAILED")
            continue

        after = count_rows(sb, table, filters=filt)
        print(f"{table}: rows after delete  = {after}")
    print("=== Community cleanup complete ===")


if __name__ == "__main__":
    main()