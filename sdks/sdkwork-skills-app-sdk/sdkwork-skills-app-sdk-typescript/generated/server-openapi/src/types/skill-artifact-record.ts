import type { SkillArtifactSource } from './skill-artifact-source';

export interface SkillArtifactRecord {
  id: string;
  uuid: string;
  tenantId: string;
  packageId: string;
  versionLabel: string;
  source: SkillArtifactSource;
  invocationKind: 'local-workflow' | 'process-adapter' | 'mcp-tool' | 'kernel-provider';
  entrypoint: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  configSchema: Record<string, unknown>;
  defaultConfig: Record<string, unknown>;
  securityProfileId?: string | null;
  status: 'draft' | 'published' | 'yanked';
  capabilityKeys: string[];
  publishedAt?: string | null;
  yankedAt?: string | null;
  createdAt: string;
}
