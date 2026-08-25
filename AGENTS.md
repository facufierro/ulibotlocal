# UliBot local workspace rules

## Durable project findings

- Record verified, reusable findings about this local stack in this section when
  they will affect future implementation, testing, or operational decisions.
- Keep entries concise and current. Do not add transient debugging notes,
  credentials, tokens, personal data, or unverified assumptions.
- Update or remove an entry when the underlying behavior changes so this file
  remains authoritative rather than becoming a history log.

## Assistant runtimes

- The legacy `openaiassistant` runtime is no longer used. Do not select it for
  local assistants, production clones, examples, or evaluation smoke tests.
- `openairesponses` is an active runtime and must not be confused with the
  retired `openaiassistant` runtime.
- When cloning an assistant for local testing, inspect and preserve the active
  production runtime. The clone must use local tenant credentials and must
  never reuse production credentials or external resource identifiers.
