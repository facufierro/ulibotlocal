# Ulibot Front Setup

## First time only

**1.** Go to `ulibotfront` and create `.env`:

```powershell
cd ulibotfront
copy .env.example .env
```

**2.** Open `.env` and set:

```env
VITE_ULIBOT_TOKEN=123456
VITE_BACK_URL=http://localhost:8000/ulibot
VITE_ENVIRONMENT=development
VITE_ASSISTANT_ID=
```

**3.** Install dependencies:

```powershell
npm install
```

---

## Every time

```powershell
cd ulibotfront
npm run dev
```

Open:

```text
http://localhost:3000
```