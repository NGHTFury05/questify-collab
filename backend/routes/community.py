from __future__ import annotations

from typing import Any, Dict, List, Optional, Set
from datetime import datetime, timezone
import math
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from backend.core.security import get_current_user
from backend.core.database import get_supabase
from backend.models.schemas import PostCreate, PostOut, AnswerCreate, AnswerOut, PostWithAnswers

router = APIRouter()

# --- helpers for user resolution, tags and similarity ---
MAX_TAGS_PER_POST: int = 8

def _resolve_user_id(sb, *, current_user_id: str, target_user_id: Optional[str] = None, username: Optional[str] = None, email: Optional[str] = None) -> str:
    """
    Resolve a target user's id using user_id OR username OR email. Prevent inviting self.
    """
    if target_user_id:
        uid = str(target_user_id)
    else:
        uid = ""
        try:
            if username:
                r = sb.table("users").select("id").eq("username", username).single().execute()
                uid = (r.data or {}).get("id") or ""
            elif email:
                r = sb.table("users").select("id").eq("email", email).single().execute()
                uid = (r.data or {}).get("id") or ""
        except Exception:
            uid = ""
    if not uid:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target user not found")
    if uid == current_user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot invite yourself")
    return uid


def _sanitize_tags(raw: Optional[List[str]]) -> List[str]:
    if not raw:
        return []
    seen: Set[str] = set()
    out: List[str] = []
    for t in raw:
        if not isinstance(t, str):
            continue
        s = t.strip().lower()
        if not s or s in seen:
            continue
        seen.add(s)
        out.append(s)
        if len(out) >= MAX_TAGS_PER_POST:
            break
    return out

def _similar_tags_fallback(seed: Set[str]) -> List[str]:
    # Deterministic, small fallback map; safe when AI is unavailable
    related = {
        "python": ["pandas", "numpy", "flask", "fastapi"],
        "react": ["javascript", "vite", "hooks", "redux"],
        "javascript": ["node", "react", "vite"],
        "ml": ["machine-learning", "sklearn", "modeling"],
        "ai": ["llm", "nlp", "groq"],
    }
    out: Set[str] = set()
    for t in seed:
        for r in related.get(t, []):
            out.add(r)
    return sorted(out)

# Module logger for diagnostics
logger = logging.getLogger("questify.community")

def _get_username(sb, uid: Optional[str]) -> Optional[str]:
    """
    Resolve a single user's username safely. Returns None on failure.
    """
    if not uid:
        return None
    try:
        row = (
            sb.table("users")
            .select("username")
            .eq("id", uid)
            .single()
            .execute()
            .data
            or {}
        )
        return row.get("username")
    except Exception:
        return None

def _get_usernames(sb, uids: List[str]) -> Dict[str, Optional[str]]:
    """
    Batch resolve usernames for a list of user IDs.
    """
    out: Dict[str, Optional[str]] = {}
    uniq = [u for u in dict.fromkeys([str(u) for u in uids if u])]
    if not uniq:
        return out
    try:
        res = (
            sb.table("users")
            .select("id,username")
            .in_("id", uniq)
            .execute()
        )
        for r in (res.data or []):
            out[r.get("id")] = r.get("username")
    except Exception:
        # best-effort only
        pass
    return out

# -------- helpers for feed scoring and aggregates --------
def _parse_ts(ts: str) -> datetime:
    try:
        return datetime.fromisoformat(str(ts).replace("Z", "+00:00")).astimezone(timezone.utc)
    except Exception:
        return datetime.now(timezone.utc)

def _vote_summary_for_post(sb, post_id: int) -> Dict[str, int]:
    try:
        rows = sb.table("post_votes").select("vote").eq("post_id", post_id).execute().data or []
    except Exception:
        rows = []
    up = sum(1 for r in rows if int(r.get("vote", 0)) == 1)
    down = sum(1 for r in rows if int(r.get("vote", 0)) == -1)
    return {"upvotes": up, "downvotes": down, "total": up + down}

def _vote_summary_for_answer(sb, answer_id: int) -> Dict[str, int]:
    try:
        rows = sb.table("answer_votes").select("vote").eq("answer_id", answer_id).execute().data or []
    except Exception:
        rows = []
    up = sum(1 for r in rows if int(r.get("vote", 0)) == 1)
    down = sum(1 for r in rows if int(r.get("vote", 0)) == -1)
    return {"upvotes": up, "downvotes": down, "total": up + down}

