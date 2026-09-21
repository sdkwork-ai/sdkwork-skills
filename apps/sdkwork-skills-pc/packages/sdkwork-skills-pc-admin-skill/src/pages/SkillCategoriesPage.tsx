import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  createSkillCategory,
  listManagedSkillCategories,
  packageManagePermissionForCategory,
  updateSkillCategory,
} from '@sdkwork/skills-pc-admin-core';
import { useSkillsClients, type SkillCategoryRecord } from '@sdkwork/skills-pc-core';
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

const CATEGORY_TYPE_LABELS: Record<CategoryType, string> = {
  skill_market: 'Market',
  skills_collection: 'Collection',
};

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
    <section className="skills-console-page">
      <header className="skills-console-header">
        <div>
          <h2>Categories</h2>
          <p className="skills-console-field-hint">
            Curate the Skill taxonomy. Categories are assigned at creation time and cannot be
            deleted — retire one by disabling it.
          </p>
        </div>
        <button type="button" className="skills-console-primary" onClick={openCreate}>
          Create category
        </button>
      </header>

      {error ? <p role="alert">{error}</p> : null}

      <div className="skills-console-tabs" role="tablist" aria-label="Category taxonomy">
        {CATEGORY_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            role="tab"
            aria-selected={activeType === type}
            className={activeType === type ? 'is-active' : undefined}
            onClick={() => setActiveType(type)}
          >
            {CATEGORY_TYPE_LABELS[type]} ({counts[type]})
          </button>
        ))}
      </div>

      <div className="data-surface">
        <div className="table-frame">
          {visibleCategories.length === 0 ? (
            <div className="empty-state">
              <h3>No {CATEGORY_TYPE_LABELS[activeType].toLowerCase()} categories</h3>
              <p>
                Create one from the header action, or switch taxonomy above. Packages cannot be
                filed without a category.
              </p>
              <button type="button" className="skills-console-primary" onClick={openCreate}>
                Create category
              </button>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Code</th>
                  <th>Parent</th>
                  <th>Permission</th>
                  <th>Sort</th>
                  <th>State</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleCategories.map((item) => {
                  const parent = item.parentId
                    ? categories.find((candidate) => candidate.id === item.parentId)
                    : undefined;
                  return (
                    <tr key={item.id}>
                      <td>{item.name}</td>
                      <td className="skills-console-category-option-code">{item.code}</td>
                      <td>{parent ? parent.name : '—'}</td>
                      <td className="skills-console-category-option-code">
                        {item.permissionCode || '—'}
                      </td>
                      <td>{item.sortWeight}</td>
                      <td>
                        {item.status === 1 ? 'Enabled' : 'Disabled'}
                        {item.visible ? '' : ' · hidden'}
                      </td>
                      <td>
                        <div className="skills-console-actions">
                          <button type="button" onClick={() => openEdit(item)}>
                            Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <SurfaceDrawer open={createOpen} title="Create category" onClose={() => setCreateOpen(false)}>
        <form onSubmit={onCreate} className="skills-console-form">
          <label className="skills-console-field">
            <span className="skills-console-field-label">Taxonomy</span>
            <select
              value={createForm.categoryType}
              onChange={(event) =>
                setCreateForm({ ...createForm, categoryType: event.target.value as CategoryType })
              }
            >
              {CATEGORY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {CATEGORY_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </label>
          <label className="skills-console-field">
            <span className="skills-console-field-label">Code</span>
            <input
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
              placeholder="e.g. data-analysis"
              required
            />
            <small className="skills-console-field-hint">
              Immutable after creation; the console resolves the category by this code.
            </small>
          </label>
          <label className="skills-console-field">
            <span className="skills-console-field-label">Name</span>
            <input
              value={createForm.name}
              onChange={(event) => setCreateForm({ ...createForm, name: event.target.value })}
              placeholder="e.g. Data analysis"
              required
            />
          </label>
          <label className="skills-console-field">
            <span className="skills-console-field-label">Description</span>
            <textarea
              value={createForm.description}
              onChange={(event) => setCreateForm({ ...createForm, description: event.target.value })}
              rows={3}
            />
          </label>
          <label className="skills-console-field">
            <span className="skills-console-field-label">Parent category</span>
            <select
              value={createForm.parentId}
              onChange={(event) => setCreateForm({ ...createForm, parentId: event.target.value })}
            >
              <option value="">None (top level)</option>
              {categories
                .filter((item) => (item.categoryType ?? 'skill_market') === createForm.categoryType)
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="skills-console-field">
            <span className="skills-console-field-label">Sort weight</span>
            <input
              type="number"
              value={createForm.sortWeight}
              onChange={(event) =>
                setCreateForm({ ...createForm, sortWeight: Number(event.target.value) || 0 })
              }
            />
            <small className="skills-console-field-hint">
              Lower sorts first in the console picker.
            </small>
          </label>
          {createForm.categoryType === 'skill_market' ? (
            <label className="skills-console-field">
              <span className="skills-console-field-label">Permission code</span>
              <input
                value={createForm.permissionCode}
                onChange={(event) =>
                  setCreateForm({ ...createForm, permissionCode: event.target.value })
                }
                placeholder={defaultPermissionCode(createForm.code || 'category')}
              />
              <small className="skills-console-field-hint">
                Granted to operators who manage packages in this category.
              </small>
            </label>
          ) : null}
          <label className="skills-console-field">
            <span className="skills-console-field-label">Status</span>
            <select
              value={createForm.status}
              onChange={(event) =>
                setCreateForm({
                  ...createForm,
                  status: Number(event.target.value) === 0 ? 0 : 1,
                })
              }
            >
              <option value={1}>Enabled</option>
              <option value={0}>Disabled</option>
            </select>
          </label>
          <label className="skills-console-field">
            <span className="skills-console-field-label">Visible in the console</span>
            <input
              type="checkbox"
              checked={createForm.visible}
              onChange={(event) => setCreateForm({ ...createForm, visible: event.target.checked })}
            />
          </label>
          <div className="sdkwork-surface-drawer-form-actions">
            <button type="button" onClick={() => setCreateOpen(false)} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" disabled={submitting}>
              Create category
            </button>
          </div>
        </form>
      </SurfaceDrawer>

      <SurfaceDrawer
        open={editTarget != null}
        title={editTarget ? `Edit ${editTarget.name}` : 'Edit category'}
        onClose={() => setEditTarget(null)}
      >
        {editTarget ? (
          <form onSubmit={onUpdate} className="skills-console-form">
            <label className="skills-console-field">
              <span className="skills-console-field-label">Code</span>
              <input value={editTarget.code} readOnly disabled />
              <small className="skills-console-field-hint">
                Immutable after creation. To rename, retire this category and create a new one.
              </small>
            </label>
            <label className="skills-console-field">
              <span className="skills-console-field-label">Taxonomy</span>
              <input
                value={CATEGORY_TYPE_LABELS[(editTarget.categoryType ?? 'skill_market') as CategoryType]}
                readOnly
                disabled
              />
            </label>
            <label className="skills-console-field">
              <span className="skills-console-field-label">Name</span>
              <input
                value={editForm.name}
                onChange={(event) => setEditForm({ ...editForm, name: event.target.value })}
                required
              />
            </label>
            <label className="skills-console-field">
              <span className="skills-console-field-label">Description</span>
              <textarea
                value={editForm.description}
                onChange={(event) => setEditForm({ ...editForm, description: event.target.value })}
                rows={3}
              />
            </label>
            <label className="skills-console-field">
              <span className="skills-console-field-label">Parent category</span>
              <select
                value={editForm.parentId}
                onChange={(event) => setEditForm({ ...editForm, parentId: event.target.value })}
              >
                <option value="">None (top level)</option>
                {parentOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="skills-console-field">
              <span className="skills-console-field-label">Sort weight</span>
              <input
                type="number"
                value={editForm.sortWeight}
                onChange={(event) =>
                  setEditForm({ ...editForm, sortWeight: Number(event.target.value) || 0 })
                }
              />
            </label>
            <label className="skills-console-field">
              <span className="skills-console-field-label">Permission code</span>
              <input
                value={editForm.permissionCode}
                onChange={(event) =>
                  setEditForm({ ...editForm, permissionCode: event.target.value })
                }
              />
              <small className="skills-console-field-hint">
                Editable — the write contract carries this field even though the code is fixed.
              </small>
            </label>
            <label className="skills-console-field">
              <span className="skills-console-field-label">Status</span>
              <select
                value={editForm.status}
                onChange={(event) =>
                  setEditForm({ ...editForm, status: Number(event.target.value) === 0 ? 0 : 1 })
                }
              >
                <option value={1}>Enabled</option>
                <option value={0}>Disabled</option>
              </select>
            </label>
            <label className="skills-console-field">
              <span className="skills-console-field-label">Visible in the console</span>
              <input
                type="checkbox"
                checked={editForm.visible}
                onChange={(event) => setEditForm({ ...editForm, visible: event.target.checked })}
              />
            </label>
            <div className="sdkwork-surface-drawer-form-actions">
              <button type="button" onClick={() => setEditTarget(null)} disabled={submitting}>
                Cancel
              </button>
              <button type="submit" disabled={submitting}>
                Save changes
              </button>
            </div>
          </form>
        ) : null}
      </SurfaceDrawer>
    </section>
  );
}
