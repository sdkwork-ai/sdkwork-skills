import { useEffect, useRef, useState, type FormEvent } from 'react';
import { isBlank, trim } from '@sdkwork/utils';
import { isDriveArtifactRef } from '@sdkwork/skills-pc-commons/driveUri';
import {
  useSkillsClients,
  type CreateCategoryInput,
  type CreatePackageInput,
  type SkillCategoryRecord,
  type SkillPackageRecord,
} from '@sdkwork/skills-pc-core';
import {
  canManagePackagesInCategories,
  createSkillCategory,
  createSkillPackage,
  deleteSkillPackage,
  listManagedSkillCategories,
  listManagedSkillPackages,
  normalizeAllowedRoleCodes,
  packageManagePermissionForCategory,
  updateSkillCategory,
  updateSkillPackage,
} from '@sdkwork/skills-pc-admin-core';

import { uploadSkillPackageArchive } from './services/skillPackageUploadService';
import { ConfirmModal, SurfaceDrawer } from './components/SurfaceOverlay.tsx';
import { RoleMultiSelect } from './components/RoleMultiSelect.tsx';
import { useSkillsAdminCopy } from './copy/skillsAdminCopy';

export {
  SKILLS_ADMIN_COPY,
  useSkillsAdminCopy,
  useSkillsAdminLocale,
  type SkillsAdminCopy,
} from './copy/skillsAdminCopy';

const INPUT_CLASS =
  'w-full rounded-md border border-zinc-700 bg-zinc-800/60 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60';
