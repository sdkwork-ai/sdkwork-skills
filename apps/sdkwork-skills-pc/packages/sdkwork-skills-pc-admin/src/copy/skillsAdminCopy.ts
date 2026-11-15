import { useEffect, useState } from 'react';

/**
 * Local copy bundle for the Skills administration surfaces.
 *
 * The admin block and the admin pages are mounted by several hosts (the Skills
 * console and the Cloud Router console, among others), so they carry their own
 * English and Chinese copy instead of depending on host-specific translation
 * keys. The language is read from the host document language (`<html lang>`),
 * which the Cloud Router admin shell and the Skills shell keep in sync with
 * their i18n instance.
 *
 * Technical identifiers stay untranslated on purpose: skill keys, package
 * codes, category codes, permission codes, status enum wire values, URLs,
 * JSON payloads and product names such as sdkwork-drive.
 */
const en = {
  overlay: {
    close: 'Close',
  },
  roles: {
    legend: 'Visible to roles',
    allRoles: 'All roles (default)',
    customRole: 'Custom role',
    /**
     * Role labels come from the shared IAM assignable-role catalog. Only
     * localized overrides live here, so an English host still renders the
     * catalog's own label and an unknown organization-defined role keeps its
     * code-based label.
     */
    labels: {} as Record<string, string>,
  },
  admin: {
    title: 'Admin Skills',
    description:
      'Curate the Skill package catalog — create packages, bind categories, and manage role visibility.',
    createPackage: 'Create package',
    empty: 'No skill packages yet.',
    defaults: {
      displayName: 'Demo Sample Skill',
      summary: 'Skill package uploaded through sdkwork-drive',
    },
    table: {
      name: 'Name',
      skillKey: 'Skill key',
      categories: 'Categories',
      roles: 'Roles',
      actions: 'Actions',
      allRoles: 'All roles',
      edit: 'Edit',
      delete: 'Delete',
      noValue: '—',
    },
    errors: {
      selectArchive: 'Select a Skill package archive to upload through sdkwork-drive.',
      needArtifact: 'Upload an artifact through sdkwork-drive before creating the Skill package.',
      checksum: 'The uploaded artifact is missing a valid SHA-256 checksum.',
      noCategoryPermission: 'You do not have package-manage permission for the selected categories.',
    },
    createDrawer: {
      title: 'Create package and artifact',
      description: 'Uploads the Skill archive through sdkwork-drive, then registers the package.',
      skillKey: 'Skill key',
      skillKeyPlaceholder: 'skill.demo.sample',
      displayName: 'Display name',
      displayNamePlaceholder: 'Demo Sample Skill',
      categories: 'Categories',
      artifactSection: 'Artifact (via sdkwork-drive)',
      uploadArtifact: 'Upload artifact',
      uploading: 'Uploading…',
      uploadedFile: (name: string) => `Uploaded: ${name}`,
      artifactRefPlaceholder: 'artifactRef (drive://spaces/.../nodes/...)',
      artifactVersion: 'Artifact version',
      artifactVersionPlaceholder: '1.0.0',
      submit: 'Create package and artifact',
    },
    editDrawer: {
      title: (skillKey: string) => `Update ${skillKey}`,
      fallbackTitle: 'Update package',
      displayName: 'Display name',
      displayNamePlaceholder: 'display name',
      summary: 'Summary',
      summaryPlaceholder: 'summary',
      description: 'Description',
      descriptionPlaceholder: 'description',
      cancel: 'Cancel',
      save: 'Save changes',
    },
    deleteConfirm: {
      title: 'Delete skill package?',
      description: (name: string) => `Delete “${name}”. This cannot be undone.`,
      confirm: 'Delete',
      cancel: 'Cancel',
    },
  },
  categories: {
    title: 'Categories',
    description:
      'Curate the Skill taxonomy. Categories are assigned at creation time and cannot be deleted — retire one by disabling it.',
    create: 'Create category',
    taxonomyAria: 'Category taxonomy',
    types: {
      skill_market: 'Market',
      skills_collection: 'Collection',
    } as Record<'skill_market' | 'skills_collection', string>,
    table: {
      name: 'Name',
      code: 'Code',
      parent: 'Parent',
      permission: 'Permission',
      sort: 'Sort',
      state: 'State',
      actions: 'Actions',
      enabled: 'Enabled',
      disabled: 'Disabled',
      hidden: '· hidden',
      edit: 'Edit',
      noValue: '—',
    },
    empty: {
      title: (label: string) => `No ${label.toLowerCase()} categories`,
      description:
        'Create one from the header action, or switch taxonomy above. Packages cannot be filed without a category.',
      create: 'Create category',
    },
    drawer: {
      createTitle: 'Create category',
      editTitle: (name: string) => `Edit ${name}`,
      editFallbackTitle: 'Edit category',
      taxonomy: 'Taxonomy',
      code: 'Code',
      codePlaceholder: 'e.g. data-analysis',
      codeHint: 'Immutable after creation; the console resolves the category by this code.',
      codeEditHint:
        'Immutable after creation. To rename, retire this category and create a new one.',
      name: 'Name',
      namePlaceholder: 'e.g. Data analysis',
      description: 'Description',
      parent: 'Parent category',
      parentNone: 'None (top level)',
      sortWeight: 'Sort weight',
      sortWeightHint: 'Lower sorts first in the console picker.',
      permission: 'Permission code',
      permissionHint: 'Granted to operators who manage packages in this category.',
      permissionEditHint:
        'Editable — the write contract carries this field even though the code is fixed.',
      status: 'Status',
      statusEnabled: 'Enabled',
      statusDisabled: 'Disabled',
      visible: 'Visible in the console',
      cancel: 'Cancel',
      create: 'Create category',
      save: 'Save changes',
    },
  },
  artifacts: {
    title: (packageId: string) => `Artifacts for Package ${packageId}`,
    attach: 'Attach artifact',
    empty: 'No artifacts attached to this package.',
    table: {
      version: 'Version',
      status: 'Status',
      invocation: 'Invocation',
    },
    statusLabels: {
      draft: 'Draft',
      published: 'Published',
      yanked: 'Yanked',
    },
    invocationLabels: {
      'local-workflow': 'Local workflow',
      'process-adapter': 'Process adapter',
      'mcp-tool': 'MCP tool',
      'kernel-provider': 'Kernel provider',
    },
    drawer: {
      title: 'Attach artifact',
      versionLabelPlaceholder: 'version label',
      upload: 'Upload Artifact via sdkwork-drive',
      uploading: 'Uploading...',
      uploadedFile: (name: string) => `Uploaded file: ${name}`,
      artifactRefPlaceholder: 'artifactRef (drive://...)',
      cancel: 'Cancel',
      submit: 'Attach Artifact',
    },
    errors: {
      selectArchive: 'Select an artifact archive to upload through sdkwork-drive.',
      needArtifact: 'Upload an artifact through sdkwork-drive before attaching it.',
      checksum: 'The uploaded artifact is missing a valid SHA-256 checksum.',
    },
  },
  capabilities: {
    title: 'Skill Capabilities',
    create: 'Create capability',
    empty: 'No capability definitions yet.',
    defaults: {
      displayName: 'Basic Run',
      description: 'Standard capability',
    },
    table: {
      name: 'Name',
      key: 'Key',
      risk: 'Risk',
    },
    drawer: {
      title: 'Create capability',
      capabilityKeyPlaceholder: 'capability key',
      displayNamePlaceholder: 'display name',
      cancel: 'Cancel',
      submit: 'Create Capability',
    },
    risk: {
      standard: 'standard',
      sensitive: 'sensitive',
      privileged: 'privileged',
    },
  },
  updatePackage: {
    notFound: (packageId: string) => `Skill package ${packageId} was not found.`,
    loading: (packageId: string) => `Loading skill package ${packageId}…`,
    saved: 'Skill package updated.',
    displayNamePlaceholder: 'display name',
    summaryPlaceholder: 'summary',
    descriptionPlaceholder: 'description',
    categoriesPlaceholder: 'categories (comma separated)',
    tagsPlaceholder: 'tags (comma separated)',
    cancel: 'Cancel',
    save: 'Save Changes',
  },
};

