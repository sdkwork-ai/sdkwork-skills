import { SKILLS_ASSIGNABLE_ROLES, type SkillsAssignableRole } from '@sdkwork/skills-pc-admin-core';

/**
 * Multi-select for the IAM roles a Skill package is assigned to.
 *
 * An empty selection is the default and means every role can see the package,
 * so "All roles" is the first row and clears every specific role. Codes already
 * assigned but absent from the shared catalog stay selectable, so an
 * organization-defined role never silently disappears from the form.
 */
export function RoleMultiSelect({
  value,
  onChange,
  disabled = false,
}: {
  value: readonly string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const selected = new Set(value);
  const allRoles = value.length === 0;
  const known = new Set(SKILLS_ASSIGNABLE_ROLES.map((role) => role.code));
  const extras: SkillsAssignableRole[] = [...selected]
    .filter((code) => !known.has(code))
    .sort()
    .map((code) => ({ code, label: 'Custom role' }));
  const roles = [...SKILLS_ASSIGNABLE_ROLES, ...extras];

  return (
    <fieldset
      disabled={disabled}
      style={{ display: 'grid', gap: 6, border: '1px solid #ddd', padding: 12 }}
    >
      <legend>Visible to roles</legend>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 600 }}>
        <input type="checkbox" checked={allRoles} onChange={() => onChange([])} />
        <span>All roles (default)</span>
      </label>
      {roles.map((role) => (
        <label key={role.code} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={selected.has(role.code)}
            onChange={(event) => {
              const next = new Set(value);
              if (event.target.checked) {
                next.add(role.code);
              } else {
                next.delete(role.code);
              }
              onChange([...next]);
            }}
          />
          <span>
            {role.label} (<code>{role.code}</code>)
          </span>
        </label>
      ))}
    </fieldset>
  );
}
