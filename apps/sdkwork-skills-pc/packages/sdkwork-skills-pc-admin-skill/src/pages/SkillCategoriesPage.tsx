import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  createSkillCategory,
  listManagedSkillCategories,
  packageManagePermissionForCategory,
  updateSkillCategory,
} from '@sdkwork/skills-pc-admin-core';
import { useSkillsClients, type SkillCategoryRecord } from '@sdkwork/skills-pc-core';
import { useSkillsAdminCopy } from '@sdkwork/skills-pc-admin';
import { SurfaceDrawer } from '../components/SurfaceOverlay.tsx';

/**
 * Skill category taxonomy, as declared by the backend write contract
 * (`CreateSkillCategoryCommand.categoryType` enum: `skill_market` |
 * `skills_collection`).
 *
 * The two are separate taxonomies over the same table, not two views of one
 * list: a *market* category files published packages for consumers, while a
 * *collection* category groups them for the operator. The console's package
 * form therefore resolves against one taxonomy, and an operator must be able to
 * see and curate each independently — hence the tab strip rather than a single
 * flat list.
 */
const CATEGORY_TYPES = ['skill_market', 'skills_collection'] as const;
type CategoryType = (typeof CATEGORY_TYPES)[number];

const INPUT_CLASS =
  'w-full rounded-md border border-zinc-700 bg-zinc-800/60 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60';
const LABEL_TEXT_CLASS = 'text-xs font-medium text-zinc-400';
const PRIMARY_BUTTON_CLASS = 'rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-60';
const SECONDARY_BUTTON_CLASS = 'rounded-md border border-zinc-700 bg-zinc-800/60 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-700/60 disabled:opacity-60';

/**
 * Permission code a market category grants.
 *
 * Delegates to the admin-core helper rather than re-deriving the string: the
 * console resolves a package's permission through
 * `packageManagePermissionForCategory` / `resolveCategoryPackagePermission`, so
 * a category created here must produce exactly the code the console will look
 * up. A *collection* is a presentation grouping and carries no
 * package-management grant, so it keeps `permissionCode` unset.
 */
const defaultPermissionCode = packageManagePermissionForCategory;

interface CreateFormState {
  categoryType: CategoryType;
  code: string;
  name: string;
  description: string;
  parentId: string;
  sortWeight: number;
  permissionCode: string;
  visible: boolean;
  status: 0 | 1;
}

interface EditFormState {
  name: string;
  description: string;
  parentId: string;
  sortWeight: number;
  permissionCode: string;
  visible: boolean;
  status: 0 | 1;
}

const EMPTY_CREATE: CreateFormState = {
  categoryType: 'skill_market',
  code: '',
  name: '',
  description: '',
  parentId: '',
  sortWeight: 0,
  permissionCode: '',
  visible: true,
  status: 1,
};

/**
 * Admin curation surface for the Skill category taxonomy.
 *
 * ## Why this page lives here
 * It is the page layer of the `sdkwork-skills-pc-admin-skill` package, which is
 * the module's own administrative surface. The host (`sdkwork-webserver`) only
 * mounts it; every rule below — which taxonomies exist, which fields are
 * mutable, what a permission code looks like — is owned here.
 *
 * ## What the backend does and does not allow
 * - `code` is **immutable**: `UpdateSkillCategoryCommand` carries no `code`
 *   field, so the edit form renders it read-only rather than pretending to
 *   accept an edit the server would ignore.
 * - `version` is **required** on update (optimistic concurrency) and is threaded
 *   from the record being edited, never from form state.
 * - There is **no delete endpoint** (`skillCategories` exposes list / create /
 *   retrieve / update). Rather than shipping a button that 404s, retirement is
 *   modelled as `status = 0` (disabled) plus `visible = false`, and the page says
 *   so explicitly. A disabled category stops being offered to the console
 *   picker while remaining addressable by packages already filed under it.
 */
