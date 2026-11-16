use std::sync::Arc;

use axum::{
    extract::{Extension, Path, Query, State},
    response::Response,
    Json,
};
use sdkwork_intelligence_skills_service::{SkillsRepository, SkillsService};
use sdkwork_routes_skills_common::mapper::{artifact_record, self_service_package_aggregate};
use sdkwork_routes_skills_common::{
    create_artifact, create_skill_package, delete_skill_package, ensure_app_package_visible,
    finish_api_json, finish_created_api_json, finish_no_content, get_marketplace_skill_package,
    get_skill, install_skill, list_categories, list_hub_skills, list_installable_artifacts,
    list_installations, list_marketplace_skill_packages, list_owned_skill_packages, ok_json,
    parse_resource_id, update_skill_package, ApiProblem, CreateSkillArtifactCommand,
    CreateSkillInstallationCommand, CreateSkillPackageCommand, SdkWorkListQuery,
    SkillCategoryListQuery, SkillInstallationListQuery, UpdateOwnSkillPackageCommand,
};
use sdkwork_skills_contract::{
    SkillCategoryType, SkillInstallationSubjectKind, SkillPackageRecord, PERM_INSTALLATIONS_MANAGE,
};
use sdkwork_web_core::WebRequestContext;

use crate::mapper::installation_record;
use crate::{SkillInstallationTargetAuthorizer, SkillsAppRequestContext};

#[derive(Clone)]
pub struct AppState<R: SkillsRepository> {
    pub service: Arc<SkillsService<R>>,
    pub target_authorizer: Arc<dyn SkillInstallationTargetAuthorizer>,
}

pub(crate) async fn list_package_artifacts<R>(
    ctx: WebRequestContext,
    State(state): State<AppState<R>>,
    Extension(context): Extension<SkillsAppRequestContext>,
    Path(package_id): Path<String>,
    Query(query): Query<SdkWorkListQuery>,
) -> Response
where
    R: SkillsRepository + Send + Sync,
{
    finish_api_json(
        &ctx,
        async {
            let package_id = parse_resource_id(&package_id, "packageId")?;
            // The artifact rows are a package-scoped view, so the parent package
            // must be catalog-visible first; an invisible package is a 404, not
            // an empty 200 list.
            ensure_app_package_visible(
                state.service.as_ref(),
                context.tenant_id,
                context.organization_id,
                context.actor_id,
                package_id,
            )
            .await?;
            list_installable_artifacts(
                state.service.as_ref(),
                context.tenant_id,
                context.organization_id,
                context.actor_id,
                package_id,
                &query,
            )
            .await
        }
        .await,
    )
}

pub(crate) async fn list_skills<R>(
    ctx: WebRequestContext,
    State(state): State<AppState<R>>,
    Extension(context): Extension<SkillsAppRequestContext>,
    Query(query): Query<SdkWorkListQuery>,
) -> Response
where
    R: SkillsRepository + Send + Sync,
{
    finish_api_json(
        &ctx,
        list_hub_skills(
            state.service.as_ref(),
            context.tenant_id,
            context.organization_id,
            context.actor_id,
            &query,
        )
        .await,
    )
}

pub(crate) async fn retrieve_skill<R>(
    ctx: WebRequestContext,
    State(state): State<AppState<R>>,
    Extension(context): Extension<SkillsAppRequestContext>,
    Path(skill_key): Path<String>,
) -> Response
where
    R: SkillsRepository + Send + Sync,
{
    finish_api_json(
        &ctx,
        get_skill(
            state.service.as_ref(),
            context.tenant_id,
            context.organization_id,
            context.actor_id,
            skill_key.as_str(),
        )
        .await,
    )
}

pub(crate) async fn list_packages<R>(
    ctx: WebRequestContext,
    State(state): State<AppState<R>>,
    Extension(context): Extension<SkillsAppRequestContext>,
    Query(query): Query<SdkWorkListQuery>,
) -> Response
where
    R: SkillsRepository + Send + Sync,
{
    finish_api_json(
        &ctx,
        list_marketplace_skill_packages(
            state.service.as_ref(),
            context.tenant_id,
            context.organization_id,
            context.actor_id,
            &query,
        )
        .await,
    )
}

