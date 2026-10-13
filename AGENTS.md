# UliBot local workspace rules

## Durable project findings

- Record verified, reusable findings about this local stack in this section when
  they will affect future implementation, testing, or operational decisions.
- Keep entries concise and current. Do not add transient debugging notes,
  credentials, tokens, personal data, or unverified assumptions.
- Update or remove an entry when the underlying behavior changes so this file
  remains authoritative rather than becoming a history log.
- Group chat is tested at the Vite test app's `/groups` page without plugin edits.
  Its server-side fixture owns membership and the seeded course mapping; the
  local signer is a development simulation, not Moodle authentication.
- The local backend container startup applies pending Prisma migrations and
  generates its client. Starting that container can therefore change the database.
- On an already-configured stack, add only the group context mapping to the active
  `general/general` assistant. Running `up.py` also re-seeds personal mappings and
  normalizes all assistant runtimes, which can overwrite a locally cloned assistant.

## Assistant runtimes

- The legacy `openaiassistant` runtime is no longer used. Do not select it for
  local assistants, production clones, examples, or evaluation smoke tests.
- `openairesponses` is an active runtime and must not be confused with the
  retired `openaiassistant` runtime.
- When cloning an assistant for local testing, inspect and preserve the active
  production runtime. The clone must use local tenant credentials and must
  never reuse production credentials or external resource identifiers.

## Moodle startup

- Starting existing containers does not apply upgrades for the bind-mounted Moodle
  plugins. When a plugin's code version exceeds its installed database version,
  Moodle redirects administrator home/dashboard requests to `/admin/index.php`.
  Check for pending upgrades before attributing slow navigation to startup or
  backend connectivity. Running `admin/cli/upgrade.php` requires the user's
  explicit migration authorization.
- The widget translates Moodle's `global` context to backend `general/general`;
  do not add a separate `global` assistant mapping to repair the home-page widget.
