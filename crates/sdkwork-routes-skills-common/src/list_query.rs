use sdkwork_skills_contract::{SkillCategoryType, SkillInstallationSubjectKind};
use sdkwork_utils_rust::{
    validated_offset_list_params, CatalogViewFilter, CatalogViewQuery, OffsetListPageParams,
};
use serde::Deserialize;

use crate::response::ApiProblem;

/// Standard GET list query parameters (`API_SPEC.md` §14.1) plus the catalog
/// view filters (`category_code`, `role_codes`) the catalog lists consume.
#[derive(Debug, Default, Deserialize)]
pub struct SdkWorkListQuery {
    #[serde(
        default,
        deserialize_with = "sdkwork_utils_rust::serde_query_int::option_i32"
    )]
    pub page: Option<i32>,
    #[serde(
        default,
        deserialize_with = "sdkwork_utils_rust::serde_query_int::option_i32"
    )]
    pub page_size: Option<i32>,
    pub cursor: Option<String>,
    pub q: Option<String>,
    /// Shared catalog view vocabulary: one registry category code (`all` keeps
    /// every category) and the comma-separated IAM role codes of the caller.
    #[serde(flatten)]
    pub catalog: CatalogViewQuery,
}

#[derive(Debug, Default, Deserialize)]
pub struct SkillInstallationListQuery {
    #[serde(flatten)]
    pub pagination: SdkWorkListQuery,
    pub subject_kind: Option<SkillInstallationSubjectKind>,
    #[serde(default, with = "sdkwork_utils_rust::serde_uint64::option")]
    pub subject_id: Option<u64>,
}

#[derive(Debug, Default, Deserialize)]
pub struct SkillCategoryListQuery {
    #[serde(flatten)]
    pub pagination: SdkWorkListQuery,
    pub category_type: Option<SkillCategoryType>,
}

impl SdkWorkListQuery {
    pub fn validate(&self) -> Result<(), ApiProblem> {
        let cursor = self
            .cursor
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty());
        if cursor.is_some() {
            return Err(ApiProblem::bad_request(
                "cursor pagination is not supported yet; use page and page_size",
            ));
        }
        self.offset_params().map(|_| ())
    }

    pub fn offset_params(&self) -> Result<OffsetListPageParams, ApiProblem> {
        validated_offset_list_params(self.page.map(i64::from), self.page_size.map(i64::from))
            .map_err(|_| {
                // `40003 INVALID_PARAMETER`: an out-of-range window is rejected
                // rather than clamped, so a caller asking for more rows than the
                // operation serves sees the failure instead of a shorter page.
                ApiProblem::invalid_parameter(format!(
                    "page must be between 1 and {}, page_size must be between 1 and {}",
                    sdkwork_utils_rust::http_api::MAX_LIST_PAGE,
                    sdkwork_utils_rust::http_api::MAX_LIST_PAGE_SIZE
                ))
            })
    }

    pub fn effective_page_size(&self) -> i32 {
        self.page_size.unwrap_or(20).clamp(1, 200)
    }

    pub fn effective_page(&self) -> i32 {
        self.page.unwrap_or(1).max(1)
    }

    pub fn search_keyword(&self) -> Option<&str> {
        self.q
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
    }

    /// Catalog view handed to the repository for the two optional filters.
    ///
    /// The shared query type owns the wire vocabulary and the normalization, so
    /// both the category selector and the role scope arrive canonical
    /// lowercase; the repository binds them straight into its predicates.
    pub fn catalog_filter(&self) -> CatalogViewFilter {
        self.catalog.to_filter()
    }
}

#[cfg(test)]
mod tests {
    use axum::extract::Query;
    use axum::http::Uri;

    use super::*;

    fn query_with(category_code: Option<&str>, role_codes: Option<&str>) -> SdkWorkListQuery {
        SdkWorkListQuery {
            catalog: CatalogViewQuery {
                category_code: category_code.map(str::to_string),
                role_codes: role_codes.map(str::to_string),
            },
            ..Default::default()
        }
    }

    #[test]
    fn rejects_cursor_pagination() {
        let query = SdkWorkListQuery {
            cursor: Some("cursor-1".into()),
            ..Default::default()
        };
        assert!(query.validate().is_err());
    }

