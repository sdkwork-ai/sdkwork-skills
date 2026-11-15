import { useState } from 'react';

import {
  SKILLS_ASSIGNABLE_ROLES,
  normalizeAllowedRoleCodes,
  type SkillsAssignableRole,
} from '@sdkwork/skills-pc-admin-core';

import { useSkillsAdminCopy } from '../copy/skillsAdminCopy';
import { SelectionField } from './SelectionField';
import { SelectionModal } from './SelectionModal';

/**
 * Multi-select for the IAM roles a Skill package is assigned to.
 *
 * An empty selection is the default and means every role can see the package,
 * so "All roles" is the first row of the picker and clears every specific role.
 * Codes already assigned but absent from the shared catalog stay selectable, so
 * an organization-defined role never silently disappears from the form.
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
  const [open, setOpen] = useState(false);
  const selected = new Set(value);
  const known = new Set(SKILLS_ASSIGNABLE_ROLES.map((role) => role.code));
  const extras: SkillsAssignableRole[] = [...selected]
    .filter((code) => !known.has(code))
    .sort()
    .map((code) => ({ code, label: copy.roles.customRole }));
  const roles = [...SKILLS_ASSIGNABLE_ROLES, ...extras];
  const localizedLabels: Record<string, string> = copy.roles.labels;

  function labelFor(code: string): string {
    return localizedLabels[code] ?? roles.find((role) => role.code === code)?.label ?? code;
  }

  const chips = roles
    .filter((role) => selected.has(role.code))
    .map((role) => ({ key: role.code, label: labelFor(role.code) }));
  const options = roles.map((role) => ({
    value: role.code,
    label: labelFor(role.code),
    description: role.code,
  }));

  return (
    <>
      <SelectionField
        label={copy.roles.legend}
        placeholder={copy.roles.allRoles}
        selected={chips}
        onOpen={() => setOpen(true)}
        disabled={disabled}
        expanded={open}
        tone="zinc"
      />
      <SelectionModal
        open={open}
        title={copy.roles.modalTitle}
        description={copy.roles.modalDescription}
        options={options}
        value={value}
        onCancel={() => setOpen(false)}
        onConfirm={(next) => {
          setOpen(false);
          onChange(normalizeAllowedRoleCodes(next));
        }}
        searchPlaceholder={copy.selection.searchPlaceholder}
        noMatchLabel={copy.selection.noMatch}
        selectedCountLabel={copy.selection.selectedCount}
        cancelLabel={copy.selection.cancel}
        confirmLabel={copy.selection.confirm}
        clearLabel={copy.selection.clear}
        emptyOptionLabel={copy.roles.allRoles}
        closeLabel={copy.overlay.close}
      />
    </>
  );
}
