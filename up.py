#!/usr/bin/env python3
"""
One-command bring-up for the all-in-one local Moodle + UliBot test stack.

    python up.py            # build + start everything, install Moodle, seed, wire config
    python up.py --no-build # skip image rebuild (faster on subsequent runs)

Idempotent: safe to re-run. Reads seed/config values from ./.env (see .env in this dir;
seed var names are documented in ALLINONE.md and container-setup/seed.py).
"""

from __future__ import annotations

import argparse
import importlib.util
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent          # ulibotlocal/  (holds compose.yml)
ENV_PATH = SCRIPT_DIR / ".env"
SEED_PATH = SCRIPT_DIR / "container-setup" / "seed.py"

# Fixed local Moodle admin credentials.
MOODLE_ADMIN_USER = "admin"
MOODLE_ADMIN_PASS = "Admin#12345"
MOODLE_ADMIN_EMAIL = "admin@example.com"

FRONT_URL = "http://localhost:3000"
# host.docker.internal (not localhost) so the Moodle *container* can reach the backend for
# server-side calls like mod_lia file upload -> OpenAI vector store. It also resolves from the
# host, so the browser widget works too. Auth still keys on the browser host (localhost:8080).
BACK_URL = "http://host.docker.internal:8000/ulibot"


# ── console helpers ───────────────────────────────────────────────────────────

def step(msg: str) -> None:
    bar = "=" * 68
    print(f"\n{bar}\n  {msg}\n{bar}", flush=True)


def dc(*args: str, quiet: bool = False, **kwargs):
    """Run a `docker compose ...` command in the stack directory."""
    cmd = ["docker", "compose", *args]
    if not quiet:
        print(f"\n$ {' '.join(cmd)}", flush=True)
    return subprocess.run(cmd, cwd=SCRIPT_DIR, **kwargs)


def dc_checked(*args: str) -> None:
    result = dc(*args)
    if result.returncode != 0:
        sys.exit(f"\nERROR: `docker compose {' '.join(args)}` failed ({result.returncode}).")


def moodle_cli(*args: str) -> subprocess.CompletedProcess:
    # Moodle CLI must run as www-data so files land with the right ownership.
    return dc("exec", "-T", "-u", "www-data", "moodle", "php", *args)


# ── load seed.py (its build_sql is the single source of truth for the seed) ────

def load_seed_module():
    spec = importlib.util.spec_from_file_location("ulibot_seed", SEED_PATH)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


# ── readiness polls ───────────────────────────────────────────────────────────

def wait_for_api(timeout: int = 180) -> None:
    step("Waiting for backend API (http://localhost:8000/docs)")
    for i in range(timeout):
        try:
            urllib.request.urlopen("http://127.0.0.1:8000/docs", timeout=2)
            print("  API is ready.")
            return
        except Exception:
            print(f"  [{i + 1}/{timeout}] not ready, retrying...")
            time.sleep(1)
    sys.exit("ERROR: backend API did not come up in time. Check `docker compose logs ulibotback`.")


def wait_for_moodle(timeout: int = 180) -> None:
    step("Waiting for Moodle DB + container")
    for i in range(timeout):
        db_ok = dc("exec", "-T", "moodledb", "mysqladmin", "ping", "-h", "127.0.0.1",
                   "-uroot", "-p123456", "--silent", quiet=True, capture_output=True).returncode == 0
        php_ok = db_ok and dc("exec", "-T", "moodle", "php", "-v",
                              quiet=True, capture_output=True).returncode == 0
        if php_ok:
            print("  Moodle is ready.")
            return
        print(f"  [{i + 1}/{timeout}] not ready, retrying...")
        time.sleep(1)
    sys.exit("ERROR: Moodle did not come up in time. Check `docker compose logs moodle moodledb`.")


def moodle_installed() -> bool:
    """True if Moodle core has already been installed into moodledb."""
    result = dc(
        "exec", "-T", "moodledb", "mysql", "-uroot", "-p123456", "-N", "-e",
        "SELECT COUNT(*) FROM information_schema.tables "
        "WHERE table_schema='moodle' AND table_name='mdl_config'",
        quiet=True, capture_output=True, text=True,
    )
    return result.returncode == 0 and result.stdout.strip().endswith("1")


# ── assistant normalization ────────────────────────────────────────────────────

def normalize_assistants_sql(env) -> str:
    """Force EVERY assistant onto the configured type/provider/model + voice.

    The seed only configures the widget assistants; mod_lia creates its own assistants as
    `openairesponses` with audio off. This makes them all match (langgraph / bedrock / sonnet +
    activeaudio), so a Lia activity works on Bedrock with voice after an Apply.
    """
    def esc(s: str) -> str:
        return s.replace("\\", "\\\\").replace("'", "''")

    typ = env.get("ULIBOT_ASSISTANT_TYPE", "langgraph").strip() or "langgraph"
    meta = {
        "provider": env.get("ULIBOT_PROVIDER", "").strip(),
        "model": env.get("ULIBOT_MODEL", "").strip(),
        "activeaudio": env.get("ULIBOT_ACTIVE_AUDIO", "1").strip() or "1",
        "realtime_model": env.get("ULIBOT_REALTIME_MODEL", "").strip(),
        # Enables the `gdrivesearch` tool + ClickHouse RAG — a Bedrock/langgraph assistant's ONLY
        # file channel (uploaded files are ingested here, not the OpenAI vector store).
        "tool_openai_gdrive_vector_store_clickhouse_json":
            '{"host":"clickhouse","port":8123,"table":"gdrive_embeddings_"}',
    }
    stmts = [
        f"UPDATE assistant SET type='{esc(typ)}' WHERE deletedAt IS NULL;",
        "DELETE FROM assistant_meta WHERE `key` IN "
        "('provider','model','activeaudio','realtime_model',"
        "'tool_openai_gdrive_vector_store_clickhouse_json');",
    ]
    for key, value in meta.items():
        if value:
            stmts.append(
                "INSERT INTO assistant_meta (assistantId,`key`,value) "
                f"SELECT id,'{key}','{esc(value)}' FROM assistant WHERE deletedAt IS NULL;"
            )
    return "\n".join(stmts)


