/** A path inside an https Git repository. The backend stores the descriptor; the skill runtime clones at installation time. */
export interface SkillArtifactGitSource {
  kind: 'git';
  /** Absolute https clone URL. Embedded credentials are rejected; private repositories require a future credential binding. */
  repositoryUrl: string;
  /** Path inside the repository. Use . for the repository root. Absolute and parent-traversal paths are rejected. */
  repositoryPath: string;
  /** Optional branch, tag, or commit id. When omitted, the repository default branch is used. */
  gitRef?: string | null;
}
