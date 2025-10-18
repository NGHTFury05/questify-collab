from typing import Any, Optional, Dict, List

def get(obj: Any, key: str, default: Any = None) -> Any:
    if obj is None:
        return default
    if isinstance(obj, dict):
        return obj.get(key, default)
    if hasattr(obj, key):
        return getattr(obj, key, default)
    return default

def find_user_id_by_email(sb, email: str) -> Optional[str]:
    try:
        res = sb.table("users").select("id").eq("email", email).single().execute()
        return (res.data or {}).get("id")
    except Exception:
        return None

def ensure_auth_user(sb, email: str, password: str, username: Optional[str] = None) -> Optional[str]:
    # Try find via admin list
    try:
        page = 1
        per_page = 50
        while True:
            res = sb.auth.admin.list_users(page=page, per_page=per_page)
            users = get(res, "users") or []
            for u in users:
                if get(u, "email") == email:
                    return get(u, "id")
            if len(users) < per_page:
                break
            page += 1
    except Exception:
        pass
    # Try create
    try:
        res = sb.auth.admin.create_user({
            "email": email,
            "password": password,
            "email_confirm": True,
            "user_metadata": {"username": username} if username else None,
        })
        usr = get(res, "user")
        uid = get(usr, "id")
        if uid:
            return uid
    except Exception:
        # If exists, try sign-in or re-list
        try:
            page = 1
            per_page = 50
            while True:
                res = sb.auth.admin.list_users(page=page, per_page=per_page)
                users = get(res, "users") or []
                for u in users:
                    if get(u, "email") == email:
                        return get(u, "id")
                if len(users) < per_page:
                    break
                page += 1
        except Exception:
            pass
    return None

def upsert_user_profile(sb, user_id: str, email: Optional[str], username: Optional[str], reputation: int = 0) -> None:
    try:
        sb.table("users").upsert({
            "id": user_id,
            "email": email,
            "username": username,
            "reputation_score": reputation,
        }, on_conflict="id").execute()
    except Exception as e:
        print(f"[warn] upsert users failed for {email or username}: {e}")

def ensure_post(sb, *, user_id: str, topic: str, title: str, content: str, tags: List[str]) -> Optional[int]:
    if not user_id:
        return None
    try:
        existing = (
            sb.table("posts").select("id").eq("title", title).eq("user_id", user_id).single().execute()
        ).data
        if existing and existing.get("id"):
            return int(existing["id"])
    except Exception:
        pass
    try:
        ins = sb.table("posts").insert({
            "user_id": user_id, "topic": topic, "title": title, "content": content, "tags": [t.lower() for t in tags][:8]
        }).execute()
        post = (ins.data or [{}])[0]
        return int(post["id"])
    except Exception as e:
        print(f"[warn] ensure_post failed: {e}")
        return None

def ensure_answer(sb, *, post_id: Optional[int], user_id: str, content: str, mark_solution: bool = False) -> Optional[int]:
    if not post_id or not user_id:
        return None
    try:
        rows = sb.table("answers").select("id,content").eq("post_id", post_id).eq("user_id", user_id).execute().data or []
        for r in rows:
            if str(r.get("content","")).strip() == content.strip():
                ans_id = int(r["id"])
                if mark_solution:
                    try:
                        sb.table("answers").update({"is_helpful_solution": True}).eq("id", ans_id).execute()
                    except Exception:
                        pass
                return ans_id
    except Exception:
        pass
    try:
        ins = sb.table("answers").insert({
            "post_id": post_id, "user_id": user_id, "content": content, "is_helpful_solution": mark_solution
        }).execute()
        ans = (ins.data or [{}])[0]
        return int(ans["id"])
    except Exception as e:
        print(f"[warn] ensure_answer failed: {e}")
        return None

def ensure_vote_post(sb, *, post_id: Optional[int], user_id: Optional[str], vote: int) -> None:
    if not post_id or not user_id:
        return
    v = 1 if int(vote) > 0 else -1
    try:
        sb.table("post_votes").upsert({"post_id": post_id, "user_id": user_id, "vote": v}, on_conflict="post_id,user_id").execute()
    except Exception as e:
        print(f"[warn] post vote failed: {e}")

def ensure_vote_answer(sb, *, answer_id: Optional[int], user_id: Optional[str], vote: int) -> None:
    if not answer_id or not user_id:
        return
    v = 1 if int(vote) > 0 else -1
    try:
        sb.table("answer_votes").upsert({"answer_id": answer_id, "user_id": user_id, "vote": v}, on_conflict="answer_id,user_id").execute()
    except Exception as e:
        print(f"[warn] answer vote failed: {e}")

def ensure_friendship(sb, *, a: Optional[str], b: Optional[str]) -> None:
    if not a or not b:
        return
    try:
        existing = (
            sb.table("friendships").select("id,status")
            .or_(f"(requester_id.eq.{a},addressee_id.eq.{b}),(requester_id.eq.{b},addressee_id.eq.{a})")
            .execute()
        ).data or []
        for r in existing:
            if r.get("status") != "accepted":
                sb.table("friendships").update({"status": "accepted"}).eq("id", r["id"]).execute()
        if existing:
            return
    except Exception:
        pass
    try:
        req = sb.table("friendships").insert({"requester_id": a, "addressee_id": b, "status": "pending"}).execute()
        rid = (req.data or [{}])[0].get("id")
        if rid:
            sb.table("friendships").update({"status": "accepted"}).eq("id", rid).execute()
    except Exception as e:
        print(f"[warn] friendship setup failed: {e}")