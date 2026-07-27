import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './map.css';
import { tileProvider } from './provider';
import type { LatLng } from '../state/types';

type Props = {
  centre: LatLng;
  zoom?: number;
  className?: string;
  /** Called once the Leaflet instance exists, for markers/lines/controls. */
  onReady?: (map: L.Map) => void;
  onMapClick?: (p: LatLng) => void;
};

/**
 * Thin Leaflet wrapper rendering real satellite imagery. Pan, pinch-zoom and
 * tap-to-place all come from Leaflet's own gesture handling; only the controls
 * drawn around the map use the retro pixel theme.
 */
export default function SatelliteMap({ centre, zoom = 17, className, onReady, onMapClick }: Props) {
  const el = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const clickRef = useRef(onMapClick);
  clickRef.current = onMapClick;

  useEffect(() => {
    if (!el.current || mapRef.current) return;

    const provider = tileProvider();
    const map = L.map(el.current, {
      center: [centre.lat, centre.lng],
      zoom,
      zoomControl: false,
      attributionControl: true,
      // Pinch-to-zoom and drag-to-pan are Leaflet defaults; keep them explicit.
      dragging: true,
      touchZoom: true,
      doubleClickZoom: false,
    });

    L.tileLayer(provider.url, {
      attribution: provider.attribution,
      maxZoom: provider.maxZoom,
      maxNativeZoom: provider.maxZoom,
      tileSize: provider.tileSize,
      zoomOffset: provider.zoomOffset,
      crossOrigin: true,
    }).addTo(map);

    map.on('click', (e: L.LeafletMouseEvent) => {
      clickRef.current?.({ lat: e.latlng.lat, lng: e.latlng.lng });
    });

    mapRef.current = map;
    onReady?.(map);

    // The map lives inside a flex column; size it once layout has settled.
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(el.current);

    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
    };
    // Intentionally mount-once: subsequent centring is done by the caller.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={el} className={`sat-map ${className ?? ''}`} />;
}

/** Pixel-styled Leaflet marker built from a CSS class rather than an image. */
export function pixelIcon(kind: string, label?: string): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div class="pin pin--${kind}">${label ? `<span>${label}</span>` : ''}</div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}
