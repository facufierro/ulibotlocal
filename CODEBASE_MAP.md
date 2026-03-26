# Codebase Map — UliBot Workspace

## 1. Stack

| | **ulibotback** | **ulibotfront** | **ulibotlocal** |
|---|---|---|---|
| **Language** | Python 3.10 | TypeScript 5 | TypeScript 5 |
| **Runtime** | Uvicorn (ASGI) | Vite 4 (dev), http-server (prod) | Vite 5 |
| **Framework** | FastAPI | React 18 | React 18 |
| **Pkg mgr** | Poetry | pnpm | npm |
| **Key deps** | LangChain 0.3, LangGraph, OpenAI SDK, Prisma ORM, boto3, ClickHouse | Recoil, i18next, react-markdown, react-media-recorder, Shadcn/ui primitives, Tailwind | Minimal — only react + vite |

- **Unusual**: `@chainlit/react-client` still in front's `package.json` but unused; `chainlit.py` is a compat shim over a custom WebSocket layer

## 2. Structure

```
ulibotback/          ← Python backend (FastAPI + LLM orchestration)
├── app.py           ← FastAPI app, routers, CORS, WebSocket
├── ulibot.py        ← Chat lifecycle decorators (start, message, auth, actions)
├── ws_support.py    ← Custom WebSocket handler registry (replaced Chainlit)
├── chainlit.py      ← Compat shim re-exporting ws_support
├── db/              ← Prisma schema + migrations (MySQL)
├── ulibotapp/       ← Core package
│   ├── api/v1/      ← REST endpoints (FastAPI routers)
│   ├── assistants/   ← LLM assistant impls (OpenAI Assistants, Responses, LangGraph)
│   ├── clients/      ← LLM client adapters (OpenAI, LangGraph, Bedrock)
│   ├── configs/      ← Config managers per assistant type
│   ├── factories/    ← Dynamic assistant/site instantiation
│   ├── repositories/ ← Data access (Prisma → MySQL)
│   ├── services/     ← Business logic (Assistant, Site, Stats, Tenant, Report)
│   ├── tools/        ← Pluggable function tools (Google, GDrive, GLPI, Moodle)
│   ├── restrictions/ ← Usage limit checks (token caps)
│   ├── sites/        ← Site context wrapper (expiry, user/course data)
│   ├── utils/        ← Auth, encryption, image processing
│   └── logger/       ← Dual-handler logging config
├── assets/          ← HTML pages (login, assistant, widget.js)
└── assistantdata/   ← Static data per assistant (metaverso, ulibotcac, etc.)

ulibotfront/         ← React chat widget (embeddable)
├── src/
│   ├── App.tsx       ← Settings fetch, template resolution, auth gate
│   ├── main.tsx      ← mountUlibotWidget() + Shadow DOM support
│   ├── components/   ← Chat, Welcome, Help, Terms + ui/ (Shadcn-like)
│   ├── context/      ← GlobalStateContext (useReducer)
│   ├── templates/    ← Theme configs (uli, lia, mentor, tutor)
│   ├── lang/         ← i18n (es/en) via i18next
│   ├── scss/         ← SCSS modules (base, components, layouts, themes)
│   └── utils/        ← Assistant name replacement
└── public/widget.js  ← Bootstrapper: injects CSS+JS, creates Shadow DOM

ulibotlocal/         ← Local dev test harness
├── src/App.tsx       ← Loads widget.js, mounts widget + inline modes
└── seed.py           ← DB seeder (generates SQL → pipes into MySQL container)
```

## 3. Entry Points

- **Backend**: `app.py` → `uvicorn app:app --host 0.0.0.0 --port 8000`
- **Frontend**: `src/main.tsx` → exposes `window.mountUlibotWidget(options)` for embedding
- **Local dev**: `src/main.tsx` → React app that dynamically loads the frontend widget
- **DB seed**: `python seed.py` in ulibotlocal (runs Prisma migrations + SQL inserts via Docker)

## 4. Data Layer

- **Primary DB**: MySQL 8 via **Prisma ORM** (async client, schema at `db/schema.prisma`)
- **Analytics DB**: ClickHouse 23.10 (token/word stats)
- **Models**: `tenant` → `assistant` → `assistant_meta` (KV config) | `site` → `site_meta` | `site_assistant` (many-to-many with context) | `site_thread` → `message` | `daily_stats`
- **Multi-tenancy**: Tenant holds OpenAI token + ClickHouse connection string; all entities scoped to tenant
- **Repository pattern**: abstract `BaseRepository` → `MysqlRepository` (Prisma); dynamic model dispatch via `getattr()`
- **Migrations**: Prisma Migrate (`prisma migrate deploy`), schema push for dev

## 5. API Surface

