/**
 * Satellite tile provider.
 *
 * The playing map must be genuine aerial imagery, never illustrated or
 * pixelated. Two providers are wired up:
 *
 *  - Esri World Imagery (default) — real satellite/aerial imagery, no API key
 *    required, attribution rendered on the map.
 *  - Mapbox Satellite Streets — used automatically when VITE_MAPBOX_TOKEN is
 *    set in .env.local.
 *
 * Google imagery is deliberately absent: it may only be served through the
 * authorised Google Maps JavaScript API, so no Google tiles or branding are
 * used anywhere in this app.
 */
export type TileProvider = {
  id: string;
  url: string;
  attribution: string;
  maxZoom: number;
  /** 512px styles need tileSize 512 with zoomOffset -1 to line up. */
  tileSize: number;
  zoomOffset: number;
};

const ESRI: TileProvider = {
  id: 'esri-world-imagery',
  url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  attribution:
    'Imagery &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community',
  maxZoom: 19,
  tileSize: 256,
  zoomOffset: 0,
};

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;

const MAPBOX: TileProvider = {
  id: 'mapbox-satellite-streets',
  url: `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/512/{z}/{x}/{y}@2x?access_token=${MAPBOX_TOKEN}`,
  attribution: '&copy; Mapbox &copy; OpenStreetMap',
  maxZoom: 20,
  tileSize: 512,
  zoomOffset: -1,
};

export function tileProvider(): TileProvider {
  return MAPBOX_TOKEN ? MAPBOX : ESRI;
}

/**
 * URL of the single real satellite tile containing `centre`, used for the
 * small course previews in lists. No imagery is generated or redrawn — this
 * is the provider's own tile.
 */
export function previewTileUrl(centre: { lat: number; lng: number }, zoom = 15): string {
  const n = 2 ** zoom;
  const x = Math.floor(((centre.lng + 180) / 360) * n);
  const latRad = (centre.lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n,
  );
  return tileProvider()
    .url.replace('{z}', String(zoom))
    .replace('{x}', String(x))
    .replace('{y}', String(y));
}
