"""Exercise local setup without Docker, builds, servers, or provider calls."""
import importlib.util
import json
import subprocess
import urllib.error
from pathlib import Path
from types import SimpleNamespace

import pytest


ROOT = Path(__file__).resolve().parents[1]
FIXTURES = json.loads((ROOT / "test-app/server/group-chat-fixtures.json").read_text(encoding="utf-8"))
ENVIRONMENT = {"ULIBOT_SITE_HOST": "localhost", "ULIBOT_SITE_TOKEN": "test-only-token"}


@pytest.fixture
def workflow(monkeypatch):
    monkeypatch.syspath_prepend(str(ROOT))
    spec = importlib.util.spec_from_file_location("prepare_group_test", ROOT / "prepare_group_test.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    monkeypatch.setattr(module, "step", lambda text: None)
    monkeypatch.setattr(module.subprocess, "run", lambda *args, **kwargs: pytest.fail("Unexpected subprocess"))
    monkeypatch.setattr(module.subprocess, "Popen", lambda *args, **kwargs: pytest.fail("Unexpected server"))
    monkeypatch.setattr(module.webbrowser, "open_new_tab", lambda *args: pytest.fail("Unexpected browser"))
    monkeypatch.setattr(module, "request_json", lambda *args, **kwargs: pytest.fail("Unexpected network request"))
    monkeypatch.setattr(module, "prepare_stack", lambda: pytest.fail("Unexpected Docker preparation"))
    return module


def test_participants_share_a_room_and_inactive_members_are_excluded(workflow):
    fixtures = {"rooms": [{"groupid": "group & one"}], "members": [
        {"userid": "inactive", "active": False, "groups": ["group & one"]},
        {"userid": "user 1", "active": True, "groups": ["group & one"]},
        {"userid": "user 2", "active": True, "groups": ["group & one"]},
    ]}
    assert workflow.participant_urls(fixtures) == [
        "http://localhost:5174/groups?userid=user+1&groupid=group+%26+one",
        "http://localhost:5174/groups?userid=user+2&groupid=group+%26+one",
    ]
    fixtures["members"].pop()
    with pytest.raises(ValueError, match="two active participants"):
        workflow.participant_urls(fixtures)


@pytest.mark.parametrize("missing", [False, True])
def test_group_mapping_reuses_active_assistant_without_reseeding(workflow, monkeypatch, missing):
    writes = []
    def request(url, *, headers, body=None):
        assert headers["api-token"] == ENVIRONMENT["ULIBOT_SITE_TOKEN"]
        assert headers["x-client-host"] == "localhost"
        if body is not None:
            writes.append((url, body))
            return {"id": 6}
        if "/assistants/" in url:
            return {"id": 6, "type": "openairesponses"}
        if "context=general" in url:
            assert missing, "An existing group mapping must not be replaced with the general assistant"
            return {"id": 6}
        if missing:
            raise urllib.error.HTTPError(url, 404, "missing mapping", {}, None)
        return {"id": 6}
    monkeypatch.setattr(workflow, "request_json", request)

    workflow.ensure_group_contexts(ENVIRONMENT, FIXTURES)

    assert writes == ([(f"{workflow.API_URL}/assistant/6/site",
                       {"context": "course", "contextinstance": "uli-local-groups"})] if missing else [])


def test_auth_failure_does_not_attempt_mapping_writes(workflow, monkeypatch):
    calls = []
    def request(url, **kwargs):
        calls.append(url)
        assert kwargs.get("body") is None
        raise urllib.error.HTTPError(url, 401, "invalid token", {}, None)
    monkeypatch.setattr(workflow, "request_json", request)
    with pytest.raises(urllib.error.HTTPError):
        workflow.ensure_group_contexts(ENVIRONMENT, FIXTURES)
    assert len(calls) == 1


def test_unsupported_assistant_is_left_unchanged(workflow, monkeypatch):
    def request(url, **kwargs):
        assert kwargs.get("body") is None
        return {"id": 6, "type": "unsupported-runtime"}
    monkeypatch.setattr(workflow, "request_json", request)
    with pytest.raises(ValueError, match="configuration was left unchanged"):
        workflow.ensure_group_contexts(ENVIRONMENT, FIXTURES)


def test_running_test_app_is_reused(workflow, monkeypatch):
    opened = []
    monkeypatch.setattr(workflow, "group_server_ready", lambda: True)
    monkeypatch.setattr(workflow.webbrowser, "open_new_tab", opened.append)
    urls = workflow.participant_urls(FIXTURES)
    workflow.serve_groups("node", Path("vite.js"), urls)
    assert opened == urls


def test_server_startup_failure_stops_owned_process_without_opening_browser(workflow, monkeypatch):
    ready = iter([False, False])
    stopped = []
    process = SimpleNamespace(poll=lambda: None, terminate=lambda: stopped.append("terminated"), wait=lambda: stopped.append("waited"))
    monkeypatch.setattr(workflow, "group_server_ready", lambda: next(ready))
    monkeypatch.setattr(workflow.subprocess, "Popen", lambda *args, **kwargs: process)
    monkeypatch.setattr(workflow.time, "monotonic", iter([0, 181]).__next__)
    with pytest.raises(ValueError, match="did not become ready"):
        workflow.serve_groups("node", Path("vite.js"), workflow.participant_urls(FIXTURES))
    assert stopped == ["terminated", "waited"]


@pytest.mark.parametrize("docker_ready", [False, True])
def test_preparation_checks_docker_before_mutations_then_maps_before_serving(workflow, monkeypatch, tmp_path, docker_ready):
    events = []
    seed = workflow.load_seed_module()
    monkeypatch.setattr(seed, "parse_env", lambda path: dict(ENVIRONMENT))
    monkeypatch.setattr(workflow, "load_seed_module", lambda: seed)
    monkeypatch.setattr(workflow.shutil, "which", lambda name: name)
    vite = tmp_path / "node_modules/vite/bin/vite.js"
    vite.parent.mkdir(parents=True)
    vite.write_text("", encoding="utf-8")
    monkeypatch.setattr(workflow, "TEST_APP", tmp_path)
    def docker(command, **kwargs):
        assert command == ["docker", "info"]
        events.append("docker")
        if not docker_ready:
            raise subprocess.CalledProcessError(1, command)
    monkeypatch.setattr(workflow.subprocess, "run", docker)
    monkeypatch.setattr(workflow, "prepare_stack", lambda: events.append("prepare"))
    monkeypatch.setattr(workflow, "ensure_group_contexts", lambda *args: events.append("map"))
    monkeypatch.setattr(workflow, "serve_groups", lambda *args: events.append("serve"))
    if docker_ready:
        workflow.main()
        assert events == ["docker", "prepare", "map", "serve"]
    else:
        with pytest.raises(SystemExit, match="Open Docker Desktop"):
            workflow.main()
        assert events == ["docker"]
