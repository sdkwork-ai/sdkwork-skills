import type {
  CreateSkillArtifactCommand,
  CreateSkillCapabilityCommand,
  CreateSkillCategoryCommand,
  CreateSkillPackageCommand,
  SkillArtifactRecord,
  SkillArtifactsPageData,
  SkillCapabilitiesPageData,
  SkillCapabilityRecord,
  SkillCategoriesPageData,
  SkillCategoryRecord,
  SkillPackageRecord,
  SkillPackagesPageData,
  UpdateSkillCapabilityCommand,
  UpdateSkillCategoryCommand,
  UpdateSkillPackageCommand,
} from '@sdkwork/skills-backend-sdk';

import type { SkillsBackendClients } from '../clients';

/**
 * List query parameters of the managed package catalog.
 *
 * The backend list accepts the shared catalog view filters
 * (`category_code`, `role_codes`) plus `q`/`page`/`page_size`; the admin page
 * passes them through rather than filtering a fully loaded page in memory, so
 * the page and its totals agree.
 */
export type ManagedSkillPackagesListParams = Parameters<
  SkillsBackendClients['backend']['skills']['skillPackages']['list']
>[0];

/** Category list query parameters of the generated backend client. */
export type ManagedSkillCategoriesListParams = Parameters<
  SkillsBackendClients['backend']['skills']['skillCategories']['list']
>[0];

/** Artifact list query parameters of the generated backend client. */
export type ManagedSkillArtifactsListParams = Parameters<
  SkillsBackendClients['backend']['skills']['skillPackages']['artifacts']['list']
>[1];

export async function listManagedSkillPackages(
  clients: SkillsBackendClients,
  params?: ManagedSkillPackagesListParams,
): Promise<SkillPackagesPageData> {
  return clients.backend.skills.skillPackages.list(params);
}

export async function listManagedSkillCategories(
  clients: SkillsBackendClients,
  params?: ManagedSkillCategoriesListParams,
): Promise<SkillCategoriesPageData> {
  return clients.backend.skills.skillCategories.list(params);
}

export async function createSkillPackage(
  clients: SkillsBackendClients,
  input: CreateSkillPackageCommand,
): Promise<SkillPackageRecord> {
  return clients.backend.skills.skillPackages.create(input);
}

export async function updateSkillPackage(
  clients: SkillsBackendClients,
  packageId: string,
  input: UpdateSkillPackageCommand,
): Promise<SkillPackageRecord> {
  return clients.backend.skills.skillPackages.update(packageId, input);
}

export async function deleteSkillPackage(
  clients: SkillsBackendClients,
  packageId: string,
): Promise<void> {
  return clients.backend.skills.skillPackages.delete(packageId);
}

export async function listPackageArtifacts(
  clients: SkillsBackendClients,
  packageId: string,
  params?: ManagedSkillArtifactsListParams,
): Promise<SkillArtifactsPageData> {
  return clients.backend.skills.skillPackages.artifacts.list(packageId, params);
}

export async function createSkillArtifact(
  clients: SkillsBackendClients,
  packageId: string,
  input: CreateSkillArtifactCommand,
): Promise<SkillArtifactRecord> {
  return clients.backend.skills.skillPackages.artifacts.create(packageId, input);
}

export async function listSkillCapabilities(
  clients: SkillsBackendClients,
): Promise<SkillCapabilitiesPageData> {
  return clients.backend.skills.skillCapabilities.list();
}

export async function createSkillCapability(
  clients: SkillsBackendClients,
  input: CreateSkillCapabilityCommand,
): Promise<SkillCapabilityRecord> {
  return clients.backend.skills.skillCapabilities.create(input);
}

export async function updateSkillCapability(
  clients: SkillsBackendClients,
  capabilityId: string,
  input: UpdateSkillCapabilityCommand,
): Promise<SkillCapabilityRecord> {
  return clients.backend.skills.skillCapabilities.update(capabilityId, input);
}

export async function createSkillCategory(
  clients: SkillsBackendClients,
  input: CreateSkillCategoryCommand,
): Promise<SkillCategoryRecord> {
  return clients.backend.skills.skillCategories.create(input);
}

/**
 * Updates an existing Skill category.
 *
 * The category `code` is immutable after creation — the write contract
 * (`UpdateSkillCategoryCommand`) carries no `code` field, and the console binds
 * `permissionCode` to the code at creation time
 * (`packageManagePermissionForCategory`). Renaming is therefore out of scope
 * here; admins adjust the display name, description, sort weight, and status.
 * `version` is required for optimistic concurrency and comes from the record
 * being edited.
 */
export async function updateSkillCategory(
  clients: SkillsBackendClients,
  categoryId: string,
  input: UpdateSkillCategoryCommand,
): Promise<SkillCategoryRecord> {
  return clients.backend.skills.skillCategories.update(categoryId, input);
}
