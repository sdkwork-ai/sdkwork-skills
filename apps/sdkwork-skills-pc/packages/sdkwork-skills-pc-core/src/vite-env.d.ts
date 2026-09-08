/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly SDKWORK_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
