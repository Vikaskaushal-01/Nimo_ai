/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional absolute API URL; defaults to same-origin "/api/v1". */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
