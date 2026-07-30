import { useEffect, useRef } from 'react';
import { importLibrary, setOptions } from '@googlemaps/js-api-loader';
import './map.css';
import { GOOGLE_MAPS_ID, GOOGLE_MAPS_KEY } from './provider';
import type { LatLng } from '../state/types';

/* --- singleton loader ---------------------------------------------------- */

let _optionsSet = false;
let _loadPromise: Promise<void> | null = null;

function ensureMapsLoaded(): Promise<void> {
  if (typeof window !== 'undefined' && window.google?.maps) return Promise.resolve();
  if (!_loadPromise) {
    if (!_optionsSet && GOOGLE_MAPS_KEY) {
      setOptions({ key: GOOGLE_MAPS_KEY, v: 'weekly' });
      _optionsSet = true;
    }
    _loadPromise = importLibrary('maps').then(() => {});
  }
  return _loadPromise!;
}

/* --- component ------------------------------------------------------------ */

type Props = {
  centre: LatLng;
  zoom?: number;
  className?: string;
  onReady?: (map: google.maps.Map) => void;
  onMapClick?: (p: LatLng) => void;
};

export default function GoogleMap({ centre, zoom = 17, className, onReady, onMapClick }: Props) {
  const el = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const clickRef = useRef(onMapClick);
  clickRef.current = onMapClick;
  const readyRef = useRef(onReady);
  readyRef.current = onReady;

  useEffect(() => {
    if (!el.current || mapRef.current || !GOOGLE_MAPS_KEY) return;

    ensureMapsLoaded().then(() => {
      if (!el.current || mapRef.current) return;
      const map = new google.maps.Map(el.current, {
        center: { lat: centre.lat, lng: centre.lng },
        zoom,
        mapTypeId: google.maps.MapTypeId.SATELLITE,
        disableDefaultUI: true,
        // Drops the "Keyboard shortcuts" button, which is pure clutter on a
        // phone. The imagery credit and Terms link next to it are required by
        // the Google Maps Platform terms and cannot be removed.
        keyboardShortcuts: false,
        gestureHandling: 'greedy',
        backgroundColor: '#000820',
        // A Map ID switches the API to VECTOR rendering, which is the only
        // mode where `setHeading()` works on a top-down satellite view. Omit
        // it and the map renders as raster and silently refuses to rotate.
        ...(GOOGLE_MAPS_ID ? { mapId: GOOGLE_MAPS_ID } : {}),
        // Keep the view flat; we rotate around the vertical axis only.
        tilt: 0,
      });

      map.addListener('click', (e: google.maps.MapMouseEvent) => {
        if (e.latLng) clickRef.current?.({ lat: e.latLng.lat(), lng: e.latLng.lng() });
      });

      mapRef.current = map;
      readyRef.current?.(map);

      // Recalculate tile coverage after layout paints, and again on any
      // window resize (including browser zoom changes).
      const triggerResize = () => google.maps.event.trigger(map, 'resize');
      requestAnimationFrame(triggerResize);
      window.addEventListener('resize', triggerResize);
      (el.current as HTMLDivElement & { _resizeCleanup?: () => void })._resizeCleanup =
        () => window.removeEventListener('resize', triggerResize);
    });
    // Don't clear mapRef in cleanup — prevents StrictMode double-init on the same div.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => {
    const div = el.current as (HTMLDivElement & { _resizeCleanup?: () => void }) | null;
    div?._resizeCleanup?.();
  }, []);

  if (!GOOGLE_MAPS_KEY) {
    return (
      <div className={`sat-map sat-map--nokey ${className ?? ''}`}>
        Map key not set.
        <br />
        Add VITE_GOOGLE_MAPS_KEY to .env.local
      </div>
    );
  }

  return <div ref={el} className={`sat-map ${className ?? ''}`} />;
}

/* --- camera orientation --------------------------------------------------- */

/**
 * Orient the map: rotate to `heading` (degrees clockwise from north) and pitch
 * the camera to `tilt` (degrees from straight-down; 0 = flat bird's-eye,
 * ~45-67.5 = Grint-style down-the-fairway perspective).
 *
 * Applied twice on purpose: `fitBounds` is asynchronous and resets both heading
 * and tilt to zero, so they have to be re-set once the camera settles. Setting
 * them immediately as well covers the case where `fitBounds` changes nothing
 * and therefore never fires `idle`.
 *
 * No-ops unless the map was built with a vector Map ID (heading/tilt are
 * ignored on raster maps) — see `GOOGLE_MAPS_ID` in `provider.ts`. Tilt also
 * requires the Map ID to have had "Tilt" enabled when it was created.
 */
export function faceHeading(map: google.maps.Map, heading: number, tilt = 0): void {
  const apply = () => {
    map.setHeading(heading);
    map.setTilt(tilt);
  };
  apply();
  google.maps.event.addListenerOnce(map, 'idle', apply);
}

/* --- bounds --------------------------------------------------------------- */

const M_PER_DEG_LAT = 111_320;

/**
 * Axis-aligned box containing every point, expanded by `padM` metres on all
 * sides. Used to fence the playing map to the current hole.
 */
