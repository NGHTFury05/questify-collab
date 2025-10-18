from __future__ import annotations

from typing import Any, Optional, Dict

from fastapi import APIRouter, HTTPException, status
from backend.core.database import get_supabase
from backend.models.schemas import SignupRequest, LoginRequest, AuthResponse, UserInfo, RefreshRequest

router = APIRouter()


def _get(obj: Any, key: str, default: Any = None) -> Any:
    """
    Helper to safely extract attributes or dict keys from Supabase responses,
    supporting both object attributes and dict-like access.
    """
    if obj is None:
        return default
    if hasattr(obj, key):
        return getattr(obj, key, default)
    if isinstance(obj, dict):
        return obj.get(key, default)
    return default


def _exc_to_dict(e: Exception) -> Dict[str, Any]:
    """
    Normalize exceptions (from Supabase client or otherwise) into a loggable/serializable dict.
    """
    return {
        "type": e.__class__.__name__,
        "message": str(e),
        "code": getattr(e, "code", None),
        "status": getattr(e, "status", None),
        "error": getattr(e, "error", None),
        "hint": getattr(e, "hint", None),
        "details": getattr(e, "details", None),
    }


@router.post("/signup", response_model=AuthResponse)
def signup(payload: SignupRequest) -> AuthResponse:
    """
    Register a new user. First try standard sign_up. If that fails (e.g., password policy or email confirmation flow),
    fall back to admin.create_user using the service role and then sign in to mint a session token.
    Always upsert a row into public.users.

    Enhanced logging: surfaces Supabase error codes, hints, and details to help diagnose
    issues like "User not allowed" (disabled signups or restricted domains).
    """
    sb = get_supabase()

    debug: Dict[str, Any] = {}

    user_id: Optional[str] = None
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    user = None
    resp = None

    # 1) Attempt standard sign_up
    try:
        resp = sb.auth.sign_up({"email": payload.email, "password": payload.password})
        user = _get(resp, "user")
        user_id = _get(user, "id")
        session = _get(resp, "session")
        access_token = _get(session, "access_token") if session else None
        refresh_token = _get(session, "refresh_token") if session else None
        debug["sign_up_resp_has_session"] = bool(session)
    except Exception as e:
        # Capture detailed error info; we'll attempt admin fallback next
        debug["sign_up_error"] = _exc_to_dict(e)
        user = None
        user_id = None

    # 2) Fallback: admin create_user + sign in (useful for local/dev setups)
    if not user_id:
        try:
            admin_res = sb.auth.admin.create_user(
                {
                    "email": payload.email,
                    "password": payload.password,
                    "email_confirm": True,  # mark as confirmed for local/dev
                }
            )
            admin_user = _get(admin_res, "user")
            user_id = _get(admin_user, "id")

            # Try to issue a session token for the new user so the frontend can proceed seamlessly
            try:
                login_res = sb.auth.sign_in_with_password({"email": payload.email, "password": payload.password})
                session = _get(login_res, "session")
                access_token = _get(session, "access_token") if session else None
                refresh_token = _get(session, "refresh_token") if session else None
            except Exception as e:
                debug["post_admin_login_error"] = _exc_to_dict(e)
                access_token = None
        except Exception as e:
            # Surface explicit reason from Supabase (e.g., signups disabled, restricted domain)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "message": "Signup failed in admin fallback",
                    "debug": _exc_to_dict(e),
                },
            )

    if not user_id:
        # Common reasons: Email signups disabled or domain restriction enabled in Supabase
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": "Signup not allowed by authentication settings (check Supabase Auth: Email provider ‘Allow email signups’ and ‘Allowed domains’).",
                "debug": debug,
            },
        )

    # 3) Upsert into public.users (profile + reputation)
    try:
        sb.table("users").upsert(
            {
                "id": user_id,
                "username": payload.username,
                "email": payload.email,
                "reputation_score": 0,
            },
            on_conflict="id",
        ).execute()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"message": "Failed to create user profile", "error": _exc_to_dict(e)},
        )

    return AuthResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserInfo(
            id=user_id,
            email=payload.email,
            username=payload.username,
            reputation_score=0,
        ),
        message=None
        if access_token
        else "Signup successful. Check your email to confirm the account, then log in.",
    )


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest) -> AuthResponse:
    """
    Sign in via Supabase Auth and return a bearer token. Also returns user profile from public.users.
    """
    sb = get_supabase()
    try:
        resp = sb.auth.sign_in_with_password({"email": payload.email, "password": payload.password})
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Login failed: {e}")

    session = _get(resp, "session")
    if session is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Login failed: no session returned")

    access_token = _get(session, "access_token")
    refresh_token = _get(session, "refresh_token")
    if not access_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Login failed: missing access token")

    user = _get(resp, "user")
    user_id = _get(user, "id")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Login failed: user not found")

    # Fetch profile from public.users
    try:
        prof_res = sb.table("users").select("*").eq("id", user_id).single().execute()
        profile = prof_res.data or {}
    except Exception:
        profile = {}

    return AuthResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserInfo(
            id=user_id,
            email=_get(user, "email") or _get(profile, "email"),
            username=_get(profile, "username"),
            reputation_score=_get(profile, "reputation_score", 0),
        ),
    )

@router.post("/refresh", response_model=AuthResponse)
def refresh(payload: RefreshRequest) -> AuthResponse:
    """
    Exchange a refresh_token for a new access_token (and possibly a new refresh_token).
    Unprotected route; do NOT require bearer auth here.
    """
    sb = get_supabase()
    try:
        # Supabase python client may accept either a dict or positional arg depending on version.
        try:
            resp = sb.auth.refresh_session({"refresh_token": payload.refresh_token})  # type: ignore[arg-type]
        except Exception:
            resp = sb.auth.refresh_session(payload.refresh_token)  # type: ignore[arg-type]
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Refresh failed: {e}")

    session = _get(resp, "session") or _get(_get(resp, "data"), "session")
    access_token = _get(session, "access_token")
    new_refresh_token = _get(session, "refresh_token") or payload.refresh_token

    if not access_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh failed: no session returned")

    # We don't fetch user profile here; caller should already have user cached.
    return AuthResponse(access_token=access_token, refresh_token=new_refresh_token)