    #[test]
    fn category_filter_is_canonical_lowercase_and_keeps_all_for_the_all_selector() {
        assert_eq!(
            query_with(Some("all"), None)
                .catalog_filter()
                .category_code(),
            None
        );
        assert_eq!(
            query_with(Some("CODING"), None)
                .catalog_filter()
                .category_code(),
            Some("coding")
        );
        assert_eq!(
            query_with(Some(" Coding "), None)
                .catalog_filter()
                .category_code(),
            Some("coding")
        );
    }

    #[test]
    fn role_scope_normalizes_role_codes_to_canonical_lowercase() {
        assert!(query_with(None, None)
            .catalog_filter()
            .role_codes()
            .is_empty());
        assert_eq!(
            query_with(None, Some("Org_Admin,ORG_OPERATIONS,org_admin"))
                .catalog_filter()
                .role_codes(),
            ["org_admin".to_string(), "org_operations".to_string()].as_slice()
        );
    }

    #[test]
    fn catalog_filter_carries_both_normalized_filters() {
        let filter = query_with(Some("ALL"), Some("Org_Admin")).catalog_filter();
        assert!(!filter.is_all_data());
        assert_eq!(filter.category_code(), None);
        assert_eq!(filter.role_codes(), ["org_admin".to_string()].as_slice());

        let all_data = query_with(Some("all"), None).catalog_filter();
        assert!(all_data.is_all_data());
    }

    #[test]
    fn catalog_filter_accepts_the_camel_case_aliases() {
        let query: SdkWorkListQuery = serde_json::from_value(serde_json::json!({
            "categoryCode": "coding",
            "roleCodes": "org_admin",
        }))
        .expect("deserialize catalog query aliases");
        let filter = query.catalog_filter();
        assert_eq!(filter.category_code(), Some("coding"));
        assert_eq!(filter.role_codes(), ["org_admin".to_string()].as_slice());
    }

    #[test]
    fn query_parameters_parse_from_the_url_wire_form() {
        let uri: Uri = "/skills?page=2&category_code=CODING&role_codes=Org_Admin%2CORG_AUDITOR"
            .parse()
            .expect("url parses");
        let Query(query) =
            Query::<SdkWorkListQuery>::try_from_uri(&uri).expect("extract the list query");
        assert_eq!(query.effective_page(), 2);
        let filter = query.catalog_filter();
        assert_eq!(filter.category_code(), Some("coding"));
        assert_eq!(
            filter.role_codes(),
            ["org_admin".to_string(), "org_auditor".to_string()].as_slice()
        );
    }

    #[test]
    fn category_list_query_keeps_the_optional_category_type() {
        let uri: Uri = "/categories?category_type=skill_market&category_code=ALL"
            .parse()
            .expect("url parses");
        let Query(query) =
            Query::<SkillCategoryListQuery>::try_from_uri(&uri).expect("extract the list query");
        assert_eq!(query.category_type, Some(SkillCategoryType::SkillMarket));
        assert!(query.pagination.catalog_filter().is_all_data());

        let default_query = SkillCategoryListQuery::default();
        assert!(default_query.category_type.is_none());
        assert!(default_query.pagination.catalog_filter().is_all_data());
    }

    #[test]
    fn wrapper_queries_parse_paging_next_to_their_own_fields() {
        // Both wrapper DTOs flatten the base list query, so numeric paging
        // reaches the inner DTO through serde's content buffer.
        let uri: Uri = "/categories?page=3&page_size=25&category_type=skill_market"
            .parse()
            .expect("url parses");
        let Query(category_query) = Query::<SkillCategoryListQuery>::try_from_uri(&uri)
            .expect("extract the category query");
        assert_eq!(category_query.pagination.page, Some(3));
        assert_eq!(category_query.pagination.page_size, Some(25));
        let offset = category_query
            .pagination
            .offset_params()
            .expect("offset params");
        assert_eq!((offset.page, offset.page_size), (3, 25));

        let uri: Uri = "/installations?page=2&page_size=50&subject_kind=user&subject_id=42"
            .parse()
            .expect("url parses");
        let Query(installation_query) = Query::<SkillInstallationListQuery>::try_from_uri(&uri)
            .expect("extract the installation query");
        assert_eq!(installation_query.pagination.page, Some(2));
        assert_eq!(installation_query.pagination.page_size, Some(50));
        assert_eq!(installation_query.subject_id, Some(42));
    }

    #[test]
    fn wrapper_queries_still_reject_junk_paging() {
        let uri: Uri = "/categories?page=next".parse().expect("url parses");
        assert!(Query::<SkillCategoryListQuery>::try_from_uri(&uri).is_err());
    }
}
