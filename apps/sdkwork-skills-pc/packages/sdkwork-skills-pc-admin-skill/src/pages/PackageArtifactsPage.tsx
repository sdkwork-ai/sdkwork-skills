import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { isDriveArtifactRef } from '@sdkwork/skills-pc-commons/driveUri';
import { createSkillArtifact, listPackageArtifacts } from '@sdkwork/skills-pc-admin-core';
import {
  uploadSkillPackageArchive,
  useSkillsClients,
  type SkillArtifactRecord,
} from '@sdkwork/skills-pc-core';
import { useSkillsAdminCopy } from '@sdkwork/skills-pc-admin';
import { SurfaceDrawer } from '../components/SurfaceOverlay.tsx';

export function PackageArtifactsPage() {
  const copy = useSkillsAdminCopy();
  const clients = useSkillsClients();
  const { packageId = '' } = useParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [artifacts, setArtifacts] = useState<SkillArtifactRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    versionLabel: '1.1.0',
    artifactRef: '',
    checksumSha256: '',
    sizeBytes: null as string | null,
    invocationKind: 'local-workflow' as const,
    entrypoint: 'run',
    inputSchema: {} as Record<string, unknown>,
    outputSchema: {} as Record<string, unknown>,
    configSchema: {} as Record<string, unknown>,
    defaultConfig: {} as Record<string, unknown>,
    capabilityKeys: [] as string[],
  });

  async function reload() {
    const page = await listPackageArtifacts(clients, packageId);
    setArtifacts(page.items);
  }

  useEffect(() => {
    reload().catch((cause: Error) => setError(cause.message));
  }, [clients, packageId]);

  async function onUploadSelectedFile() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError(copy.artifacts.errors.selectArchive);
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const artifact = await uploadSkillPackageArchive(clients.drive, file);
      setForm((current) => ({
        ...current,
        artifactRef: artifact.artifactRef,
        checksumSha256: artifact.checksumSha256,
        sizeBytes: artifact.sizeBytes,
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
    if (!isDriveArtifactRef(form.artifactRef)) {
      setError(copy.artifacts.errors.needArtifact);
      return;
    }
    if (!/^[0-9a-f]{64}$/.test(form.checksumSha256)) {
      setError(copy.artifacts.errors.checksum);
      return;
    }
    try {
      await createSkillArtifact(clients, packageId, form);
      setForm((current) => ({ ...current, artifactRef: '', checksumSha256: '' }));
      setSelectedFileName(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setCreateOpen(false);
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  return (
    <section className="skills-console-page">
      <header className="skills-console-header" style={{ marginBottom: 0 }}>
        <h2>{copy.artifacts.title(packageId)}</h2>
        <button type="button" className="skills-console-primary" onClick={() => setCreateOpen(true)}>
          {copy.artifacts.attach}
        </button>
      </header>
      {error ? <p role="alert">{error}</p> : null}
      <div className="data-surface">
        <div className="table-frame">
          {artifacts.length === 0 ? (
            <div className="empty-state">
              <span>{copy.artifacts.empty}</span>
              <button type="button" className="skills-console-primary" onClick={() => setCreateOpen(true)}>
                {copy.artifacts.attach}
              </button>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>{copy.artifacts.table.version}</th>
                  <th>{copy.artifacts.table.status}</th>
                  <th>{copy.artifacts.table.invocation}</th>
                </tr>
              </thead>
              <tbody>
                {artifacts.map((item) => (
                  <tr key={item.id}>
                    <td>{item.versionLabel}</td>
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
        onClose={() => setCreateOpen(false)}
      >
        <form onSubmit={onSubmit} style={{ display: 'grid', gap: 8 }}>
          <input
            value={form.versionLabel}
            onChange={(event) => setForm({ ...form, versionLabel: event.target.value })}
            placeholder={copy.artifacts.drawer.versionLabelPlaceholder}
            required
          />
          <div style={{ display: 'grid', gap: 8 }}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip,.tar,.gz,.tgz,.skillpkg,application/zip"
            />
            <button type="button" onClick={onUploadSelectedFile} disabled={uploading}>
              {uploading ? copy.artifacts.drawer.uploading : copy.artifacts.drawer.upload}
            </button>
            {selectedFileName ? <p>{copy.artifacts.drawer.uploadedFile(selectedFileName)}</p> : null}
            <input
              value={form.artifactRef}
              readOnly
              placeholder={copy.artifacts.drawer.artifactRefPlaceholder}
            />
          </div>
          <div className="sdkwork-surface-drawer-form-actions">
            <button type="button" onClick={() => setCreateOpen(false)}>
              {copy.artifacts.drawer.cancel}
            </button>
            <button type="submit" disabled={uploading}>
              {copy.artifacts.drawer.submit}
            </button>
          </div>
        </form>
      </SurfaceDrawer>
    </section>
  );
}
