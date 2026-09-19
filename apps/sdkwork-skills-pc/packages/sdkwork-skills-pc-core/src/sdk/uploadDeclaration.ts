/**
 * Application upload declaration constants.
 *
 * Authority: `DRIVE_SPEC.md` section 18 (Application Upload Declaration Contract).
 * Declared values live in `apps/sdkwork-skills-pc/specs/upload.declaration.json`; this module
 * carries them into code so upload call sites reference a constant instead of repeating
 * literals. Call sites MUST NOT inline these values, and the declaration MUST NOT be
 * duplicated as a second local authority.
 *
 * The previous local values (`skills-pc-package-upload`, `skills_self_service_package_upload`,
 * `pc_local_file`) were not rule-conforming: `appResourceType` must be a dotted
 * `<domain>.<resource>` business type and `source` must be a stable kebab-case call-origin
 * label. They are converged here to the declared values.
 */

export interface SkillsUploadDeclarationEntry {
  readonly appResourceIdKind: 'application' | 'entity' | 'draft';
  readonly appResourceType: string;
  readonly purpose: string;
  readonly retention: 'long_term' | 'temporary';
  readonly scene: string;
  readonly source: string;
  readonly uploadProfileCode: string;
}

/** This application's canonical appId, from `sdkwork.app.config.json` `backend.appId`. */
export const SKILLS_APP_ID = 'sdkwork-skills-pc' as const;

/** The single call-origin label for every upload from this application. */
export const SKILLS_UPLOAD_SOURCE = 'sdkwork-skills-pc' as const;

const SKILLS_APP_RESOURCE_ID_KIND = 'entity' as const;
const SKILLS_RETENTION = 'long_term' as const;

export const SKILLS_PACKAGE_ARTIFACT_UPLOAD = {
  appResourceIdKind: SKILLS_APP_RESOURCE_ID_KIND,
  appResourceType: 'skill.package_artifact',
  purpose:
    'Skill package archive uploaded by an author from the self-service surface so the skill can be installed.',
  retention: SKILLS_RETENTION,
  scene: 'skill-package-upload',
  source: SKILLS_UPLOAD_SOURCE,
  uploadProfileCode: 'archive',
} as const satisfies SkillsUploadDeclarationEntry;

/** Every declared upload purpose for this application. */
export const SKILLS_UPLOAD_DECLARATIONS: readonly SkillsUploadDeclarationEntry[] = [
  SKILLS_PACKAGE_ARTIFACT_UPLOAD,
];
