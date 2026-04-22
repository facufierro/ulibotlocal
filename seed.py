from __future__ import annotations

import subprocess
import sys
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = (ROOT_DIR / ".." / "ulibotback").resolve()
ENV_PATH = ROOT_DIR / ".env"


def parse_env(path: Path) -> dict[str, str]:
	if not path.exists():
		raise FileNotFoundError(f"Missing .env file: {path}")

	values: dict[str, str] = {}
	for raw_line in path.read_text(encoding="utf-8").splitlines():
		line = raw_line.strip()
		if not line or line.startswith("#") or "=" not in line:
			continue
		key, value = line.split("=", 1)
		key = key.strip()
		value = value.strip()
		if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
			value = value[1:-1]
		values[key] = value
	return values


def sql_escape(value: str) -> str:
	return value.replace("\\", "\\\\").replace("'", "''")


def required(env: dict[str, str], key: str) -> str:
	value = env.get(key, "").strip()
	if not value:
		raise ValueError(f"Missing required key in .env: {key}")
	return value


def optional(env: dict[str, str], key: str, default: str = "") -> str:
	return env.get(key, default).strip()


def build_sql(env: dict[str, str]) -> str:
	tenant_name = required(env, "ULIBOT_TENANT_NAME")
	assistant_name = required(env, "ULIBOT_ASSISTANT_NAME")
	assistant_type = optional(env, "ULIBOT_ASSISTANT_TYPE", "langgraph")
	provider = optional(env, "ULIBOT_PROVIDER", "openai")
	site_name = required(env, "ULIBOT_SITE_NAME")
	site_host = required(env, "ULIBOT_SITE_HOST")
	site_token = required(env, "ULIBOT_SITE_TOKEN")
	openai_token = optional(env, "ULIBOT_OPENAI_TOKEN")
	active_audio = optional(env, "ULIBOT_ACTIVE_AUDIO", "1")
	disclaimer_text = optional(env, "ULIBOT_DISCLAIMER_TEXT", "Local test assistant")
	language = optional(env, "ULIBOT_LANGUAGE", "en")
	model = optional(env, "ULIBOT_MODEL", "gpt-4o-mini")
	template = optional(env, "ULIBOT_TEMPLATE", "uli")
	alignstyle = optional(
		env,
		"ULIBOT_ALIGNSTYLE",
		'{"right":"0px","bottom":"16.25rem"}',
	)

	token_sql = f"'{sql_escape(openai_token)}'" if openai_token else "NULL"

	return f"""
SET @tenant_name = '{sql_escape(tenant_name)}';
SET @assistant_name = '{sql_escape(assistant_name)}';
SET @assistant_type = '{sql_escape(assistant_type)}';
SET @provider = '{sql_escape(provider)}';
SET @site_name = '{sql_escape(site_name)}';
SET @site_host = '{sql_escape(site_host)}';
SET @site_token = '{sql_escape(site_token)}';
SET @openai_token = {token_sql};

INSERT INTO tenant (name, openaitoken, openaiorgid, clickhouseconnection)
SELECT @tenant_name, @openai_token, NULL, NULL
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM tenant WHERE name = @tenant_name
);

SELECT id INTO @tenant_id
FROM tenant
WHERE name = @tenant_name
LIMIT 1;

UPDATE tenant
SET openaitoken = @openai_token
WHERE id = @tenant_id
  AND @openai_token IS NOT NULL
  AND @openai_token <> '';

INSERT INTO assistant (name, tenantId, type, deletedAt)
SELECT @assistant_name, @tenant_id, @assistant_type, NULL
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1
  FROM assistant
  WHERE name = @assistant_name
	AND tenantId = @tenant_id
	AND deletedAt IS NULL
);

SELECT id INTO @assistant_id
FROM assistant
WHERE name = @assistant_name
  AND tenantId = @tenant_id
  AND deletedAt IS NULL
ORDER BY id DESC
LIMIT 1;

UPDATE assistant
SET type = @assistant_type
WHERE id = @assistant_id;

INSERT INTO site (name, tenantId, host, token, duration)
VALUES (@site_name, @tenant_id, @site_host, @site_token, 30)
ON DUPLICATE KEY UPDATE
  id = LAST_INSERT_ID(id),
  name = VALUES(name),
  tenantId = VALUES(tenantId),
  token = VALUES(token),
  duration = VALUES(duration);

SET @site_id = LAST_INSERT_ID();

DELETE FROM site_assistant
WHERE siteId = @site_id
  AND context = 'general'
  AND contextInstance = 'general'
  AND deletedAt IS NULL;

INSERT INTO site_assistant (siteId, assistantId, context, contextInstance, deletedAt)
VALUES (@site_id, @assistant_id, 'general', 'general', NULL);

DELETE FROM assistant_meta
WHERE assistantId = @assistant_id
  AND deletedAt IS NULL
  AND `key` IN (
	'activeaudio',
	'disclaimertext',
	'alignstyle',
	'language',
	'model',
	'template',
	'image_upload_glpi',
	'provider'
  );

INSERT INTO assistant_meta (assistantId, `key`, value, deletedAt)
VALUES
	(@assistant_id, 'activeaudio', '{sql_escape(active_audio)}', NULL),
  (@assistant_id, 'disclaimertext', '{sql_escape(disclaimer_text)}', NULL),
  (@assistant_id, 'alignstyle', '{sql_escape(alignstyle)}', NULL),
  (@assistant_id, 'language', '{sql_escape(language)}', NULL),
  (@assistant_id, 'model', '{sql_escape(model)}', NULL),
  (@assistant_id, 'template', '{sql_escape(template)}', NULL),
  (@assistant_id, 'image_upload_glpi', 'false', NULL),
  (@assistant_id, 'provider', '{sql_escape(provider)}', NULL);

SELECT 'Seed complete' AS status, @tenant_id AS tenant_id, @assistant_id AS assistant_id, @site_id AS site_id, @site_token AS site_token;
""".strip()


def run_seed(sql: str, env: dict[str, str]) -> int:
	db_name = optional(env, "ULIBOT_DB_NAME", "ulibot")
	db_user = optional(env, "ULIBOT_DB_USER", "ulibot")
	db_password = optional(env, "ULIBOT_DB_PASSWORD", "ulibot")
	db_service = optional(env, "ULIBOT_DB_SERVICE", "db")

	command = [
		"docker",
		"compose",
		"exec",
		"-T",
		db_service,
		"mysql",
		f"-u{db_user}",
		f"-p{db_password}",
		"-D",
		db_name,
	]

	completed = subprocess.run(
		command,
		input=sql,
		text=True,
		cwd=BACKEND_DIR,
	)
	return completed.returncode


def run_reset() -> int:
	command = [
		"docker",
		"compose",
		"exec",
		"-T",
		"ulibotback",
		"bash",
		"-lc",
		"cd /home/dev/app && poetry run prisma migrate reset --force --skip-seed --schema db/schema.prisma",
	]

	completed = subprocess.run(command, cwd=BACKEND_DIR)
	return completed.returncode


def main() -> int:
	try:
		env = parse_env(ENV_PATH)
		sql = build_sql(env)
	except Exception as exc:
		print(f"Error: {exc}", file=sys.stderr)
		return 1

	print("Resetting database (prisma migrate reset)...")
	reset_code = run_reset()
	if reset_code != 0:
		print("Reset step failed.", file=sys.stderr)
		return reset_code

	print("Running seed...")
	code = run_seed(sql, env)
	if code != 0:
		print("Seed failed.", file=sys.stderr)
		return code

	print("Seed finished.")
	return 0


if __name__ == "__main__":
	raise SystemExit(main())
