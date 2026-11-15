use regex_lite::Regex;
use sdkwork_drive_contract::DriveUri;
use sdkwork_skills_contract::{
    SkillArtifactRecord, SkillArtifactSource, SkillArtifactStatus, SkillCapabilityRecord,
    SkillCategoryRecord, SkillInstallationRecord, SkillInstallationSubjectKind, SkillPackageRecord,
};
use sdkwork_utils_rust::trim;

use crate::{SkillsResult, SkillsServiceError};

fn invalid(message: impl Into<String>) -> SkillsServiceError {
    SkillsServiceError::InvalidArgument(message.into())
}

fn skill_key_pattern() -> Regex {
    Regex::new(r"^skill\.[a-z0-9_-]+(?:\.[a-z0-9_-]+)*$").expect("valid skill key regex")
}

fn capability_key_pattern() -> Regex {
    Regex::new(r"^[a-z0-9_-]+(?:\.[a-z0-9_-]+)+$").expect("valid capability key regex")
}

fn sha256_pattern() -> Regex {
    Regex::new(r"^[0-9a-f]{64}$").expect("valid sha256 regex")
}

fn git_repository_url_pattern() -> Regex {
    Regex::new(r"^https://[A-Za-z0-9][A-Za-z0-9.-]*(?::[0-9]{1,5})?/[^\s]+$")
        .expect("valid git repository URL regex")
}

fn git_ref_pattern() -> Regex {
    Regex::new(r"^[A-Za-z0-9._/-]+$").expect("valid git ref regex")
}

fn role_code_pattern() -> Regex {
    Regex::new(r"^[a-z][a-z0-9_.-]{0,127}$").expect("valid IAM role code regex")
}

pub fn validate_skill_key(value: &str) -> SkillsResult<()> {
    let value = trim(value);
    if !skill_key_pattern().is_match(&value) {
        return Err(invalid(
            "skill_key must use skill.<segment>[.<segment>] lowercase format",
        ));
    }
    Ok(())
}

fn validate_json_object(value: &serde_json::Value, field: &str) -> SkillsResult<()> {
    if !value.is_object() {
        return Err(invalid(format!("{field} must be a JSON object")));
    }
    Ok(())
}

fn validate_drive_uri(drive_uri: &str) -> SkillsResult<()> {
    DriveUri::parse(drive_uri)
        .map_err(|error| invalid(format!("drive source URI is invalid: {error}")))?;
    Ok(())
}

fn validate_git_repository_url(repository_url: &str) -> SkillsResult<()> {
    let value = trim(repository_url);
    if value.len() > 2048 || !git_repository_url_pattern().is_match(&value) {
        return Err(invalid(
            "git repository_url must be an absolute https URL without credentials or whitespace",
        ));
    }
    Ok(())
}

fn validate_git_repository_path(repository_path: &str) -> SkillsResult<()> {
    let value = trim(repository_path);
    if value.is_empty() || value.len() > 1024 {
        return Err(invalid(
            "git repository_path must contain 1 to 1024 characters",
        ));
    }
    if value.starts_with('/') || value.contains('\\') || value.chars().any(char::is_control) {
        return Err(invalid(
            "git repository_path must be a relative POSIX path without control characters",
        ));
    }
    if value != "." {
        for segment in value.split('/') {
            if segment.is_empty() || segment == "." || segment == ".." {
                return Err(invalid(
                    "git repository_path must not contain empty, '.', or '..' segments",
                ));
            }
        }
    }
    Ok(())
}

fn validate_git_ref(git_ref: &str) -> SkillsResult<()> {
    let value = trim(git_ref);
    if value.is_empty() || value.len() > 255 || !git_ref_pattern().is_match(&value) {
        return Err(invalid(
            "git_ref must be a 1 to 255 character branch, tag, or commit id",
        ));
    }
    if value == "@"
        || value.contains("..")
        || value.starts_with('/')
        || value.ends_with('/')
        || value.contains("//")
    {
        return Err(invalid("git_ref is not a safe revision name"));
    }
    Ok(())
}

fn validate_artifact_source(source: &SkillArtifactSource) -> SkillsResult<()> {
    match source {
        SkillArtifactSource::DriveFile {
            drive_uri,
            checksum_sha256,
            ..
        } => {
            validate_drive_uri(drive_uri)?;
            if !sha256_pattern().is_match(checksum_sha256) {
                return Err(invalid(
                    "checksum_sha256 must be 64 lowercase hexadecimal characters",
                ));
            }
        }
        SkillArtifactSource::DriveDirectory { drive_uri } => {
            validate_drive_uri(drive_uri)?;
        }
        SkillArtifactSource::Git {
            repository_url,
            repository_path,
            git_ref,
        } => {
            validate_git_repository_url(repository_url)?;
            validate_git_repository_path(repository_path)?;
            if let Some(value) = git_ref {
                validate_git_ref(value)?;
            }
        }
    }
    Ok(())
}