pub(crate) async fn retrieve_package<R>(
    ctx: WebRequestContext,
    State(state): State<AppState<R>>,
    Extension(context): Extension<SkillsAppRequestContext>,
    Path(package_id): Path<String>,
) -> Response
where
    R: SkillsRepository + Send + Sync,
{
    finish_api_json(
        &ctx,
        async {
            let package_id = parse_resource_id(&package_id, "packageId")?;
            get_marketplace_skill_package(
                state.service.as_ref(),
                context.tenant_id,
                context.organization_id,
                context.actor_id,
                package_id,
            )
            .await
        }
        .await,
    )
}

/// Self-service package ownership guard: only the authenticated creator may
/// mutate a package within the active tenant.
///
/// Unlike the package-scoped reads, the self-service writes deliberately do not
/// require catalog visibility: a draft package is exactly the state its owner
/// edits before publishing, and the ownership predicate already keeps every
/// other user out.
fn ensure_owned_package(
    context: &SkillsAppRequestContext,
    package: &SkillPackageRecord,
) -> Result<(), ApiProblem> {
    if package.tenant_id == context.tenant_id && package.owner_user_id == context.actor_id {
        Ok(())
    } else {
        Err(ApiProblem::forbidden(
            "skill package is outside the authenticated user's ownership scope",
        ))
    }
}

pub(crate) async fn list_owned_packages<R>(
    ctx: WebRequestContext,
    State(state): State<AppState<R>>,
    Extension(context): Extension<SkillsAppRequestContext>,
    Query(query): Query<SdkWorkListQuery>,
) -> Response
where
    R: SkillsRepository + Send + Sync,
{
    finish_api_json(
        &ctx,
        list_owned_skill_packages(
            state.service.as_ref(),
            context.tenant_id,
            context.actor_id,
            &query,
        )
        .await,
    )
}

pub(crate) async fn create_package<R>(
    ctx: WebRequestContext,
    State(state): State<AppState<R>>,
    Extension(context): Extension<SkillsAppRequestContext>,
    Json(body): Json<CreateSkillPackageCommand>,
) -> Response
where
    R: SkillsRepository + Send + Sync,
{
    let (package, initial_artifact) = self_service_package_aggregate(
        context.tenant_id,
        context.organization_id,
        context.actor_id,
        body,
    );
    finish_created_api_json(
        &ctx,
        create_skill_package(state.service.as_ref(), package, initial_artifact).await,
    )
}

pub(crate) async fn update_package<R>(
    ctx: WebRequestContext,
    State(state): State<AppState<R>>,
    Extension(context): Extension<SkillsAppRequestContext>,
    Path(package_id): Path<String>,
    Json(body): Json<UpdateOwnSkillPackageCommand>,
) -> Response
where
    R: SkillsRepository + Send + Sync,
{
    finish_api_json(
        &ctx,
        async {
            let package_id = parse_resource_id(&package_id, "packageId")?;
            let mut record = state
                .service
                .get_skill_package(context.tenant_id, package_id)
                .await
                .map_err(ApiProblem::from)?;
            ensure_owned_package(&context, &record)?;
            record.version = body.version;
            if let Some(value) = body.display_name {
                record.display_name = value;
            }
            body.summary.apply_to(&mut record.summary);
            body.description.apply_to(&mut record.description);
            if let Some(value) = body.categories {
                record.categories = value;
            }
            if let Some(value) = body.tags {
                record.tags = value;
            }
            update_skill_package(state.service.as_ref(), record).await
        }
        .await,
    )
}

