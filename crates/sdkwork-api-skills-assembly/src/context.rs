use sdkwork_routes_skills_app_api::SkillsAppRequestContext;
use sdkwork_routes_skills_backend_api::SkillsBackendRequestContext;
use sdkwork_web_core::{DomainContextInjector, WebApiSurface, WebRequestContext};

#[derive(Clone, Copy, Debug, Default)]
pub struct SkillsDomainContextInjector;

impl DomainContextInjector for SkillsDomainContextInjector {
    fn inject(&self, request: &mut axum::extract::Request, context: &WebRequestContext) {
        let Some(principal) = context.principal.as_ref() else {
            return;
        };
        let Some(tenant_id) = positive_id(principal.tenant_id()) else {
            return;
        };
        let Some(actor_id) = positive_id(principal.user_id()) else {
            return;
        };

        match context.api_surface {
            WebApiSurface::AppApi => {
                let organization_id = principal
                    .organization_id()
                    .and_then(positive_id)
                    .unwrap_or(0);
                request.extensions_mut().insert(SkillsAppRequestContext {
                    tenant_id,
                    actor_id,
                    organization_id,
                });
            }
            WebApiSurface::BackendApi => {
                // A tenant-scope session carries the tenant-level organization
                // sentinel `0` (`API_SPEC.md` §10.4); `organization_scope()`
                // normalizes an absent scope to it. The backend context must
                // still be injected for that scope: returning without inserting
                // makes every `Extension<SkillsBackendRequestContext>` handler
                // extraction fail, so the whole skills admin surface answered
                // `500` for tenant-scope operators.
                let organization_id = positive_id(&principal.organization_scope()).unwrap_or(0);
                request
                    .extensions_mut()
                    .insert(SkillsBackendRequestContext {
                        tenant_id,
                        organization_id,
                        operator_id: actor_id,
                    });
            }
            _ => {}
        }
    }
}

fn positive_id(value: &str) -> Option<u64> {
    value.parse().ok().filter(|value| *value > 0)
}

#[cfg(test)]
mod tests {
    use axum::body::Body;
    use axum::http::Request;
    use sdkwork_web_core::{
        ServerRequestId, WebApiSurface, WebAuthMode, WebRequestContext, WebRequestPrincipal,
        WebTransportFacts,
    };

    use super::*;

    fn request_context(
        api_surface: WebApiSurface,
        principal: Option<WebRequestPrincipal>,
    ) -> WebRequestContext {
        WebRequestContext {
            request_id: ServerRequestId("skills-injector-test".to_owned()),
            api_surface,
            auth_mode: WebAuthMode::DualToken,
            principal,
            transport: WebTransportFacts {
                path: "/backend/v3/api/skill_packages".to_owned(),
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
            trace_id: Some("skills-injector-trace".to_owned()),
            idempotency_key: None,
        }
    }

    fn principal(organization_id: Option<&str>) -> WebRequestPrincipal {
        WebRequestPrincipal::builder()
            .tenant_id("100001")
            .organization_id(organization_id.map(str::to_owned))
            .user_id("30")
            .app_id("sdkwork-cloudrouter")
            .build()
    }

    fn backend_request() -> Request<Body> {
        Request::builder()
            .uri("/backend/v3/api/skill_packages")
            .body(Body::empty())
            .expect("backend request")
    }

    #[test]
    fn backend_surface_injects_context_for_a_tenant_scope_principal() {
        let context = request_context(WebApiSurface::BackendApi, Some(principal(None)));
        let mut request = backend_request();

        SkillsDomainContextInjector.inject(&mut request, &context);

        let backend = request
            .extensions()
            .get::<SkillsBackendRequestContext>()
            .expect("tenant-scope backend requests must carry the skills context");
        assert_eq!(100_001, backend.tenant_id);
        assert_eq!(0, backend.organization_id);
        assert_eq!(30, backend.operator_id);
    }

    #[test]
    fn backend_surface_injects_the_organization_scope() {
        let context = request_context(WebApiSurface::BackendApi, Some(principal(Some("42"))));
        let mut request = backend_request();

        SkillsDomainContextInjector.inject(&mut request, &context);

        let backend = request
            .extensions()
            .get::<SkillsBackendRequestContext>()
            .expect("organization-scope backend requests must carry the skills context");
        assert_eq!(42, backend.organization_id);
    }

    #[test]
    fn backend_surface_without_a_principal_is_not_injected() {
        let context = request_context(WebApiSurface::BackendApi, None);
        let mut request = backend_request();

        SkillsDomainContextInjector.inject(&mut request, &context);

        assert!(request
            .extensions()
            .get::<SkillsBackendRequestContext>()
            .is_none());
    }

    #[test]
    fn app_surface_keeps_the_tenant_level_default() {
        let context = request_context(WebApiSurface::AppApi, Some(principal(None)));
        let mut request = Request::builder()
            .uri("/app/v3/api/skills")
            .body(Body::empty())
            .expect("app request");

        SkillsDomainContextInjector.inject(&mut request, &context);

        let app = request
            .extensions()
            .get::<SkillsAppRequestContext>()
            .expect("app requests must carry the skills context");
        assert_eq!(100_001, app.tenant_id);
        assert_eq!(0, app.organization_id);
        assert_eq!(30, app.actor_id);
    }
}