def _answers_summary_for_post(sb, post_id: int) -> Dict[str, int]:
    try:
        rows = sb.table("answers").select("is_helpful_solution").eq("post_id", post_id).execute().data or []
    except Exception:
        rows = []
    answers_count = len(rows)
    solutions_count = sum(1 for r in rows if bool(r.get("is_helpful_solution")))
    return {"answers_count": answers_count, "solutions_count": solutions_count}
# ====================
# Personalization & Social
# ====================
from backend.models.schemas import (
    PostCreate, PostOut, AnswerCreate, AnswerOut, PostWithAnswers,
    TopicInteraction, FeedResponse, FeedPost,
    FriendInviteRequest, FriendActionRequest, FriendRequestOut, FriendshipSummary,
    MessageCreate, MessageOut, ThreadOut,
    UserSearchResult,
    VoteRequest, VoteSummary, FlagRequest,
    CommunityNoteCreate, CommunityNoteOut,
    LessonCompletionCreate, LessonCompletionOut,
)


@router.post("/posts", response_model=PostOut)
def create_post(payload: PostCreate, user=Depends(get_current_user)) -> Dict[str, Any]:
    """
    Create a new post in the posts table. Accepts up to 8 tags.
    """
    sb = get_supabase()
    try:
        tags = _sanitize_tags(payload.tags)
        res = sb.table("posts").insert(
            {
                "user_id": user["user_id"],
                "topic": payload.topic,
                "title": payload.title,
                "content": payload.content,
                "tags": tags,
            }
        ).execute()
        if not res.data:
            raise HTTPException(status_code=500, detail="Failed to create post")
        return res.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating post: {e}")


@router.get("/posts/{topic}", response_model=List[PostOut])
def get_posts_by_topic(topic: str) -> List[Dict[str, Any]]:
    """
    Fetch all posts for a specific topic.
    """
    sb = get_supabase()
    try:
        res = (
            sb.table("posts")
            .select("*")
            .eq("topic", topic)
            .order("created_at", desc=True)
            .execute()
        )
        return res.data or []
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching posts: {e}")


@router.get("/post/{post_id}", response_model=Dict[str, Any])
def get_post_with_answers(post_id: int) -> Dict[str, Any]:
    """
    Fetch a single post with aggregates (votes, answers_count, solutions_count, disputed)
    and all of its associated answers including each answer's vote summary.
    """
    sb = get_supabase()
    try:
        post_res = sb.table("posts").select("*").eq("id", post_id).single().execute()
        post = post_res.data
        if not post:
            raise HTTPException(status_code=404, detail="Post not found")

        # Post vote summary and answers/solutions summary
        vs = _vote_summary_for_post(sb, int(post_id))
        ans_rows = (
            sb.table("answers")
            .select("*")
            .eq("post_id", post_id)
            .order("created_at", desc=False)
            .execute()
        ).data or []

        answers_count = len(ans_rows)
        solutions_count = sum(1 for a in ans_rows if bool(a.get("is_helpful_solution")))
        disputed = (vs["total"] >= 10) and (vs["downvotes"] > vs["upvotes"])

        # Enrich answers with vote summaries
        enriched_answers: List[Dict[str, Any]] = []
        for a in ans_rows:
            avs = _vote_summary_for_answer(sb, int(a.get("id")))
            uname = _get_username(sb, str(a.get("user_id")))
            enriched_answers.append({
                **a,
                "upvotes": avs["upvotes"],
                "downvotes": avs["downvotes"],
                "author_username": uname,
            })

        enriched_post = {
            **post,
            "upvotes": vs["upvotes"],
            "downvotes": vs["downvotes"],
            "answers_count": answers_count,
            "solutions_count": solutions_count,
            "disputed": disputed,
            "author_username": _get_username(sb, str(post.get("user_id"))),
        }
        return {"post": enriched_post, "answers": enriched_answers}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching post: {e}")


@router.post("/interest", status_code=status.HTTP_204_NO_CONTENT)
def record_interest(payload: TopicInteraction, user=Depends(get_current_user)):
    """
    Record or update a user's interest score in a topic for personalization.
    Gracefully no-op if the table doesn't exist in the current Supabase project.
    """
    sb = get_supabase()
    try:
        # Simple upsert with latest score; you can change to incremental if desired
        sb.table("user_topic_interests").upsert(
            {"user_id": user["user_id"], "topic": payload.topic, "score": payload.delta},
            on_conflict="user_id,topic",
        ).execute()
    except Exception:
        # Likely PGRST205: table doesn't exist yet. Don't break UX; just ignore.
        pass
    return None


