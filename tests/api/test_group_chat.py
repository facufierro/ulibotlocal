"""Real local HTTP/MySQL contracts; no AI calls, resets, or personal-chat writes."""
import concurrent.futures
import json
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

import pytest

from test_context_assistant import BASE, _jwt_hs256, _site_token

FIXTURES = json.loads((Path(__file__).resolve().parents[2] / "test-app" / "server" /
                       "group-chat-fixtures.json").read_text(encoding="utf-8"))


class LocalGroupAPI:
    def __init__(self, secret):
        self.secret = secret

    def claims(self, member_index=0, room_index=0):
        member = FIXTURES["members"][member_index]
        room = FIXTURES["rooms"][room_index]
        assert member["active"] and room["groupid"] in member["groups"]
        now = int(time.time())
        return {"iss": "moodle", "host": "localhost", "iat": now, "exp": now + 60,
                "userid": member["userid"], "name": member["name"],
                "group_chat": {"version": 1, **room}}

    def request(self, *, member=0, room=0, body=None, after=0, claims=None):
        payload = self.claims(member, room) if claims is None else claims
        url = BASE.rstrip("/") + "/ulibot/api/v1/group-chat/messages"
        data = json.dumps(body).encode() if body is not None else None
        if data is None:
            url += "?" + urllib.parse.urlencode({"after": after})
        request = urllib.request.Request(url, data=data, headers={
            "api-token": _jwt_hs256(payload, self.secret), "x-client-host": "localhost",
            "Content-Type": "application/json",
        })
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                return response.status, json.load(response)
        except urllib.error.HTTPError as response:
            return response.code, json.load(response)

    def transcript(self, member=0, room=0):
        sequence = 0
        messages = []
        while True:
            status, page = self.request(member=member, room=room, after=sequence)
            assert status == 200, page
            messages.extend(page["messages"])
            sequence = page["next_sequence"]
            if not page["has_more"]:
                return messages


@pytest.fixture(scope="module")
def api():
    target = urllib.parse.urlsplit(BASE)
    assert target.scheme == "http" and target.hostname == "localhost" and target.port == 8000, (
        "Group integration tests write messages and may only target http://localhost:8000"
    )
    secret = _site_token()
    if not secret:
        pytest.skip("Configure the seeded ULIBOT_SITE_TOKEN in ulibotlocal/.env")
    return LocalGroupAPI(secret)


def message(content="Local integration discussion"):
    return {"message_id": str(uuid.uuid4()), "content": content}


def test_two_users_share_a_transcript_but_another_group_does_not(api):
    outgoing = message()
    status, saved = api.request(body=outgoing)
    assert status == 200, saved
    assert saved["message"]["sender_id"] == FIXTURES["members"][0]["userid"]
    shared = api.transcript(member=1)
    assert any(item["id"] == outgoing["message_id"] for item in shared)
    isolated = api.transcript(member=2, room=1)
    assert not any(item["id"] == outgoing["message_id"] for item in isolated)


def test_concurrent_publication_is_ordered_and_idempotent(api):
    duplicate = message("Idempotent local discussion")
    outgoing = [message(f"Concurrent discussion {index}") for index in range(10)]
    outgoing.extend([duplicate, duplicate])
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
        replies = list(executor.map(lambda body: api.request(body=body), outgoing))
    assert all(status == 200 for status, _ in replies), replies
    rows = api.transcript()
    sequences = [row["sequence"] for row in rows]
    assert sequences == sorted(set(sequences))
    ids = [row["id"] for row in rows]
    assert ids.count(duplicate["message_id"]) == 1
    assert all(ids.count(body["message_id"]) == 1 for body in outgoing)
    for (status, reply), body in zip(replies, outgoing):
        acknowledged = reply["message"]
        found = next(row for row in rows if row["id"] == body["message_id"])
        assert acknowledged == found


def test_idempotency_rejects_changed_sender_content_or_room(api):
    outgoing = message()
    assert api.request(body=outgoing)[0] == 200
    for options in [dict(body={**outgoing, "content": "Changed content"}),
                    dict(body=outgoing, member=1), dict(body=outgoing, member=1, room=1)]:
        status, failure = api.request(**options)
        assert status == 409
        assert failure["detail"]["code"] == "message_conflict"


def test_sender_and_room_are_verified_claims_not_body_fields(api):
    outgoing = {**message(), "sender_id": "impostor", "sender_name": "Impostor", "groupid": "9202"}
    status, saved = api.request(body=outgoing)
    assert status == 200, saved
    assert saved["message"]["sender_name"] == FIXTURES["members"][0]["name"]
    assert saved["message"]["sender_id"] == FIXTURES["members"][0]["userid"]
    assert not any(row["id"] == outgoing["message_id"] for row in api.transcript(member=2, room=1))


def test_group_access_requires_expiring_signed_membership(api):
    claims = api.claims()
    personal = {key: value for key, value in claims.items() if key != "group_chat"}
    assert api.request(claims=personal)[0] == 403
    assert api.request(claims={**claims, "iat": 1, "exp": 2})[0] == 401
    missing_expiration = {key: value for key, value in claims.items() if key != "exp"}
    assert api.request(claims=missing_expiration)[0] == 401


def test_blank_messages_are_rejected_without_publication(api):
    outgoing = message(" \n ")
    assert api.request(body=outgoing)[0] == 422
    assert not any(row["id"] == outgoing["message_id"] for row in api.transcript())
