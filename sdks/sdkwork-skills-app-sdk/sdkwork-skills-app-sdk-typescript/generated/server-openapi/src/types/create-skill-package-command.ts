import type { CreateSkillArtifactCommand } from './create-skill-artifact-command';

export interface CreateSkillPackageCommand {
  skillKey: string;
  packageKey?: string;
  code: string;
  displayName: string;
  summary?: string | null;
  description?: string | null;
  categories?: string[];
  tags?: string[];
  /** IAM role codes allowed to see this resource. An empty list means every role (the default). */
  allowedRoleCodes?: string[];
  status?: 'draft' | 'active' | 'disabled' | 'archived' | 'deleted';
  visibility?: 'private' | 'tenant' | 'organization' | 'public';
  featured?: boolean;
  sortWeight?: number;
  initialArtifact: CreateSkillArtifactCommand;
}