export type SkillsAdminCopy = typeof en;

const zh: SkillsAdminCopy = {
  overlay: {
    close: '关闭',
  },
  roles: {
    legend: '可见角色',
    allRoles: '全部角色（默认）',
    customRole: '自定义角色',
    labels: {
      app_user: '应用用户',
      org_admin: '组织管理员',
      org_assistant: '组织助理',
      org_auditor: '组织审计员',
      org_finance: '组织财务',
      org_operations: '组织运营',
      platform_system_admin: '平台系统管理员',
      platform_super_admin: '平台超级管理员',
      skills_admin_operator: '技能运营管理员',
      skills_marketplace_user: '技能市场用户',
    },
  },
  admin: {
    title: '技能管理',
    description: '维护技能包目录：创建技能包、绑定分类，并管理角色的可见范围。',
    createPackage: '创建技能包',
    empty: '暂无技能包。',
    defaults: {
      displayName: '示例技能',
      summary: '通过 sdkwork-drive 上传的技能包',
    },
    table: {
      name: '名称',
      skillKey: '技能标识',
      categories: '分类',
      roles: '角色',
      actions: '操作',
      allRoles: '全部角色',
      edit: '编辑',
      delete: '删除',
      noValue: '—',
    },
    errors: {
      selectArchive: '请选择要通过 sdkwork-drive 上传的技能包压缩包。',
      needArtifact: '创建技能包前，请先通过 sdkwork-drive 上传产物。',
      checksum: '上传的产物缺少有效的 SHA-256 校验和。',
      noCategoryPermission: '你没有所选分类的技能包管理权限。',
    },
    createDrawer: {
      title: '创建技能包与产物',
      description: '先通过 sdkwork-drive 上传技能包压缩包，再登记技能包。',
      skillKey: '技能标识',
      skillKeyPlaceholder: 'skill.demo.sample',
      displayName: '显示名称',
      displayNamePlaceholder: '示例技能',
      categories: '分类',
      artifactSection: '产物（通过 sdkwork-drive）',
      uploadArtifact: '上传产物',
      uploading: '上传中…',
      uploadedFile: (name) => `已上传：${name}`,
      artifactRefPlaceholder: '产物引用（drive://spaces/.../nodes/...）',
      artifactVersion: '产物版本',
      artifactVersionPlaceholder: '1.0.0',
      submit: '创建技能包与产物',
    },
    editDrawer: {
      title: (skillKey) => `更新 ${skillKey}`,
      fallbackTitle: '更新技能包',
      displayName: '显示名称',
      displayNamePlaceholder: '显示名称',
      summary: '摘要',
      summaryPlaceholder: '摘要',
      description: '描述',
      descriptionPlaceholder: '描述',
      cancel: '取消',
      save: '保存修改',
    },
    deleteConfirm: {
      title: '删除技能包？',
      description: (name) => `将删除“${name}”。此操作不可撤销。`,
      confirm: '删除',
      cancel: '取消',
    },
  },
  categories: {
    title: '技能分类',
    description: '维护技能分类体系。分类在创建时指定，不支持删除；如需退役某个分类，请将其停用。',
    create: '创建分类',
    taxonomyAria: '分类体系',
    types: {
      skill_market: '市场',
      skills_collection: '集合',
    },
    table: {
      name: '名称',
      code: '编码',
      parent: '父分类',
      permission: '权限',
      sort: '排序',
      state: '状态',
      actions: '操作',
      enabled: '已启用',
      disabled: '已停用',
      hidden: '· 已隐藏',
      edit: '编辑',
      noValue: '—',
    },
    empty: {
      title: (label) => `暂无${label}分类`,
      description: '请使用页面顶部的操作创建，或在上方切换分类体系。没有分类时无法归档技能包。',
      create: '创建分类',
    },
    drawer: {
      createTitle: '创建分类',
      editTitle: (name) => `编辑 ${name}`,
      editFallbackTitle: '编辑分类',
      taxonomy: '分类体系',
      code: '编码',
      codePlaceholder: '如：data-analysis',
      codeHint: '创建后不可修改；控制台通过该编码解析分类。',
      codeEditHint: '创建后不可修改。若需重命名，请先停用该分类再新建一个。',
      name: '名称',
      namePlaceholder: '如：数据分析',
      description: '描述',
      parent: '父分类',
      parentNone: '无（顶级分类）',
      sortWeight: '排序值',
      sortWeightHint: '数值越小，在控制台选择器中越靠前。',
      permission: '权限编码',
      permissionHint: '授予在该分类下管理技能包的运营人员。',
      permissionEditHint: '该字段可修改：编码固定不变，但写入契约仍然包含此字段。',
      status: '状态',
      statusEnabled: '已启用',
      statusDisabled: '已停用',
      visible: '在控制台可见',
      cancel: '取消',
      create: '创建分类',
      save: '保存修改',
    },
  },
  artifacts: {
    title: (packageId) => `技能包 ${packageId} 的产物`,
    attach: '添加产物',
    empty: '该技能包还没有产物。',
    table: {
      version: '版本',
      status: '状态',
      invocation: '调用方式',
    },
    statusLabels: {
      draft: '草稿',
      published: '已发布',
      yanked: '已撤回',
    },
    invocationLabels: {
      'local-workflow': '本地工作流',
      'process-adapter': '进程适配器',
      'mcp-tool': 'MCP 工具',
      'kernel-provider': '内核提供方',
    },
    drawer: {
      title: '添加产物',
      versionLabelPlaceholder: '版本标签',
      upload: '通过 sdkwork-drive 上传产物',
      uploading: '上传中…',
      uploadedFile: (name) => `已上传文件：${name}`,
      artifactRefPlaceholder: '产物引用（drive://...）',
      cancel: '取消',
      submit: '添加产物',
    },
    errors: {
      selectArchive: '请选择要通过 sdkwork-drive 上传的产物压缩包。',
      needArtifact: '添加产物前，请先通过 sdkwork-drive 上传产物。',
      checksum: '上传的产物缺少有效的 SHA-256 校验和。',
    },
  },
  capabilities: {
    title: '技能能力',
    create: '创建能力',
    empty: '暂无能力定义。',
    defaults: {
      displayName: '基础运行',
      description: '标准能力',
    },
    table: {
      name: '名称',
      key: '标识',
      risk: '风险等级',
    },
    drawer: {
      title: '创建能力',
      capabilityKeyPlaceholder: '能力标识',
      displayNamePlaceholder: '显示名称',
      cancel: '取消',
      submit: '创建能力',
    },
    risk: {
      standard: '标准',
      sensitive: '敏感',
      privileged: '高权限',
    },
  },
  updatePackage: {
    notFound: (packageId) => `未找到技能包 ${packageId}。`,
    loading: (packageId) => `正在加载技能包 ${packageId}…`,
    saved: '技能包已更新。',
    displayNamePlaceholder: '显示名称',
    summaryPlaceholder: '摘要',
    descriptionPlaceholder: '描述',
    categoriesPlaceholder: '分类（逗号分隔）',
    tagsPlaceholder: '标签（逗号分隔）',
    cancel: '取消',
    save: '保存修改',
  },
};

export const SKILLS_ADMIN_COPY: Record<'en' | 'zh', SkillsAdminCopy> = { en, zh };

function documentLanguage(): 'en' | 'zh' {
  if (typeof document === 'undefined') {
    return 'en';
  }
  return document.documentElement.lang.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

export function useSkillsAdminLocale(): 'en' | 'zh' {
  const [language, setLanguage] = useState(documentLanguage);
  useEffect(() => {
    const update = () => setLanguage(documentLanguage());
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['lang'],
    });
    return () => observer.disconnect();
  }, []);
  return language;
}

export function useSkillsAdminCopy(): SkillsAdminCopy {
  const language = useSkillsAdminLocale();
  return SKILLS_ADMIN_COPY[language];
}
