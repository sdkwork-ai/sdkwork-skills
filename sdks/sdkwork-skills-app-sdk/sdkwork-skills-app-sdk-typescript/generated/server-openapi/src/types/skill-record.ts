export interface SkillRecord {
  id: string;
  uuid: string;
  tenantId: string;
  organizationId: string;
  skillKey: string;
  packageId: string;
  name: string;
  summary?: string | null;
  description?: string | null;
  marketStatus: string;
  visibility: 'private' | 'tenant' | 'organization' | 'public';
  reviewStatus: string;
  categories: string[];
  enabled: boolean;
  featured: boolean;
  installCount: string;
  tags: string[];
  /** IAM role codes allowed to see this resource. An empty list means every role (the default). */
  allowedRoleCodes: string[];
  version: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}
