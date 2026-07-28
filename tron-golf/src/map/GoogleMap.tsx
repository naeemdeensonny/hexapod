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
    });
    // Don't clear mapRef in cleanup — prevents StrictMode double-init on the same div.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

/* --- marker icons --------------------------------------------------------- */

function svgIcon(svg: string, w: number, h: number): google.maps.Icon {
  return {
    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
    anchor: new google.maps.Point(w / 2, h / 2),
    scaledSize: new google.maps.Size(w, h),
  };
}

/**
 * Returns a TRON-styled Google Maps marker icon.
 * Must be called only after the Maps API has loaded (i.e. inside effects
 * that depend on `map` being non-null).
 */
export function markerIcon(
  kind: 'tee' | 'green' | 'target' | 'player' | 'hazard',
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
    case 'green':
      return svgIcon(
        `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18">` +
          `<circle cx="9" cy="9" r="7" fill="#00ff88" stroke="#041018" stroke-width="2"/>` +
          (label ? `<text x="9" y="13" font-family="monospace" font-size="7" font-weight="bold" fill="#041018" text-anchor="middle">${label}</text>` : '') +
          `</svg>`,
        18, 18,
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
        `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36">` +
          `<line x1="0" y1="18" x2="36" y2="18" stroke="#ffb02e" stroke-width="1.5" stroke-opacity="0.8"/>` +
          `<line x1="18" y1="0" x2="18" y2="36" stroke="#ffb02e" stroke-width="1.5" stroke-opacity="0.8"/>` +
          `<circle cx="18" cy="18" r="9" fill="#ffb02e" stroke="#1a0f00" stroke-width="2"/>` +
          `</svg>`,
        36, 36,
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
