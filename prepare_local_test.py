"""Prepare the existing local stack for browser tests without resetting or seeding."""
import webbrowser

from up import dc_checked, step, wait_for_api, wait_for_moodle


def main():
    step("Starting existing databases")
    dc_checked("start", "--wait", "backdb", "moodledb", "clickhouse")

    # Restart uses the existing bind-mounted container. Its startup command
    # installs declared dependencies, applies migrations, and generates Prisma.
    step("Starting backend and applying pending migrations")
    dc_checked("restart", "--no-deps", "ulibotback")
    wait_for_api()

    step("Starting existing Moodle")
    dc_checked("start", "moodle")
    wait_for_moodle()

    step("Rebuilding the frontend with current source")
    dc_checked("up", "--wait", "--build", "--no-deps", "ulibotfront")

    step("Local test ready")
    print("For conversation history, open a Lia activity using a Responses assistant.")
    print("Hard-refresh an already open Moodle tab to load the updated widget.")
    webbrowser.open("http://localhost:8080")


if __name__ == "__main__":
    main()