pub(crate) async fn delete_package<R>(
    ctx: WebRequestContext,
    State(state): State<AppState<R>>,
    Extension(context): Extension<SkillsAppRequestContext>,
    Path(package_id): Path<String>,
) -> Response
where
    R: SkillsRepository + Send + Sync,
{
    finish_no_content(
        &ctx,
        async {
            let package_id = parse_resource_id(&package_id, "packageId")?;
            let package = state
                .service
                .get_skill_package(context.tenant_id, package_id)
                .await
                .map_err(ApiProblem::from)?;
            ensure_owned_package(&context, &package)?;
            delete_skill_package(state.service.as_ref(), context.tenant_id, package_id).await
        }
        .await,
    )
}

pub(crate) async fn create_package_artifact<R>(
    ctx: WebRequestContext,
    State(state): State<AppState<R>>,
    Extension(context): Extension<SkillsAppRequestContext>,
    Path(package_id): Path<String>,
    Json(body): Json<CreateSkillArtifactCommand>,
) -> Response
where
    R: SkillsRepository + Send + Sync,
{
    finish_created_api_json(
        &ctx,
        async {
            let package_id = parse_resource_id(&package_id, "packageId")?;
            let package = state
                .service
                .get_skill_package(context.tenant_id, package_id)
                .await
                .map_err(ApiProblem::from)?;
            ensure_owned_package(&context, &package)?;
            create_artifact(
                state.service.as_ref(),
                artifact_record(context.tenant_id, package_id, body),
            )
            .await
        }
        .await,
    )
}

pub(crate) async fn list_skill_categories<R>(
    ctx: WebRequestContext,
    State(state): State<AppState<R>>,
    Extension(context): Extension<SkillsAppRequestContext>,
    Query(query): Query<SkillCategoryListQuery>,
) -> Response
where
    R: SkillsRepository + Send + Sync,
{
    let category_type = query
        .category_type
        .unwrap_or(SkillCategoryType::SkillMarket);
    finish_api_json(
        &ctx,
        list_categories(
            state.service.as_ref(),
            context.tenant_id,
            category_type.as_str(),
            // The end-user catalog hides categories the registry marks hidden
            // or inactive; the backend admin list keeps returning them.
            true,
            &query.pagination,
        )
        .await,
    )
}

async fn authorize_target(
    ctx: &WebRequestContext,
    context: &SkillsAppRequestContext,
    authorizer: &dyn SkillInstallationTargetAuthorizer,
    subject_kind: SkillInstallationSubjectKind,
    subject_id: u64,
) -> Result<(SkillInstallationSubjectKind, u64), ApiProblem> {
    if subject_id == 0 {
        return Err(ApiProblem::bad_request(
            "installation target id must be a positive Snowflake id",
        ));
    }
    if subject_kind == SkillInstallationSubjectKind::User {
        return if subject_id == context.actor_id {
            Ok((subject_kind, subject_id))
        } else {
            Err(ApiProblem::forbidden(
                "a user installation target must be the authenticated user",
            ))
        };
    }
    if !ctx.has_permission(PERM_INSTALLATIONS_MANAGE) {
        return Err(ApiProblem::forbidden(format!(
            "{} is required for non-user installation targets",
            PERM_INSTALLATIONS_MANAGE
        )));
    }
    if subject_kind == SkillInstallationSubjectKind::Organization {
        return if context.organization_id > 0 && subject_id == context.organization_id {
            Ok((subject_kind, subject_id))
        } else {
            Err(ApiProblem::forbidden(
                "an organization installation target must be the authenticated organization",
            ))
        };
    }
    if !authorizer
        .authorize(context, subject_kind, subject_id)
        .await
    {
        return Err(ApiProblem::forbidden(
            "installation target is outside the authenticated principal's authorized scope",
        ));
    }
    Ok((subject_kind, subject_id))
}

#[cfg(test)]
mod target_authority_tests {
    use super::*;

