/** An archive uploaded to sdkwork-drive. checksumSha256 is the SHA-256 of the archive bytes. */
export interface SkillArtifactDriveFileSource {
  kind: 'drive_file';
  driveUri: string;
  checksumSha256: string;
  sizeBytes?: string | null;
}
