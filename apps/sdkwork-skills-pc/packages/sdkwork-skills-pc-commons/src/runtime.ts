import { readRuntimeEnv } from '@sdkwork/sdk-common';
import { isBlank, trim } from '@sdkwork/utils';

/**
 * Runtime environment accessor, unified on @sdkwork/sdk-common so every
 * module shares one implementation (Vite import.meta.env + Node process.env).
 */
export { readRuntimeEnv };

export function normalizeApiBaseUrl(baseUrl: string): string {
  const normalized = trim(baseUrl);
  if (isBlank(normalized)) {
    return '';
  }
  return normalized.replace(/\/+$/, '');
}

export function resolveSkillsDriveSpaceId(): string | undefined {
  return readRuntimeEnv('VITE_SDKWORK_SKILLS_DRIVE_SPACE_ID');
}

export function resolveSkillsDriveParentNodeId(): string | undefined {
  return readRuntimeEnv('VITE_SDKWORK_SKILLS_DRIVE_PARENT_NODE_ID');
}
