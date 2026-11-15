import type { SkillArtifactDriveDirectorySource } from './skill-artifact-drive-directory-source';
import type { SkillArtifactDriveFileSource } from './skill-artifact-drive-file-source';
import type { SkillArtifactGitSource } from './skill-artifact-git-source';

/** Artifact content source: a Drive archive, an existing Drive directory, or a Git repository path. */
export type SkillArtifactSource = SkillArtifactDriveFileSource | SkillArtifactDriveDirectorySource | SkillArtifactGitSource;
