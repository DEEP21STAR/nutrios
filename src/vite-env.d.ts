/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string
  readonly VITE_OLLAMA_TAILSCALE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/** Injected by vite.config.ts's `define` — real git commit count / short hash at build time. */
declare const __BUILD_NUMBER__: string
declare const __COMMIT_HASH__: string
