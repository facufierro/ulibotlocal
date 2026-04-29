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

6. Apply database migrations:

```bash
poetry run prisma migrate deploy --schema db/schema.prisma
```

7. Generate Prisma client:

```bash
poetry run prisma generate --schema db/schema.prisma
```

8. Run the backend:

```bash
poetry run uvicorn app:app --host 0.0.0.0 --port 8000
```

9. Check it here:

```text
http://localhost:8000/docs
```

## Notes

- Run `docker compose ...` commands from the host shell, not from inside the `ulibotback` container.
- If you want to inspect the database tables from the host, use:

```powershell
docker compose exec db mysql -uulibot -pulibot -D ulibot -e "SHOW TABLES;"
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