**REST** (all under `/ulibot/api/v1/`, auth via `validate_api_token` dependency):

| Route prefix | Purpose |
|---|---|
| `/assistants` | CRUD assistants, get by context |
| `/assistants/{id}/meta` | KV metadata operations |
| `/sites`, `/site-assistants` | Site & site↔assistant bindings |
| `/site-meta` | Site metadata |
| `/openaisession` | Create OpenAI session with tools |
| `/messages` | POST tool exec, GET thread messages |
| `/frontsettings/{id}` | Frontend config (audio, lang, template, capabilities) |
| `/reports` | Site/tenant usage reports + CSV export |
| `/vectorstores` | OpenAI vector store management |

**WebSocket** (`ws_support.py`): Streaming chat with token-by-token delivery, action callbacks (like/dislike/create_course)

## 6. Patterns in Use

- **Architecture**: Layered service-oriented (Repository → Service → API / Factory → Client → Assistant)
- **Factory pattern**: `AssistantFactory` dynamically creates typed assistants (OpenAI Assistants API, Responses, LangGraph) with matching configs, clients, and tools
- **Strategy pattern**: Pluggable tools (`BaseTool` → Google, GDrive, GLPI, Moodle), restrictions (`BaseRestriction` → token limits), clients (`BaseClient` → OpenAI, LangGraph)
- **State (frontend)**: `useReducer` + React Context (`GlobalStateContext`), plus Recoil (imported but context is primary)
- **Template/theming**: Registry of named templates with light/dark mode palettes and CSS vars
- **Error handling**: Backend uses FastAPI exception handlers; frontend has error overlay component
- **DI**: Manual — `appconfig.py` singleton holds class references; factories wire dependencies at runtime
- **Auth**: JWT (HS256) or raw token validation via `is_valid_hosttoken()`

## 7. Config & Env

- **Backend**: `.env` file → `ULIBOT_DB_URL`, `ULIBOT_ENDPOINT_PASS`, `LOG_LEVEL`, `CHAINLIT_AUTH_SECRET`, `ULIBOT_USERNAME`
- **Frontend**: `.env` → Vite env vars mapped in `config.js`: `VITE_ULIBOT_TOKEN`, `VITE_BACK_URL`, `VITE_ENVIRONMENT`, `VITE_ASSISTANT_ID`
- **Local**: `.env` → seed parameters (`ULIBOT_TENANT_NAME`, `ULIBOT_SITE_TOKEN`, `ULIBOT_OPENAI_TOKEN`, etc.)
- **DB-driven config**: `assistant_meta` table stores per-assistant settings (model, template, audio, language, prompts, tool configs) — loaded at runtime via `ConfigManager`

## 8. Testing

- **No test framework, no test files, no coverage setup** across any of the three projects
- ESLint configured in frontend (`.eslintrc.cjs` — TS + React hooks rules)
- No linter config in backend

## 9. Build & Deploy

- **Backend**: Docker (`python:3.10` + Poetry + Prisma generate), `compose.yml` runs `ulibotback` + `db` (MySQL) + `clickhouse`
- **Frontend**: Docker (`node:20.15`), production builds via `tsc && vite build` → `http-server ./dist`; outputs `index-ulibot.js` + `style-ulibot.css`
- **CI/CD**: GitLab CI (`.gitlab-ci.yml`) — Kaniko build → Helm deploy to Kubernetes; `dev` branch → staging namespace, `main` → production (`eabc` namespace)
- **Local dev**: `ulibotlocal` on port 5174 loads widget from frontend on port 3000, backend on port 8000

## 10. Code Style

- **Backend**: No linter/formatter config found; Python dataclasses + Pydantic models; snake_case; no type annotations enforcement
- **Frontend**: ESLint (`eslint:recommended` + `@typescript-eslint` + `react-hooks`); Prettier-ready (devDep); Strict TS mode; Shadcn/ui component conventions; SCSS with BEM-ish naming
- **Naming**: Backend modules use underscore (`openai_assistant_chat.py`); frontend uses camelCase files (`chatmessage.tsx`) with PascalCase components

---

## Notable / Non-Standard

- **Chainlit removal in progress**: WebSocket layer (`ws_support.py`) replaces Chainlit but a compat shim still exists; `@chainlit/react-client` still listed as a frontend dependency
- **No tests anywhere** — no test files, framework, or CI test stage
- **CORS allows all origins** in backend (`allow_origins=["*"]`)
- **Singleton hack** in ulibotlocal's `App.tsx`: resets `window.__ulibotMounted` to mount two widget instances
- **Shadow DOM isolation** for the embeddable widget — non-trivial; styles injected manually
- **ClickHouse for analytics** alongside MySQL — dual-database architecture
- **HMR disabled** in ulibotlocal Vite config