# ── main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--no-build", action="store_true", help="skip `--build` on compose up")
    args = parser.parse_args()

    if not ENV_PATH.exists():
        sys.exit(f"ERROR: {ENV_PATH} not found. Copy .env.example to .env and fill it in "
                 "(see ALLINONE.md).")

    seed = load_seed_module()
    env = seed.parse_env(ENV_PATH)

    # The wiring linchpins (see ALLINONE.md §wiring). Fail loudly on the ones that
    # silently break the widget.
    site_host = env.get("ULIBOT_SITE_HOST", "").strip()
    site_token = env.get("ULIBOT_SITE_TOKEN", "").strip()
    if site_host != "localhost":
        sys.exit("ERROR: ULIBOT_SITE_HOST must be 'localhost' (matches the browser host + JWT "
                 f"payload host). Got: {site_host!r}.")
    if not site_token:
        sys.exit("ERROR: ULIBOT_SITE_TOKEN is required (it must equal Moodle's tokenulibot).")
    if not env.get("ULIBOT_OPENAI_TOKEN", "").strip():
        print("WARNING: ULIBOT_OPENAI_TOKEN is empty — the widget will load and connect but "
              "chat replies will fail until you set a real key and re-run.", file=sys.stderr)

    # Build the seed SQL up front so a bad .env fails before we touch Docker.
    seed_sql = seed.build_sql(env)

    step("Starting the stack")
    up_args = ["up", "-d"]
    if not args.no_build:
        up_args.append("--build")
    dc_checked(*up_args)

    wait_for_api()

    step("Seeding backend (tenant / assistant / site) into backdb")
    seed_proc = dc("exec", "-T", "backdb", "mysql", "-uulibot", "-pulibot", "-D", "ulibot",
                   input=seed_sql, text=True)
    if seed_proc.returncode != 0:
        sys.exit("ERROR: seeding failed. Is the backend migration done? "
                 "Check `docker compose logs ulibotback`.")

    step("Normalizing all assistants to the configured provider/model + voice")
    norm_proc = dc("exec", "-T", "backdb", "mysql", "-uulibot", "-pulibot", "-D", "ulibot",
                   input=normalize_assistants_sql(env), text=True)
    if norm_proc.returncode != 0:
        print("WARNING: assistant normalization failed (non-fatal).", file=sys.stderr)

    wait_for_moodle()

    if moodle_installed():
        print("\nMoodle already installed — skipping install.")
    else:
        step("Installing Moodle (CLI)")
        result = moodle_cli(
            "admin/cli/install_database.php",
            "--lang=en",
            f"--adminuser={MOODLE_ADMIN_USER}",
            f"--adminpass={MOODLE_ADMIN_PASS}",
            f"--adminemail={MOODLE_ADMIN_EMAIL}",
            "--fullname=UliBot Local",
            "--shortname=ulibotlocal",
            "--agree-license",
        )
        if result.returncode != 0:
            sys.exit("ERROR: Moodle install failed. Check `docker compose logs moodle`.")

    step("Upgrading Moodle (installs/updates both plugins)")
    dc_checked("exec", "-T", "-u", "www-data", "moodle", "php",
               "admin/cli/upgrade.php", "--non-interactive")

    step("Wiring plugin config to the local backend/frontend")
    for name, value in (
        ("urlulibot", FRONT_URL),
        ("urlbackulibot", BACK_URL),
        ("tokenulibot", site_token),   # MUST equal the seeded ULIBOT_SITE_TOKEN
    ):
        if moodle_cli("admin/cli/cfg.php", "--component=local_ulibot",
                      f"--name={name}", f"--set={value}").returncode != 0:
            sys.exit(f"ERROR: failed to set local_ulibot/{name}. Check `docker compose logs moodle`.")
    # Default new Lia activities to audio-on (their assistant meta is also normalized above).
    moodle_cli("admin/cli/cfg.php", "--component=mod_lia", "--name=active_audio", "--set=1")
    moodle_cli("admin/cli/purge_caches.php")

    step("Done")
    print(f"""
  Moodle : http://localhost:8080   (login: {MOODLE_ADMIN_USER} / {MOODLE_ADMIN_PASS})
  Widget : http://localhost:3000/widget.js
  Backend: http://localhost:8000/docs

  Log in at http://localhost:8080 (use 'localhost', not 127.0.0.1) and the chat widget
  should appear bottom-right. Send a message to test end-to-end chat.

  Logs:  docker compose logs -f ulibotback | ulibotfront | moodle
  Stop:  docker compose down          (add -v to also wipe the databases)
""")


if __name__ == "__main__":
    main()