export function SkillCategoriesPage() {
  const copy = useSkillsAdminCopy();
  const clients = useSkillsClients();
  const [categories, setCategories] = useState<SkillCategoryRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<CategoryType>('skill_market');
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<SkillCategoryRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [createForm, setCreateForm] = useState<CreateFormState>(EMPTY_CREATE);
  const [editForm, setEditForm] = useState<EditFormState>({
    name: '',
    description: '',
    parentId: '',
    sortWeight: 0,
    permissionCode: '',
    visible: true,
    status: 1,
  });

  async function reload() {
    const page = await listManagedSkillCategories(clients);
    setCategories(page.items);
  }

  useEffect(() => {
    reload().catch((cause: Error) => setError(cause.message));
  }, [clients]);

  /** Categories of the taxonomy currently being curated, sorted the way the
   *  console orders them (sortWeight ascending, then name) so the admin list and
   *  the console picker never disagree on order. */
  const visibleCategories = useMemo(() => {
    return categories
      .filter((item) => (item.categoryType ?? 'skill_market') === activeType)
      .slice()
      .sort((a, b) => {
        const byWeight = (a.sortWeight ?? 0) - (b.sortWeight ?? 0);
        if (byWeight !== 0) return byWeight;
        return (a.name ?? '').localeCompare(b.name ?? '');
      });
  }, [categories, activeType]);

  /** Parent options exclude the record being edited so a category cannot be
   *  re-parented onto itself (which would orphan its subtree). */
  const parentOptions = useMemo(() => {
    return visibleCategories.filter((item) => item.id !== editTarget?.id);
  }, [visibleCategories, editTarget]);

  const counts = useMemo(() => {
    const next: Record<CategoryType, number> = { skill_market: 0, skills_collection: 0 };
    for (const item of categories) {
      const type = (item.categoryType ?? 'skill_market') as CategoryType;
      if (type in next) next[type] += 1;
    }
    return next;
  }, [categories]);

  function openCreate() {
    setCreateForm({ ...EMPTY_CREATE, categoryType: activeType });
    setCreateOpen(true);
  }

  function openEdit(category: SkillCategoryRecord) {
    setEditTarget(category);
    setEditForm({
      name: category.name ?? '',
      description: category.description ?? '',
      parentId: category.parentId ?? '',
      sortWeight: category.sortWeight ?? 0,
      permissionCode: category.permissionCode ?? '',
      visible: category.visible ?? true,
      status: category.status === 0 ? 0 : 1,
    });
  }

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const code = createForm.code.trim();
      await createSkillCategory(clients, {
        categoryType: createForm.categoryType,
        code,
        name: createForm.name.trim(),
        description: createForm.description.trim() || undefined,
        parentId: createForm.parentId.trim() || undefined,
        sortWeight: createForm.sortWeight,
        // A market category needs a permission grant; a collection is a
        // presentation grouping and is created without one.
        permissionCode:
          createForm.categoryType === 'skill_market'
            ? createForm.permissionCode.trim() || defaultPermissionCode(code)
            : undefined,
        visible: createForm.visible,
        status: createForm.status,
      });
      setCreateOpen(false);
      setActiveType(createForm.categoryType);
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSubmitting(false);
    }
  }

  async function onUpdate(event: FormEvent) {
    event.preventDefault();
    const target = editTarget;
    if (!target) return;
    setError(null);
    setSubmitting(true);
    try {
      await updateSkillCategory(clients, target.id, {
        version: target.version,
        name: editForm.name.trim(),
        description: editForm.description.trim() || null,
        parentId: editForm.parentId.trim() || null,
        sortWeight: editForm.sortWeight,
        // `permissionCode` is `string | undefined` on the write contract (not
        // nullable), so an emptied field is sent as `undefined` and the server
        // keeps its current value rather than receiving an explicit null.
        permissionCode: editForm.permissionCode.trim() || undefined,
        visible: editForm.visible,
        status: editForm.status,
      });
      setEditTarget(null);
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="flex flex-col gap-4 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">{copy.categories.title}</h2>
          <p className="mt-0.5 max-w-2xl text-sm text-zinc-400">
            {copy.categories.description}
          </p>
        </div>
        <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={openCreate}>
          {copy.categories.create}
        </button>
      </header>

      {error ? (
        <div
          role="alert"
          className="rounded-md border border-red-800 bg-red-950/50 px-3 py-2 text-sm text-red-400"
        >
          {error}
        </div>
      ) : null}

      <div
        className="inline-flex w-fit gap-1 rounded-lg border border-zinc-800 bg-zinc-900/80 p-1"
        role="tablist"
        aria-label={copy.categories.taxonomyAria}
      >
        {CATEGORY_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            role="tab"
            aria-selected={activeType === type}
            className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
              activeType === type
                ? 'bg-blue-600 font-medium text-white'
                : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
            }`}
            onClick={() => setActiveType(type)}
          >
            {copy.categories.types[type]} ({counts[type]})
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/60">
        {visibleCategories.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
            <h3 className="text-base font-semibold text-zinc-200">
              {copy.categories.empty.title(copy.categories.types[activeType])}
            </h3>
            <p className="max-w-md text-sm text-zinc-400">{copy.categories.empty.description}</p>
            <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={openCreate}>
              {copy.categories.empty.create}
            </button>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-800/60 text-xs uppercase tracking-wide text-zinc-400">
              <tr>
                <th className="px-3 py-2.5 font-medium">{copy.categories.table.name}</th>
                <th className="px-3 py-2.5 font-medium">{copy.categories.table.code}</th>
                <th className="px-3 py-2.5 font-medium">{copy.categories.table.parent}</th>
                <th className="px-3 py-2.5 font-medium">{copy.categories.table.permission}</th>
                <th className="px-3 py-2.5 font-medium">{copy.categories.table.sort}</th>
                <th className="px-3 py-2.5 font-medium">{copy.categories.table.state}</th>
                <th className="px-3 py-2.5 font-medium">{copy.categories.table.actions}</th>
              </tr>
            </thead>
            <tbody>
              {visibleCategories.map((item) => {
                const parent = item.parentId
                  ? categories.find((candidate) => candidate.id === item.parentId)
                  : undefined;
                return (
                  <tr key={item.id} className="border-t border-zinc-800 hover:bg-zinc-800/40">
                    <td className="px-3 py-2.5 font-medium text-zinc-100">{item.name}</td>
                    <td className="px-3 py-2.5">
                      <code className="font-mono text-xs text-zinc-300">{item.code}</code>
                    </td>
                    <td className="px-3 py-2.5 text-zinc-400">
                      {parent ? parent.name : copy.categories.table.noValue}
                    </td>
                    <td className="px-3 py-2.5">
                      {item.permissionCode ? (
                        <code className="font-mono text-xs text-zinc-300">{item.permissionCode}</code>
                      ) : (
                        <span className="text-zinc-500">{copy.categories.table.noValue}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-zinc-400">{item.sortWeight}</td>
                    <td className="px-3 py-2.5">
                      {item.status === 1 ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-400">
                          <span className="size-1.5 rounded-full bg-emerald-400" />
                          {copy.categories.table.enabled}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-700/60 px-2 py-0.5 text-xs font-medium text-zinc-400">
                          <span className="size-1.5 rounded-full bg-zinc-500" />
                          {copy.categories.table.disabled}
                        </span>
                      )}
                      {!item.visible ? (
                        <span className="ml-1.5 text-xs text-zinc-500">
                          {copy.categories.table.hidden}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5">
                      <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => openEdit(item)}>
                        {copy.categories.table.edit}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <SurfaceDrawer
        open={createOpen}
        title={copy.categories.drawer.createTitle}
        onClose={() => setCreateOpen(false)}
      >
        <form onSubmit={onCreate} className="grid gap-4">
          <label className="grid gap-1.5 text-sm">
            <span className={LABEL_TEXT_CLASS}>{copy.categories.drawer.taxonomy}</span>
            <select
              className={INPUT_CLASS}
              value={createForm.categoryType}
              onChange={(event) =>
                setCreateForm({ ...createForm, categoryType: event.target.value as CategoryType })
              }
            >
              {CATEGORY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {copy.categories.types[type]}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className={LABEL_TEXT_CLASS}>{copy.categories.drawer.code}</span>
            <input
              className={INPUT_CLASS}
              value={createForm.code}
              onChange={(event) => {
                const code = event.target.value;
                setCreateForm((prev) => ({
                  ...prev,
                  code,
                  // Keep the suggested permission in step with the code until
                  // the operator overrides it, so a market category never lands
                  // without the grant the console looks up.
                  permissionCode:
                    prev.permissionCode === '' || prev.permissionCode === defaultPermissionCode(prev.code)
                      ? defaultPermissionCode(code)
                      : prev.permissionCode,
                }));
              }}
              placeholder={copy.categories.drawer.codePlaceholder}
              required
            />
            <small className="text-xs text-zinc-500">{copy.categories.drawer.codeHint}</small>
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className={LABEL_TEXT_CLASS}>{copy.categories.drawer.name}</span>
            <input
              className={INPUT_CLASS}
              value={createForm.name}
              onChange={(event) => setCreateForm({ ...createForm, name: event.target.value })}
              placeholder={copy.categories.drawer.namePlaceholder}
              required
            />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className={LABEL_TEXT_CLASS}>{copy.categories.drawer.description}</span>
            <textarea
              className={INPUT_CLASS}
              value={createForm.description}
              onChange={(event) => setCreateForm({ ...createForm, description: event.target.value })}
              rows={3}
            />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className={LABEL_TEXT_CLASS}>{copy.categories.drawer.parent}</span>
            <select
              className={INPUT_CLASS}
              value={createForm.parentId}
              onChange={(event) => setCreateForm({ ...createForm, parentId: event.target.value })}
            >
              <option value="">{copy.categories.drawer.parentNone}</option>
              {categories
                .filter((item) => (item.categoryType ?? 'skill_market') === createForm.categoryType)
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className={LABEL_TEXT_CLASS}>{copy.categories.drawer.sortWeight}</span>
            <input
              className={INPUT_CLASS}
              type="number"
              value={createForm.sortWeight}
              onChange={(event) =>
                setCreateForm({ ...createForm, sortWeight: Number(event.target.value) || 0 })
              }
            />
            <small className="text-xs text-zinc-500">
              {copy.categories.drawer.sortWeightHint}
            </small>
          </label>
          {createForm.categoryType === 'skill_market' ? (
            <label className="grid gap-1.5 text-sm">
              <span className={LABEL_TEXT_CLASS}>{copy.categories.drawer.permission}</span>
              <input
                className={INPUT_CLASS}
                value={createForm.permissionCode}
                onChange={(event) =>
                  setCreateForm({ ...createForm, permissionCode: event.target.value })
                }
                placeholder={defaultPermissionCode(createForm.code || 'category')}
              />
              <small className="text-xs text-zinc-500">
                {copy.categories.drawer.permissionHint}
              </small>
            </label>
          ) : null}
          <label className="grid gap-1.5 text-sm">
            <span className={LABEL_TEXT_CLASS}>{copy.categories.drawer.status}</span>
            <select
              className={INPUT_CLASS}
              value={createForm.status}
              onChange={(event) =>
                setCreateForm({
                  ...createForm,
                  status: Number(event.target.value) === 0 ? 0 : 1,
                })
              }
            >
              <option value={1}>{copy.categories.drawer.statusEnabled}</option>
              <option value={0}>{copy.categories.drawer.statusDisabled}</option>
            </select>
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className={LABEL_TEXT_CLASS}>{copy.categories.drawer.visible}</span>
            <input
              className="size-4 rounded border-zinc-600 bg-zinc-800"
              type="checkbox"
              checked={createForm.visible}
              onChange={(event) => setCreateForm({ ...createForm, visible: event.target.checked })}
            />
          </label>
          <div className="sdkwork-surface-drawer-form-actions mt-2 flex justify-end gap-2">
            <button type="button" onClick={() => setCreateOpen(false)} disabled={submitting}>
              {copy.categories.drawer.cancel}
            </button>
            <button type="submit" disabled={submitting}>
              {copy.categories.drawer.create}
            </button>
          </div>
        </form>
      </SurfaceDrawer>

      <SurfaceDrawer
        open={editTarget != null}
        title={
          editTarget
            ? copy.categories.drawer.editTitle(editTarget.name)
            : copy.categories.drawer.editFallbackTitle
        }
        onClose={() => setEditTarget(null)}
      >
        {editTarget ? (
          <form onSubmit={onUpdate} className="grid gap-4">
            <label className="grid gap-1.5 text-sm">
              <span className={LABEL_TEXT_CLASS}>{copy.categories.drawer.code}</span>
              <input className="w-full rounded-md border border-zinc-700 bg-zinc-800/60 px-3 py-2 text-sm text-zinc-100 disabled:opacity-60" value={editTarget.code} readOnly disabled />
              <small className="text-xs text-zinc-500">
                {copy.categories.drawer.codeEditHint}
              </small>
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className={LABEL_TEXT_CLASS}>{copy.categories.drawer.taxonomy}</span>
              <input
                className={INPUT_CLASS}
                value={copy.categories.types[(editTarget.categoryType ?? 'skill_market') as CategoryType]}
                readOnly
                disabled
              />
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className={LABEL_TEXT_CLASS}>{copy.categories.drawer.name}</span>
              <input
                className={INPUT_CLASS}
                value={editForm.name}
                onChange={(event) => setEditForm({ ...editForm, name: event.target.value })}
                required
              />
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className={LABEL_TEXT_CLASS}>{copy.categories.drawer.description}</span>
              <textarea
                className={INPUT_CLASS}
                value={editForm.description}
                onChange={(event) => setEditForm({ ...editForm, description: event.target.value })}
                rows={3}
              />
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className={LABEL_TEXT_CLASS}>{copy.categories.drawer.parent}</span>
              <select
                className={INPUT_CLASS}
                value={editForm.parentId}
                onChange={(event) => setEditForm({ ...editForm, parentId: event.target.value })}
              >
                <option value="">{copy.categories.drawer.parentNone}</option>
                {parentOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className={LABEL_TEXT_CLASS}>{copy.categories.drawer.sortWeight}</span>
              <input
                className={INPUT_CLASS}
                type="number"
                value={editForm.sortWeight}
                onChange={(event) =>
                  setEditForm({ ...editForm, sortWeight: Number(event.target.value) || 0 })
                }
              />
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className={LABEL_TEXT_CLASS}>{copy.categories.drawer.permission}</span>
              <input
                className={INPUT_CLASS}
                value={editForm.permissionCode}
                onChange={(event) =>
                  setEditForm({ ...editForm, permissionCode: event.target.value })
                }
              />
              <small className="text-xs text-zinc-500">
                {copy.categories.drawer.permissionEditHint}
              </small>
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className={LABEL_TEXT_CLASS}>{copy.categories.drawer.status}</span>
              <select
                className={INPUT_CLASS}
                value={editForm.status}
                onChange={(event) =>
                  setEditForm({ ...editForm, status: Number(event.target.value) === 0 ? 0 : 1 })
                }
              >
                <option value={1}>{copy.categories.drawer.statusEnabled}</option>
                <option value={0}>{copy.categories.drawer.statusDisabled}</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className={LABEL_TEXT_CLASS}>{copy.categories.drawer.visible}</span>
              <input
                className="size-4 rounded border-zinc-600 bg-zinc-800"
                type="checkbox"
                checked={editForm.visible}
                onChange={(event) => setEditForm({ ...editForm, visible: event.target.checked })}
              />
            </label>
            <div className="sdkwork-surface-drawer-form-actions mt-2 flex justify-end gap-2">
              <button type="button" onClick={() => setEditTarget(null)} disabled={submitting}>
                {copy.categories.drawer.cancel}
              </button>
              <button type="submit" disabled={submitting}>
                {copy.categories.drawer.save}
              </button>
            </div>
          </form>
        ) : null}
      </SurfaceDrawer>
    </section>
  );
}