@router.get("/feed", response_model=FeedResponse)
def get_feed(
    q: Optional[str] = None,
    tags: Optional[str] = None,
    expand_similar: bool = False,  # default off per request
    view: Optional[str] = None,     # "pulse" | "personalised"
    unanswered: bool = False,
    has_solution: bool = False,
    user=Depends(get_current_user),
):
    """
    Unified feed with two modes:
      - pulse (default for new users): rank by popularity with time decay
      - personalised (for engaged users): popularity + user topic interests + boosts

    Filters:
      - q: search in title/content
      - tags: CSV of tags, with optional expand_similar
      - unanswered: only posts with 0 answers
      - has_solution: only posts that have a marked helpful solution
    """
    sb = get_supabase()
    v = (view or "").strip().lower()

    # Fetch recent posts
    posts_res = sb.table("posts").select("*").order("created_at", desc=True).execute()
    posts = posts_res.data or []

    # Parse filters
    q_norm = (q or "").strip().lower()
    selected: Set[str] = set()
    if tags:
        selected = set(_sanitize_tags([t for t in tags.replace(";", ",").split(",")]))

    if expand_similar and selected:
        try:
            from backend.core.groq_client import get_groq_service  # lazy import
            svc = get_groq_service()
            prompt = (
                "Expand these tags with 5-10 closely related tags as a JSON array of lowercase strings: "
                + ", ".join(sorted(selected))
            )
            ai = svc.simple_json_array(prompt)  # expect list[str]
            expanded: List[str] = _sanitize_tags(list(selected) + list(ai or []))
            selected = set(expanded)
        except Exception:
            selected = selected.union(_similar_tags_fallback(selected))

    # Apply q/tags filter first
    def post_matches_basic(p: Dict[str, Any]) -> bool:
        if q_norm:
            title = (p.get("title") or "").lower()
            content = (p.get("content") or "").lower()
            if q_norm not in title and q_norm not in content:
                return False
        if selected:
            ptags = {str(t).lower() for t in (p.get("tags") or [])}
            if not (ptags & selected):
                return False
        return True

    posts = [p for p in posts if post_matches_basic(p)]
    if not posts:
        return {"posts": []}

    # Build author cache (username, reputation)
    author_cache: Dict[str, Dict[str, Any]] = {}
    def get_author(uid: str) -> Dict[str, Any]:
        if uid in author_cache:
            return author_cache[uid]
        try:
            row = sb.table("users").select("username,reputation_score").eq("id", uid).single().execute().data or {}
        except Exception:
            row = {}
        author_cache[uid] = {"username": row.get("username"), "reputation_score": int(row.get("reputation_score", 0))}
        return author_cache[uid]

    # User interests
    interests: Dict[str, int] = {}
    try:
        ints_res = sb.table("user_topic_interests").select("*").eq("user_id", user["user_id"]).execute()
        interests = {i["topic"]: int(i.get("score", 0)) for i in (ints_res.data or [])}
    except Exception:
        interests = {}

    # Last lesson keywords
    last_keywords: List[str] = []
    try:
        lc_res = (
            sb.table("user_lesson_completions")
            .select("keywords")
            .eq("user_id", user["user_id"])
            .order("completed_at", desc=True)
            .limit(1)
            .execute()
        )
        kw = ((lc_res.data or [{}])[0] or {}).get("keywords") or []
        last_keywords = [str(k).lower() for k in kw if isinstance(k, str)]
    except Exception:
        last_keywords = []

    # Topics the user has interacted with (answers, and recent votes)
    interacted_topics: Set[str] = set()
    try:
        ans_res = sb.table("answers").select("post_id").eq("user_id", user["user_id"]).order("created_at", desc=True).limit(50).execute()
        for r in (ans_res.data or []):
            try:
                p = sb.table("posts").select("topic").eq("id", r["post_id"]).single().execute().data
                if p and p.get("topic"):
                    interacted_topics.add(str(p["topic"]))
            except Exception:
                pass
    except Exception:
        pass
    try:
        pv_res = sb.table("post_votes").select("post_id").eq("user_id", user["user_id"]).order("created_at", desc=True).limit(50).execute()
        for r in (pv_res.data or []):
            try:
                p = sb.table("posts").select("topic").eq("id", r["post_id"]).single().execute().data
                if p and p.get("topic"):
                    interacted_topics.add(str(p["topic"]))
            except Exception:
                pass
    except Exception:
        pass

    # Build feed items with aggregates and scoring
    now = datetime.now(timezone.utc)
    items: List[Dict[str, Any]] = []
    for p in posts:
        pid = int(p.get("id"))
        uid = str(p.get("user_id"))
        created_at = _parse_ts(p.get("created_at"))
        age_days = max(0.0, (now - created_at).total_seconds() / 86400.0)

        # Aggregates
        vs = _vote_summary_for_post(sb, pid)
        ans = _answers_summary_for_post(sb, pid)
        disputed = (vs["total"] >= 10) and (vs["downvotes"] > vs["upvotes"])

        # Popularity with 7-day exponential decay
        popularity_raw = (3 * ans["solutions_count"]) + (2 * ans["answers_count"]) + (1 * vs["upvotes"]) - (1 * vs["downvotes"])
        decay = math.exp(-age_days / 7.0)
        popularity = float(popularity_raw) * decay

        # Personalisation boosts
        interest_component = float(interests.get(p.get("topic", ""), 0))
        boost = 0.0

        # last lesson keyword boost
        if last_keywords:
            hay_tags = [str(t).lower() for t in (p.get("tags") or [])]
            hay_text = f"{p.get('title','')} {p.get('content','')}".lower()
            if any((k in hay_text) or (k in hay_tags) for k in last_keywords):
                boost += 2.0

        # interacted topics boost
        if p.get("topic") in interacted_topics:
            boost += 1.0

        # high-rep author boost
        author = get_author(uid)
        if int(author.get("reputation_score", 0)) >= 100:
            boost += 1.0

        if v == "personalised":
            final_score = (0.7 * popularity) + (1.0 * interest_component) + boost
        else:
            # default to pulse
            final_score = popularity

        item = {
            **p,
            "author_username": author.get("username"),
            "score": float(final_score),
            "upvotes": vs["upvotes"],
            "downvotes": vs["downvotes"],
            "answers_count": ans["answers_count"],
            "solutions_count": ans["solutions_count"],
            "disputed": disputed,
        }
        items.append(item)

    # Apply unanswered and has_solution filters after aggregates
    if unanswered:
        items = [it for it in items if int(it.get("answers_count", 0)) == 0]
    if has_solution:
        items = [it for it in items if int(it.get("solutions_count", 0)) > 0]

    # Sort and return
    if v == "personalised":
        items.sort(key=lambda x: (x.get("score", 0.0), x.get("created_at", "")), reverse=True)
    else:
        # pulse: sort by popularity proxy -> our score already equals popularity in this mode
        items.sort(key=lambda x: (x.get("score", 0.0), x.get("created_at", "")), reverse=True)

    return {"posts": items}


