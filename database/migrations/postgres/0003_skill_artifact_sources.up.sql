-- sdkwork:migration
-- id: 0003_skill_artifact_sources
-- engine: postgres
-- module: sdkwork-skills
-- purpose: Introduce a structured artifact source descriptor (Drive file,
--   Drive directory, Git repository) and backfill legacy Drive archive rows
--   into source_json. The legacy artifact_ref/checksum_sha256 columns stay
--   nullable for compatibility, but source_json is the read authority.
-- reversible: false
-- rollback: forward-fix (source_json is the only complete descriptor for
--   directory and Git artifacts; dropping it would discard artifact identity)
-- transactional: true
-- lock: lightweight
-- lock_timeout: 2s
-- statement_timeout: 30s

BEGIN;

ALTER TABLE skills_artifact
    ADD COLUMN IF NOT EXISTS source_json TEXT;

UPDATE skills_artifact
SET source_json = json_build_object(
    'kind', 'drive_file',
    'driveUri', artifact_ref,
    'checksumSha256', checksum_sha256,
    'sizeBytes', CASE WHEN size_bytes IS NULL THEN NULL ELSE size_bytes::text END
)::text
WHERE source_json IS NULL OR source_json = '';

ALTER TABLE skills_artifact
    ALTER COLUMN source_json SET NOT NULL;

ALTER TABLE skills_artifact
    DROP CONSTRAINT IF EXISTS ck_skills_artifact_ref;

ALTER TABLE skills_artifact
    DROP CONSTRAINT IF EXISTS ck_skills_artifact_checksum;

ALTER TABLE skills_artifact
    ALTER COLUMN artifact_ref DROP NOT NULL;

ALTER TABLE skills_artifact
    ALTER COLUMN checksum_sha256 DROP NOT NULL;

ALTER TABLE skills_artifact
    ADD CONSTRAINT ck_skills_artifact_source
        CHECK (jsonb_typeof(source_json::jsonb) = 'object');

ALTER TABLE skills_artifact
    ADD CONSTRAINT ck_skills_artifact_source_kind
        CHECK (source_json::jsonb ->> 'kind' IN ('drive_file', 'drive_directory', 'git'));

COMMIT;
