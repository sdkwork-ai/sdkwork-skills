import { useEffect, useState, type FormEvent } from 'react';
import {
  createSkillCapability,
  listSkillCapabilities,
  updateSkillCapability,
  type SkillCapabilityRecord,
} from '@sdkwork/skills-pc-admin-core';
import { useSkillsClients } from '@sdkwork/skills-pc-core';
import { useSkillsAdminCopy } from '@sdkwork/skills-pc-admin';
import { SurfaceDrawer } from '../components/SurfaceOverlay.tsx';

export function SkillCapabilitiesPage() {
  const copy = useSkillsAdminCopy();
  const clients = useSkillsClients();
  const [capabilities, setCapabilities] = useState<SkillCapabilityRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    capabilityKey: 'capability.basic.run',
    displayName: copy.capabilities.defaults.displayName,
    description: copy.capabilities.defaults.description,
    riskLevel: 'standard' as 'standard' | 'sensitive' | 'privileged',
  });

  async function reload() {
    const page = await listSkillCapabilities(clients);
    setCapabilities(page.items);
  }

  useEffect(() => {
    reload().catch((cause: Error) => setError(cause.message));
  }, [clients]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await createSkillCapability(clients, form);
      setForm({
        capabilityKey: 'capability.basic.run',
        displayName: copy.capabilities.defaults.displayName,
        description: copy.capabilities.defaults.description,
        riskLevel: 'standard',
      });
      setCreateOpen(false);
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  async function onSetRiskLevel(
    item: SkillCapabilityRecord,
    riskLevel: 'standard' | 'sensitive' | 'privileged',
  ) {
    setError(null);
    try {
      await updateSkillCapability(clients, item.id, {
        version: item.version,
        riskLevel,
      });
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  return (
    <section className="embedded-fill-page">
      <header className="skills-console-header" style={{ marginBottom: 0 }}>
        <h2>{copy.capabilities.title}</h2>
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
              {copy.capabilities.create}
            </button>
          </div>
        </div>
        <div className="table-frame">
          {capabilities.length === 0 ? (
            <div className="empty-state">
              <span>{copy.capabilities.empty}</span>
              <button type="button" className="skills-console-primary" onClick={() => setCreateOpen(true)}>
                {copy.capabilities.create}
              </button>
            </div>
          ) : (
            <table className="admin-list-table">
              <thead>
                <tr>
                  <th>{copy.capabilities.table.name}</th>
                  <th>{copy.capabilities.table.key}</th>
                  <th>{copy.capabilities.table.risk}</th>
                </tr>
              </thead>
              <tbody>
                {capabilities.map((item) => (
                  <tr key={item.id}>
                    <td>{item.displayName}</td>
                    <td>{item.capabilityKey}</td>
                    <td>
                      <select
                        value={item.riskLevel}
                        onChange={(event) =>
                          onSetRiskLevel(
                            item,
                            event.target.value as 'standard' | 'sensitive' | 'privileged',
                          )
                        }
                      >
                        <option value="standard">{copy.capabilities.risk.standard}</option>
                        <option value="sensitive">{copy.capabilities.risk.sensitive}</option>
                        <option value="privileged">{copy.capabilities.risk.privileged}</option>
                      </select>
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
        title={copy.capabilities.drawer.title}
        onClose={() => setCreateOpen(false)}
      >
        <form onSubmit={onSubmit} style={{ display: 'grid', gap: 8 }}>
          <input
            value={form.capabilityKey}
            onChange={(event) => setForm({ ...form, capabilityKey: event.target.value })}
            placeholder={copy.capabilities.drawer.capabilityKeyPlaceholder}
            required
          />
          <input
            value={form.displayName}
            onChange={(event) => setForm({ ...form, displayName: event.target.value })}
            placeholder={copy.capabilities.drawer.displayNamePlaceholder}
            required
          />
          <select
            value={form.riskLevel}
            onChange={(event) =>
              setForm({ ...form, riskLevel: event.target.value as typeof form.riskLevel })
            }
          >
            <option value="standard">{copy.capabilities.risk.standard}</option>
            <option value="sensitive">{copy.capabilities.risk.sensitive}</option>
            <option value="privileged">{copy.capabilities.risk.privileged}</option>
          </select>
          <div className="sdkwork-surface-drawer-form-actions">
            <button type="button" onClick={() => setCreateOpen(false)}>
              {copy.capabilities.drawer.cancel}
            </button>
            <button type="submit">{copy.capabilities.drawer.submit}</button>
          </div>
        </form>
      </SurfaceDrawer>
    </section>
  );
}
