# All-in-One Local Test Stack

Brings up **Moodle 4.5** (with both `local_ulibot` and `mod_lia` installed and wired), the
**FastAPI backend**, the **React widget frontend**, and all their **databases** on one Docker
network — so you can log into Moodle and chat with the assistant end-to-end locally.

Everything lives in this `ulibotlocal/` folder; the compose file reaches the sibling repos
(`../plugin-uli`, `../plugin-lia`, `../ulibotback`, `../ulibotfront`) via relative paths.

## Prerequisites

- Docker Desktop (WSL2 backend on Windows).
- `../ulibotback/.env` present (the backend's own env; copy from its `.env.example`). The DB URL
  in it is overridden automatically to point at this stack's DB.
- A real OpenAI API key for real chat.

## 1. Configure `ulibotlocal/.env`

`seed.py` reads this file. The values that **must** be set for the widget to load, authenticate,
and chat:

| Var | Value | Why |
|---|---|---|
| `ULIBOT_SITE_HOST` | `localhost` | Must equal the browser host **and** the JWT host claim. Never `127.0.0.1`. |
| `ULIBOT_SITE_TOKEN` | any secret, e.g. `local-test-token` | **Must equal** Moodle's `tokenulibot` — it's the JWT signing key the backend verifies against. `up.py` sets Moodle's `tokenulibot` to this value automatically. |
| `ULIBOT_OPENAI_TOKEN` | `sk-…` (real) | Seeded into the tenant; required for real replies. |
| `ULIBOT_TENANT_NAME` / `ULIBOT_ASSISTANT_NAME` / `ULIBOT_SITE_NAME` | any names | Required by the seeder. |
| `ULIBOT_ASSISTANT_TYPE` | `openairesponses` (or `openaiassistant` / `langgraph`) | Assistant backend to use. |
| `ULIBOT_MODEL` | `gpt-4o-mini` | Chat model. |
| `ULIBOT_PROVIDER` | `openai` | Provider. |

(Other optional seed vars — audio, template, disclaimer, alignstyle, Bedrock keys — are
documented in `container-setup/seed.py`.)

## 2. Run

```powershell
cd ulibotlocal
python up.py            # first run builds images (Moodle clone + front build) — be patient
# later runs:
python up.py --no-build
```

`up.py` starts everything, waits for the API, seeds the backend, installs Moodle, installs both
plugins, and wires `urlulibot` / `urlbackulibot` / `tokenulibot`. It is idempotent.

| Service | URL |
|---|---|
| Moodle | http://localhost:8080 — login `admin` / `Admin#12345` |
| Widget assets | http://localhost:3000/widget.js |
| Backend API docs | http://localhost:8000/docs |
| Selenium noVNC (Behat) | http://localhost:7900 |

## 3. Verify end-to-end

1. Browse to **http://localhost:8080** (use `localhost`, not `127.0.0.1`), log in as admin.
2. The chat widget appears bottom-right (`#ulibot-host` in the DOM); DevTools console logs
   `UliBot context assistant success`.
3. Open it, send "hello" → a real `gpt-4o-mini` reply streams back over `ws://localhost:8000/ulibot/ws`.
4. Create a course → add a **Lia** activity → open it (exercises `mod_lia`).

## Realtime voice

Voice lives on the **site widget** (the floating chat), gated by the assistant's `activeaudio`
meta (the seed sets it to `1`; the `mod_lia` activity defaults to `0`, i.e. no voice). Flow: the
browser POSTs `{backurl}/api/v1/openaisession` to mint an ephemeral OpenAI token, then connects
**directly to OpenAI over WebRTC** — audio never goes through the local backend (it only persists
transcripts).

Requirements (all handled except the last two):
- `activeaudio=1` on the assistant ✓; `realtime_model` set to `gpt-realtime` ✓ (empty falls back to
  the backend default `gpt-realtime-2`). To persist across a re-seed, add
  `ULIBOT_REALTIME_MODEL=gpt-realtime` to `.env` (otherwise `up.py` re-seeds it empty).
- **Browse `http://localhost:8080`, not `host.docker.internal:8080`** — `getUserMedia`/WebRTC need a
  secure context, and only `localhost`/`127.0.0.1` count as secure over plain HTTP.
- Your tenant OpenAI key must have **Realtime API** access.

Test: on `localhost:8080` as admin, open the widget → click the **mic** button → allow microphone →
speak → hear the reply (transcript appears in the chat). If the mic errors, check
`docker compose logs -f ulibotback` for the `openaisession` call; a model-access error there means
your key needs a different `realtime_model` (e.g. `gpt-4o-realtime-preview`).

## 4. Automated tests

All tests live under `ulibotlocal/tests/` — nothing is written into the plugin/back/front repos.

**Backend API contract** (self-contained, stdlib only, runs from the host):

```powershell
python tests/api/test_context_assistant.py     # or: pytest tests/api
```

**Frontend + widget E2E** (Playwright, self-contained; drives Moodle at :8080):

```powershell
cd tests/e2e
npm install ; npx playwright install chromium
npx playwright test
```

**Moodle PHPUnit / Behat** — Moodle only discovers tests inside the plugin tree, so these are
kept as templates in `tests/moodle-templates/`. To run them, copy each into its plugin repo (a
deliberate change to `plugin-uli` / `plugin-lia`) as described in
[tests/moodle-templates/README.md](tests/moodle-templates/README.md); the stack is already
test-ready (selenium service + `phpunit_*`/`behat_*` config blocks).

## 5. Stop / reset

```powershell
docker compose down          # stop, keep data
docker compose down -v       # stop and wipe all databases + moodledata (fresh install next up.py)
```

## Troubleshooting

- **`port is already allocated` on `up.py`** — a standalone stack is holding 8000/8080/3000. Stop it
  first: `cd ..\ulibotback ; docker compose down` (and `..\ulibotfront`, `..\plugin-uli` if needed).
  Don't run the standalone `ulibotback` stack and this one at the same time.
- **`local_ulibot` install error "Missing TABLES section"** — handled automatically: `compose.yml`
  overlays `docker/local_ulibot-install.xml` into the container because the upstream plugin ships an
  empty `install.xml` that Moodle 4.5 rejects on a fresh install.
- **Widget doesn't appear** — browse `localhost` (not `127.0.0.1`); check `docker compose logs -f
  ulibotback moodle`.

## What this touches

Everything here is under `ulibotlocal/`. The other repos are used **read-only**:
- The plugin dirs (`../plugin-uli`, `../plugin-lia`) are bind-mounted into Moodle so it can serve
  them live — Moodle never writes back into them.
- `../ulibotback` is bind-mounted for hot-reload (same as `container-setup/reset.py`); at runtime it
  may write only already-gitignored artifacts (logs, `__pycache__`). To avoid even those, drop the
  `volumes:` line on the `ulibotback` service in `compose.yml` and it runs purely from the image.

## Wiring gotchas (why the widget silently doesn't appear)

1. **`localhost` vs `127.0.0.1`** — any host mismatch (browser / `wwwroot` / JWT host /
   `ULIBOT_SITE_HOST`) breaks auth silently. Always `localhost`.
2. **`tokenulibot` ≠ `ULIBOT_SITE_TOKEN`** — JWT signature check fails, widget won't mount.
   `up.py` keeps them equal; don't set `tokenulibot` by hand.
3. **`urlbackulibot` uses `host.docker.internal`, not `localhost`** — server-side calls (mod_lia /
   local_ulibot **file upload** to the OpenAI vector store, mentor lookup, course builder) run as PHP
   *inside* the Moodle container, where `localhost:8000` is the container itself. `up.py` sets
   `urlbackulibot=http://host.docker.internal:8000/ulibot`, which the container **and** the browser
   both resolve, so both chat and file upload work. Keep browsing at `localhost:8080` — auth still
   keys on that host. (Needs Docker Desktop's `host.docker.internal`; present by default on Windows/Mac.)
4. **Windows performance** — Moodle core is baked into the image and all data is on named volumes.
   Don't bind-mount the Moodle tree or move volumes onto `d:\`.
