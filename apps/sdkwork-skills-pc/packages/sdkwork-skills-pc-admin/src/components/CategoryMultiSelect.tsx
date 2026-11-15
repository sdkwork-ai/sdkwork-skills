import { useState } from 'react';

import type { SkillCategoryRecord } from '@sdkwork/skills-pc-core';

import { useSkillsAdminCopy } from '../copy/skillsAdminCopy';
import { SelectionField } from './SelectionField';
import { SelectionModal } from './SelectionModal';

/**
 * Multi-select for the categories a Skill package is filed under.
 *
 * The trigger stays a single row in the create drawer and opens the shared
 * selection dialog. Codes already assigned but no longer present in the loaded
 * category list still render, so an archived category is visible instead of
 * being dropped from the form.
 */
export function CategoryMultiSelect({
  categories,
  value,
  onChange,
  disabled = false,
}: {
  categories: readonly SkillCategoryRecord[];
  value: readonly string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const copy = useSkillsAdminCopy();
  const [open, setOpen] = useState(false);
  const selected = new Set(value);
  const known = new Set(categories.map((category) => category.code));

  const chips = [
    ...categories
      .filter((category) => selected.has(category.code))
      .map((category) => ({ key: category.code, label: category.name })),
    ...value
      .filter((code) => !known.has(code))
      .map((code) => ({ key: code, label: code })),
  ];
  const options = categories.map((category) => ({
    value: category.code,
    label: category.name,
    description: [category.code, category.permissionCode].filter(Boolean).join(' · '),
  }));

  return (
    <>
      <SelectionField
        label={copy.admin.createDrawer.categories}
        placeholder={copy.admin.createDrawer.categoriesPlaceholder}
        selected={chips}
        onOpen={() => setOpen(true)}
        disabled={disabled}
        expanded={open}
        tone="blue"
      />
      <SelectionModal
        open={open}
        title={copy.admin.createDrawer.categoriesModalTitle}
        description={copy.admin.createDrawer.categoriesModalDescription}
        options={options}
        value={value}
        onCancel={() => setOpen(false)}
        onConfirm={(next) => {
          setOpen(false);
          onChange(next);
        }}
        searchPlaceholder={copy.selection.searchPlaceholder}
        noMatchLabel={copy.selection.noMatch}
        selectedCountLabel={copy.selection.selectedCount}
        cancelLabel={copy.selection.cancel}
        confirmLabel={copy.selection.confirm}
        clearLabel={copy.selection.clear}
        closeLabel={copy.overlay.close}
      />
    </>
  );
}
