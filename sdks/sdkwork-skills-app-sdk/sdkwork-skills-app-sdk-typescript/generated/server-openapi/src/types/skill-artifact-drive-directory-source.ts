/** An existing sdkwork-drive folder. The folder contents are the skill package; no archive checksum applies. */
export interface SkillArtifactDriveDirectorySource {
  kind: 'drive_directory';
  /** Drive folder node URI. The runtime materializes the folder contents as the skill package. */
  driveUri: string;
}
