# Ulibot Front Setup

1. Go to the `ulibotfront` folder.

2. Create `.env` from `.env.example`.

3. Put this in `.env`:

```env
VITE_ULIBOT_TOKEN=123456
VITE_BACK_URL=http://localhost:8000/ulibot
VITE_ENVIRONMENT=development
VITE_ASSISTANT_ID=
```

4. Install dependencies:

```powershell
npm install
```

5. Start the frontend:

```powershell
npm run dev
```

6. Open:

```text
http://localhost:3000
```

## Notes

- `VITE_BACK_URL` must point to the backend running on port `8000`.
- `VITE_ULIBOT_TOKEN` must match the token used by the backend/site config.