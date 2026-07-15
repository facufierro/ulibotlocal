# Moodle test templates

Moodle only discovers PHPUnit/Behat tests **inside the plugin tree** (`local/ulibot/tests`,
`mod/lia/tests`). Because the plugins are bind-mounted from their own repos, running these tests
means copying the templates below into those repos — a change to `plugin-uli` / `plugin-lia` that
you make deliberately. The all-in-one stack is already test-ready (selenium service + the
`phpunit_*` / `behat_*` blocks in `docker/moodle-config.php`).

## Copy into place (only when you want them)

| Template (here) | Destination (plugin repo) |
|---|---|
| `ulibot_test.php` | `../plugin-uli/tests/ulibot_test.php` |
| `widget.feature`  | `../plugin-uli/tests/behat/widget.feature` |
| `lia_lib_test.php` | `../plugin-lia/tests/lib_test.php` |

## Run (from the stack root, after `python up.py`)

```powershell
# PHPUnit
docker compose exec -u www-data moodle php admin/tool/phpunit/cli/init.php
docker compose exec -u www-data moodle vendor/bin/phpunit local/ulibot/tests
docker compose exec -u www-data moodle vendor/bin/phpunit mod/lia/tests

# Behat (drives the selenium service)
docker compose exec -u www-data moodle php admin/tool/behat/cli/init.php
docker compose exec -u www-data moodle vendor/bin/behat --tags @local_ulibot
```
