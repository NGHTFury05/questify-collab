from typing import Dict, Any, Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt  # PyJWT
from .config import get_settings
import logging
from datetime import datetime, timezone


http_bearer = HTTPBearer(auto_error=False)


def decode_token(token: str) -> Dict[str, Any]:
    """
    Decode and verify a Supabase-issued JWT using SUPABASE_JWT_SECRET (HS256).
    Raises HTTP 401 on failure.
    """
    settings = get_settings()
    if not settings.SUPABASE_JWT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Server JWT secret not configured"
        )
    try:
        now = int(datetime.now(timezone.utc).timestamp())
        leeway = getattr(settings, "JWT_LEEWAY", 0)
        payload = jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            options={"verify_aud": False},  # Supabase tokens may not include 'aud'
            leeway=leeway,
        )
        exp = payload.get("exp")
        iat = payload.get("iat")
        logging.debug(f"JWT validated: now={now}, exp={exp}, iat={iat}, leeway={leeway}")
        return payload
    except jwt.ExpiredSignatureError:
        logging.info("JWT expired during decode_token")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except jwt.InvalidTokenError:
        logging.info("Invalid JWT during decode_token")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(http_bearer),
) -> Dict[str, Any]:
    """
    FastAPI dependency to authorize a request via Bearer token.
    Returns a dict with user_id, email, and role from token claims.
    Adds diagnostics logging for header presence and token shape.
    """
    if credentials is None:
        logging.info("Auth: credentials missing in get_current_user")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header",
        )

    scheme = (credentials.scheme or "")
    token = credentials.credentials or ""
    redacted = f"{scheme} {token[:5]}...{token[-5:]}" if token and len(token) > 10 else f"{scheme} {token}"
    logging.info(f"Auth: received Authorization={redacted}")

    if scheme.lower() != "bearer" or not token:
        logging.info(f"Auth: invalid scheme='{scheme}' or empty token")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header",
        )

    payload = decode_token(token)
    user_id = payload.get("sub") or payload.get("user_id")
    if not user_id:
        logging.info("Auth: decoded token missing subject (sub/user_id)")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token: missing subject")
    return {
        "user_id": user_id,
        "email": payload.get("email"),
        "role": payload.get("role"),
        "raw_claims": payload,
    }