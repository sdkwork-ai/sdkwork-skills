use sdkwork_skills_contract::{
    SkillArtifactRecord, SkillArtifactSource, SkillArtifactStatus, SkillInvocationKind,
    SkillLifecycleStatus, SkillPackageRecord, SkillVisibility,
};

use super::validation::{
    validate_artifact_record, validate_installation_subject, validate_skill_package_record,
};

const SHA256: &str = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

fn artifact(source: SkillArtifactSource) -> SkillArtifactRecord {
    SkillArtifactRecord {
        id: 0,
        uuid: String::new(),
        tenant_id: 1,
        package_id: 0,
        version_label: "1.0.0".to_string(),
        source,
        invocation_kind: SkillInvocationKind::LocalWorkflow,
        entrypoint: "run".to_string(),
        input_schema: serde_json::json!({}),
        output_schema: serde_json::json!({}),
        config_schema: serde_json::json!({}),
        default_config: serde_json::json!({}),
        security_profile_id: None,
        status: SkillArtifactStatus::Published,
        capability_keys: Vec::new(),
        published_at: None,
        yanked_at: None,
        created_at: String::new(),
    }
}

fn drive_file(drive_uri: &str, checksum: &str) -> SkillArtifactRecord {
    artifact(SkillArtifactSource::DriveFile {
        drive_uri: drive_uri.to_string(),
        checksum_sha256: checksum.to_string(),
        size_bytes: Some(42),
    })
}

fn git(repository_url: &str, repository_path: &str, git_ref: Option<&str>) -> SkillArtifactRecord {
    artifact(SkillArtifactSource::Git {
        repository_url: repository_url.to_string(),
        repository_path: repository_path.to_string(),
        git_ref: git_ref.map(str::to_string),
    })
}

fn package() -> SkillPackageRecord {
    SkillPackageRecord {
        id: 0,
        uuid: String::new(),
        tenant_id: 1,
        organization_id: 0,
        owner_user_id: 1,
        skill_key: "skill.demo.run".to_string(),
        package_key: "demo-run".to_string(),
        code: "demo-run".to_string(),
        display_name: "Demo Run".to_string(),
        summary: None,
        description: None,
        categories: Vec::new(),
        tags: Vec::new(),
        allowed_role_codes: Vec::new(),
        status: SkillLifecycleStatus::Active,
        visibility: SkillVisibility::Tenant,
        featured: false,
        sort_weight: 0,
        version: 1,
        created_at: String::new(),
        updated_at: String::new(),
        deleted_at: None,
    }
}

#[test]
fn accepts_drive_file_artifact_with_sha256() {
    let record = drive_file("drive://spaces/skills-dev/nodes/demo-package", SHA256);
    validate_artifact_record(&record).expect("valid drive file artifact");
    validate_skill_package_record(&package()).expect("valid package");
}

#[test]
fn rejects_drive_file_with_non_drive_uri_or_invalid_checksum() {
    assert!(validate_artifact_record(&drive_file("https://example.com/demo.zip", SHA256)).is_err());
    assert!(
        validate_artifact_record(&drive_file("drive://spaces/skills-dev/nodes/demo", "bad"))
            .is_err()
    );
}

#[test]
fn accepts_drive_directory_artifact() {
    let record = artifact(SkillArtifactSource::DriveDirectory {
        drive_uri: "drive://spaces/skills-dev/nodes/skill-directory".to_string(),
    });
    validate_artifact_record(&record).expect("valid drive directory artifact");
}

#[test]
fn rejects_drive_directory_with_invalid_uri() {
    let record = artifact(SkillArtifactSource::DriveDirectory {
        drive_uri: "https://example.com/skill-directory".to_string(),
    });
    assert!(validate_artifact_record(&record).is_err());
}

