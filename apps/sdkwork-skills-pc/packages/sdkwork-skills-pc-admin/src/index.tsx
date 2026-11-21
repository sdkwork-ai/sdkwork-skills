import { useEffect, useId, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import {
  useSkillsClients,
  type CreatePackageInput,
  type SkillArtifactSource,
  type SkillCategoryRecord,
  type SkillPackageRecord,
} from '@sdkwork/skills-pc-core';
import {
  canManagePackagesInCategories,
  createSkillPackage,
  deleteSkillPackage,
  listManagedSkillCategories,
  listManagedSkillPackages,
  normalizeAllowedRoleCodes,
  updateSkillPackage,
} from '@sdkwork/skills-pc-admin-core';
import type { ManagedSkillPackagesListParams } from '@sdkwork/skills-pc-admin-core';

import { ConfirmModal, SurfaceDrawer } from './components/SurfaceOverlay.tsx';
import { ArtifactSourceField } from './components/ArtifactSourceField.tsx';
import { CategoryMultiSelect } from './components/CategoryMultiSelect.tsx';
import { RoleMultiSelect } from './components/RoleMultiSelect.tsx';
import { useSkillsAdminCopy } from './copy/skillsAdminCopy';

export {
  SKILLS_ADMIN_COPY,
  useSkillsAdminCopy,
  useSkillsAdminLocale,
  type SkillsAdminCopy,
} from './copy/skillsAdminCopy';

export {
  SelectionField,
  type SelectionChip,
  type SelectionFieldProps,
} from './components/SelectionField';
export {
  SelectionModal,
  type SelectionModalProps,
  type SelectionOption,
} from './components/SelectionModal';
export {
  ArtifactSourceField,
  type ArtifactSourceFieldProps,
} from './components/ArtifactSourceField';

const INPUT_CLASS =
  'w-full rounded-md border border-zinc-700 bg-zinc-800/60 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60';
const LABEL_CLASS = 'grid gap-1.5 text-sm';
const LABEL_TEXT_CLASS = 'text-xs font-medium text-zinc-400';
const SECONDARY_BUTTON_CLASS =
  'rounded-md border border-zinc-700 bg-zinc-800/60 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-700/60 disabled:opacity-60';
const PRIMARY_BUTTON_CLASS =
  'rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-60';
const ALERT_CLASS = 'admin-alert admin-alert--error';

type CreatePackageForm = Omit<CreatePackageInput, 'initialArtifact'> & {
  initialArtifact: Omit<CreatePackageInput['initialArtifact'], 'source'> & {
    source: SkillArtifactSource | null;
  };
};

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className={LABEL_CLASS}>
      <span className={LABEL_TEXT_CLASS}>{label}</span>
      {children}
      {hint ? <span className="text-xs text-zinc-500">{hint}</span> : null}
    </label>
  );
}

/**
 * Visible category options for the filter select.
 *
 * A category can be hidden or retired after it was selected; keeping the
 * selected value as an option prevents the select from rendering blank while
 * the package list stays filtered by that code.
 */
function activeCategoryOptions(
  categories: readonly SkillCategoryRecord[],
  selected: string,
): { value: string; label: string }[] {
  const options = categories
    .filter((category) => category.visible && category.status === 1)
    .slice()
    .sort((left, right) => left.sortWeight - right.sortWeight)
    .map((category) => ({ value: category.code, label: category.name }));
  if (selected.length > 0 && !options.some((option) => option.value === selected)) {
    const retained = categories.find((category) => category.code === selected);
    options.push({ value: selected, label: retained?.name ?? selected });
  }
  return options;
}

