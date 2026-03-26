# Ulibot Backend Setup

1. Go to the `ulibotback` folder.

2. Create `.env` from `.env.example`.

3. Start Docker:

```powershell
docker compose up -d
```

4. Open bash in the backend container:

```powershell
docker compose exec ulibotback bash
```

5. Install dependencies:

```bash
poetry install
```

6. Generate Prisma client:

```bash
poetry run prisma generate --schema db/schema.prisma
```

7. Run the backend:

```bash
poetry run uvicorn app:app --host 0.0.0.0 --port 8000
```

8. Check it here:

```text
http://localhost:8000/docs
```

## Optional

If you want Docker to start the API directly, change this in `compose.yml`:

```yaml
command: /bin/bash
```

to:

```yaml
command: poetry run uvicorn app:app --host 0.0.0.0 --port 8000
```