# ----------------------
# User search + Tag suggestion/expansion endpoints
# ----------------------
@router.get("/users/search", response_model=List[UserSearchResult])
def users_search(q: str, limit: int = 10, user=Depends(get_current_user)):
    """
    Search users by username or email (case-insensitive). Returns up to `limit`.
    """
    sb = get_supabase()
    q = (q or "").strip()
    if not q:
        return []
    # Two simple queries; merge/dedupe in Python to avoid fragile OR filters
    try:
        by_username = (
            sb.table("users")
            .select("id,username,email")
            .ilike("username", f"%{q}%")
            .limit(limit)
            .execute()
        ).data or []
    except Exception:
        by_username = []
    try:
        by_email = (
            sb.table("users")
            .select("id,username,email")
            .ilike("email", f"%{q}%")
            .limit(limit)
            .execute()
        ).data or []
    except Exception:
        by_email = []
    seen: Set[str] = set()
    out: List[Dict[str, Any]] = []
    for row in by_username + by_email:
        uid = row.get("id")
        if not uid or uid in seen:
            continue
        seen.add(uid)
        out.append({"id": uid, "username": row.get("username"), "email": row.get("email")})
        if len(out) >= max(1, int(limit)):
            break
    return out

@router.get("/tags/suggest")
def suggest_tags(q: str, user=Depends(get_current_user)) -> Dict[str, Any]:
    """
    Suggest tags for a query/title/content. Uses Groq when available, with deterministic fallback.
    """
    seed = _sanitize_tags([w for w in (q or "").replace("#", " ").replace(",", " ").split()])
    try:
        from backend.core.groq_client import get_groq_service  # lazy import
        svc = get_groq_service()
        prompt = (
            "Extract up to 8 short, lowercase tags (single or hyphenated words) from this text. "
            "Return ONLY a JSON array of strings, no prose: " + q
        )
        tags = svc.simple_json_array(prompt)
        return {"tags": _sanitize_tags(list(tags or []) + seed)[:MAX_TAGS_PER_POST]}
    except Exception:
        # Fallback: return top unique words (simple heuristic) plus similarity expansion
        base = seed[:]
        base = [t for t in base if len(t) >= 3]
        base = base[:MAX_TAGS_PER_POST]
        return {"tags": base}

