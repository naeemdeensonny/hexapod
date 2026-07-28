/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Google Maps JavaScript API key. Set in .env.local and rebuild. */
  readonly VITE_GOOGLE_MAPS_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
