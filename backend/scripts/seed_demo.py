#!/usr/bin/env python
"""
Seed the Supabase database with demo data for Questify Collab.

- Ensures two demo users (email confirmed) in Supabase Auth (admin) using robust helper
- Upserts corresponding rows in public.users with usernames and reputation
- Creates sample posts with tags/topics
- Adds answers (one marked as helpful solution)
- Adds friendship (accepted) and some chat messages
- Adds votes for posts/answers

Idempotent: safe to re-run; it checks for existing entities by natural keys.
Requires backend/.env to contain SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
"""

from __future__ import annotations
from typing import Optional, List
from pathlib import Path
import sys

# Ensure we can import "backend.*" when running as: python scripts/seed_demo.py
HERE = Path(__file__).resolve()
BACKEND_DIR = HERE.parents[1]  # questify-collab/backend
REPO_ROOT = BACKEND_DIR.parent  # questify-collab
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend.core.database import get_supabase  # type: ignore
from backend.core.config import get_settings  # type: ignore

# Shared robust seeding helpers
from backend.scripts.seed_utils import (  # type: ignore
    get,
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
        sb.table("messages").insert({"sender_id": sender_id, "recipient_id": recipient_id, "content": content}).execute()
    except Exception as e:
        print(f"[warn] message insert failed: {e}")


def main() -> None:
    settings = get_settings()
    print(f"[seed] Using project: {settings.API_NAME} v{settings.API_VERSION}")
    sb = get_supabase()

    # Demo users
    alice_email = "alice.demo@questify.dev"
    alice_pass = "Questify123!"
    bob_email = "bob.demo@questify.dev"
    bob_pass = "Questify123!"

    # Robust creation or resolution via helpers
    alice_id: Optional[str] = None
    bob_id: Optional[str] = None
    try:
        alice_id = ensure_auth_user(sb, alice_email, alice_pass, username="alice")
    except Exception:
        alice_id = None
    try:
        bob_id = ensure_auth_user(sb, bob_email, bob_pass, username="bob")
    except Exception:
        bob_id = None

    # Graceful behavior when signups disabled / admin not permitted
    if not alice_id or not bob_id:
        print("\n[seed] One or both demo users could not be created automatically.")
        print("[seed] Ensure Supabase email signups are enabled OR sign up via the UI once using:")
        print(f"  - {alice_email} / {alice_pass}")
        print(f"  - {bob_email} / {bob_pass}")
        print("[seed] Then re-run: backend\\.venv\\Scripts\\python backend\\scripts\\seed_demo.py")
        sys.exit(0)

    # Upsert profile rows
    upsert_user_profile(sb, alice_id, alice_email, "alice", reputation=100)
    upsert_user_profile(sb, bob_id, bob_email, "bob", reputation=50)
    print(f"[seed] Users ready: alice={alice_id}, bob={bob_id}")

    # Posts
    pid1 = ensure_post(
        sb,
        user_id=alice_id,
        topic="python",
        title="How to structure a FastAPI project?",
        content="Looking for best practices on organizing routes, services, and models in a mid-sized FastAPI app.",
        tags=["python", "fastapi", "architecture"],
    )
    pid2 = ensure_post(
        sb,
        user_id=bob_id,
        topic="react",
        title="Efficiently rendering long lists with inline threads",
        content="What's the best way to keep feed scroll positions while expanding a discussion thread inline?",
        tags=["react", "vite", "performance", "ux"],
    )
    pid3 = ensure_post(
        sb,
        user_id=alice_id,
        topic="ai",
        title="Prompting tips for better tag suggestions",
        content="Share your best short prompts to extract useful tags from user-submitted questions.",
        tags=["ai", "nlp", "tags"],
    )
    print(f"[seed] Posts ready: {pid1}, {pid2}, {pid3}")

    # Answers (one marked helpful)
    aid1 = ensure_answer(
        sb,
        post_id=pid1,
        user_id=bob_id,
        content="Consider a layered approach: routers -> services -> repositories. Keep Pydantic models separate from DB models.",
        mark_solution=True,
    )
    aid2 = ensure_answer(
        sb,
        post_id=pid2,
        user_id=alice_id,
        content="Use a fixed-height container with overflow for the thread; preserve feed scroll in a ref. react-window if lists are very long.",
        mark_solution=False,
    ) if pid2 else None
    aid3 = ensure_answer(
        sb,
        post_id=pid3,
        user_id=bob_id,
        content="Ask for 'a pure JSON array of lowercase tags' and include a couple of seed tags to anchor the model.",
        mark_solution=False,
    )
    print(f"[seed] Answers ready: {aid1}, {aid2}, {aid3}")

    # Votes
    if pid1 and bob_id:
        ensure_vote_post(sb, post_id=pid1, user_id=bob_id, vote=1)
    if pid2 and alice_id:
        ensure_vote_post(sb, post_id=pid2, user_id=alice_id, vote=1)
    if pid3 and bob_id:
        ensure_vote_post(sb, post_id=pid3, user_id=bob_id, vote=1)
    if aid1 and alice_id:
        ensure_vote_answer(sb, answer_id=aid1, user_id=alice_id, vote=1)

    # Friendships and messages
    ensure_friendship(sb, a=alice_id, b=bob_id)
    add_message(sb, sender_id=alice_id, recipient_id=bob_id, content="Hey Bob! Did you check the new inline threads?")
    add_message(sb, sender_id=bob_id, recipient_id=alice_id, content="Yes! Looks smooth. The scroll preservation works.")
    add_message(sb, sender_id=alice_id, recipient_id=bob_id, content="Awesome. Let's prep for the demo.")
    print("[seed] Friendships and messages ready.")

    print("\n[seed] Demo data seeded successfully.")
    print("Log in using:")
    print(f"  - {alice_email} / {alice_pass}")
    print(f"  - {bob_email} / {bob_pass}")


if __name__ == "__main__":
    main()