pub fn validate_artifact_record(record: &SkillArtifactRecord) -> SkillsResult<()> {
    if record.status == SkillArtifactStatus::Yanked {
        return Err(invalid(
            "a new artifact must be draft or published; yanked is a post-publication lifecycle state",
        ));
    }
    if trim(&record.version_label).is_empty() || record.version_label.len() > 128 {
        return Err(invalid("version_label must contain 1 to 128 characters"));
    }
    validate_artifact_source(&record.source)?;
    if trim(&record.entrypoint).is_empty() || record.entrypoint.len() > 255 {
        return Err(invalid("entrypoint must contain 1 to 255 characters"));
    }
    validate_json_object(&record.input_schema, "input_schema")?;
    validate_json_object(&record.output_schema, "output_schema")?;
    validate_json_object(&record.config_schema, "config_schema")?;
    validate_json_object(&record.default_config, "default_config")?;
    if record.capability_keys.len() > 64 {
        return Err(invalid(
            "capability_keys cannot contain more than 64 entries",
        ));
    }
    for key in &record.capability_keys {
        if !capability_key_pattern().is_match(&trim(key)) {
            return Err(invalid(format!("invalid capability key: {key}")));
        }
    }
    Ok(())
}

pub fn validate_skill_package_record(record: &SkillPackageRecord) -> SkillsResult<()> {
    validate_skill_key(&record.skill_key)?;
    for (field, value, max) in [
        ("package_key", record.package_key.as_str(), 128_usize),
        ("code", record.code.as_str(), 128_usize),
        ("display_name", record.display_name.as_str(), 255_usize),
    ] {
        let value = trim(value);
        if value.is_empty() || value.len() > max {
            return Err(invalid(format!(
                "{field} must contain 1 to {max} characters"
            )));
        }
    }
    if record.categories.len() > 32 {
        return Err(invalid("categories cannot contain more than 32 entries"));
    }
    if record.tags.len() > 64 {
        return Err(invalid("tags cannot contain more than 64 entries"));
    }
    if record.allowed_role_codes.len() > 64 {
        return Err(invalid(
            "allowed_role_codes cannot contain more than 64 entries",
        ));
    }
    for code in &record.allowed_role_codes {
        if !role_code_pattern().is_match(&trim(code)) {
            return Err(invalid(format!("invalid allowed role code: {code}")));
        }
    }
    Ok(())
}

pub fn validate_category_record(record: &SkillCategoryRecord) -> SkillsResult<()> {
    if trim(&record.code).is_empty() || record.code.len() > 128 {
        return Err(invalid("category code must contain 1 to 128 characters"));
    }
    if trim(&record.name).is_empty() || record.name.len() > 255 {
        return Err(invalid("category name must contain 1 to 255 characters"));
    }
    if trim(&record.permission_code).is_empty() {
        return Err(invalid("category permission_code is required"));
    }
    Ok(())
}

pub fn validate_capability_record(record: &SkillCapabilityRecord) -> SkillsResult<()> {
    if !capability_key_pattern().is_match(&trim(&record.capability_key)) {
        return Err(invalid(
            "capability_key must contain at least two lowercase dotted segments",
        ));
    }
    if trim(&record.display_name).is_empty() || record.display_name.len() > 255 {
        return Err(invalid(
            "capability display_name must contain 1 to 255 characters",
        ));
    }
    Ok(())
}

pub fn validate_installation_subject(subject_kind: &str, subject_id: u64) -> SkillsResult<()> {
    if SkillInstallationSubjectKind::parse(subject_kind).is_none() {
        return Err(invalid(
            "subject_kind must be user, organization, project, or agent",
        ));
    }
    if subject_id == 0 {
        return Err(invalid("subject_id must be a positive Snowflake id"));
    }
    Ok(())
}

pub fn validate_installation_record(record: &SkillInstallationRecord) -> SkillsResult<()> {
    validate_installation_subject(record.subject_kind.as_str(), record.subject_id)?;
    if record.package_id == 0 || record.artifact_id == 0 || record.installed_by_user_id == 0 {
        return Err(invalid(
            "package_id, artifact_id, and installed_by_user_id are required",
        ));
    }
    validate_json_object(&record.config, "config")
}
