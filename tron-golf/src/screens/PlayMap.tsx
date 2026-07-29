import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Screen from '../components/Screen';
import { Button } from '../components/ui';
import GoogleMap, {
  distanceLabelIcon,
  markerIcon,
  midpoint,
  paddedBounds,
} from '../map/GoogleMap';
import { bearing, distanceM, fmtDist } from '../state/geo';
import { courseById, useStore } from '../state/store';
import type { LatLng } from '../state/types';

/** Slack around the hole so the tee and green never sit hard against the edge. */
const HOLE_PAD_M = 180;

export default function PlayMap() {
  const nav = useNavigate();
  const { activeRound, settings } = useStore();
  const course = activeRound ? courseById(activeRound.courseId) : undefined;
  const hole = course?.holes.find((h) => h.number === activeRound?.currentHole);

  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [player, setPlayer] = useState<LatLng | null>(null);
  const [target, setTarget] = useState<LatLng | null>(null);
  const [gpsError, setGpsError] = useState(false);

  type Leg = { line: google.maps.Polyline; label: google.maps.Marker };

  const staticMarkers = useRef<google.maps.Marker[]>([]);
  const playerMarker = useRef<google.maps.Marker | null>(null);
  const targetMarker = useRef<google.maps.Marker | null>(null);
  const legs = useRef<Map<string, Leg>>(new Map());
  const fenceRef = useRef<google.maps.LatLngBoundsLiteral | null>(null);

  const centre = hole?.tee ?? course?.centre ?? { lat: 0, lng: 0 };

  /* --- GPS ---------------------------------------------------------------- */
  useEffect(() => {
    if (!navigator.geolocation) { setGpsError(true); return; }
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsError(false);
        setPlayer({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => setGpsError(true),
      { enableHighAccuracy: settings.gpsAccuracy === 'high', maximumAge: 3000, timeout: 15000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [settings.gpsAccuracy]);

  const from = player ?? hole?.tee ?? null;

  /* --- default target = green centre -------------------------------------- */
  useEffect(() => {
    if (hole?.greenCentre) setTarget(hole.greenCentre);
  }, [hole?.number, hole?.greenCentre]);

  /* --- pan fence ----------------------------------------------------------- */

  /** Restrict panning to the hole corridor, widened to keep `extra` reachable. */
  function applyFence(m: google.maps.Map, extra?: LatLng | null) {
    if (!hole) return;
    const fence = paddedBounds(
      [
        hole.tee,
        hole.greenFront,
        hole.greenCentre,
        hole.greenBack,
        ...(hole.hazards ?? []).map((h) => h.point),
        extra,
      ],
      HOLE_PAD_M,
    );
    fenceRef.current = fence;
    m.setOptions({ restriction: fence ? { latLngBounds: fence, strictBounds: true } : null });
  }

  // A GPS fix outside the fence would otherwise be unreachable — widen it.
  useEffect(() => {
    const f = fenceRef.current;
    if (!map || !player || !f) return;
    const inside =
      player.lat >= f.south && player.lat <= f.north &&
      player.lng >= f.west && player.lng <= f.east;
    if (!inside) applyFence(map, player);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, player]);

  /* --- static hole furniture ---------------------------------------------- */
  useEffect(() => {
    if (!map || !hole) return;

    staticMarkers.current.forEach((m) => m.setMap(null));
    staticMarkers.current = [];

    const add = (pos: LatLng, kind: 'tee' | 'flag' | 'hazard', label: string, title: string) => {
      staticMarkers.current.push(
        new google.maps.Marker({ position: pos, map, icon: markerIcon(kind, label), title, zIndex: 10 }),
      );
    };

    if (hole.tee) add(hole.tee, 'tee', 'T', 'Tee');
    if (hole.greenCentre) add(hole.greenCentre, 'flag', '', 'Green');
    for (const h of hole.hazards ?? []) add(h.point, 'hazard', h.name[0] ?? 'H', h.name);

    applyFence(map, player);

    // Frame both pins, then rotate once the map is idle.
    // fitBounds resets heading to north, so heading must be applied after it settles.
    const h = (hole.tee && hole.greenCentre) ? bearing(hole.tee, hole.greenCentre) : null;
    const bounds = new google.maps.LatLngBounds();
    if (hole.tee) bounds.extend({ lat: hole.tee.lat, lng: hole.tee.lng });
    if (hole.greenCentre) bounds.extend({ lat: hole.greenCentre.lat, lng: hole.greenCentre.lng });
    if (!bounds.isEmpty()) map.fitBounds(bounds, 50);
    if (h !== null) {
      google.maps.event.addListenerOnce(map, 'idle', () => map.setHeading(h));
    }

    return () => {
      staticMarkers.current.forEach((m) => m.setMap(null));
      staticMarkers.current = [];
    };
    // `player` is read for the initial fence only; GPS ticks must not rebuild markers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, hole]);

  /* --- movable target ----------------------------------------------------- */
  useEffect(() => {
    if (!map || !target) return;
    if (!targetMarker.current) {
      const m = new google.maps.Marker({
        position: { lat: target.lat, lng: target.lng },
        map,
        icon: markerIcon('target'),
        draggable: true,
        zIndex: 1000,
        title: 'Target',
      });
      const sync = () => {
        const pos = m.getPosition();
        if (pos) setTarget({ lat: pos.lat(), lng: pos.lng() });
      };
      m.addListener('drag', sync);
      m.addListener('dragend', sync);
      targetMarker.current = m;
    } else {
      const cur = targetMarker.current.getPosition();
      if (!cur || cur.lat() !== target.lat || cur.lng() !== target.lng) {
        targetMarker.current.setPosition({ lat: target.lat, lng: target.lng });
      }
    }
  }, [map, target]);

  useEffect(
    () => () => {
      targetMarker.current?.setMap(null);
      targetMarker.current = null;
    },
    [],
  );

  /* --- player marker ------------------------------------------------------- */
  useEffect(() => {
    if (!map || !player) return;
    if (playerMarker.current) {
      playerMarker.current.setPosition({ lat: player.lat, lng: player.lng });
    } else {
      playerMarker.current = new google.maps.Marker({
        position: { lat: player.lat, lng: player.lng },
        map,
        icon: markerIcon('player'),
        zIndex: 900,
        title: 'You',
      });
    }
  }, [map, player]);

  /* --- aiming lines, each labelled with its own distance ------------------- */
  useEffect(() => {
    if (!map) return;

    const green = hole?.greenCentre;

    // Segments run tee → you → target → green. A leg is dropped when its two
    // ends coincide (e.g. the target still sits on the green centre).
    const wanted: { key: string; a: LatLng; b: LatLng }[] = [];
    const push = (key: string, a?: LatLng | null, b?: LatLng | null) => {
      if (a && b && distanceM(a, b) > 3) wanted.push({ key, a, b });
    };
    push('tee-you', hole?.tee, player);
    push('you-target', from, target);
    push('target-green', target, green);

    const live = legs.current;

    for (const { key, a, b } of wanted) {
      const path = [
        { lat: a.lat, lng: a.lng },
        { lat: b.lat, lng: b.lng },
      ];
      const text = fmtDist(distanceM(a, b), settings.units);
      const mid = midpoint(a, b);
      const existing = live.get(key);

      if (existing) {
        existing.line.setPath(path);
        existing.label.setPosition({ lat: mid.lat, lng: mid.lng });
        existing.label.setIcon(distanceLabelIcon(text));
      } else {
        live.set(key, {
          line: new google.maps.Polyline({
            path,
            map,
            strokeColor: '#ffffff',
            strokeOpacity: 0.85,
            strokeWeight: 1.5,
            clickable: false,
          }),
          label: new google.maps.Marker({
            position: { lat: mid.lat, lng: mid.lng },
            map,
            icon: distanceLabelIcon(text),
            clickable: false,
            zIndex: 950,
          }),
        });
      }
    }

    // Drop legs that no longer apply.
    const keep = new Set(wanted.map((w) => w.key));
    for (const [key, leg] of live) {
      if (keep.has(key)) continue;
      leg.line.setMap(null);
      leg.label.setMap(null);
      live.delete(key);
    }
  }, [map, player, from, target, hole, settings.units]);

  useEffect(
    () => () => {
      for (const leg of legs.current.values()) {
        leg.line.setMap(null);
        leg.label.setMap(null);
      }
      legs.current.clear();
      playerMarker.current?.setMap(null);
      playerMarker.current = null;
    },
    [],
  );

  if (!activeRound || !course) {
    return (
      <Screen title="MAP" back="/">
        <div className="empty">NO ACTIVE ROUND</div>
      </Screen>
    );
  }

  function recentre() {
    if (!map) return;
    const bounds = new google.maps.LatLngBounds();
    if (from) bounds.extend({ lat: from.lat, lng: from.lng });
    if (hole?.greenCentre) bounds.extend({ lat: hole.greenCentre.lat, lng: hole.greenCentre.lng });
    if (!bounds.isEmpty()) map.fitBounds(bounds, 50);
    else if (from) map.setCenter({ lat: from.lat, lng: from.lng });

    // fitBounds snaps back to north — re-apply the tee → green heading after it settles.
    if (hole?.tee && hole.greenCentre) {
      const h = bearing(hole.tee, hole.greenCentre);
      google.maps.event.addListenerOnce(map, 'idle', () => map.setHeading(h));
    }
  }

  return (
    <Screen
      title={`HOLE ${activeRound.currentHole}`}
      subtitle={`Par ${hole?.par ?? '-'} · ${activeRound.tee}`}
      back="/hole"
      flush
    >
      <div className="play">
        <div className="play__map">
          <GoogleMap centre={centre} zoom={17} onReady={setMap} onMapClick={setTarget} />
        </div>

        <div className="play__panel">
          {gpsError && (
            <p className="muted" style={{ color: 'var(--red)', fontSize: 11 }}>
              NO GPS FIX — distances measured from the tee box.
            </p>
          )}

          <div className="btn-row">
            <Button size="sm" onClick={recentre}>
              RE-CENTRE
            </Button>
            <Button size="sm" variant="primary" onClick={() => nav('/score')}>
              SCORE
            </Button>
          </div>
        </div>
      </div>
    </Screen>
  );
}
