//! Catalog view filters shared by the marketplace and admin list surfaces.
//!
//! A Skills catalog listing is narrowed by two independent, optional filters:
//!
//! - **category**: one `code` from the category registry, or every category
//!   when the caller asks for `all` (or omits the filter). The value is matched
//!   against the package's binding in `skills_category_binding`, whose joined
//!   `skills_category.code` is the code the registry publishes.
//! - **role scope**: the IAM role codes of the signed-in operator. An empty
//!   scope is the "all data" view; a populated scope keeps the records that
//!   name one of those roles *plus* the records open to every role, so the
//!   operator still sees the catalog entries their whole tenant shares.
//!
//! Neither filter widens visibility: the repository already scopes rows to the
//! caller's tenant and visibility, and both filters only remove rows from that
//! set. The repository applies both predicates in SQL so the page and its total
//! stay consistent; [`SkillCatalogFilter`] is the canonical value type and the
//! in-memory definition those predicates mirror.

/// Selector value that keeps every category in a listing.
pub const CATALOG_ALL_CATEGORIES: &str = "all";

/// Localized equivalent of [`CATALOG_ALL_CATEGORIES`] the client ships.
const CATALOG_ALL_CATEGORIES_ZH: &str = "全部";

/// Normalizes a category selector to `None` (every category) or one code.
///
/// The registry codes are lower-kebab, so the comparison is case-insensitive
/// and the returned code keeps the caller's spelling for the echoed filter.
pub fn normalize_category_filter(value: Option<&str>) -> Option<String> {
    let trimmed = value?.trim();
    if trimmed.is_empty()
        || trimmed.eq_ignore_ascii_case(CATALOG_ALL_CATEGORIES)
        || trimmed == CATALOG_ALL_CATEGORIES_ZH
    {
        return None;
    }
    Some(trimmed.to_string())
}

/// Parses a comma-separated `role_codes` value into a sorted, unique scope.
///
/// Codes are IAM role codes (`NAMING_SPEC.md` role-code pattern); blank entries
/// are dropped rather than rejected so a trailing comma stays harmless.
pub fn normalize_role_code_filter(value: Option<&str>) -> Vec<String> {
    let Some(value) = value else {
        return Vec::new();
    };
    let mut codes = value
        .split(',')
        .map(str::trim)
        .filter(|code| !code.is_empty())
        .map(str::to_string)
        .collect::<Vec<_>>();
    codes.sort();
    codes.dedup();
    codes
}

/// True when a record restricted to `allowed` is part of the caller's scope.
///
/// An empty `role_codes` is the "all data" view and matches everything. An
/// empty `allowed` list means the record is open to every role (the documented
/// default in `SkillRecord::allowed_role_codes`), so it matches every scope.
pub fn role_scope_allows(allowed: &[String], role_codes: &[String]) -> bool {
    role_codes.is_empty()
        || allowed.is_empty()
        || allowed.iter().any(|code| {
            role_codes
                .iter()
                .any(|scope| scope.eq_ignore_ascii_case(code))
        })
}

/// True when a record's category matches the normalized category filter.
pub fn category_matches(record_category: Option<&str>, category: &str) -> bool {
    record_category.is_some_and(|value| value.eq_ignore_ascii_case(category))
}

/// One normalized catalog view: the category selector plus the caller's roles.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct SkillCatalogFilter {
    /// One `skills_category.code`, or `None` for every category.
    pub category_code: Option<String>,
    /// IAM role codes of the caller; empty is the all-data view.
    pub role_codes: Vec<String>,
}

impl SkillCatalogFilter {
    /// Builds the filter from raw query values.
    pub fn from_query(category_code: Option<&str>, role_codes: Option<&str>) -> Self {
        Self {
            category_code: normalize_category_filter(category_code),
            role_codes: normalize_role_code_filter(role_codes),
        }
    }

    /// True when this filter keeps every record.
    pub fn is_all_data(&self) -> bool {
        self.category_code.is_none() && self.role_codes.is_empty()
    }

