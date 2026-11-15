import { SKILLS_ASSIGNABLE_ROLES, type SkillsAssignableRole } from '@sdkwork/skills-pc-admin-core';

import { useSkillsAdminCopy } from '../copy/skillsAdminCopy';

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
  const copy = useSkillsAdminCopy();
  const selected = new Set(value);
  const allRoles = value.length === 0;
  const known = new Set(SKILLS_ASSIGNABLE_ROLES.map((role) => role.code));
  const extras: SkillsAssignableRole[] = [...selected]
    .filter((code) => !known.has(code))
    .sort()
    .map((code) => ({ code, label: copy.roles.customRole }));
  const roles = [...SKILLS_ASSIGNABLE_ROLES, ...extras];
  const localizedLabels: Record<string, string> = copy.roles.labels;

  return (
    <fieldset
      disabled={disabled}
      className="rounded-lg border border-zinc-700 bg-zinc-800/40 p-3"
    >
      <legend className="px-1 text-xs font-medium uppercase tracking-wide text-zinc-400">
        {copy.roles.legend}
      </legend>
      <div className="grid gap-1.5">
        <label className="flex items-center gap-2 text-sm font-medium text-zinc-200">
          <input
            type="checkbox"
            checked={allRoles}
            onChange={() => onChange([])}
            className="size-4 rounded border-zinc-600 bg-zinc-800"
          />
          <span>{copy.roles.allRoles}</span>
        </label>
        {roles.map((role) => (
          <label key={role.code} className="flex items-center gap-2 text-sm text-zinc-300">
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
              className="size-4 rounded border-zinc-600 bg-zinc-800"
            />
            <span>
              {localizedLabels[role.code] ?? role.label} (<code className="font-mono text-xs text-zinc-400">{role.code}</code>)
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