#[test]
fn accepts_git_repository_artifact() {
    let record = git(
        "https://github.com/sdkwork/skills.git",
        "skills/demo",
        Some("main"),
    );
    validate_artifact_record(&record).expect("valid git repository artifact");

    let without_ref = git("https://github.com/sdkwork/skills.git", ".", None);
    validate_artifact_record(&without_ref).expect("valid git repository root artifact");
}

#[test]
fn artifact_source_wire_shape_is_a_camel_case_discriminated_union() {
    let drive = SkillArtifactSource::DriveFile {
        drive_uri: "drive://spaces/skills-dev/nodes/demo".to_string(),
        checksum_sha256: SHA256.to_string(),
        size_bytes: Some(42),
    };
    let drive_json = serde_json::to_value(&drive).expect("serialize drive source");
    assert_eq!(drive_json["kind"], "drive_file");
    assert_eq!(
        drive_json["driveUri"],
        "drive://spaces/skills-dev/nodes/demo"
    );
    assert_eq!(drive_json["sizeBytes"], "42");
    let parsed: SkillArtifactSource =
        serde_json::from_value(drive_json).expect("deserialize drive source");
    assert_eq!(parsed, drive);

    let git = SkillArtifactSource::Git {
        repository_url: "https://github.com/sdkwork/skills.git".to_string(),
        repository_path: "skills/demo".to_string(),
        git_ref: Some("main".to_string()),
    };
    let git_json = serde_json::to_value(&git).expect("serialize git source");
    assert_eq!(git_json["kind"], "git");
    assert_eq!(
        git_json["repositoryUrl"],
        "https://github.com/sdkwork/skills.git"
    );
    assert_eq!(git_json["repositoryPath"], "skills/demo");
    assert_eq!(git_json["gitRef"], "main");
    let parsed: SkillArtifactSource =
        serde_json::from_value(git_json).expect("deserialize git source");
    assert_eq!(parsed, git);
}

#[test]
fn rejects_unsafe_git_repository_artifact() {
    assert!(validate_artifact_record(&git(
        "http://github.com/sdkwork/skills.git",
        "skills/demo",
        None
    ))
    .is_err());
    assert!(validate_artifact_record(&git(
        "https://user:secret@github.com/sdkwork/skills.git",
        "skills/demo",
        None
    ))
    .is_err());
    assert!(validate_artifact_record(&git(
        "https://github.com/sdkwork/skills.git",
        "/skills/demo",
        None
    ))
    .is_err());
    assert!(validate_artifact_record(&git(
        "https://github.com/sdkwork/skills.git",
        "skills/../demo",
        None
    ))
    .is_err());
    assert!(validate_artifact_record(&git(
        "https://github.com/sdkwork/skills.git",
        "skills/demo",
        Some("bad ref")
    ))
    .is_err());
}

#[test]
fn rejects_artifact_created_directly_in_yanked_state() {
    let mut record = drive_file("drive://spaces/skills-dev/nodes/yanked-package", SHA256);
    record.status = SkillArtifactStatus::Yanked;

    assert!(validate_artifact_record(&record).is_err());
}

#[test]
fn installation_subjects_use_iam_and_agents_authorities() {
    for subject_kind in ["user", "organization", "project", "agent"] {
        validate_installation_subject(subject_kind, 1).expect("canonical installation subject");
    }
    assert!(validate_installation_subject("workspace", 1).is_err());
    assert!(validate_installation_subject("project", 0).is_err());
}

#[test]
fn validates_allowed_role_codes() {
    let mut record = package();
    record.allowed_role_codes = vec![
        "org_admin".to_string(),
        "skills_marketplace_user".to_string(),
    ];
    validate_skill_package_record(&record).expect("canonical role codes");

    record.allowed_role_codes = vec!["Org Admin".to_string()];
    assert!(validate_skill_package_record(&record).is_err());

    record.allowed_role_codes = (0..65).map(|index| format!("role_{index}")).collect();
    assert!(validate_skill_package_record(&record).is_err());
}