    /// Role codes lower-cased for the case-insensitive storage comparison.
    pub fn normalized_role_codes(&self) -> Vec<String> {
        self.role_codes
            .iter()
            .map(|code| code.to_ascii_lowercase())
            .collect()
    }

    /// True when a record's `categories` satisfy the category selector.
    pub fn allows_category(&self, categories: &[String]) -> bool {
        match self.category_code.as_deref() {
            Some(code) => categories
                .iter()
                .any(|category| category_matches(Some(category.as_str()), code)),
            None => true,
        }
    }

    /// True when a record's `allowed_role_codes` are inside the caller's scope.
    pub fn allows_roles(&self, allowed_role_codes: &[String]) -> bool {
        role_scope_allows(allowed_role_codes, &self.role_codes)
    }

    /// True when a record is inside both halves of the view.
    pub fn allows(&self, categories: &[String], allowed_role_codes: &[String]) -> bool {
        self.allows_category(categories) && self.allows_roles(allowed_role_codes)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn codes(values: &[&str]) -> Vec<String> {
        values.iter().map(|value| value.to_string()).collect()
    }

    #[test]
    fn category_filter_drops_the_all_selectors() {
        assert_eq!(normalize_category_filter(None), None);
        assert_eq!(normalize_category_filter(Some("  ")), None);
        assert_eq!(normalize_category_filter(Some("ALL")), None);
        assert_eq!(normalize_category_filter(Some("全部")), None);
        assert_eq!(
            normalize_category_filter(Some(" coding ")),
            Some("coding".to_string())
        );
    }

    #[test]
    fn role_code_filter_trims_sorts_and_dedupes() {
        assert_eq!(normalize_role_code_filter(None), Vec::<String>::new());
        assert_eq!(
            normalize_role_code_filter(Some("org_admin, org_operations,,org_admin,")),
            vec!["org_admin".to_string(), "org_operations".to_string()]
        );
    }

    #[test]
    fn role_scope_matches_open_records_and_named_roles() {
        let all_data: Vec<String> = Vec::new();
        let operator = codes(&["org_admin"]);
        let open: Vec<String> = Vec::new();
        let restricted = codes(&["org_finance"]);

        assert!(role_scope_allows(&restricted, &all_data));
        assert!(role_scope_allows(&open, &operator));
        assert!(role_scope_allows(&["ORG_ADMIN".to_string()], &operator));
        assert!(!role_scope_allows(&restricted, &operator));
    }

    #[test]
    fn category_match_is_case_insensitive_and_never_matches_absent_codes() {
        assert!(category_matches(Some("Coding"), "coding"));
        assert!(!category_matches(Some("writing"), "coding"));
        assert!(!category_matches(None, "coding"));
    }

    #[test]
    fn catalog_filter_composes_category_and_role_scope() {
        let filter = SkillCatalogFilter::from_query(Some("coding"), Some("org_auditor"));

        assert!(!filter.is_all_data());
        assert!(filter.allows(&codes(&["coding"]), &codes(&["org_auditor"])));
        assert!(filter.allows(&codes(&["CODING"]), &[]));
        assert!(!filter.allows(&codes(&["coding"]), &codes(&["org_finance"])));
        assert!(!filter.allows(&codes(&["writing"]), &[]));

        let all_data = SkillCatalogFilter::from_query(Some("all"), Some(" "));
        assert!(all_data.is_all_data());
        assert!(all_data.allows(&codes(&["writing"]), &codes(&["org_finance"])));
    }

    #[test]
    fn normalized_role_codes_are_lower_case_for_storage_comparison() {
        let filter = SkillCatalogFilter::from_query(None, Some("Org_Admin,ORG_AUDITOR"));
        assert_eq!(filter.role_codes, codes(&["ORG_AUDITOR", "Org_Admin"]));
        assert_eq!(
            filter.normalized_role_codes(),
            vec!["org_auditor".to_string(), "org_admin".to_string()]
        );
    }
}