    #[test]
    fn canonical_subject_kinds_keep_iam_and_agents_authorities_distinct() {
        assert_eq!(SkillInstallationSubjectKind::User.as_str(), "user");
        assert_eq!(
            SkillInstallationSubjectKind::Organization.as_str(),
            "organization"
        );
        assert_eq!(SkillInstallationSubjectKind::Project.as_str(), "project");
        assert_eq!(SkillInstallationSubjectKind::Agent.as_str(), "agent");
        assert!(SkillInstallationSubjectKind::parse("workspace").is_none());
    }
}

pub(crate) async fn create_installation<R>(
    ctx: WebRequestContext,
    State(state): State<AppState<R>>,
    Extension(context): Extension<SkillsAppRequestContext>,
    Path(package_id): Path<String>,
    Json(body): Json<CreateSkillInstallationCommand>,
) -> Response
where
    R: SkillsRepository + Send + Sync,
{
    finish_created_api_json(
        &ctx,
        async {
            let package_id = parse_resource_id(&package_id, "packageId")?;
            // Installing is reachable by package id alone, so it needs the same
            // catalog-visibility gate as the reads: a caller may not install a
            // package whose retrieve operation answers 404.
            ensure_app_package_visible(
                state.service.as_ref(),
                context.tenant_id,
                context.organization_id,
                context.actor_id,
                package_id,
            )
            .await?;
            let (subject_kind, subject_id) = match body.target {
                Some(target) => {
                    authorize_target(
                        &ctx,
                        &context,
                        state.target_authorizer.as_ref(),
                        target.kind,
                        target.id,
                    )
                    .await?
                }
                None => (SkillInstallationSubjectKind::User, context.actor_id),
            };
            let record = installation_record(
                &context,
                package_id,
                body.artifact_id,
                subject_kind,
                subject_id,
                body.config,
            );
            install_skill(state.service.as_ref(), record).await
        }
        .await,
    )
}

pub(crate) async fn list_skill_installations<R>(
    ctx: WebRequestContext,
    State(state): State<AppState<R>>,
    Extension(context): Extension<SkillsAppRequestContext>,
    Query(query): Query<SkillInstallationListQuery>,
) -> Response
where
    R: SkillsRepository + Send + Sync,
{
    finish_api_json(
        &ctx,
        async {
            let (subject_kind, subject_id) = match (query.subject_kind, query.subject_id) {
                (None, None) | (Some(SkillInstallationSubjectKind::User), None) => {
                    (SkillInstallationSubjectKind::User, context.actor_id)
                }
                (None, Some(_)) => {
                    return Err(ApiProblem::bad_request(
                        "subject_kind is required when subject_id is provided",
                    ));
                }
                (Some(kind), Some(id)) => {
                    authorize_target(&ctx, &context, state.target_authorizer.as_ref(), kind, id)
                        .await?
                }
                (Some(_), None) => {
                    return Err(ApiProblem::bad_request(
                        "subject_id is required for non-user installation targets",
                    ));
                }
            };
            ok_json(
                list_installations(
                    state.service.as_ref(),
                    context.tenant_id,
                    context.organization_id,
                    subject_kind.as_str(),
                    subject_id,
                    &query.pagination,
                )
                .await?,
            )
        }
        .await,
    )
}

#[cfg(test)]
mod package_visibility_tests {
    use std::sync::atomic::{AtomicUsize, Ordering};

    use async_trait::async_trait;
    use axum::http::StatusCode;
    use sdkwork_intelligence_skills_service::{
        SkillsRepository, SkillsResult, SkillsService, SkillsServiceError,
    };
    use sdkwork_skills_contract::{
        SkillArtifactRecord, SkillCapabilityRecord, SkillCategoryRecord, SkillInstallationRecord,
        SkillLifecycleStatus, SkillRecord, SkillVisibility,
    };
    use sdkwork_utils_rust::{CatalogViewFilter, OffsetListPageParams};
    use sdkwork_web_core::{
        ServerRequestId, WebApiSurface, WebAuthMode, WebRequestContext, WebTransportFacts,
    };

    use crate::DenyExternalInstallationTargets;

    use super::*;