@router.get("/tags/similar")
def similar_tags(tags: str, user=Depends(get_current_user)) -> Dict[str, Any]:
    """
    Expand a list of tags with similar ones. Uses Groq when available, with fallback map.
    """
    base = set(_sanitize_tags(tags.replace(";", ",").split(",")))
    if not base:
        return {"tags": []}
    try:
        from backend.core.groq_client import get_groq_service  # lazy import
        svc = get_groq_service()
        prompt = (
            "Given tags [" + ", ".join(sorted(base)) + "], list 5-10 closely related tags "
            "as a pure JSON array of lowercase strings."
        )
        ai = svc.simple_json_array(prompt)
        merged = _sanitize_tags(list(base) + list(ai or []))
        return {"tags": merged[:MAX_TAGS_PER_POST]}
    except Exception:
        merged = _sanitize_tags(list(base) + _similar_tags_fallback(base))
        return {"tags": merged[:MAX_TAGS_PER_POST]}

@router.post("/friend-invite", response_model=FriendRequestOut)
def invite_friend(payload: FriendInviteRequest, user=Depends(get_current_user)):
    """
    Invite a friend by user_id OR username OR email.
    """
    sb = get_supabase()
    try:
        target_uid = _resolve_user_id(
            sb,
            current_user_id=user["user_id"],
            target_user_id=getattr(payload, "target_user_id", None),
            username=getattr(payload, "username", None),
            email=getattr(payload, "email", None),
        )
        res = sb.table("friendships").insert(
            {"requester_id": user["user_id"], "addressee_id": target_uid}
        ).execute()
        return (res.data or [None])[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error inviting friend: {e}")


@router.get("/friend-requests", response_model=List[FriendRequestOut])
def list_friend_requests(user=Depends(get_current_user)):
    sb = get_supabase()
    try:
        res = (
            sb.table("friendships")
            .select("*")
            .eq("addressee_id", user["user_id"])
            .eq("status", "pending")
            .order("created_at", desc=False)
            .execute()
        )
        return res.data or []
    except Exception:
        # If friendships table isn't present, return empty list instead of 500
        return []


@router.post("/friend-action", response_model=FriendRequestOut)
def respond_friend_invite(payload: FriendActionRequest, user=Depends(get_current_user)):
    """
    Accept or reject a friend invite addressed to the current user.
    """
    if payload.action not in ("accepted", "rejected"):
        raise HTTPException(status_code=400, detail="action must be 'accepted' or 'rejected'")
    sb = get_supabase()
    upd = (
        sb.table("friendships")
        .update({"status": payload.action})
        .eq("id", payload.request_id)
        .eq("addressee_id", user["user_id"])
        .execute()
    )
    return (upd.data or [None])[0]


@router.get("/friends", response_model=List[FriendshipSummary])
def list_friends(user=Depends(get_current_user)):
    """
    Return a list of accepted friendships (both directions), without relying on PostgREST 'or' syntax.
    """
    sb = get_supabase()
    uid = user["user_id"]
    try:
        # Query both sides separately to avoid PostgREST 'or' filter quirks
        req = (
            sb.table("friendships")
            .select("*")
            .eq("requester_id", uid)
            .eq("status", "accepted")
            .execute()
        ).data or []
        add = (
            sb.table("friendships")
            .select("*")
            .eq("addressee_id", uid)
            .eq("status", "accepted")
            .execute()
        ).data or []
        rows = req + add
    except Exception:
        return []

    # Enrich with usernames
    ids: List[str] = []
    for r in rows:
        fid = r["addressee_id"] if r.get("requester_id") == uid else r.get("requester_id")
        if fid:
            ids.append(fid)
    name_map = _get_usernames(sb, ids)

    friends: List[FriendshipSummary] = []
    for r in rows:
        fid = r["addressee_id"] if r.get("requester_id") == uid else r.get("requester_id")
        if fid:
            friends.append({
                "friend_id": fid,
                "friend_username": name_map.get(fid),
                "status": r.get("status", "accepted"),
            })
    return friends


def _friendship_accepted(sb, uid: str, other: str) -> bool:
    """
    Check accepted friendship in either direction using two simple queries.
    """
    try:
        a = (
            sb.table("friendships")
            .select("id,status")
            .eq("requester_id", uid)
            .eq("addressee_id", other)
            .eq("status", "accepted")
            .execute()
        ).data
        if a:
            return True
        b = (
            sb.table("friendships")
            .select("id,status")
            .eq("requester_id", other)
            .eq("addressee_id", uid)
            .eq("status", "accepted")
            .execute()
        ).data
        return bool(b)
    except Exception:
        # If table doesn't exist, treat as not friends
        return False


@router.post("/messages", response_model=MessageOut)
def send_message(payload: MessageCreate, user=Depends(get_current_user)):
    sb = get_supabase()
    if not _friendship_accepted(sb, user["user_id"], payload.recipient_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Friendship not accepted")
    try:
        res = (
            sb.table("messages")
            .insert(
                {
                    "sender_id": user["user_id"],
                    "recipient_id": payload.recipient_id,
                    "content": payload.content,
                }
            )
            .execute()
        )
        return (res.data or [None])[0]
    except Exception as e:
        # Graceful handling when schema hasn't been applied yet
        emsg = str(getattr(e, "message", "")) or str(e)
        if "messages" in emsg or "schema cache" in emsg or "PGRST205" in emsg:
            logger.error(f"messages table missing; cannot send DM: {emsg}")
            raise HTTPException(
                status_code=status.HTTP_501_NOT_IMPLEMENTED,
                detail="Direct messaging schema is missing. Apply backend/db/001_init.sql in your Supabase project to create 'public.messages'."
            )
        raise


@router.get("/threads/{friend_id}", response_model=ThreadOut)
def get_thread(friend_id: str, user=Depends(get_current_user)):
    """
    Return a DM thread between the current user and friend_id.

    Avoid PostgREST 'or' logic tree pitfalls by fetching both directions separately
    and merging in Python. This preserves API shape without changing schemas.
    """
    sb = get_supabase()
    uid = user["user_id"]
    logger.info(f"get_thread enter uid={uid} friend_id={friend_id}")
    if not _friendship_accepted(sb, uid, friend_id):
        logger.warning(f"get_thread blocked: friendship not accepted uid={uid} friend_id={friend_id}")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Friendship not accepted")

    try:
        # messages sent by current user to friend
        out_a = (
            sb.table("messages")
            .select("*")
            .eq("sender_id", uid)
            .eq("recipient_id", friend_id)
            .order("created_at", desc=False)
            .execute()
        ).data or []
    except Exception:
        out_a = []

    try:
        # messages sent by friend to current user
        out_b = (
            sb.table("messages")
            .select("*")
            .eq("sender_id", friend_id)
            .eq("recipient_id", uid)
            .order("created_at", desc=False)
            .execute()
        ).data or []
    except Exception:
        out_b = []

    msgs = (out_a + out_b)
    # sort ascending by created_at to form timeline
    try:
        msgs.sort(key=lambda m: m.get("created_at", ""))
    except Exception:
        pass

    friend_name = _get_username(sb, friend_id)
    try:
        logger.info(f"get_thread ok uid={uid} friend_id={friend_id} msgs={len(msgs)}")
    except Exception:
        pass
    return {"friend_id": friend_id, "friend_username": friend_name, "messages": msgs}


@router.post("/answers", response_model=AnswerOut)
def create_answer(payload: AnswerCreate, user=Depends(get_current_user)) -> Dict[str, Any]:
    """
    Create a new answer in the answers table for a given post_id.
    """
    sb = get_supabase()
    try:
        # Ensure post exists
        post_check = sb.table("posts").select("id").eq("id", payload.post_id).single().execute()
        if not post_check.data:
            raise HTTPException(status_code=404, detail="Post not found")

        res = sb.table("answers").insert(
            {
                "post_id": payload.post_id,
                "user_id": user["user_id"],
                "content": payload.content,
                "is_helpful_solution": False,
            }
        ).execute()
        if not res.data:
            raise HTTPException(status_code=500, detail="Failed to create answer")
        return res.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating answer: {e}")


@router.put("/answers/{answer_id}/mark-solution", response_model=AnswerOut)
def mark_answer_as_solution(answer_id: int, user=Depends(get_current_user)) -> Dict[str, Any]:
    """
    Sets is_helpful_solution to true for the specified answer and increments
    the answer author's reputation_score by 10.
    Only the author of the post may mark an answer as a helpful solution.
    """
    sb = get_supabase()
    try:
        # 1) Load the answer
        ans_res = sb.table("answers").select("*").eq("id", answer_id).single().execute()
        answer = ans_res.data
        if not answer:
            raise HTTPException(status_code=404, detail="Answer not found")

        # 2) Load the related post to verify permission
        post_id = answer.get("post_id")
        post_res = sb.table("posts").select("*").eq("id", post_id).single().execute()
        post = post_res.data
        if not post:
            raise HTTPException(status_code=404, detail="Related post not found")

        # Only post author can mark helpful
        if post.get("user_id") != user["user_id"]:
            raise HTTPException(status_code=403, detail="Only the post author can mark a solution")

        # 3) Mark the answer as helpful solution
        upd_res = (
            sb.table("answers")
            .update({"is_helpful_solution": True})
            .eq("id", answer_id)
            .execute()
        )
        updated_answer = upd_res.data[0] if upd_res.data else None
        if not updated_answer:
            raise HTTPException(status_code=500, detail="Failed to mark answer as solution")

        # 4) Increment reputation of the answer's author by 10
        author_id = answer.get("user_id")
        prof_res = sb.table("users").select("reputation_score").eq("id", author_id).single().execute()
        current_score = (prof_res.data or {}).get("reputation_score", 0)
        new_score = int(current_score) + 10
        sb.table("users").update({"reputation_score": new_score}).eq("id", author_id).execute()

        return updated_answer
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error marking solution: {e}")

# ====================
# Voting Endpoints
# ====================
@router.post("/posts/{post_id}/vote", response_model=VoteSummary)
def vote_post(post_id: int, payload: VoteRequest, user=Depends(get_current_user)) -> Dict[str, int]:
    sb = get_supabase()
    uid = user["user_id"]
    try:
        v = None if payload is None else payload.vote
        if v in (None, 0):
            # remove vote
            try:
                sb.table("post_votes").delete().eq("post_id", post_id).eq("user_id", uid).execute()
            except Exception:
                pass
        else:
            v = 1 if int(v) > 0 else -1
            sb.table("post_votes").upsert(
                {"post_id": post_id, "user_id": uid, "vote": v},
                on_conflict="post_id,user_id",
            ).execute()
        summary = _vote_summary_for_post(sb, post_id)
        # Disputed penalty: apply -5 to author once when a post first becomes disputed
        try:
            is_disputed = (summary["total"] >= 10) and (summary["downvotes"] > summary["upvotes"])
            if is_disputed:
                p = sb.table("posts").select("user_id,disputed_penalized").eq("id", post_id).single().execute().data or {}
                if p and not bool(p.get("disputed_penalized", False)) and p.get("user_id"):
                    prof = sb.table("users").select("reputation_score").eq("id", p["user_id"]).single().execute().data or {}
                    curr = int(prof.get("reputation_score", 0))
                    sb.table("users").update({"reputation_score": curr - 5}).eq("id", p["user_id"]).execute()
                    sb.table("posts").update({"disputed_penalized": True}).eq("id", post_id).execute()
        except Exception:
            # Do not block vote result if penalty bookkeeping fails
            pass

        return {"upvotes": summary["upvotes"], "downvotes": summary["downvotes"], "total": summary["total"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error voting on post: {e}")

@router.get("/posts/{post_id}/votes", response_model=VoteSummary)
def get_post_votes(post_id: int, user=Depends(get_current_user)) -> Dict[str, int]:
    sb = get_supabase()
    s = _vote_summary_for_post(sb, post_id)
    return {"upvotes": s["upvotes"], "downvotes": s["downvotes"], "total": s["total"]}

@router.post("/answers/{answer_id}/vote", response_model=VoteSummary)
def vote_answer(answer_id: int, payload: VoteRequest, user=Depends(get_current_user)) -> Dict[str, int]:
    sb = get_supabase()
    uid = user["user_id"]
    try:
        v = None if payload is None else payload.vote
        if v in (None, 0):
            try:
                sb.table("answer_votes").delete().eq("answer_id", answer_id).eq("user_id", uid).execute()
            except Exception:
                pass
        else:
            v = 1 if int(v) > 0 else -1
            sb.table("answer_votes").upsert(
                {"answer_id": answer_id, "user_id": uid, "vote": v},
                on_conflict="answer_id,user_id",
            ).execute()
        summary = _vote_summary_for_answer(sb, answer_id)
        return {"upvotes": summary["upvotes"], "downvotes": summary["downvotes"], "total": summary["total"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error voting on answer: {e}")

@router.get("/answers/{answer_id}/votes", response_model=VoteSummary)
def get_answer_votes(answer_id: int, user=Depends(get_current_user)) -> Dict[str, int]:
    sb = get_supabase()
    s = _vote_summary_for_answer(sb, answer_id)
    return {"upvotes": s["upvotes"], "downvotes": s["downvotes"], "total": s["total"]}

# ====================
# Flagging Endpoints
# ====================
@router.post("/posts/{post_id}/flag")
def flag_post(post_id: int, payload: FlagRequest, user=Depends(get_current_user)) -> Dict[str, Any]:
    sb = get_supabase()
    try:
        sb.table("post_flags").upsert(
            {"post_id": post_id, "user_id": user["user_id"], "reason": getattr(payload, "reason", None)},
            on_conflict="post_id,user_id",
        ).execute()
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error flagging post: {e}")

@router.post("/answers/{answer_id}/flag")
def flag_answer(answer_id: int, payload: FlagRequest, user=Depends(get_current_user)) -> Dict[str, Any]:
    sb = get_supabase()
    try:
        sb.table("answer_flags").upsert(
            {"answer_id": answer_id, "user_id": user["user_id"], "reason": getattr(payload, "reason", None)},
            on_conflict="answer_id,user_id",
        ).execute()
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error flagging answer: {e}")

# ====================
# Community Notes
# ====================
@router.post("/notes", response_model=CommunityNoteOut)
def add_note(payload: CommunityNoteCreate, user=Depends(get_current_user)) -> Dict[str, Any]:
    if payload.entity_type not in ("post", "answer"):
        raise HTTPException(status_code=400, detail="entity_type must be 'post' or 'answer'")
    sb = get_supabase()
    try:
        res = sb.table("community_notes").insert(
            {
                "entity_type": payload.entity_type,
                "entity_id": payload.entity_id,
                "user_id": user["user_id"],
                "content": payload.content,
            }
        ).execute()
        return (res.data or [None])[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error adding note: {e}")

@router.get("/notes", response_model=List[CommunityNoteOut])
def list_notes(entity_type: str, entity_id: int, user=Depends(get_current_user)) -> List[Dict[str, Any]]:
    if entity_type not in ("post", "answer"):
        return []
    sb = get_supabase()
    try:
        res = (
            sb.table("community_notes")
            .select("*")
            .eq("entity_type", entity_type)
            .eq("entity_id", entity_id)
            .order("created_at", desc=False)
            .execute()
        )
        return res.data or []
    except Exception:
        return []

# ====================
# Lesson Completion
# ====================
@router.post("/lesson-completion", response_model=LessonCompletionOut)
def record_lesson_completion(payload: LessonCompletionCreate, user=Depends(get_current_user)) -> Dict[str, Any]:
    sb = get_supabase()
    try:
        kw = [str(k).strip().lower() for k in (payload.keywords or []) if isinstance(k, str)]
        kw = [k for k in kw if k]  # remove empties
        res = sb.table("user_lesson_completions").insert(
            {
                "user_id": user["user_id"],
                "course_title": payload.course_title,
                "module_title": payload.module_title,
                "keywords": kw[:20],
                "completed_at": payload.completed_at or None,
            }
        ).execute()
        return (res.data or [None])[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error recording lesson completion: {e}")