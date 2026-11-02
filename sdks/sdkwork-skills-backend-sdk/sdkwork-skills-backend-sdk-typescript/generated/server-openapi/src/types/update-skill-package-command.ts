export interface UpdateSkillPackageCommand {
  version: string;
  displayName?: string;
  summary?: string | null;
  description?: string | null;
  categories?: string[];
  tags?: string[];
  /** Full replacement role-code list. Omitted leaves the assignment unchanged; an empty list means every role. */
  allowedRoleCodes?: string[];
  status?: 'draft' | 'active' | 'disabled' | 'archived' | 'deleted';
  visibility?: 'private' | 'tenant' | 'organization' | 'public';
  featured?: boolean;
  sortWeight?: number;
}
