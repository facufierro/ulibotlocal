# Changelog

## 2026-03-27 — Voice Unification

Unified text and voice chat into a single conversation thread. Voice now shares context with text, supports tools properly, and syncs history in real time.

### Backend

- **`/openaisession`** — validates `activeaudio`, reads `realtime_model` from config, caches assistant, creates/reuses thread, returns `thread_id` + `session_id` + conversation `history`
- **`/messages/tool/{name}`** — looks up cached assistant by `session_id` (falls back to `setup_app()` if missing)
- **WS `sync_voice_turn`** — new message type: persists each voice turn to DB immediately (replaces batch sync)
- **WS `voice_ended`** — clears `last_message_id` so next text message rebuilds full context from DB
- **WS connect** — eagerly creates thread, sends `thread_id` in session response
- **`session_cache.py`** (new) — in-memory assistant cache with 60-min TTL
- **`config_openai_responses.py`** — added `realtime_model` key and `REALTIME_MODEL_DEFAULT` constant

### Frontend

- **`chat.tsx`** — `threadId` lifted to React state (from WS session message), removed `localStorage` thread pattern
- **`chatfooter.tsx`**:
  - Sends `thread_id` + `session_id` on voice init
  - Uses `realtime_model` from backend response (no more hardcoded model)
  - Per-turn sync via `sync_voice_turn` (replaces batch `store_voice_history`)
  - Primes Realtime with backend conversation history
  - Flushes in-progress turns when voice is cut mid-response
  - Sends `voice_ended` on disconnect to reset text context
  - Whisper language hint (`es`) for better transcription

### What's NOT changed

- No DB migrations
- No new env vars
- `store_voice_history` still handled (deprecated fallback)
- Old frontends work unchanged — all new fields are additive
- Non-voice assistants completely unaffected

### Setup for existing assistants

- `activeaudio = "1"` in `assistant_meta` (already set if mic button is visible)
- `realtime_model` in `assistant_meta` (optional — defaults to `gpt-4o-realtime-preview-2025-06-03`)
