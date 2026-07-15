#!/usr/bin/env python3
"""
Backend API contract test — runs from the HOST against the live stack (run `python up.py` first).

Self-contained: stdlib only, no third-party deps, no changes to the backend repo. Works both as a
plain script and under pytest.

    python tests/api/test_context_assistant.py
    # or:  pytest tests/api

The "valid JWT" case needs the seeded site token; it is read from ULIBOT_SITE_TOKEN or ../.env
(otherwise skipped).
"""

import base64
import hashlib
import hmac
import json
import os
import time
import urllib.parse
import urllib.request

BASE = os.environ.get("ULIBOT_BACK_URL", "http://localhost:8000")
ENV_PATH = os.path.join(os.path.dirname(__file__), "..", "..", ".env")


def _get(params: dict):
    url = BASE + "/ulibot/context/assistant?" + urllib.parse.urlencode(params)
    with urllib.request.urlopen(url, timeout=10) as resp:
        return resp.status, json.load(resp)


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _jwt_hs256(payload: dict, secret: str) -> str:
    seg = _b64(json.dumps({"alg": "HS256", "typ": "JWT"}).encode()) + "." + _b64(json.dumps(payload).encode())
    sig = hmac.new(secret.encode(), seg.encode(), hashlib.sha256).digest()
    return seg + "." + _b64(sig)


def _site_token():
    tok = os.environ.get("ULIBOT_SITE_TOKEN")
    if tok:
        return tok.strip()
    try:
        for line in open(ENV_PATH, encoding="utf-8"):
            line = line.strip()
            if line.startswith("ULIBOT_SITE_TOKEN="):
                return line.split("=", 1)[1].strip().strip('"').strip("'") or None
    except OSError:
        pass
    return None


def test_rejects_garbage_token():
    status, body = _get({"context": "general", "contextinstance": "general",
                         "token": "not-a-jwt", "host": "localhost"})
    assert status == 200
    assert body.get("status") == "empty", body


def test_accepts_valid_jwt():
    secret = _site_token()
    if not secret:
        print("SKIP test_accepts_valid_jwt: set ULIBOT_SITE_TOKEN (or fill ../.env)")
        return
    token = _jwt_hs256(
        {"host": "localhost", "iat": int(time.time()), "exp": int(time.time()) + 3600},
        secret,
    )
    status, body = _get({"context": "general", "contextinstance": "general",
                         "token": token, "host": "localhost"})
    assert status == 200
    assert body.get("status") == "success", body
    assert body.get("id") is not None


if __name__ == "__main__":
    test_rejects_garbage_token()
    print("PASS rejects_garbage_token")
    test_accepts_valid_jwt()
    print("PASS accepts_valid_jwt (or skipped)")
