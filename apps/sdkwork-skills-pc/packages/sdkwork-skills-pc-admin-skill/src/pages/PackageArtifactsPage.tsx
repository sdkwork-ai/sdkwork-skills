import { useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { createSkillArtifact, listPackageArtifacts } from '@sdkwork/skills-pc-admin-core';
import {
  useSkillsClients,
  type SkillArtifactRecord,
  type SkillArtifactSource,
} from '@sdkwork/skills-pc-core';
import { ArtifactSourceField, useSkillsAdminCopy } from '@sdkwork/skills-pc-admin';
import { SurfaceDrawer } from '../components/SurfaceOverlay.tsx';

export function PackageArtifactsPage() {
  const copy = useSkillsAdminCopy();
  const clients = useSkillsClients();
  const { packageId = '' } = useParams();
  const [artifacts, setArtifacts] = useState<SkillArtifactRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [artifactSourceKey, setArtifactSourceKey] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    versionLabel: '1.1.0',
    source: null as SkillArtifactSource | null,
    invocationKind: 'local-workflow' as const,
    entrypoint: 'run',
    inputSchema: {} as Record<string, unknown>,
    outputSchema: {} as Record<string, unknown>,
    configSchema: {} as Record<string, unknown>,
    defaultConfig: {} as Record<string, unknown>,
    capabilityKeys: [] as string[],
  });

  async function reload() {
    // The artifacts table renders every version, so the request asks for the
    // maximum page the backend serves instead of the default 20-row window.
    const page = await listPackageArtifacts(clients, packageId, { pageSize: 200 });
    setArtifacts(page.items);
  }

  useEffect(() => {
    reload().catch((cause: Error) => setError(cause.message));
  }, [clients, packageId]);

  function closeCreate() {
    if (submitting) return;
    setCreateOpen(false);
    setError(null);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const source = form.source;
    if (!source) {
      setError(copy.artifacts.errors.needArtifact);
      return;
    }
    setSubmitting(true);
    try {
      await createSkillArtifact(clients, packageId, {
        ...form,
        source,
      });
      setForm((current) => ({ ...current, source: null }));
      setArtifactSourceKey((key) => key + 1);
      setCreateOpen(false);
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="embedded-fill-page">
      <header className="skills-console-header" style={{ marginBottom: 0 }}>
        <h2>{copy.artifacts.title(packageId)}</h2>
      </header>
      {error ? (
        <div role="alert" className="admin-alert admin-alert--error">
          {error}
        </div>
      ) : null}
      <div className="data-surface">
        <div className="admin-list-toolbar">
          <div className="admin-list-toolbar__actions">
            <button
              type="button"
              className="admin-button admin-button--primary"
              onClick={() => setCreateOpen(true)}
            >
              {copy.artifacts.attach}
            </button>
          </div>
        </div>
        <div className="table-frame">
          {artifacts.length === 0 ? (
            <div className="empty-state">
              <span>{copy.artifacts.empty}</span>
              <button type="button" className="skills-console-primary" onClick={() => setCreateOpen(true)}>
                {copy.artifacts.attach}
              </button>
            </div>
          ) : (
            <table className="admin-list-table">
              <thead>
                <tr>
                  <th>{copy.artifacts.table.version}</th>
                  <th>{copy.artifacts.table.source}</th>
                  <th>{copy.artifacts.table.status}</th>
                  <th>{copy.artifacts.table.invocation}</th>
                </tr>
              </thead>
              <tbody>
                {artifacts.map((item) => (
                  <tr key={item.id}>
                    <td>{item.versionLabel}</td>
                    <td>{copy.artifacts.sourceLabels[item.source.kind] ?? item.source.kind}</td>
                    <td>{copy.artifacts.statusLabels[item.status] ?? item.status}</td>
                    <td>
                      {copy.artifacts.invocationLabels[item.invocationKind] ?? item.invocationKind}
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
        title={copy.artifacts.drawer.title}
        onClose={closeCreate}
      >
        <form onSubmit={onSubmit} style={{ display: 'grid', gap: 8 }}>
          {error ? (
            <p role="alert" className="skills-console-error">
              {error}
            </p>
          ) : null}
          <input
            value={form.versionLabel}
            onChange={(event) => setForm({ ...form, versionLabel: event.target.value })}
            placeholder={copy.artifacts.drawer.versionLabelPlaceholder}
            required
          />
          <ArtifactSourceField
            key={artifactSourceKey}
            driveClient={clients.drive}
            value={form.source}
            onChange={(source) => setForm((current) => ({ ...current, source }))}
            disabled={submitting}
          />
          <div className="sdkwork-surface-drawer-form-actions">
            <button type="button" onClick={closeCreate} disabled={submitting}>
              {copy.artifacts.drawer.cancel}
            </button>
            <button type="submit" disabled={submitting || !form.source}>
              {submitting ? copy.artifacts.drawer.submitting : copy.artifacts.drawer.submit}
            </button>
          </div>
        </form>
      </SurfaceDrawer>
    </section>
  );
}
