/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** Google Maps JavaScript API key. Set in .env.local and rebuild. */
  readonly VITE_GOOGLE_MAPS_KEY?: string;
  /**
   * Map ID of a **vector** map with tilt/rotation enabled. Required for
   * `map.setHeading()` to do anything — raster maps ignore heading at
   * top-down zoom levels.
   */
  readonly VITE_GOOGLE_MAPS_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Build timestamp (`MM-DD HH:MM`, UTC), injected by Vite. */
declare const __BUILD_ID__: string;
