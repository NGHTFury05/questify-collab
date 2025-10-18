#!/usr/bin/env python
"""
Seed demo data for a specific existing user email (no Auth admin required).

- Finds the user_id from public.users by email (user must sign up once in the app)
- Creates/ensures a companion 'Mentor Bot' auth user + profile (best-effort)
- Inserts demo posts (both sides), answers (one solution), votes, a friendship (accepted)
  between the user and Mentor Bot, and a short DM thread.
- Idempotent: safe to re-run; checks natural keys and dedupes.

Usage:
  python backend/scripts/seed_for_email.py --email demo@example.com
  (Run from the repo root 'questify-collab/', with backend/.env configured)

Requires:
  - SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env
"""

from __future__ import annotations

import argparse
from typing import Optional
from pathlib import Path
import sys

# Make 'backend' importable when running from repo root
HERE = Path(__file__).resolve()
BACKEND_DIR = HERE.parents[1]
REPO_ROOT = BACKEND_DIR.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend.core.database import get_supabase  # type: ignore
from backend.core.config import get_settings  # type: ignore

# Shared, safe helpers
from backend.scripts.seed_utils import (
    get,
    find_user_id_by_email,
    ensure_auth_user,
    upsert_user_profile,
    ensure_post,
    ensure_answer,
    ensure_vote_post,
    ensure_vote_answer,
    ensure_friendship,
)


def add_message(sb, *, sender_id: str, recipient_id: str, content: str) -> None:
    try:
        sb.table("messages").insert(
            {"sender_id": sender_id, "recipient_id": recipient_id, "content": content}
        ).execute()
    except Exception as e:
        print(f"[warn] message insert failed: {e}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--email",
        required=True,
        help="Existing user email to seed data for (must have signed up)",
    )
    args = parser.parse_args()

    settings = get_settings()
    print(f"[seed-for-email] Project: {settings.API_NAME} v{settings.API_VERSION}")
    sb = get_supabase()

    # 1) Resolve target user id from public.users
    user_email = args.email.strip().lower()
    user_id: Optional[str] = find_user_id_by_email(sb, user_email)
    if not user_id:
        print(
            f"[error] No row in public.users for email {user_email}. "
            "Please sign up first via the app, then re-run."
        )
        sys.exit(1)
    print(f"[seed-for-email] Target user: {user_email} -> {user_id}")

    # 2) Ensure a companion mentor bot auth user + profile (best-effort)
    mentor_email = "mentor.bot@questify.dev"
    mentor_id: Optional[str] = find_user_id_by_email(sb, mentor_email)
    if not mentor_id:
        # Try robust admin create or resolve existing via list_users
        try:
            mentor_id = ensure_auth_user(
                sb, mentor_email, "Questify123!", username="mentor-bot"
            )
        except Exception as e:
            print(f"[warn] mentor user creation via auth.admin failed: {e}")
            mentor_id = None

    if mentor_id:
        upsert_user_profile(
            sb, mentor_id, mentor_email, "mentor-bot", reputation=120
        )
    else:
        print("[warn] proceeding without mentor-bot; related seed items will be skipped")

    # 3) Create posts (both sides)
    pid1 = ensure_post(
        sb,
        user_id=user_id,
        topic="python",
        title="Inline quiz and threads work great — tips?",
        content=(
            "Testing the new inline quiz in lessons and inline discussions in the feed. "
            "Any best practices to keep state consistent?"
        ),
        tags=["python", "fastapi", "ux"],
    )
    pid2 = None
    if mentor_id:
        pid2 = ensure_post(
            sb,
            user_id=mentor_id,
            topic="react",
            title="How to preserve feed scroll when opening inline thread?",
            content=(
                "When the user opens a thread on a post card, how do you avoid jank and keep "
                "the parent feed scroll position intact?"
            ),
            tags=["react", "vite", "performance"],
        )
    pid3 = ensure_post(
        sb,
        user_id=user_id,
        topic="ai",
        title="Prompt patterns for extracting tags in client UI",
        content="Looking for compact prompt snippets to get a clean array of tags from user input.",
        tags=["ai", "nlp"],
    )

    # 4) Answers and a helpful solution
    if mentor_id and pid1:
        aid1 = ensure_answer(
            sb,
            post_id=pid1,
            user_id=mentor_id,
            content=(
                "Keep the thread container at a fixed max-height with overflow and store feed "
                "scrollY in a ref before opening."
            ),
            mark_solution=True,
        )
    else:
        aid1 = ensure_answer(
            sb,
            post_id=pid1,
            user_id=user_id,
            content=(
                "Self-answer placeholder: Consider a fixed-height thread container with overflow "
                "and cached scrollY."
            ),
            mark_solution=False,
        )

    aid2 = None
    if pid2:
        aid2 = ensure_answer(
            sb,
            post_id=pid2,
            user_id=user_id,
            content=(
                "Use a ref to cache window.scrollY before toggling; on close, restore with "
                "scrollTo. Consider IntersectionObserver to pause polling off-screen."
            ),
            mark_solution=False,
        )

    # 5) Votes (best-effort)
    if mentor_id and pid1:
        ensure_vote_post(sb, post_id=pid1, user_id=mentor_id, vote=1)
    if pid2 and user_id:
        ensure_vote_post(sb, post_id=pid2, user_id=user_id, vote=1)
    if aid1 and user_id:
        ensure_vote_answer(sb, answer_id=aid1, user_id=user_id, vote=1)

    # 6) Friendship and messages
    if mentor_id:
        ensure_friendship(sb, a=user_id, b=mentor_id)
        add_message(
            sb,
            sender_id=mentor_id,
            recipient_id=user_id,
            content="Welcome! Ask me anything about the new features.",
        )
        add_message(
            sb,
            sender_id=user_id,
            recipient_id=mentor_id,
            content="Thanks! Does the inline thread keep scroll stable?",
        )
        add_message(
            sb,
            sender_id=mentor_id,
            recipient_id=user_id,
            content="Yes — with a max-height container and ref-cached scroll position.",
        )
    else:
        print("[seed-for-email] Mentor-bot unavailable; skipped friendship and DM examples.")

    print("[seed-for-email] Seeding complete.")
    print(f"[seed-for-email] You can now log in as {user_email} and open:")
    print("  - /feed (use Discuss on cards)")
    print("  - /chat (Mentor Bot should be in your friends and have messages)")
    print("  - /lesson (open ?quiz=open to demo inline quiz)")


if __name__ == "__main__":
    main()