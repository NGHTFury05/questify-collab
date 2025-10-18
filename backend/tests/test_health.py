import os
import requests

def test_health():
    base = os.environ.get("API_BASE_URL", "http://localhost:8000")
    r = requests.get(f"{base}/health", timeout=10)
    assert r.status_code == 200
    assert r.json().get("ok") == True