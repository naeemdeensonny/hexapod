/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional Mapbox token; when absent the app falls back to Esri imagery. */
  readonly VITE_MAPBOX_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
