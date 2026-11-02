/**
 * Role assignment for Skill packages.
 *
 * A package's `allowedRoleCodes` lists the IAM role codes allowed to see and
 * install it; an empty list means every role (the default). The catalog below
 * is the IAM platform standard set plus the Skills domain roles seeded by
 * `sdkwork-iam`; it feeds the multi-select authoring surface.
 */
export interface SkillsAssignableRole {
  code: string;
  label: string;
}

export const SKILLS_ASSIGNABLE_ROLES: readonly SkillsAssignableRole[] = [
  { code: 'app_user', label: 'App user' },
  { code: 'org_admin', label: 'Organization admin' },
  { code: 'org_assistant', label: 'Organization assistant' },
  { code: 'org_auditor', label: 'Organization auditor' },
  { code: 'org_finance', label: 'Organization finance' },
  { code: 'org_operations', label: 'Organization operations' },
  { code: 'platform_system_admin', label: 'Platform system admin' },
  { code: 'platform_super_admin', label: 'Platform super admin' },
  { code: 'skills_admin_operator', label: 'Skills admin operator' },
  { code: 'skills_marketplace_user', label: 'Skills marketplace user' },
];

const ROLE_CODE_PATTERN = /^[a-z][a-z0-9_.-]{0,127}$/;

/** Trims, drops empties, de-duplicates and sorts the selection. */
export function normalizeAllowedRoleCodes(codes: readonly string[]): string[] {
  const unique = new Set<string>();
  for (const code of codes) {
    const normalized = code.trim();
    if (ROLE_CODE_PATTERN.test(normalized)) {
      unique.add(normalized);
    }
  }
  return [...unique].sort();
}

/**
 * Whether a resource assigned to `allowedRoleCodes` is visible to a caller
 * holding `callerRoleCodes`. An empty assignment means every role.
 */
export function isSkillVisibleToRoles(
  allowedRoleCodes: readonly string[] | null | undefined,
  callerRoleCodes: readonly string[] | null | undefined,
): boolean {
  const allowed = normalizeAllowedRoleCodes(allowedRoleCodes ?? []);
  if (allowed.length === 0) {
    return true;
  }
  const caller = new Set(callerRoleCodes ?? []);
  return allowed.some((code) => caller.has(code));
}

/** Human-readable summary for list surfaces. */
export function describeAllowedRoleCodes(
  allowedRoleCodes: readonly string[] | null | undefined,
): string {
  const allowed = normalizeAllowedRoleCodes(allowedRoleCodes ?? []);
  return allowed.length === 0 ? 'All roles' : allowed.join(', ');
}
