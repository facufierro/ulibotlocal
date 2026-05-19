# Ulibot Backend Setup

## First time only

**1.** Go to `ulibotback` and create `.env`:

```powershell
cd ulibotback
copy .env.example .env
```

**2.** Start services:

```powershell
docker compose up -d
```

**3.** Install dependencies and run migrations:

```powershell
docker compose exec ulibotback poetry install
docker compose exec ulibotback poetry run prisma migrate deploy --schema db/schema.prisma
```

**4.** Start the API inside the container (runs in the background):

```powershell
docker compose exec -d ulibotback bash -c "poetry run prisma generate --schema db/schema.prisma && poetry run uvicorn app:app --host 0.0.0.0 --port 8000"
```

**5.** Open a new terminal and run the seed:

```powershell
cd ulibotlocal
python seed.py
```

**6.** Verify:

```text
http://localhost:8000/docs
```

---

## Every time after (already set up)

**1.** Start services:

```powershell
cd ulibotback
docker compose up -d
```

**2.** Start the API inside the container (runs in the background):

```powershell
docker compose exec -d ulibotback bash -c "poetry run prisma generate --schema db/schema.prisma && poetry run uvicorn app:app --host 0.0.0.0 --port 8000"
```

---

## Useful commands

Watch logs:

```powershell
docker compose logs -f ulibotback
```

Inspect database tables:

```powershell
docker compose exec db mysql -uulibot -pulibot -D ulibot -e "SHOW TABLES;"
```

New migration after schema change:

```powershell
docker compose exec ulibotback poetry run prisma migrate deploy --schema db/schema.prisma
```
