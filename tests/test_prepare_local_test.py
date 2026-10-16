"""Verify button startup ordering and failures without running Docker or builds."""
import importlib.util
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture
def workflow(monkeypatch):
    monkeypatch.syspath_prepend(str(ROOT))
    spec = importlib.util.spec_from_file_location("prepare_local_test", ROOT / "prepare_local_test.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    monkeypatch.setattr(module, "step", lambda text: None)
    return module


def test_button_preserves_existing_databases_and_opens_moodle_after_preparation(workflow, monkeypatch):
    events = []
    monkeypatch.setattr(workflow, "dc_checked", lambda *args: events.append(args))
    monkeypatch.setattr(workflow, "wait_for_api", lambda: events.append("backend-ready"))
    monkeypatch.setattr(workflow, "wait_for_moodle", lambda: events.append("moodle-ready"))
    monkeypatch.setattr(workflow.webbrowser, "open", lambda url: events.append(url))

    workflow.main()

    assert events[0] == ("start", "--wait", "backdb", "moodledb", "clickhouse")
    assert events[1] == ("restart", "--no-deps", "ulibotback")
    assert events.index("backend-ready") < events.index(("start", "moodle"))
    assert events[-2] == ("up", "--wait", "--build", "--no-deps", "ulibotfront")
    assert events[-1] == "http://localhost:8080"
    commands = [event for event in events if isinstance(event, tuple)]
    assert all(command[0] not in {"down", "rm", "build"} for command in commands)
    assert all("-v" not in command and "seed" not in " ".join(command) for command in commands)


@pytest.mark.parametrize("failure", ["database", "backend", "frontend"])
def test_preparation_failure_stops_before_opening_browser(workflow, monkeypatch, failure):
    events = []
    def compose(*args):
        events.append(args)
        if (failure == "database" and args[0] == "start") or (failure == "frontend" and args[0] == "up"):
            raise SystemExit(1)
    def backend_ready():
        if failure == "backend":
            raise SystemExit(1)

    monkeypatch.setattr(workflow, "dc_checked", compose)
    monkeypatch.setattr(workflow, "wait_for_api", backend_ready)
    monkeypatch.setattr(workflow, "wait_for_moodle", lambda: None)
    monkeypatch.setattr(workflow.webbrowser, "open", lambda url: pytest.fail("Opened browser before preparation succeeded"))

    with pytest.raises(SystemExit):
        workflow.main()
    if failure != "frontend":
        assert not any(event[0] == "up" for event in events)
