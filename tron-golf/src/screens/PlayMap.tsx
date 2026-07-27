import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { useNavigate } from 'react-router-dom';
import Screen from '../components/Screen';
import { Button } from '../components/ui';
import SatelliteMap, { pixelIcon } from '../map/SatelliteMap';
import { distanceM, fmtDist } from '../state/geo';
import { courseById, useStore } from '../state/store';
import type { LatLng } from '../state/types';

export default function PlayMap() {
  const nav = useNavigate();
  const { activeRound, settings } = useStore();
  const course = activeRound ? courseById(activeRound.courseId) : undefined;
  const hole = course?.holes.find((h) => h.number === activeRound?.currentHole);

  const [map, setMap] = useState<L.Map | null>(null);
  const [player, setPlayer] = useState<LatLng | null>(null);
  const [target, setTarget] = useState<LatLng | null>(null);
  const [gpsError, setGpsError] = useState(false);

  const layers = useRef<L.LayerGroup | null>(null);
  const playerMarker = useRef<L.Marker | null>(null);
  const targetMarker = useRef<L.Marker | null>(null);
  const legA = useRef<L.Polyline | null>(null); // player -> target
  const legB = useRef<L.Polyline | null>(null); // target -> green

  const centre = hole?.tee ?? course?.centre ?? { lat: 0, lng: 0 };

  /* --- GPS ------------------------------------------------------------- */
  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsError(true);
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsError(false);
        setPlayer({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => setGpsError(true),
      {
        enableHighAccuracy: settings.gpsAccuracy === 'high',
        maximumAge: 3000,
        timeout: 15000,
      },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [settings.gpsAccuracy]);

  /** Without a GPS fix the tee box stands in as the reference point. */
  const from = player ?? hole?.tee ?? null;

  /* --- default target = green centre for the current hole --------------- */
  useEffect(() => {
    if (hole?.greenCentre) setTarget(hole.greenCentre);
  }, [hole?.number, hole?.greenCentre]);

  /* --- static hole furniture ------------------------------------------- */
  useEffect(() => {
    if (!map || !hole) return;
    layers.current?.remove();
    const group = L.layerGroup().addTo(map);
    layers.current = group;

    if (hole.tee) L.marker([hole.tee.lat, hole.tee.lng], { icon: pixelIcon('tee', 'TEE') }).addTo(group);
    if (hole.greenFront)
      L.marker([hole.greenFront.lat, hole.greenFront.lng], { icon: pixelIcon('green', 'F') }).addTo(group);
    if (hole.greenCentre)
      L.marker([hole.greenCentre.lat, hole.greenCentre.lng], { icon: pixelIcon('green', 'C') }).addTo(group);
    if (hole.greenBack)
      L.marker([hole.greenBack.lat, hole.greenBack.lng], { icon: pixelIcon('green', 'B') }).addTo(group);
    for (const h of hole.hazards ?? [])
      L.marker([h.point.lat, h.point.lng], { icon: pixelIcon('hazard', h.name) }).addTo(group);

    // Frame tee and green so the whole hole is visible on entry.
    const pts: L.LatLngExpression[] = [];
    if (hole.tee) pts.push([hole.tee.lat, hole.tee.lng]);
    if (hole.greenCentre) pts.push([hole.greenCentre.lat, hole.greenCentre.lng]);
    if (pts.length === 2) map.fitBounds(L.latLngBounds(pts).pad(0.25));

    return () => {
      group.remove();
    };
  }, [map, hole]);

  /* --- movable target --------------------------------------------------- */
  useEffect(() => {
    if (!map || !target) return;
    if (!targetMarker.current) {
      const m = L.marker([target.lat, target.lng], {
        icon: pixelIcon('target'),
        draggable: true,
        autoPan: true,
        zIndexOffset: 1000,
      }).addTo(map);
      const sync = () => {
        const ll = m.getLatLng();
        setTarget({ lat: ll.lat, lng: ll.lng });
      };
      m.on('drag', sync);
      m.on('dragend', sync);
      targetMarker.current = m;
    } else {
      const cur = targetMarker.current.getLatLng();
      if (cur.lat !== target.lat || cur.lng !== target.lng)
        targetMarker.current.setLatLng([target.lat, target.lng]);
    }
  }, [map, target]);

  useEffect(
    () => () => {
      targetMarker.current?.remove();
      targetMarker.current = null;
    },
    [],
  );

  /* --- player marker + the two aiming lines ----------------------------- */
  useEffect(() => {
    if (!map) return;

    if (player) {
      if (playerMarker.current) playerMarker.current.setLatLng([player.lat, player.lng]);
      else
        playerMarker.current = L.marker([player.lat, player.lng], {
          icon: pixelIcon('player'),
          zIndexOffset: 900,
        }).addTo(map);
    }

    const green = hole?.greenCentre;
    if (from && target) {
      const pts: L.LatLngExpression[] = [
        [from.lat, from.lng],
        [target.lat, target.lng],
      ];
      if (legA.current) legA.current.setLatLngs(pts);
      else
        legA.current = L.polyline(pts, {
          color: '#ffb02e',
          weight: 2,
          dashArray: '6 4',
        }).addTo(map);
    }
    if (target && green) {
      const pts: L.LatLngExpression[] = [
        [target.lat, target.lng],
        [green.lat, green.lng],
      ];
      if (legB.current) legB.current.setLatLngs(pts);
      else legB.current = L.polyline(pts, { color: '#35e0ff', weight: 2 }).addTo(map);
    }
  }, [map, player, from, target, hole]);

  useEffect(
    () => () => {
      legA.current?.remove();
      legB.current?.remove();
      playerMarker.current?.remove();
      legA.current = legB.current = null;
      playerMarker.current = null;
    },
    [],
  );

  /* --- readouts ---------------------------------------------------------- */
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
    const pts: L.LatLngExpression[] = [];
    if (from) pts.push([from.lat, from.lng]);
    if (hole?.greenCentre) pts.push([hole.greenCentre.lat, hole.greenCentre.lng]);
    if (pts.length >= 2) map.fitBounds(L.latLngBounds(pts).pad(0.25));
    else if (pts.length === 1) map.setView(pts[0] as L.LatLngExpression, 17);
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
          <SatelliteMap centre={centre} zoom={17} onReady={setMap} onMapClick={setTarget} />
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
