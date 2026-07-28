import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Screen from '../components/Screen';
import { Button } from '../components/ui';
import GoogleMap, { markerIcon, paddedBounds } from '../map/GoogleMap';
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

  const staticMarkers = useRef<google.maps.Marker[]>([]);
  const playerMarker = useRef<google.maps.Marker | null>(null);
  const targetMarker = useRef<google.maps.Marker | null>(null);
  const legA = useRef<google.maps.Polyline | null>(null); // player → target
  const legB = useRef<google.maps.Polyline | null>(null); // target → green
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

  /* --- player marker + aiming lines --------------------------------------- */
  useEffect(() => {
    if (!map) return;

    if (player) {
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
    }

    const green = hole?.greenCentre;

    if (from && target) {
      const path = [
        { lat: from.lat, lng: from.lng },
        { lat: target.lat, lng: target.lng },
      ];
      if (legA.current) {
        legA.current.setPath(path);
      } else {
        legA.current = new google.maps.Polyline({
          path,
          map,
          strokeColor: 'rgba(255,255,255,0.75)',
          strokeWeight: 1.5,
        });
      }
    }

    if (target && green) {
      const path = [
        { lat: target.lat, lng: target.lng },
        { lat: green.lat, lng: green.lng },
      ];
      if (legB.current) {
        legB.current.setPath(path);
      } else {
        legB.current = new google.maps.Polyline({
          path,
          map,
          strokeColor: 'rgba(255,255,255,0.75)',
          strokeWeight: 1.5,
        });
      }
    }
  }, [map, player, from, target, hole]);

  useEffect(
    () => () => {
      legA.current?.setMap(null);
      legB.current?.setMap(null);
      playerMarker.current?.setMap(null);
      legA.current = legB.current = null;
      playerMarker.current = null;
    },
    [],
  );

  /* --- readouts ----------------------------------------------------------- */
  const d = useMemo(() => {
    const g = hole;
    return {
      front: from && g?.greenFront ? distanceM(from, g.greenFront) : null,
      centre: from && g?.greenCentre ? distanceM(from, g.greenCentre) : null,
      back: from && g?.greenBack ? distanceM(from, g.greenBack) : null,
      toTarget: from && target ? distanceM(from, target) : null,
      targetToGreen: target && g?.greenCentre ? distanceM(target, g.greenCentre) : null,
    };
  }, [from, target, hole]);

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
          <div className="play__hud">
            <div>
              <b>FRONT</b>
              <span>{fmtDist(d.front, settings.units)}</span>
            </div>
            <div>
              <b>CENTRE</b>
              <span className="c-cyan">{fmtDist(d.centre, settings.units)}</span>
            </div>
            <div>
              <b>BACK</b>
              <span>{fmtDist(d.back, settings.units)}</span>
            </div>
          </div>
        </div>

        <div className="play__panel">
          <div className="play__legs">
            <div className="play__leg">
              <b>YOU → TARGET</b>
              <span>{fmtDist(d.toTarget, settings.units)}</span>
            </div>
            <div className="play__leg">
              <b>TARGET → GREEN</b>
              <span className="c-cyan">{fmtDist(d.targetToGreen, settings.units)}</span>
            </div>
          </div>

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