export function AdminSkillsPage({
  grantedPermissions = [],
  roleCodes = [],
  initialEditPackageId = null,
}: {
  grantedPermissions?: readonly string[];
  roleCodes?: readonly string[];
  initialEditPackageId?: string | null;
}) {
  const copy = useSkillsAdminCopy();
  const clients = useSkillsClients();
  const createFormId = useId();
  const editFormId = useId();
  const [packages, setPackages] = useState<SkillPackageRecord[]>([]);
  const [categories, setCategories] = useState<SkillCategoryRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [artifactSourceKey, setArtifactSourceKey] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<SkillPackageRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SkillPackageRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [categoryCode, setCategoryCode] = useState('');
  const [roleScope, setRoleScope] = useState<'all' | 'mine'>('all');
  // The category chips, the keyword, and the role scope all travel to the list
  // endpoint: the backend filters and paginates, so the totals stay honest and
  // a role-scoped view is one request rather than a client-side judgement.
  const usableRoleCodes = useMemo(
    () => roleCodes.map((code) => code.trim()).filter((code) => code.length > 0),
    [roleCodes],
  );
  const listParams = useMemo<ManagedSkillPackagesListParams | undefined>(() => {
    // The tables render the whole filtered list, so the request asks for the
    // maximum page the backend serves (`MAX_LIST_PAGE_SIZE`); without it the
    // default window would silently hide everything past the first 20 rows.
    const params: NonNullable<ManagedSkillPackagesListParams> = { pageSize: 200 };
    if (keyword.trim().length > 0) {
      params.q = keyword.trim();
    }
    if (categoryCode.length > 0) {
      params.categoryCode = categoryCode;
    }
    if (roleScope === 'mine' && usableRoleCodes.length > 0) {
      params.roleCodes = [...usableRoleCodes].sort().join(',');
    }
    return params;
  }, [keyword, categoryCode, roleScope, usableRoleCodes]);
  const [form, setForm] = useState<CreatePackageForm>({
    skillKey: 'skill.demo.sample',
    packageKey: 'demo-sample',
    code: 'demo-sample',
    displayName: copy.admin.defaults.displayName,
    summary: copy.admin.defaults.summary,
    categories: [],
    tags: ['demo'],
    allowedRoleCodes: [],
    status: 'active',
    visibility: 'tenant',
    initialArtifact: {
      versionLabel: '1.0.0',
      source: null,
      invocationKind: 'local-workflow',
      entrypoint: 'run',
      inputSchema: {},
      outputSchema: {},
      configSchema: {},
      defaultConfig: {},
      status: 'published',
      capabilityKeys: [],
    },
  });

  async function reload() {
    const [packagePage, categoryPage] = await Promise.all([
      listManagedSkillPackages(clients, listParams),
      // The category filter needs the full registry, not the default window.
      listManagedSkillCategories(clients, { pageSize: 200 }),
    ]);
    setPackages(packagePage.items);
    setCategories(categoryPage.items);
  }

  useEffect(() => {
    reload().catch((cause: Error) => setError(cause.message));
  }, [clients, listParams]);

  useEffect(() => {
    if (!initialEditPackageId || packages.length === 0) return;
    const found = packages.find((item) => item.id === initialEditPackageId);
    if (found) setEditTarget(found);
  }, [initialEditPackageId, packages]);

  function openCreate() {
    setError(null);
    setCreateOpen(true);
  }

  function closeCreate() {
    if (creating) return;
    setCreateOpen(false);
    setError(null);
  }

  function closeEdit() {
    if (saving) return;
    setEditTarget(null);
    setError(null);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const source = form.initialArtifact.source;
    if (!source) {
      setError(copy.admin.errors.needArtifact);
      return;
    }
    const selectedCategories = form.categories ?? [];
    if (
      !canManagePackagesInCategories(
        grantedPermissions,
        roleCodes,
        selectedCategories,
        categories,
      )
    ) {
      setError(copy.admin.errors.noCategoryPermission);
      return;
    }
    const input: CreatePackageInput = {
      ...form,
      initialArtifact: { ...form.initialArtifact, source },
    };
    setCreating(true);
    try {
      await createSkillPackage(clients, input);
      setCreateOpen(false);
      setArtifactSourceKey((key) => key + 1);
      setForm((current) => ({
        ...current,
        initialArtifact: { ...current.initialArtifact, source: null },
      }));
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setCreating(false);
    }
  }

  async function onUpdatePackage(event: FormEvent) {
    event.preventDefault();
    const current = editTarget;
    if (!current) return;
    setError(null);
    setSaving(true);
    try {
      await updateSkillPackage(clients, current.id, {
        version: current.version,
        ...(current.displayName ? { displayName: current.displayName } : {}),
        ...(current.summary ? { summary: current.summary } : {}),
        ...(current.description ? { description: current.description } : {}),
        ...(current.categories.length > 0 ? { categories: current.categories } : {}),
        ...(current.tags.length > 0 ? { tags: current.tags } : {}),
        allowedRoleCodes: normalizeAllowedRoleCodes(current.allowedRoleCodes ?? []),
      });
      setEditTarget(null);
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteSkillPackage(clients, deleteTarget.id);
      setDeleteTarget(null);
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="embedded-fill-page">
      <header className="admin-page-header">
        <div>
          <h2 className="admin-page-header__title">{copy.admin.title}</h2>
          <p className="admin-page-header__description">{copy.admin.description}</p>
        </div>
        <div className="admin-page-header__actions">
          <button
            type="button"
            className="admin-button admin-button--primary"
            onClick={openCreate}
          >
            {copy.admin.createPackage}
          </button>
        </div>
      </header>

      {error && !createOpen && editTarget === null ? (
        <div role="alert" className={ALERT_CLASS}>
          {error}
        </div>
      ) : null}

      <div className="data-surface">
        {/* Catalog filters: keyword, category, and the operator's role scope.
            Every page in the AI-foundation console renders the same three
            controls, and they all narrow the list endpoint rather than a loaded
            page, so the four catalogs read consistently. */}
        <div className="admin-list-toolbar">
          <div className="admin-list-toolbar__filters">
            <label className="admin-field admin-field--search">
              <span className="admin-field__label">{copy.admin.filters.keywordLabel}</span>
              <input
                className="admin-control"
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder={copy.admin.filters.keywordPlaceholder}
              />
            </label>
            <label className="admin-field admin-field--compact">
              <span className="admin-field__label">{copy.admin.filters.categoryLabel}</span>
              <select
                className="admin-control"
                value={categoryCode}
                onChange={(event) => setCategoryCode(event.target.value)}
              >
                <option value="">{copy.admin.filters.allCategories}</option>
                {activeCategoryOptions(categories, categoryCode).map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="admin-field">
              <span className="admin-field__label">{copy.admin.filters.roleScopeLabel}</span>
              <div
                className="admin-segmented"
                role="group"
                aria-label={copy.admin.filters.roleScopeLabel}
              >
                {(['all', 'mine'] as const).map((scope) => {
                  const disabled = scope === 'mine' && usableRoleCodes.length === 0;
                  return (
                    <button
                      key={scope}
                      type="button"
                      className="admin-segmented__item"
                      aria-pressed={roleScope === scope}
                      disabled={disabled}
                      title={disabled ? copy.admin.filters.roleScopeUnavailable : undefined}
                      onClick={() => setRoleScope(scope)}
                    >
                      {scope === 'all'
                        ? copy.admin.filters.roleScopeAll
                        : copy.admin.filters.roleScopeMine}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="table-frame">
          {packages.length === 0 ? (
            <div className="admin-list-state">
              <p>{copy.admin.empty}</p>
              <button
                type="button"
                className="admin-button admin-button--primary"
                onClick={openCreate}
              >
                {copy.admin.createPackage}
              </button>
            </div>
          ) : (
            <table className="admin-list-table">
              <thead>
                <tr>
                  <th>{copy.admin.table.name}</th>
                  <th>{copy.admin.table.skillKey}</th>
                  <th>{copy.admin.table.categories}</th>
                  <th>{copy.admin.table.roles}</th>
                  <th>{copy.admin.table.actions}</th>
                </tr>
              </thead>
              <tbody>
                {packages.map((item) => (
                  <tr key={item.id} className="align-top">
                    <td className="font-medium">{item.displayName}</td>
                    <td>
                      <code className="font-mono text-xs">{item.skillKey}</code>
                    </td>
                    <td className="max-w-52">
                      {item.categories.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {item.categories.map((code) => (
                            <span key={code} className="admin-badge admin-badge--info">
                              {code}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span>{copy.admin.table.noValue}</span>
                      )}
                    </td>
                    <td>
                      {item.allowedRoleCodes.length === 0
                        ? copy.admin.table.allRoles
                        : normalizeAllowedRoleCodes(item.allowedRoleCodes ?? []).join(', ')}
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="admin-button admin-button--secondary"
                          onClick={() => setEditTarget(item)}
                        >
                          {copy.admin.table.edit}
                        </button>
                        <button
                          type="button"
                          className="admin-button admin-button--danger"
                          onClick={() => setDeleteTarget(item)}
                        >
                          {copy.admin.table.delete}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <SurfaceDrawer
        open={createOpen}
        title={copy.admin.createDrawer.title}
        description={copy.admin.createDrawer.description}
        onClose={closeCreate}
        footer={
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              onClick={closeCreate}
              disabled={creating}
            >
              {copy.admin.createDrawer.cancel}
            </button>
            <button
              type="submit"
              form={createFormId}
              className={PRIMARY_BUTTON_CLASS}
              disabled={creating || !form.initialArtifact.source}
            >
              {creating
                ? copy.admin.createDrawer.submitting
                : copy.admin.createDrawer.submit}
            </button>
          </div>
        }
      >
        <form id={createFormId} onSubmit={onSubmit} className="grid gap-4">
          {error ? (
            <div role="alert" className={ALERT_CLASS}>
              {error}
            </div>
          ) : null}
          <Field label={copy.admin.createDrawer.skillKey}>
            <input
              className={INPUT_CLASS}
              value={form.skillKey}
              onChange={(event) => setForm({ ...form, skillKey: event.target.value })}
              placeholder={copy.admin.createDrawer.skillKeyPlaceholder}
              required
            />
          </Field>
          <Field label={copy.admin.createDrawer.displayName}>
            <input
              className={INPUT_CLASS}
              value={form.displayName}
              onChange={(event) => setForm({ ...form, displayName: event.target.value })}
              placeholder={copy.admin.createDrawer.displayNamePlaceholder}
              required
            />
          </Field>
          <CategoryMultiSelect
            categories={categories}
            value={form.categories ?? []}
            onChange={(selectedCategories) =>
              setForm({ ...form, categories: selectedCategories })
            }
            disabled={creating}
          />
          <RoleMultiSelect
            value={form.allowedRoleCodes ?? []}
            onChange={(allowedRoleCodes) => setForm({ ...form, allowedRoleCodes })}
            disabled={creating}
          />
          <ArtifactSourceField
            key={artifactSourceKey}
            driveClient={clients.drive}
            value={form.initialArtifact.source}
            onChange={(source) =>
              setForm((current) => ({
                ...current,
                initialArtifact: { ...current.initialArtifact, source },
              }))
            }
            disabled={creating}
          />
          <Field label={copy.admin.createDrawer.artifactVersion}>
            <input
              className={`${INPUT_CLASS} w-40`}
              value={form.initialArtifact.versionLabel}
              onChange={(event) =>
                setForm({
                  ...form,
                  initialArtifact: {
                    ...form.initialArtifact,
                    versionLabel: event.target.value,
                  },
                })
              }
              placeholder={copy.admin.createDrawer.artifactVersionPlaceholder}
              required
            />
          </Field>
        </form>
      </SurfaceDrawer>

      <SurfaceDrawer
        open={editTarget != null}
        title={
          editTarget
            ? copy.admin.editDrawer.title(editTarget.skillKey)
            : copy.admin.editDrawer.fallbackTitle
        }
        onClose={closeEdit}
        footer={
          editTarget ? (
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                onClick={closeEdit}
                disabled={saving}
              >
                {copy.admin.editDrawer.cancel}
              </button>
              <button
                type="submit"
                form={editFormId}
                className={PRIMARY_BUTTON_CLASS}
                disabled={saving}
              >
                {saving ? copy.admin.editDrawer.saving : copy.admin.editDrawer.save}
              </button>
            </div>
          ) : null
        }
      >
        {editTarget ? (
          <form id={editFormId} onSubmit={onUpdatePackage} className="grid gap-4">
            {error ? (
              <div role="alert" className={ALERT_CLASS}>
                {error}
              </div>
            ) : null}
            <Field label={copy.admin.editDrawer.displayName}>
              <input
                className={INPUT_CLASS}
                value={editTarget.displayName}
                onChange={(event) => setEditTarget({ ...editTarget, displayName: event.target.value })}
                placeholder={copy.admin.editDrawer.displayNamePlaceholder}
                required
              />
            </Field>
            <Field label={copy.admin.editDrawer.summary}>
              <input
                className={INPUT_CLASS}
                value={editTarget.summary ?? ''}
                onChange={(event) => setEditTarget({ ...editTarget, summary: event.target.value || null })}
                placeholder={copy.admin.editDrawer.summaryPlaceholder}
              />
            </Field>
            <Field label={copy.admin.editDrawer.description}>
              <textarea
                className={`${INPUT_CLASS} min-h-24`}
                value={editTarget.description ?? ''}
                onChange={(event) => setEditTarget({ ...editTarget, description: event.target.value || null })}
                placeholder={copy.admin.editDrawer.descriptionPlaceholder}
                rows={4}
              />
            </Field>
            <RoleMultiSelect
              value={editTarget.allowedRoleCodes ?? []}
              onChange={(allowedRoleCodes) => setEditTarget({ ...editTarget, allowedRoleCodes })}
              disabled={saving}
            />
          </form>
        ) : null}
      </SurfaceDrawer>

      <ConfirmModal
        open={deleteTarget != null}
        title={copy.admin.deleteConfirm.title}
        description={copy.admin.deleteConfirm.description(deleteTarget?.displayName ?? '')}
        confirmLabel={copy.admin.deleteConfirm.confirm}
        cancelLabel={copy.admin.deleteConfirm.cancel}
        busy={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          void confirmDelete();
        }}
      />
    </section>
  );
}