const LABEL_CLASS = 'grid gap-1.5 text-sm';
const LABEL_TEXT_CLASS = 'text-xs font-medium text-zinc-400';
const SECONDARY_BUTTON_CLASS =
  'rounded-md border border-zinc-700 bg-zinc-800/60 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-700/60 disabled:opacity-60';

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className={LABEL_CLASS}>
      <span className={LABEL_TEXT_CLASS}>{label}</span>
      {children}
      {hint ? <span className="text-xs text-zinc-500">{hint}</span> : null}
    </label>
  );
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [packages, setPackages] = useState<SkillPackageRecord[]>([]);
  const [categories, setCategories] = useState<SkillCategoryRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<SkillPackageRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SkillPackageRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState<CreatePackageInput>({
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
      artifactRef: '',
      checksumSha256: '',
      sizeBytes: null,
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
      listManagedSkillPackages(clients),
      listManagedSkillCategories(clients),
    ]);
    setPackages(packagePage.items);
    setCategories(categoryPage.items);
  }

  useEffect(() => {
    reload().catch((cause: Error) => setError(cause.message));
  }, [clients]);

  useEffect(() => {
    if (!initialEditPackageId || packages.length === 0) return;
    const found = packages.find((item) => item.id === initialEditPackageId);
    if (found) setEditTarget(found);
  }, [initialEditPackageId, packages]);

  async function onUploadSelectedFile() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError(copy.admin.errors.selectArchive);
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const artifact = await uploadSkillPackageArchive(clients.drive, file);
      setForm((current) => ({
        ...current,
        initialArtifact: {
          ...current.initialArtifact,
          artifactRef: artifact.artifactRef,
          checksumSha256: artifact.checksumSha256,
          sizeBytes: artifact.sizeBytes,
        },
      }));
      setSelectedFileName(file.name);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!isDriveArtifactRef(form.initialArtifact.artifactRef)) {
      setError(copy.admin.errors.needArtifact);
      return;
    }
    if (!/^[0-9a-f]{64}$/.test(form.initialArtifact.checksumSha256)) {
      setError(copy.admin.errors.checksum);
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
    try {
      await createSkillPackage(clients, form);
      setCreateOpen(false);
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
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
    <section className="flex flex-col gap-4 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">{copy.admin.title}</h2>
          <p className="mt-0.5 text-sm text-zinc-400">{copy.admin.description}</p>
        </div>
        <button
          type="button"
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500"
          onClick={() => setCreateOpen(true)}
        >
          {copy.admin.createPackage}
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

      <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/60">
        {packages.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
            <p className="text-sm text-zinc-400">{copy.admin.empty}</p>
            <button
              type="button"
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500"
              onClick={() => setCreateOpen(true)}
            >
              {copy.admin.createPackage}
            </button>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-800/60 text-xs uppercase tracking-wide text-zinc-400">
              <tr>
                <th className="px-3 py-2.5 font-medium">{copy.admin.table.name}</th>
                <th className="px-3 py-2.5 font-medium">{copy.admin.table.skillKey}</th>
                <th className="px-3 py-2.5 font-medium">{copy.admin.table.categories}</th>
                <th className="px-3 py-2.5 font-medium">{copy.admin.table.roles}</th>
                <th className="px-3 py-2.5 font-medium">{copy.admin.table.actions}</th>
              </tr>
            </thead>
            <tbody>
              {packages.map((item) => (
                <tr
                  key={item.id}
                  className="border-t border-zinc-800 align-top hover:bg-zinc-800/40"
                >
                  <td className="px-3 py-2.5 font-medium text-zinc-100">{item.displayName}</td>
                  <td className="px-3 py-2.5">
                    <code className="font-mono text-xs text-zinc-300">{item.skillKey}</code>
                  </td>
                  <td className="max-w-52 px-3 py-2.5">
                    {item.categories.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {item.categories.map((code) => (
                          <span
                            key={code}
                            className="rounded-full bg-blue-500/15 px-2 py-0.5 text-xs font-medium text-blue-300"
                          >
                            {code}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-zinc-500">{copy.admin.table.noValue}</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-zinc-400">
                    {item.allowedRoleCodes.length === 0
                      ? copy.admin.table.allRoles
                      : normalizeAllowedRoleCodes(item.allowedRoleCodes ?? []).join(', ')}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className={SECONDARY_BUTTON_CLASS}
                        onClick={() => setEditTarget(item)}
                      >
                        {copy.admin.table.edit}
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-red-900/60 bg-red-950/40 px-3 py-1.5 text-sm text-red-400 hover:bg-red-900/40"
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

      <SurfaceDrawer
        open={createOpen}
        title={copy.admin.createDrawer.title}
        description={copy.admin.createDrawer.description}
        onClose={() => setCreateOpen(false)}
      >
        <form onSubmit={onSubmit} className="grid gap-4">
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
          <fieldset className="rounded-lg border border-zinc-700 bg-zinc-800/40 p-3">
            <legend className="px-1 text-xs font-medium uppercase tracking-wide text-zinc-400">
              {copy.admin.createDrawer.categories}
            </legend>
            <div className="grid gap-1.5">
              {categories.map((category) => (
                <label
                  key={category.id}
                  className="flex items-start gap-2 text-sm text-zinc-300"
                >
                  <input
                    type="checkbox"
                    checked={(form.categories ?? []).includes(category.code)}
                    onChange={(event) => {
                      const current = new Set(form.categories ?? []);
                      if (event.target.checked) {
                        current.add(category.code);
                      } else {
                        current.delete(category.code);
                      }
                      setForm({ ...form, categories: [...current] });
                    }}
                    className="mt-0.5 size-4 rounded border-zinc-600 bg-zinc-800"
                  />
                  <span>
                    {category.name}
                    <span className="ml-1 font-mono text-xs text-zinc-500">({category.code})</span>
                    <span className="block text-xs text-zinc-500">{category.permissionCode}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <RoleMultiSelect
            value={form.allowedRoleCodes ?? []}
            onChange={(allowedRoleCodes) => setForm({ ...form, allowedRoleCodes })}
          />
          <fieldset className="rounded-lg border border-zinc-700 bg-zinc-800/40 p-3">
            <legend className="px-1 text-xs font-medium uppercase tracking-wide text-zinc-400">
              {copy.admin.createDrawer.artifactSection}
            </legend>
            <div className="grid gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip,.tar,.gz,.tgz,.skillpkg,application/zip"
                className="block w-full text-sm text-zinc-300 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-700 file:px-3 file:py-1.5 file:text-sm file:text-zinc-200 hover:file:bg-zinc-600"
              />
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                onClick={onUploadSelectedFile}
                disabled={uploading}
              >
                {uploading
                  ? copy.admin.createDrawer.uploading
                  : copy.admin.createDrawer.uploadArtifact}
              </button>
              {selectedFileName ? (
                <p className="text-xs text-emerald-400">
                  {copy.admin.createDrawer.uploadedFile(selectedFileName)}
                </p>
              ) : null}
              <input
                className={`${INPUT_CLASS} font-mono text-xs`}
                value={form.initialArtifact.artifactRef}
                readOnly
                placeholder={copy.admin.createDrawer.artifactRefPlaceholder}
                required
              />
            </div>
          </fieldset>
          <div className="flex items-center justify-between gap-3">
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
            <button
              type="submit"
              className="self-end rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-60"
              disabled={isBlank(trim(form.initialArtifact.artifactRef)) || uploading}
            >
              {copy.admin.createDrawer.submit}
            </button>
          </div>
        </form>
      </SurfaceDrawer>

      <SurfaceDrawer
        open={editTarget != null}
        title={
          editTarget
            ? copy.admin.editDrawer.title(editTarget.skillKey)
            : copy.admin.editDrawer.fallbackTitle
        }
        onClose={() => setEditTarget(null)}
      >
        {editTarget ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const current = editTarget;
              setError(null);
              void updateSkillPackage(clients, current.id, {
                version: current.version,
                ...(current.displayName ? { displayName: current.displayName } : {}),
                ...(current.summary ? { summary: current.summary } : {}),
                ...(current.description ? { description: current.description } : {}),
                ...(current.categories.length > 0 ? { categories: current.categories } : {}),
                ...(current.tags.length > 0 ? { tags: current.tags } : {}),
                allowedRoleCodes: normalizeAllowedRoleCodes(current.allowedRoleCodes ?? []),
              })
                .then(async () => {
                  setEditTarget(null);
                  await reload();
                })
                .catch((cause: unknown) => {
                  setError(cause instanceof Error ? cause.message : String(cause));
                });
            }}
            className="grid gap-4"
          >
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
            />
            <div className="sdkwork-surface-drawer-form-actions flex justify-end gap-2">
              <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => setEditTarget(null)}>
                {copy.admin.editDrawer.cancel}
              </button>
              <button
                type="submit"
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500"
              >
                {copy.admin.editDrawer.save}
              </button>
            </div>
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
