/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** Google Maps JavaScript API key. Set in .env.local and rebuild. */
  readonly VITE_GOOGLE_MAPS_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Build timestamp (`MM-DD HH:MM`, UTC), injected by Vite. */
declare const __BUILD_ID__: string;
