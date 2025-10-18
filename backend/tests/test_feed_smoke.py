import os
import requests

def test_feed_smoke():
    base = os.environ.get("API_BASE_URL", "http://localhost:8000")
    # Unauthenticated feed endpoint returns 401 for protected routes, so we verify server responds
    r = requests.options(f"{base}/community/feed", timeout=10)
    assert r.status_code in (200, 204)