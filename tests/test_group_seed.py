"""Check local group wiring without starting Docker, migrating, or contacting providers."""
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("group_seed", ROOT / "container-setup" / "seed.py")
seed = importlib.util.module_from_spec(spec)
spec.loader.exec_module(seed)


def test_group_contexts_reuse_the_configured_assistant_without_replacing_personal_mappings():
    environment = {
        "ULIBOT_TENANT_NAME": "Local tenant", "ULIBOT_ASSISTANT_NAME": "Local assistant",
        "ULIBOT_SITE_NAME": "Local site", "ULIBOT_SITE_HOST": "localhost",
        "ULIBOT_SITE_TOKEN": "test-only-secret", "ULIBOT_ASSISTANT_TYPE": "openairesponses",
    }
    sql = seed.build_sql(environment)
    fixtures = json.loads(seed.GROUP_FIXTURES_PATH.read_text(encoding="utf-8"))
    contexts = {(room["context"], room["contextinstance"]) for room in fixtures["rooms"]}
    for context, instance in contexts:
        assert sql.count(f"VALUES (@site_id, @assistant_id, '{context}', '{instance}', NULL);") == 1
    assert "VALUES (@site_id, @assistant_id, 'general', 'general', NULL);" in sql
    assert "VALUES (@site_id, @inline_id, 'general', 'inline', NULL);" in sql
    assert "SET @assistant_type = 'openairesponses';" in sql
