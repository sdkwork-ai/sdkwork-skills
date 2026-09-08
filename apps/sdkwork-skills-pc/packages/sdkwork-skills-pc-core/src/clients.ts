import { createClient as createDriveSdkClient, type SdkworkDriveAppClient } from '@sdkwork/drive-app-sdk';
import type { AuthTokenManager } from '@sdkwork/sdk-common';
import { resolveBaseUrl } from '@sdkwork/sdk-common';
import { createClient as createAppSdkClient, type SdkworkAppClient } from '@sdkwork/skills-app-sdk';
import { createClient as createBackendSdkClient, type SdkworkBackendClient } from '@sdkwork/skills-backend-sdk';
import { normalizeApiBaseUrl } from '@sdkwork/skills-pc-commons/runtime';

import { createSkillsTokenManager } from './session';

export type SkillsAppClientConfig = {
  appApiBaseUrl?: string;
  driveAppApiBaseUrl?: string;
  tokenManager?: AuthTokenManager;
};

export type SkillsAppClients = {
  app: SdkworkAppClient;
  drive: SdkworkDriveAppClient;
};

/** Full PC runtime client inventory (app bootstrap composes app + backend surfaces). */
export type SkillsClients = SkillsAppClients & {
  backend: SdkworkBackendClient;
};

export type SkillsClientConfig = SkillsAppClientConfig & {
  backendApiBaseUrl?: string;
};

function resolveAppApiBaseUrl(config?: SkillsAppClientConfig): string {
  // Single shared base-url key; the matching API host is chosen from the
  // current page's environment + brand. preservePath keeps the /app/v3/api
  // suffix this SDK client expects.
  return normalizeApiBaseUrl(
    config?.appApiBaseUrl ??
      resolveBaseUrl({ envKey: 'SDKWORK_API_BASE_URL', preservePath: true }).url ??
      '',
  );
}

function resolveDriveAppApiBaseUrl(config?: SkillsAppClientConfig): string {
  // Same shared key as the app SDK: the drive SDK client also expects the
  // /app/v3/api path suffix.
  return normalizeApiBaseUrl(
    config?.driveAppApiBaseUrl ??
      resolveBaseUrl({ envKey: 'SDKWORK_API_BASE_URL', preservePath: true }).url ??
      '',
  );
}

function createAuthenticatedClientConfig(
  baseUrl: string,
  tokenManager: AuthTokenManager,
) {
  return {
    baseUrl,
    authMode: 'dual-token' as const,
    platform: 'pc' as const,
    tokenManager,
  };
}

export function createSkillsAppClients(config: SkillsAppClientConfig = {}): SkillsAppClients {
  const tokenManager = config.tokenManager ?? createSkillsTokenManager();

  const app = createAppSdkClient(
    createAuthenticatedClientConfig(resolveAppApiBaseUrl(config), tokenManager),
  );
  app.setTokenManager(tokenManager);

  const drive = createDriveSdkClient(
    createAuthenticatedClientConfig(resolveDriveAppApiBaseUrl(config), tokenManager),
  );
  drive.setTokenManager(tokenManager);

  return { app, drive };
}

function resolveBackendApiBaseUrl(config: SkillsBackendClientConfig): string {
  // Same shared key; preservePath keeps the /backend/v3/api suffix the backend
  // SDK client expects (carried by the configured base-url value).
  return normalizeApiBaseUrl(
    config.backendApiBaseUrl ??
      resolveBaseUrl({ envKey: 'SDKWORK_API_BASE_URL', preservePath: true }).url ??
      '',
  );
}

export type SkillsBackendClientConfig = {
  backendApiBaseUrl?: string;
  tokenManager: AuthTokenManager;
};

export type SkillsBackendClients = {
  backend: SdkworkBackendClient;
};

export function createSkillsBackendClients(
  config: SkillsBackendClientConfig,
): SkillsBackendClients {
  const backend = createBackendSdkClient({
    baseUrl: resolveBackendApiBaseUrl(config),
    authMode: 'dual-token',
    platform: 'pc',
    tokenManager: config.tokenManager,
  });
  backend.setTokenManager(config.tokenManager);
  return { backend };
}
