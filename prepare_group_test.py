"""Prepare the existing stack and open two fixture participants in one group."""
import json
import shutil
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request
import webbrowser

from prepare_local_test import prepare_stack
from up import ENV_PATH, SCRIPT_DIR, load_seed_module, step


TEST_APP = SCRIPT_DIR / "test-app"
TEST_URL = "http://localhost:5174"
API_URL = "http://localhost:8000/ulibot/api/v1"


def request_json(url, *, headers=None, body=None):
    request = urllib.request.Request(
        url, headers=headers or {},
        data=json.dumps(body).encode() if body is not None else None,
    )
    with urllib.request.urlopen(request, timeout=10) as response:
        return json.load(response)


def participant_urls(fixtures):
    for room in fixtures["rooms"]:
        members = [member for member in fixtures["members"]
                   if member["active"] and room["groupid"] in member["groups"]]
        if len(members) >= 2:
            return [f"{TEST_URL}/groups?{urllib.parse.urlencode({'userid': member['userid'], 'groupid': room['groupid']})}"
                    for member in members[:2]]
    raise ValueError("The local group fixtures need two active participants in the same room.")


def ensure_group_contexts(environment, fixtures):
    headers = {"api-token": environment["ULIBOT_SITE_TOKEN"],
               "x-client-host": "localhost", "Content-Type": "application/json"}
    missing = []
    contexts = sorted({(room["context"], room["contextinstance"]) for room in fixtures["rooms"]})
    for context, instance in contexts:
        query = urllib.parse.urlencode({"context": context, "contextinstance": instance})
        try:
            mapping = request_json(f"{API_URL}/openai/assistant/id?{query}", headers=headers)
        except urllib.error.HTTPError as error:
            if error.code != 404:
                raise
            missing.append({"context": context, "contextinstance": instance})
            continue
        check_assistant(mapping["id"], headers)

    if missing:
        mapping = request_json(f"{API_URL}/openai/assistant/id?context=general&contextinstance=general", headers=headers)
        check_assistant(mapping["id"], headers)
        for context in missing:
            result = request_json(f"{API_URL}/assistant/{mapping['id']}/site", headers=headers, body=context)
            check_assistant(result["id"], headers)


def check_assistant(assistant_id, headers):
    assistant = request_json(f"{API_URL}/assistants/{assistant_id}", headers=headers)
    if assistant["type"] not in {"openairesponses", "langgraph"}:
        raise ValueError("The local group assistant must use Responses or LangGraph; its configuration was left unchanged.")


def group_server_ready():
    try:
        configuration = request_json(f"{TEST_URL}/__group-chat/config")
    except urllib.error.HTTPError as error:
        raise ValueError(f"The app on port 5174 returned HTTP {error.code}. Stop the existing Run Frontend terminal and try again.") from None
    except urllib.error.URLError:
        return False
    if not isinstance(configuration, dict) or not {"rooms", "members"} <= configuration.keys():
        raise ValueError("Port 5174 is serving another app. Stop it before starting the group test.")
    return True


def open_participants(urls):
    step("Group chat ready: two participants in the same room")
    print("Send a message in either tab, then ask @Uli. Replies use the configured AI provider.", flush=True)
    for url in urls:
        print(url, flush=True)
        webbrowser.open_new_tab(url)


def serve_groups(node, vite, urls):
    if group_server_ready():
        open_participants(urls)
        return
    step("Starting group test app; keep this terminal open and press Ctrl+C to stop it")
    process = subprocess.Popen([node, str(vite), "--host", "localhost", "--port", "5174", "--strictPort"], cwd=TEST_APP)
    try:
        deadline = time.monotonic() + 180
        while not group_server_ready():
            if process.poll() is not None:
                raise ValueError("The group test app stopped before it was ready. Check the Vite output above.")
            if time.monotonic() >= deadline:
                raise ValueError("The group test app did not become ready on port 5174. Check the Vite output above.")
            time.sleep(1)
        open_participants(urls)
        process.wait()
    finally:
        if process.poll() is None:
            process.terminate()
            process.wait()
    if process.returncode:
        raise SystemExit(process.returncode)


def main():
    try:
        seed = load_seed_module()
        environment = seed.parse_env(ENV_PATH)
        environment["ULIBOT_SITE_TOKEN"] = seed.required(environment, "ULIBOT_SITE_TOKEN")
        if environment.get("ULIBOT_SITE_HOST", "").strip() != "localhost":
            raise ValueError("Set ULIBOT_SITE_HOST=localhost in ulibotlocal/.env for local group testing.")
        fixtures = json.loads(seed.GROUP_FIXTURES_PATH.read_text(encoding="utf-8"))
        urls = participant_urls(fixtures)
        node = shutil.which("node")
        vite = TEST_APP / "node_modules" / "vite" / "bin" / "vite.js"
        if not node or not vite.is_file():
            raise ValueError("Node.js and the existing test-app dependencies are required. No dependencies were installed.")
        subprocess.run(["docker", "info"], capture_output=True, check=True)
        prepare_stack()
        step("Checking local group assistant mappings")
        ensure_group_contexts(environment, fixtures)
        serve_groups(node, vite, urls)
    except subprocess.CalledProcessError:
        raise SystemExit("Docker is unavailable. Open Docker Desktop, wait until it is ready, then click Test Group Chat again.") from None
    except (ValueError, OSError) as error:
        raise SystemExit(f"Group test setup failed: {error}") from None


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nGroup test app stopped. Existing Docker services and saved conversations remain available.")
