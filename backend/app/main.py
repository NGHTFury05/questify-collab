from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
# Ensure 'backend' package is importable whether launched from repo root or backend/
from pathlib import Path as _Path
import sys as _sys
_HERE = _Path(__file__).resolve()
_BACKEND_DIR = _HERE.parents[1]
_REPO_ROOT = _BACKEND_DIR.parent
if str(_REPO_ROOT) not in _sys.path:
    _sys.path.insert(0, str(_REPO_ROOT))

from backend.routes import auth, ai, community
from backend.core.config import get_settings
import logging

settings = get_settings()
app = FastAPI(title=settings.API_NAME, version=settings.API_VERSION)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request logging middleware to trace Authorization header end-to-end
@app.middleware("http")
async def log_request_headers(request: Request, call_next):
    auth = request.headers.get("authorization")
    if auth:
        parts = auth.split()
        if len(parts) >= 2:
            token = parts[1]
            redacted = f"{parts[0]} {token[:5]}...{token[-5:]}" if len(token) > 10 else f"{parts[0]} {token}"
        else:
            redacted = auth
        logging.info(f"REQ {request.method} {request.url.path} Authorization={redacted}")
    else:
        logging.info(f"REQ {request.method} {request.url.path} Authorization=<missing>")
    response = await call_next(request)
    return response

# Debug endpoint to echo incoming headers (for diagnosis)
@app.get("/debug/headers")
async def debug_headers(request: Request):
    return {
        "method": request.method,
        "path": str(request.url),
        "headers": dict(request.headers),
    }

# Simple health check (idempotent)
@app.get("/health")
def health():
    return {"ok": True}

# Routers
app.include_router(auth.router, prefix="/auth", tags=["Authentication"])
app.include_router(ai.router, prefix="/ai", tags=["AI Features"])
app.include_router(community.router, prefix="/community", tags=["Community"])

@app.get("/")
def root():
    return {"message": "Questify Collab Backend is running successfully!"}
