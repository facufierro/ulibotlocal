# Local group chat

Group chat is opt-in; the existing personal tests and Moodle plugins are unchanged.
The test app at `http://localhost:5174/groups` supplies a **local membership
simulation**, not Moodle login. Messages and `@Uli` replies use the real backend,
database, and configured Responses or LangGraph assistant.

The frontend group source is restored, while backend and local changes remain
in their working trees. Cross-repository status and remaining release gates are
maintained in [the backend group-chat contract](../../ulibotback/docs/group_chat.md#implementation-status--2026-10-13).
Source restoration does not update an already-built frontend or a running
backend container; the setup and integration checks below are still required.

## Setup and use

The updated backend needs its additive group-chat migration and generated Prisma
client. The frontend assets on `localhost:3000` must include the group component.
Use the existing stack's setup workflow only when builds and migrations are
authorized; this change does not run either automatically.

The existing local seed now maps the fixture's course context to the configured
assistant, leaving `general/general` and `general/inline` intact. An already-seeded
database needs this additional mapping. Do not run `container-setup/seed.py` to
add it: that standalone entry point resets the database. On an existing stack,
resolve the active `general/general` assistant from the database and add only the
fixture's course mapping to that assistant after authorization. Do not re-run
`up.py` for this purpose: it re-seeds personal mappings and normalizes assistant
runtimes, which can overwrite an existing local assistant clone's configuration.
The backend container startup applies pending migrations and generates the
Prisma client, so starting it also requires migration authorization.

When the stack and test app are running:

1. Open `http://localhost:5174/groups?userid=9101&groupid=9201` as Ana.
2. Open `http://localhost:5174/groups?userid=9102&groupid=9201` as Luis in another tab.
3. Send a human message: both tabs should show its verified author, with no AI reply.
4. Send `@Uli, summarize our discussion`: one shared reply should appear in both tabs.
5. Open `http://localhost:5174/groups?userid=9103&groupid=9202` as Mar.
   Group B must not see group A's messages.
6. Return to personal chat: personal history and its existing transport are separate.

The test app uses its existing Vite dev server (`npm.cmd run dev`), not a new
service. Starting it is an explicit operational step. No extra dependencies,
secrets, or plugin edits are required.

## Membership and safety

`test-app/server/group-chat-fixtures.json` owns the local users, membership, and
room contexts; both the seed and issuer read it. Names are never accepted from
the browser. The Vite middleware signs 60-second JWTs server-side using the
existing `ULIBOT_SITE_TOKEN` in `ulibotlocal/.env` and refuses non-local or
cross-origin browser requests. The secret is not returned to the group page.

To test revocation, change Ana's `active` to `false` in the fixture. Within the
next token renewal (about one minute), her open tab must lose access. Restore it
after the check. Tokens already issued remain valid until expiry, as in the
documented backend contract. This test issuer deliberately allows selecting a
fixture user; it is **not production authentication** and is not installed in a
build or preview server. Never expose the development server publicly.

## Tests

These checks run without starting servers or contacting an AI provider:

```powershell
cd test-app
npm.cmd run test:group
.\node_modules\.bin\tsc.cmd --noEmit
cd ..
python -m pytest tests/test_group_seed.py -q
```

The live backend checks in `tests/api/test_group_chat.py` require a running
updated local stack and the group context mapping. They write uniquely named
human messages, test concurrent publication, retry identity, and room isolation;
they do not invoke AI or alter personal histories. Run only against the local
database:

```powershell
python -m pytest tests/api/test_group_chat.py -q
```

Real AI generation, browser rendering, and live MySQL behavior still require
the checks above against the running updated stack; offline tests do not prove
those integration paths.

## Moodle handoff

The plugin owner must provide a group page and a same-origin membership-token
endpoint which checks actual Moodle login, enrolment, group, and activity access
on every renewal. Mount with `chatMode: "group"`, `groupTokenUrl`, the signed
initial `token`, and the selected course/module context, inside
`#ulibot-group-container`. The full contract is in
`ulibotback/docs/group_chat.md` and `ulibotfront/docs/group_chat.md`.
The group page must suppress the normal personal-widget auto-mount: the existing
widget has one active runtime per page, not two simultaneous widgets.
No Moodle plugin file is modified by this implementation.
