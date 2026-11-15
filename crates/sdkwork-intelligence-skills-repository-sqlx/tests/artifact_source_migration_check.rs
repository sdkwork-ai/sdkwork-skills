use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;

const OLD_ARTIFACT_TABLE: &str = r#"
CREATE TABLE skills_artifact (
    id BIGINT NOT NULL PRIMARY KEY,
    uuid VARCHAR(96) NOT NULL,
    tenant_id BIGINT NOT NULL,
    package_id BIGINT NOT NULL,
    version_label VARCHAR(128) NOT NULL,
    artifact_ref TEXT NOT NULL,
    checksum_sha256 VARCHAR(64) NOT NULL,
    size_bytes BIGINT,
    invocation_kind VARCHAR(64) NOT NULL,
    entrypoint VARCHAR(255) NOT NULL,
    input_schema_json TEXT NOT NULL DEFAULT '{}',
    output_schema_json TEXT NOT NULL DEFAULT '{}',
    config_schema_json TEXT NOT NULL DEFAULT '{}',
    default_config_json TEXT NOT NULL DEFAULT '{}',
    security_profile_id VARCHAR(128),
    status VARCHAR(16) NOT NULL DEFAULT 'draft',
    published_at TIMESTAMPTZ,
    yanked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_skills_artifact_ref CHECK (artifact_ref ~ '^drive://spaces/[^/]+/nodes/[^/]+$'),
    CONSTRAINT ck_skills_artifact_checksum CHECK (checksum_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_skills_artifact_size CHECK (size_bytes IS NULL OR size_bytes >= 0),
    CONSTRAINT ck_skills_artifact_invocation CHECK (invocation_kind IN ('local-workflow', 'process-adapter', 'mcp-tool', 'kernel-provider')),
    CONSTRAINT ck_skills_artifact_status CHECK (status IN ('draft', 'published', 'yanked'))
);
"#;

const MIGRATION: &str =
    include_str!("../../../database/migrations/postgres/0003_skill_artifact_sources.up.sql");

#[tokio::test]
async fn backfills_legacy_drive_artifact_source() {
    let database_url = match std::env::var("SDKWORK_SKILLS_POSTGRES_URL") {
        Ok(value) if !value.trim().is_empty() => value,
        _ => return,
    };
    let admin_pool = PgPoolOptions::new()
        .max_connections(1)
        .connect(&database_url)
        .await
        .expect("connect migration test database");
    let schema = format!(
        "skills_migration_check_{}_{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .expect("time")
            .as_nanos()
    );
    sqlx::query(sqlx::AssertSqlSafe(format!("CREATE SCHEMA \"{schema}\"")))
        .execute(&admin_pool)
        .await
        .expect("create migration test schema");
    let pool: PgPool = PgPoolOptions::new()
        .max_connections(1)
        .connect(&database_url)
        .await
        .expect("connect migration test pool");
    sqlx::query(sqlx::AssertSqlSafe(format!(
        "SET search_path TO \"{schema}\""
    )))
    .execute(&pool)
    .await
    .expect("set migration test search path");

    sqlx::raw_sql(OLD_ARTIFACT_TABLE)
        .execute(&pool)
        .await
        .expect("create legacy artifact table");
    sqlx::query(
        "INSERT INTO skills_artifact (
            id, uuid, tenant_id, package_id, version_label, artifact_ref, checksum_sha256,
            size_bytes, invocation_kind, entrypoint, status
         ) VALUES (1, 'artifact-uuid', 1, 1, '1.0.0',
                   'drive://spaces/skills/nodes/legacy', $1, 42, 'local-workflow', 'run', 'draft')",
    )
    .bind("a".repeat(64))
    .execute(&pool)
    .await
    .expect("insert legacy artifact");

    sqlx::raw_sql(MIGRATION)
        .execute(&pool)
        .await
        .expect("apply artifact source migration");

    let source_json: String =
        sqlx::query_scalar("SELECT source_json FROM skills_artifact WHERE id=1")
            .fetch_one(&pool)
            .await
            .expect("read migrated source_json");
    let source: serde_json::Value = serde_json::from_str(&source_json).expect("parse source_json");
    assert_eq!(source["kind"], "drive_file");
    assert_eq!(source["driveUri"], "drive://spaces/skills/nodes/legacy");
    assert_eq!(source["checksumSha256"], "a".repeat(64));
    assert_eq!(source["sizeBytes"], "42");

    let parsed: sdkwork_skills_contract::SkillArtifactSource =
        serde_json::from_value(source).expect("backfilled source must match the Rust contract");
    assert_eq!(
        parsed,
        sdkwork_skills_contract::SkillArtifactSource::DriveFile {
            drive_uri: "drive://spaces/skills/nodes/legacy".to_string(),
            checksum_sha256: "a".repeat(64),
            size_bytes: Some(42),
        }
    );

    pool.close().await;
    sqlx::query(sqlx::AssertSqlSafe(format!(
        "DROP SCHEMA \"{schema}\" CASCADE"
    )))
    .execute(&admin_pool)
    .await
    .expect("drop migration test schema");
    admin_pool.close().await;
}
