-- Select all assistants of type 'openairesponses' along with their model configuration
SELECT a.id, a.name, a.type, am.value AS model
FROM assistant a
JOIN assistant_meta am ON am.assistantId = a.id AND am.key = 'model' AND am.deletedAt IS NULL
WHERE a.type = 'openairesponses';

-- Update the model value for all assistants of type 'openairesponses' to 'gpt-5-mini-2025-08-07'
UPDATE assistant_meta am
JOIN assistant a ON a.id = am.assistantId
SET am.value = 'gpt-5-mini-2025-08-07'
WHERE am.key = 'model'
  AND am.deletedAt IS NULL
  AND a.type = 'openairesponses'
  AND a.deletedAt IS NULL;