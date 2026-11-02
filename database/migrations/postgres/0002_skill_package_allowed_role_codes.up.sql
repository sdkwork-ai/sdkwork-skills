-- sdkwork:migration
-- id: 0002_skill_package_allowed_role_codes
-- engine: postgres
-- module: sdkwork-skills
-- purpose: Assign Skill packages to IAM roles. `allowed_role_codes` holds the
--   role codes allowed to see and install a package; an empty array (the
--   default) means every role, which keeps existing rows visible to all.
-- reversible: true
-- rollback: down-migration
-- transactional: true
-- lock: lightweight
-- lock_timeout: 2s
-- statement_timeout: 30s

BEGIN;

ALTER TABLE skills_package
    ADD COLUMN IF NOT EXISTS allowed_role_codes TEXT NOT NULL DEFAULT '[]'
        CHECK (jsonb_typeof(allowed_role_codes::jsonb) = 'array');

UPDATE skills_package
SET allowed_role_codes = '[]'
WHERE allowed_role_codes IS NULL OR jsonb_typeof(allowed_role_codes::jsonb) <> 'array';

CREATE INDEX IF NOT EXISTS idx_skills_package_allowed_roles
    ON skills_package USING GIN ((allowed_role_codes::jsonb))
    WHERE deleted_at IS NULL;

COMMIT;