    const TENANT_ID: u64 = 7;
    const ORGANIZATION_ID: u64 = 11;
    const ACTOR_ID: u64 = 9;
    const PACKAGE_ID: u64 = 4242;
    const ARTIFACT_ID: u64 = 555;

    fn unused<T>() -> SkillsResult<T> {
        Err(SkillsServiceError::Repository(
            "stub repository method is not expected in this test".to_string(),
        ))
    }

    fn visible_package() -> SkillPackageRecord {
        SkillPackageRecord {
            id: PACKAGE_ID,
            uuid: "00000000-0000-0000-0000-000000000001".to_string(),
            tenant_id: TENANT_ID,
            organization_id: ORGANIZATION_ID,
            owner_user_id: ACTOR_ID,
            skill_key: "demo-skill".to_string(),
            package_key: "demo-package".to_string(),
            code: "demo".to_string(),
            display_name: "Demo".to_string(),
            summary: None,
            description: None,
            categories: Vec::new(),
            tags: Vec::new(),
            allowed_role_codes: Vec::new(),
            status: SkillLifecycleStatus::Active,
            visibility: SkillVisibility::Public,
            featured: false,
            sort_weight: 0,
            version: 1,
            created_at: "2026-01-01T00:00:00Z".to_string(),
            updated_at: "2026-01-01T00:00:00Z".to_string(),
            deleted_at: None,
        }
    }

    /// Repository stub that answers only the operations the gated app handlers
    /// need and counts them, so a test can prove the visibility guard runs
    /// before the sub-resource read/write.
    #[derive(Clone, Default)]
    struct StubSkillsRepository {
        marketplace_reads: Arc<AtomicUsize>,
        artifact_list_reads: Arc<AtomicUsize>,
        installation_writes: Arc<AtomicUsize>,
        visible_package: Option<SkillPackageRecord>,
    }

    impl StubSkillsRepository {
        fn invisible() -> Self {
            Self::default()
        }

        fn with_visible_package() -> Self {
            Self {
                visible_package: Some(visible_package()),
                ..Self::default()
            }
        }

        fn marketplace_reads(&self) -> usize {
            self.marketplace_reads.load(Ordering::SeqCst)
        }

        fn artifact_list_reads(&self) -> usize {
            self.artifact_list_reads.load(Ordering::SeqCst)
        }

        fn installation_writes(&self) -> usize {
            self.installation_writes.load(Ordering::SeqCst)
        }
    }

    #[async_trait]
    impl SkillsRepository for StubSkillsRepository {
        async fn list_skill_packages_page(
            &self,
            _tenant_id: u64,
            _params: OffsetListPageParams,
            _keyword: Option<&str>,
            _filter: &CatalogViewFilter,
        ) -> SkillsResult<(Vec<SkillPackageRecord>, i64)> {
            unused()
        }

        async fn list_owned_skill_packages_page(
            &self,
            _tenant_id: u64,
            _owner_user_id: u64,
            _params: OffsetListPageParams,
            _keyword: Option<&str>,
        ) -> SkillsResult<(Vec<SkillPackageRecord>, i64)> {
            unused()
        }

        async fn get_skill_package(
            &self,
            _tenant_id: u64,
            _package_id: u64,
        ) -> SkillsResult<SkillPackageRecord> {
            unused()
        }

        async fn list_marketplace_skill_packages_page(
            &self,
            _tenant_id: u64,
            _organization_id: u64,
            _user_id: u64,
            _params: OffsetListPageParams,
            _keyword: Option<&str>,
            _filter: &CatalogViewFilter,
        ) -> SkillsResult<(Vec<SkillPackageRecord>, i64)> {
            unused()
        }

        async fn get_marketplace_skill_package(
            &self,
            _tenant_id: u64,
            _organization_id: u64,
            _user_id: u64,
            package_id: u64,
        ) -> SkillsResult<SkillPackageRecord> {
            self.marketplace_reads.fetch_add(1, Ordering::SeqCst);
            self.visible_package
                .clone()
                .ok_or_else(|| SkillsServiceError::NotFound(format!("skill package {package_id}")))
        }

