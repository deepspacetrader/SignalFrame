/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_NVIDIA_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
