/**
 * Map configuration.
 *
 * The playing map uses the Google Maps JavaScript API for genuine satellite
 * imagery. Set VITE_GOOGLE_MAPS_KEY in .env.local (Maps JavaScript API +
 * Static Maps API both need to be enabled in Google Cloud Console).
 *
 * Course list thumbnails use the Google Static Maps API when the key is set,
 * falling back to Esri World Imagery tiles (no key needed) otherwise.
 */

export const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY as string | undefined;

/**
 * Map ID of a **vector** map, created in Google Cloud Console under
 * Google Maps Platform → Map Management, with "Tilt and rotation" enabled.
 *
 * This is what makes `map.setHeading()` work. Without a Map ID the API builds
 * a RASTER map, and on raster maps heading is only honoured at 45° imagery
 * zoom levels — so a top-down satellite view silently refuses to rotate, with
 * no error. The app still runs without it; the map just stays north-up.
 */
export const GOOGLE_MAPS_ID = import.meta.env.VITE_GOOGLE_MAPS_ID as string | undefined;

/** True when the map can actually be rotated (i.e. a vector Map ID is set). */
export const MAP_ROTATION_AVAILABLE = !!GOOGLE_MAPS_ID;

const ESRI_TILE =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

/**
 * URL of a satellite thumbnail image for the given centre point.
 * Used by course-list cards. Width/height in CSS pixels (device-pixel-ratio
 * not accounted for — the img element is small enough that it doesn't matter).
 */
export function previewTileUrl(
  centre: { lat: number; lng: number },
  zoom = 15,
  w = 80,
  h = 60,
): string {
  if (GOOGLE_MAPS_KEY) {
    return (
      `https://maps.googleapis.com/maps/api/staticmap` +
      `?center=${centre.lat},${centre.lng}&zoom=${zoom}` +
      `&size=${w}x${h}&maptype=satellite&key=${GOOGLE_MAPS_KEY}`
    );
  }
  // Esri fallback — no key required.
  const n = 2 ** zoom;
  const x = Math.floor(((centre.lng + 180) / 360) * n);
  const latRad = (centre.lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n,
  );
  return ESRI_TILE.replace('{z}', String(zoom))
    .replace('{y}', String(y))
    .replace('{x}', String(x));
}
