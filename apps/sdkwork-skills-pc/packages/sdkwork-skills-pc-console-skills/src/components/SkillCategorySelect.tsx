import { useMemo, useState } from 'react';
import type { SkillCategoryRecord } from '@sdkwork/skills-pc-core';
import { useSkillsConsoleT } from '../locale.tsx';

/**
 * Managed single-select for Skill categories.
 *
 * The console must never let a user type a free-form category token: category
 * codes are bound to package-manage permissions server side
 * (`packageManagePermissionForCategory`), so an unlisted code either authorises
 * nothing or targets a category that does not exist. The picker therefore only
 * ever offers records that the admin console published.
 *
 * The selected record is pinned: filtering never hides the current choice, so a
 * user can always see (and clear) what they picked.
 */
export interface SkillCategorySelectProps {
  categories: readonly SkillCategoryRecord[];
  value: string;
  onChange: (categoryCode: string) => void;
  disabled?: boolean;
  loading?: boolean;
  /** Id used to associate the search input with the radiogroup for a11y. */
  id?: string;
}

export function SkillCategorySelect({
  categories,
  value,
  onChange,
  disabled = false,
  loading = false,
  id = 'skill-category-select',
}: SkillCategorySelectProps) {
  const t = useSkillsConsoleT();
  const [query, setQuery] = useState('');

  const selected = useMemo(
    () => categories.find((item) => item.code === value) ?? null,
    [categories, value],
  );

  const visible = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return categories;
    return categories.filter((item) => {
      if (item.code === value) return true;
      return (
        item.code.toLowerCase().includes(keyword) ||
        item.name.toLowerCase().includes(keyword)
      );
    });
  }, [categories, query, value]);

  if (loading) {
    return <p className="skills-console-status">{t('category.loading')}</p>;
  }

  if (categories.length === 0) {
    return (
      <div className="skills-console-category-empty" data-testid="skill-category-empty">
        <strong>{t('category.empty.title')}</strong>
        <span>{t('category.empty.description')}</span>
      </div>
    );
  }

  return (
    <div className="skills-console-category-picker" data-testid="skill-category-picker">
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t('category.searchPlaceholder')}
        aria-label={t('category.searchPlaceholder')}
        disabled={disabled}
      />
      <div
        id={id}
        role="radiogroup"
        aria-label={t('category.groupLabel')}
        className="skills-console-category-options"
      >
        {visible.length === 0 ? (
          <p className="skills-console-category-no-match">{t('category.noMatch')}</p>
        ) : (
          visible.map((item) => {
            const checked = item.code === value;
            return (
              <label
                key={item.id}
                className={
                  checked
                    ? 'skills-console-category-option is-selected'
                    : 'skills-console-category-option'
                }
              >
                <input
                  type="radio"
                  name={id}
                  value={item.code}
                  checked={checked}
                  disabled={disabled}
                  onChange={() => onChange(item.code)}
                />
                <span className="skills-console-category-option-body">
                  <span className="skills-console-category-option-name">{item.name}</span>
                  <span className="skills-console-category-option-code">{item.code}</span>
                </span>
              </label>
            );
          })
        )}
      </div>
      {selected ? (
        <p className="skills-console-category-selected" data-testid="skill-category-selected">
          {t('category.selected', { name: selected.name })}
        </p>
      ) : null}
    </div>
  );
}