export function paddedBounds(
  points: (LatLng | undefined | null)[],
  padM: number,
): google.maps.LatLngBoundsLiteral | null {
  const pts = points.filter((p): p is LatLng => !!p);
  if (pts.length === 0) return null;

  let north = -90;
  let south = 90;
  let east = -180;
  let west = 180;
  for (const p of pts) {
    north = Math.max(north, p.lat);
    south = Math.min(south, p.lat);
    east = Math.max(east, p.lng);
    west = Math.min(west, p.lng);
  }

  const dLat = padM / M_PER_DEG_LAT;
  const midLat = ((north + south) / 2) * (Math.PI / 180);
  const dLng = padM / (M_PER_DEG_LAT * Math.max(Math.cos(midLat), 0.01));

  return {
    north: Math.min(north + dLat, 85),
    south: Math.max(south - dLat, -85),
    east: Math.min(east + dLng, 180),
    west: Math.max(west - dLng, -180),
  };
}

/* --- marker icons --------------------------------------------------------- */

function svgIcon(svg: string, w: number, h: number, anchorX?: number, anchorY?: number): google.maps.Icon {
  return {
    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
    anchor: new google.maps.Point(anchorX ?? w / 2, anchorY ?? h / 2),
    scaledSize: new google.maps.Size(w, h),
  };
}

/**
 * Returns a TRON-styled Google Maps marker icon.
 * Must be called only after the Maps API has loaded (i.e. inside effects
 * that depend on `map` being non-null).
 */
export function markerIcon(
  kind: 'tee' | 'flag' | 'target' | 'player' | 'hazard',
  label = '',
): google.maps.Icon {
  switch (kind) {
    case 'tee':
      return svgIcon(
        `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22">` +
          `<circle cx="11" cy="11" r="9" fill="#35e0ff" stroke="#041018" stroke-width="2"/>` +
          (label ? `<text x="11" y="15" font-family="monospace" font-size="8" font-weight="bold" fill="#041018" text-anchor="middle">${label}</text>` : '') +
          `</svg>`,
        22, 22,
      );
    case 'flag':
      return svgIcon(
        `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="28">` +
          `<line x1="7" y1="3" x2="7" y2="26" stroke="rgba(255,255,255,0.9)" stroke-width="1.5"/>` +
          `<polygon points="7,3 17,7 7,14" fill="#ffe000"/>` +
          `<circle cx="7" cy="26" r="2" fill="rgba(255,255,255,0.5)"/>` +
          `</svg>`,
        18, 28, 7, 26,
      );
    case 'hazard':
      return svgIcon(
        `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16">` +
          `<circle cx="8" cy="8" r="6" fill="#ff4444" stroke="#041018" stroke-width="2"/>` +
          (label ? `<text x="8" y="12" font-family="monospace" font-size="6" font-weight="bold" fill="#fff" text-anchor="middle">${label}</text>` : '') +
          `</svg>`,
        16, 16,
      );
    case 'target':
      return svgIcon(
        `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="18">` +
          `<ellipse cx="13" cy="9" rx="11" ry="7" fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.85)" stroke-width="1.5"/>` +
          `</svg>`,
        26, 18,
      );
    case 'player':
    default:
      return svgIcon(GOLF_BALL_SVG, 22, 22);
  }
}

/* --- 8-bit golf ball ------------------------------------------------------ */

/** Row spans of a blocky pixel circle: [xStart, width] per row. */
const BALL_ROWS: [number, number][] = [
  [3, 5], [2, 7], [1, 9], [1, 9], [0, 11], [0, 11],
  [0, 11], [1, 9], [1, 9], [2, 7], [3, 5],
];

function pixelRows(rows: [number, number][], dx: number, dy: number, fill: string): string {
  return rows
    .map(([x, w], y) => `<rect x="${x + dx}" y="${y + dy}" width="${w}" height="1" fill="${fill}"/>`)
    .join('');
}

/** Outline rows: the ball shape grown by one pixel on every side. */
const BALL_OUTLINE_ROWS: [number, number][] = [
  [4, 5], [3, 7], [2, 9], [1, 11], [1, 11], [0, 13],
  [0, 13], [0, 13], [1, 11], [1, 11], [2, 9], [3, 7], [4, 5],
];

const GOLF_BALL_SVG =
  `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 13 13" shape-rendering="crispEdges">` +
  pixelRows(BALL_OUTLINE_ROWS, 0, 0, '#04101a') +
  pixelRows(BALL_ROWS, 1, 1, '#ffffff') +
  // dimples
  `<rect x="4" y="4" width="1" height="1" fill="#aebfcd"/>` +
  `<rect x="7" y="5" width="1" height="1" fill="#aebfcd"/>` +
  `<rect x="5" y="8" width="1" height="1" fill="#aebfcd"/>` +
  `<rect x="8" y="8" width="1" height="1" fill="#aebfcd"/>` +
  `</svg>`;

/* --- on-map distance label ------------------------------------------------ */

/**
 * A Grint-style distance chip pinned to a point on the map. Rendered as a
 * marker icon so it stays screen-upright while the map is rotated.
 */
export function distanceLabelIcon(text: string): google.maps.Icon {
  const w = Math.max(32, text.length * 8 + 12);
  const h = 19;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
    `<rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="2" ` +
    `fill="rgba(4,12,20,0.72)" stroke="rgba(255,255,255,0.6)" stroke-width="1"/>` +
    `<text x="${w / 2}" y="${h / 2 + 4}" font-family="monospace" font-size="12" ` +
    `fill="#ffffff" text-anchor="middle">${text}</text>` +
    `</svg>`;
  return svgIcon(svg, w, h);
}

/** Midpoint of a short segment — a plain average is accurate enough at hole scale. */
export function midpoint(a: LatLng, b: LatLng): LatLng {
  return { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
}
