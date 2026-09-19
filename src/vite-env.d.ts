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

/** BarcodeDetector — real browser API (Chrome/Edge/Android WebView only, not in TS's bundled
 * lib.dom.d.ts yet as of this TS version, not in Safari/iOS at all — see BarcodeCapture.tsx for
 * the honest feature-detected fallback). Minimal ambient type covering only what's actually used. */
interface DetectedBarcode {
  rawValue: string
  format: string
}
declare class BarcodeDetector {
  constructor(options?: { formats?: string[] })
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>
}
interface Window {
  BarcodeDetector?: typeof BarcodeDetector
}
