#!/usr/bin/env python3
"""
Full local backend reset.

Tears down everything, rebuilds, runs migrations, generates Prisma,
starts uvicorn inside the container, and seeds the database.

Usage (from ulibotlocal/):
    python reset.py
"""

import subprocess
import sys
import time
import shutil
import urllib.request
import urllib.error
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = (SCRIPT_DIR / ".." / ".." / "ulibotback").resolve()


# ── helpers ──────────────────────────────────────────────────────────────────

def step(msg: str):
    bar = "=" * 60
    print(f"\n{bar}\n  {msg}\n{bar}")


def run(*cmd: str, cwd: Path = BACKEND_DIR):
    print(f"\n$ {' '.join(cmd)}")
    result = subprocess.run(list(cmd), cwd=cwd)
    if result.returncode != 0:
        print(f"\nERROR: command failed with exit code {result.returncode}")
        sys.exit(result.returncode)


def compose_exec(*cmd: str, detach: bool = False):
    base = ["docker", "compose", "exec"]
    if detach:
        base.append("-d")
    base += ["ulibotback"] + list(cmd)
    run(*base)


# ── wait helpers ──────────────────────────────────────────────────────────────

def wait_for_db(timeout: int = 90):
    step("Waiting for MySQL...")
    for i in range(timeout):
        result = subprocess.run(
            ["docker", "compose", "exec", "db",
             "mysql", "-uulibot", "-pulibot", "-e", "SELECT 1"],
            cwd=BACKEND_DIR,
            capture_output=True,
        )
        if result.returncode == 0:
            print("  MySQL is ready.")
            return
        print(f"  [{i + 1}/{timeout}] not ready, retrying...")
        time.sleep(1)
    print("ERROR: MySQL did not become ready in time.")
    sys.exit(1)


def wait_for_api(timeout: int = 90):
    step("Waiting for API...")
    for i in range(timeout):
        try:
            urllib.request.urlopen("http://127.0.0.1:8000/docs", timeout=2)
            print("  API is ready.")
            return
        except Exception:
            print(f"  [{i + 1}/{timeout}] not ready, retrying...")
            time.sleep(1)
    print("ERROR: API did not start in time.")
    sys.exit(1)


# ── main ──────────────────────────────────────────────────────────────────────

def main():
    override_src = SCRIPT_DIR / "compose.override.yml"
    override_dst = BACKEND_DIR / "compose.override.yml"
    if override_src.exists():
        shutil.copy2(override_src, override_dst)
        print(f"Copied compose.override.yml → {override_dst}")

    step("Tearing down all services and volumes")
    run("docker", "compose", "down", "-v")

    step("Rebuilding image")
    run("docker", "compose", "build")

    step("Starting services")
    run("docker", "compose", "up", "-d")

    wait_for_db()

    step("Installing Python dependencies")
    compose_exec("poetry", "install")

    step("Running database migrations")
    compose_exec(
        "poetry", "run", "prisma", "migrate", "deploy",
        "--schema", "db/schema.prisma",
    )

    step("Generating Prisma client")
    compose_exec(
        "poetry", "run", "prisma", "generate",
        "--schema", "db/schema.prisma",
    )

    step("Starting uvicorn inside container (detached)")
    compose_exec(
        "poetry", "run", "uvicorn", "app:app",
        "--host", "0.0.0.0", "--port", "8000",
        detach=True,
    )

    wait_for_api()

    step("Seeding database")
    run("python", "seed.py", cwd=SCRIPT_DIR)

    step("Done")
    print()
    print("  API:  http://127.0.0.1:8000")
    print("  Docs: http://127.0.0.1:8000/docs")
    print()
    print("  Logs: cd ulibotback && docker compose logs -f ulibotback")
    print()


if __name__ == "__main__":
    main()
