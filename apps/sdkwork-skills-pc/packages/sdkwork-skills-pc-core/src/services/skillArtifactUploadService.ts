import type { SkillsAppClients } from '../clients';
import { SKILLS_PACKAGE_ARTIFACT_UPLOAD } from '../sdk/uploadDeclaration';
import { formatDriveArtifactRef } from '@sdkwork/skills-pc-commons/driveUri';
import { hexEncode, Sha256Hasher } from '@sdkwork/utils';
import {
  resolveSkillsDriveParentNodeId,
  resolveSkillsDriveSpaceId,
} from '@sdkwork/skills-pc-commons/runtime';

type SkillsDriveAppClient = SkillsAppClients['drive'];

export type SkillPackageUploadOptions = {
  spaceId?: string;
  parentNodeId?: string;
};

export interface SkillArtifactUploadResult {
  artifactRef: string;
  checksumSha256: string;
  sizeBytes: string;
}

async function calculateSha256(file: File): Promise<string> {
  const hasher = new Sha256Hasher();
  const reader = file.stream().getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      hasher.update(value);
    }
  } finally {
    reader.releaseLock();
  }

  return hexEncode(hasher.digest());
}

export async function uploadSkillPackageArchive(
  driveClient: SkillsDriveAppClient,
  file: File,
  options: SkillPackageUploadOptions = {},
): Promise<SkillArtifactUploadResult> {
  const spaceId = options.spaceId ?? resolveSkillsDriveSpaceId();
  if (!spaceId) {
    throw new Error(
      'VITE_SDKWORK_SKILLS_DRIVE_SPACE_ID is required before uploading skill packages through sdkwork-drive.',
    );
  }

  const checksumSha256 = await calculateSha256(file);
  // `appResourceType`/`scene`/`source`/`uploadProfileCode` come from this application's upload
  // declaration (DRIVE_SPEC.md section 18): a skill package archive always has the same shape,
  // so no caller may substitute any of them.
  const uploadResult = await driveClient.uploader.upload({
    file,
    appResourceType: SKILLS_PACKAGE_ARTIFACT_UPLOAD.appResourceType,
    appResourceId: file.name,
    scene: SKILLS_PACKAGE_ARTIFACT_UPLOAD.scene,
    source: SKILLS_PACKAGE_ARTIFACT_UPLOAD.source,
    spaceId,
    parentNodeId: options.parentNodeId ?? resolveSkillsDriveParentNodeId(),
    uploadProfileCode: SKILLS_PACKAGE_ARTIFACT_UPLOAD.uploadProfileCode,
    originalFileName: file.name,
    contentType: file.type || 'application/octet-stream',
    checksumSha256Hex: `sha256:${checksumSha256}`,
  });

  return {
    artifactRef: formatDriveArtifactRef(
      uploadResult.uploadItem.spaceId,
      uploadResult.uploadItem.nodeId,
    ),
    checksumSha256,
    sizeBytes: String(file.size),
  };
}
