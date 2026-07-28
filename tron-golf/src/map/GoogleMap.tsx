import { useEffect, useRef } from 'react';
import { importLibrary, setOptions } from '@googlemaps/js-api-loader';
import './map.css';
import { GOOGLE_MAPS_KEY } from './provider';
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
        gestureHandling: 'greedy',
        backgroundColor: '#000820',
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
      return svgIcon(
        `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24">` +
          `<circle cx="12" cy="12" r="11" fill="#35e0ff" fill-opacity="0.25"/>` +
          `<circle cx="12" cy="12" r="7" fill="#ffffff" stroke="#35e0ff" stroke-width="3"/>` +
          `</svg>`,
        24, 24,
      );
  }
}