        async fn create_skill_package(
            &self,
            _package: SkillPackageRecord,
            _initial_artifact: SkillArtifactRecord,
        ) -> SkillsResult<SkillPackageRecord> {
            unused()
        }

        async fn update_skill_package(
            &self,
            _package: SkillPackageRecord,
        ) -> SkillsResult<SkillPackageRecord> {
            unused()
        }

        async fn delete_skill_package(
            &self,
            _tenant_id: u64,
            _package_id: u64,
        ) -> SkillsResult<()> {
            unused()
        }

        async fn list_skills_page(
            &self,
            _tenant_id: u64,
            _organization_id: u64,
            _user_id: u64,
            _params: OffsetListPageParams,
            _keyword: Option<&str>,
            _filter: &CatalogViewFilter,
        ) -> SkillsResult<(Vec<SkillRecord>, i64)> {
            unused()
        }

        async fn get_skill(
            &self,
            _tenant_id: u64,
            _organization_id: u64,
            _user_id: u64,
            _skill_key: &str,
        ) -> SkillsResult<SkillRecord> {
            unused()
        }

        async fn get_category(
            &self,
            _tenant_id: u64,
            _category_id: u64,
        ) -> SkillsResult<SkillCategoryRecord> {
            unused()
        }

        async fn list_categories_page(
            &self,
            _tenant_id: u64,
            _category_type: &str,
            _params: OffsetListPageParams,
            _keyword: Option<&str>,
            _visible_only: bool,
        ) -> SkillsResult<(Vec<SkillCategoryRecord>, i64)> {
            unused()
        }

        async fn upsert_category(
            &self,
            _record: SkillCategoryRecord,
        ) -> SkillsResult<SkillCategoryRecord> {
            unused()
        }

        async fn list_capabilities_page(
            &self,
            _tenant_id: u64,
            _params: OffsetListPageParams,
            _keyword: Option<&str>,
        ) -> SkillsResult<(Vec<SkillCapabilityRecord>, i64)> {
            unused()
        }

        async fn get_capability(
            &self,
            _tenant_id: u64,
            _capability_id: u64,
        ) -> SkillsResult<SkillCapabilityRecord> {
            unused()
        }

        async fn upsert_capability(
            &self,
            _record: SkillCapabilityRecord,
        ) -> SkillsResult<SkillCapabilityRecord> {
            unused()
        }

        async fn list_artifacts_page(
            &self,
            _tenant_id: u64,
            _package_id: u64,
            _params: OffsetListPageParams,
        ) -> SkillsResult<(Vec<SkillArtifactRecord>, i64)> {
            unused()
        }

        async fn list_installable_artifacts_page(
            &self,
            _tenant_id: u64,
            _organization_id: u64,
            _user_id: u64,
            _package_id: u64,
            _params: OffsetListPageParams,
        ) -> SkillsResult<(Vec<SkillArtifactRecord>, i64)> {
            self.artifact_list_reads.fetch_add(1, Ordering::SeqCst);
            Ok((Vec::new(), 0))
        }

        async fn create_artifact(
            &self,
            _artifact: SkillArtifactRecord,
        ) -> SkillsResult<SkillArtifactRecord> {
            unused()
        }

        async fn install_skill(
            &self,
            _record: SkillInstallationRecord,
        ) -> SkillsResult<SkillInstallationRecord> {
            self.installation_writes.fetch_add(1, Ordering::SeqCst);
            unused()
        }

        async fn list_installations_page(
            &self,
            _tenant_id: u64,
            _organization_id: u64,
            _subject_kind: &str,
            _subject_id: u64,
            _params: OffsetListPageParams,
        ) -> SkillsResult<(Vec<SkillInstallationRecord>, i64)> {
            unused()
        }
    }

