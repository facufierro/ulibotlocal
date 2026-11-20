# UliBot local workspace rules

## Durable project findings

- Record verified, reusable findings about this local stack in this section when
  they will affect future implementation, testing, or operational decisions.
- Keep entries concise and current. Do not add transient debugging notes,
  credentials, tokens, personal data, or unverified assumptions.
- Update or remove an entry when the underlying behavior changes so this file
  remains authoritative rather than becoming a history log.
- Chat EABC forwards explicit `@Lia` questions after checking Moodle access.
  The existing backend accepts them into `chateabc_turn` and owns generation,
  retries and Socket.IO delivery within its application lifetime. Select a Lia
  activity in the same course and use Separate groups. No extra service or
  connector process is used. The Vite `/groups` page is a separate simulation.
- The manual Moodle workflow uses the Docker, Start Moodle, and Open Moodle
  buttons. Start Moodle starts existing all-in-one containers without rebuilding,
  resetting, or seeding. Install and upgrade Moodle plugins through Moodle itself.
- Chat EABC is bind-mounted from `mod_chateabc` and its local Socket.IO service
  runs on `http://localhost:40000`. Set that URL in Moodle's Chat EABC settings;
  an empty value falls back to the production service. The Compose whitelist
  permits only the local Moodle origin, `http://localhost:8080`.
- `docker/moodle-config.php` sets `chateabc_serverurl_internal` to
  `http://chateabc:40000` for the backend. Browsers use `http://localhost:40000`
  from the existing Chat EABC setting, and production uses its existing chat URL.
- The local chat service mounts `routes.js` so connection cleanup changes can be
  tested without rebuilding. Changes to Node source require restarting that
  existing service; its protocol and message rendering remain unchanged.
- `docker/chateabc-local-version.php` overlays only the local Moodle requirement
  for Moodle 4.5 testing. Release/version metadata is read from the actual plugin;
  the production plugin's minimum Moodle requirement remains unchanged.
- Human-only Chat EABC uses legacy jQuery plugin URLs cached for 90 days in
  browsers. Lia-enabled activities use Moodle's versioned loader for the small
  question hook; their renderer, styles and normal message delivery are unchanged.
- Students need `local/ulibot:courseview` allowed in the lab course to display
  Lia. The UliBot plugin's default student permission prevents the widget.
- The local backend container startup applies pending Prisma migrations and
  generates its client. Starting that container can therefore change the database.
- `container-setup/reset.py` targets the standalone backend stack and deletes its
  volumes before rebuilding and seeding; it has no action button.
- The Local: Rebuild widget task targets the all-in-one stack in this directory.
  The evaluation console is also available through VS Code's Tasks: Run Task.
- `prepare_local_test.py` starts existing
  databases, restarts the backend to apply migrations and generate Prisma, starts
  Moodle, rebuilds only the frontend, and opens Moodle. It does not reset volumes,
  re-seed assistants, change their runtimes, or run Moodle plugin upgrades.
- The all-in-one frontend image installs dependencies and copies sources into
  `/app`; host edits are not mounted into that container. Test current sources
  with explicit bind mounts, or use the user's frontend rebuild when authorized.
- Keep the local frontend's HTTP cache disabled (`http-server -c -1`). The widget
  loads fixed-name JavaScript and CSS dynamically; the server's default one-hour
  cache can leave an older widget visible after a successful frontend rebuild.
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
- Stashing plugin source changes does not undo database upgrades.
- The widget translates Moodle's `global` context to backend `general/general`;
  do not add a separate `global` assistant mapping to repair the home-page widget.
- Check `host.docker.internal` from Windows as well as inside Docker when the
  widget is missing. Docker Desktop's Windows hosts entry can retain an old LAN
  address after a network change; successful container requests do not verify
  the browser's route to the backend.
