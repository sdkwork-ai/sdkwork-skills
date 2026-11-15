use sdkwork_skills_contract::{
    normalize_category_filter, normalize_role_code_filter, SkillCatalogFilter, SkillCategoryType,
    SkillInstallationSubjectKind,
};
use sdkwork_utils_rust::{validated_offset_list_params, OffsetListPageParams};
use serde::Deserialize;

use crate::response::ApiProblem;

/// Standard GET list query parameters (`API_SPEC.md` §14.1) plus the catalog
/// view filters (`category_code`, `role_codes`) the catalog lists consume.
#[derive(Debug, Default, Deserialize)]
pub struct SdkWorkListQuery {
    pub page: Option<i32>,
    pub page_size: Option<i32>,
    pub cursor: Option<String>,
    pub q: Option<String>,
    /// One category code from the registry; `all` keeps every category.
    #[serde(alias = "categoryCode")]
    pub category_code: Option<String>,
    /// Comma-separated IAM role codes of the signed-in operator. Empty keeps
    /// the "all data" view.
    #[serde(alias = "roleCodes")]
    pub role_codes: Option<String>,
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
                ApiProblem::bad_request("page must be >= 1 and page_size must be between 1 and 200")
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

    /// Normalized category selector: `None` keeps every category.
    pub fn category_filter(&self) -> Option<String> {
        normalize_category_filter(self.category_code.as_deref())
    }

    /// Normalized role scope: empty keeps the "all data" view.
    pub fn role_scope(&self) -> Vec<String> {
        normalize_role_code_filter(self.role_codes.as_deref())
    }

    /// Catalog view handed to the repository for the two optional filters.
    pub fn catalog_filter(&self) -> SkillCatalogFilter {
        SkillCatalogFilter {
            category_code: self.category_filter(),
            role_codes: self.role_scope(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn query_with(category_code: Option<&str>, role_codes: Option<&str>) -> SdkWorkListQuery {
        SdkWorkListQuery {
            category_code: category_code.map(str::to_string),
            role_codes: role_codes.map(str::to_string),
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
    fn category_filter_keeps_all_for_the_all_selector() {
        assert_eq!(query_with(Some("all"), None).category_filter(), None);
        assert_eq!(
            query_with(Some("coding"), None).category_filter(),
            Some("coding".to_string())
        );
    }

    #[test]
    fn role_scope_is_empty_for_the_all_view() {
        assert!(query_with(None, None).role_scope().is_empty());
        assert_eq!(
            query_with(None, Some("org_admin,org_operations")).role_scope(),
            vec!["org_admin".to_string(), "org_operations".to_string()]
        );
    }

    #[test]
    fn catalog_filter_carries_both_normalized_filters() {
        let filter = query_with(Some("ALL"), Some("org_admin")).catalog_filter();
        assert!(!filter.is_all_data());
        assert_eq!(filter.category_code, None);
        assert_eq!(filter.role_codes, vec!["org_admin".to_string()]);

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
        assert_eq!(query.category_filter(), Some("coding".to_string()));
        assert_eq!(query.role_scope(), vec!["org_admin".to_string()]);
    }

    #[test]
    fn category_list_query_keeps_the_optional_category_type() {
        let query = SkillCategoryListQuery::default();
        assert!(query.category_type.is_none());
        assert!(query.pagination.category_filter().is_none());
    }
}