    fn request_context() -> WebRequestContext {
        WebRequestContext {
            request_id: ServerRequestId("skills-app-visibility-test".to_owned()),
            api_surface: WebApiSurface::AppApi,
            auth_mode: WebAuthMode::DualToken,
            principal: None,
            transport: WebTransportFacts {
                path: "/app/v3/api/skill_packages/4242/artifacts".to_owned(),
                method: "GET".to_owned(),
                auth_token_present: true,
                access_token_present: true,
                api_key_present: false,
                ingress_token_present: false,
                oauth_bearer_present: false,
                agent_token_present: false,
            },
            locale: None,
            client_kind: None,
            operation: None,
            trace_id: Some("skills-visibility-trace".to_owned()),
            idempotency_key: None,
        }
    }

    fn app_context() -> crate::SkillsAppRequestContext {
        crate::SkillsAppRequestContext {
            tenant_id: TENANT_ID,
            actor_id: ACTOR_ID,
            organization_id: ORGANIZATION_ID,
        }
    }

    fn state(stub: &StubSkillsRepository) -> AppState<StubSkillsRepository> {
        AppState {
            service: Arc::new(SkillsService::new(stub.clone())),
            target_authorizer: Arc::new(DenyExternalInstallationTargets),
        }
    }

    #[tokio::test]
    async fn guard_maps_an_invisible_package_to_not_found() {
        let stub = StubSkillsRepository::invisible();
        let service = SkillsService::new(stub.clone());

        let problem =
            ensure_app_package_visible(&service, TENANT_ID, ORGANIZATION_ID, ACTOR_ID, PACKAGE_ID)
                .await
                .expect_err("an invisible package must be rejected");

        let response = problem.into_response_for(&request_context());
        assert_eq!(StatusCode::NOT_FOUND, response.status());
        assert_eq!(1, stub.marketplace_reads());
    }

    #[tokio::test]
    async fn guard_accepts_a_visible_package() {
        let stub = StubSkillsRepository::with_visible_package();
        let service = SkillsService::new(stub.clone());

        ensure_app_package_visible(&service, TENANT_ID, ORGANIZATION_ID, ACTOR_ID, PACKAGE_ID)
            .await
            .expect("a catalog-visible package passes the guard");
        assert_eq!(1, stub.marketplace_reads());
    }

    #[tokio::test]
    async fn artifacts_route_rejects_an_invisible_package_before_listing() {
        let stub = StubSkillsRepository::invisible();

        let response = list_package_artifacts(
            request_context(),
            State(state(&stub)),
            Extension(app_context()),
            Path(PACKAGE_ID.to_string()),
            Query(SdkWorkListQuery::default()),
        )
        .await;

        assert_eq!(StatusCode::NOT_FOUND, response.status());
        assert_eq!(1, stub.marketplace_reads());
        assert_eq!(0, stub.artifact_list_reads());
    }

    #[tokio::test]
    async fn artifacts_route_serves_a_visible_package() {
        let stub = StubSkillsRepository::with_visible_package();

        let response = list_package_artifacts(
            request_context(),
            State(state(&stub)),
            Extension(app_context()),
            Path(PACKAGE_ID.to_string()),
            Query(SdkWorkListQuery::default()),
        )
        .await;

        assert_eq!(StatusCode::OK, response.status());
        assert_eq!(1, stub.marketplace_reads());
        assert_eq!(1, stub.artifact_list_reads());
    }

    #[tokio::test]
    async fn installation_route_rejects_an_invisible_package_before_installing() {
        let stub = StubSkillsRepository::invisible();
        let body = CreateSkillInstallationCommand {
            artifact_id: ARTIFACT_ID,
            target: None,
            config: serde_json::json!({}),
        };

        let response = create_installation(
            request_context(),
            State(state(&stub)),
            Extension(app_context()),
            Path(PACKAGE_ID.to_string()),
            Json(body),
        )
        .await;

        assert_eq!(StatusCode::NOT_FOUND, response.status());
        assert_eq!(1, stub.marketplace_reads());
        assert_eq!(0, stub.installation_writes());
    }
}
