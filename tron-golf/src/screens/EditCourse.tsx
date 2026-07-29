import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Screen from '../components/Screen';
import { Button, Field, Panel } from '../components/ui';
import GoogleMap, { markerIcon } from '../map/GoogleMap';
import { generateHoles, TEE_OPTIONS } from '../state/seed';
import { courseById, updateCourse, useStore } from '../state/store';
import type { LatLng } from '../state/types';

export default function EditCourse() {
  const { courseId } = useParams<{ courseId: string }>();
  const nav = useNavigate();
  const { settings } = useStore();

  const course = courseId ? courseById(courseId) : undefined;

  const [name, setName] = useState(course?.name ?? '');
  const [location, setLocation] = useState(course?.location ?? '');
  const [holeCount, setHoleCount] = useState(course?.holeCount ?? 18);
  const [par, setPar] = useState(course?.par ?? 72);
  const tees = [...TEE_OPTIONS];
  const [point, setPoint] = useState<LatLng | null>(course?.centre ?? null);
  const [latText, setLatText] = useState(course?.centre.lat.toFixed(6) ?? '');
  const [lngText, setLngText] = useState(course?.centre.lng.toFixed(6) ?? '');

  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const pendingPlace = useRef<LatLng | null>(course?.centre ?? null);

  if (!course) {
    return (
      <Screen title="EDIT COURSE" back="/courses">
        <p className="muted">Course not found.</p>
      </Screen>
    );
  }

  const resolvedCourse = course;

  function placeMarker(p: LatLng) {
    setPoint(p);
    setLatText(p.lat.toFixed(6));
    setLngText(p.lng.toFixed(6));
    const map = mapRef.current;
    if (!map) return;
    if (markerRef.current) {
      markerRef.current.setPosition({ lat: p.lat, lng: p.lng });
    } else {
      markerRef.current = new google.maps.Marker({
        position: { lat: p.lat, lng: p.lng },
        map,
        icon: markerIcon('tee'),
        title: 'Course location',
      });
    }
    map.setCenter({ lat: p.lat, lng: p.lng });
  }

  function applyCoordText() {
    const lat = parseFloat(latText);
    const lng = parseFloat(lngText);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return;
    placeMarker({ lat, lng });
  }

  function useMyLocation() {
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        placeMarker(p);
        mapRef.current?.setZoom(16);
      },
      () => {},
      { enableHighAccuracy: settings.gpsAccuracy === 'high', timeout: 8000 },
    );
  }

  const centreChanged =
    point && (point.lat !== resolvedCourse.centre.lat || point.lng !== resolvedCourse.centre.lng);
  const holeCountChanged = holeCount !== resolvedCourse.holeCount;
  const canSave = name.trim().length > 0 && !!point && tees.length > 0;

  function save() {
    if (!point || !canSave) return;
    const holes = holeCountChanged
      ? generateHoles(point, holeCount, par, tees)
      : resolvedCourse.holes.map((h) => ({
          ...h,
          distances: Object.fromEntries(tees.map((t) => [t, h.distances[t] ?? h.distances.Blue ?? 150])),
        }));

    updateCourse(resolvedCourse.id, {
      name: name.trim(),
      location: location.trim() || 'Unknown',
      holeCount,
      par,
      tees,
      centre: point,
      holes,
      approximateCoords: centreChanged ? true : resolvedCourse.approximateCoords,
    });
    nav('/courses');
  }

  return (
    <Screen title="EDIT COURSE" back="/courses">
      <Panel>
        <div className="stack">
          <Field label="COURSE NAME">
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Kinrara Golf Club"
            />
          </Field>
          <Field label="LOCATION">
            <input
              className="input"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Puchong, Selangor"
            />
          </Field>
          <div className="btn-row">
            <Field label="HOLES">
              <select
                className="input"
                value={holeCount}
                onChange={(e) => setHoleCount(Number(e.target.value))}
              >
                <option value={9}>9</option>
                <option value={18}>18</option>
              </select>
            </Field>
            <Field label="PAR">
              <input
                className="input"
                type="number"
                inputMode="numeric"
                value={par}
                onChange={(e) => setPar(Number(e.target.value) || 0)}
              />
            </Field>
          </div>
          {holeCountChanged && (
            <p className="muted" style={{ color: 'var(--amber)', fontSize: 11 }}>
              Changing hole count regenerates all hole data.
            </p>
          )}
        </div>
      </Panel>

      <Panel title="MAP LOCATION">
        <div className="stack">
          <div className="btn-row">
            <Field label="LATITUDE">
              <input
                className="input"
                inputMode="decimal"
                value={latText}
                onChange={(e) => setLatText(e.target.value)}
                onBlur={applyCoordText}
              />
            </Field>
            <Field label="LONGITUDE">
              <input
                className="input"
                inputMode="decimal"
                value={lngText}
                onChange={(e) => setLngText(e.target.value)}
                onBlur={applyCoordText}
              />
            </Field>
          </div>
          <Button size="sm" variant="ghost" onClick={applyCoordText}>
            APPLY COORDINATES
          </Button>

          <div style={{ height: 200, border: '1px solid var(--cyan-dim)' }}>
            <GoogleMap
              centre={point ?? resolvedCourse.centre}
              zoom={15}
              onReady={(m) => {
                mapRef.current = m;
                if (pendingPlace.current) {
                  placeMarker(pendingPlace.current);
                  pendingPlace.current = null;
                }
              }}
              onMapClick={(p) => placeMarker(p)}
            />
          </div>
          <p className="muted" style={{ fontSize: 11 }}>
            {point
              ? `Pin: ${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`
              : 'Tap the map or apply coordinates to set location.'}
          </p>
        </div>
      </Panel>

      <Panel title="HOLE COORDINATES">
        <div className="stack">
          <p className="muted" style={{ fontSize: 10, color: 'var(--text-faint)' }}>
            Pin the tee box and green centre for each hole. Cyan holes are done.
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(6, 1fr)',
              gap: 4,
            }}
          >
            {resolvedCourse.holes.map((h) => (
              <button
                key={h.number}
                type="button"
                onClick={() => nav(`/courses/edit/${resolvedCourse.id}/hole/${h.number}`)}
                style={{
                  padding: '8px 0',
                  fontFamily: 'var(--font-pixel)',
                  fontSize: 9,
                  cursor: 'pointer',
                  background: h.coordsSet ? 'rgba(53,224,255,0.12)' : 'transparent',
                  border: `1px solid ${h.coordsSet ? 'var(--cyan)' : 'var(--cyan-dim)'}`,
                  color: h.coordsSet ? 'var(--cyan)' : 'var(--text-faint)',
                }}
              >
                {h.number}
              </button>
            ))}
          </div>
          <p className="muted" style={{ fontSize: 10, color: 'var(--text-faint)' }}>
            {resolvedCourse.holes.filter((h) => h.coordsSet).length} of{' '}
            {resolvedCourse.holes.length} holes pinned.
          </p>
        </div>
      </Panel>

      <div className="stack">
        <Button onClick={useMyLocation}>USE MY GPS LOCATION</Button>
        <Button variant="primary" disabled={!canSave} onClick={save}>
          SAVE CHANGES
        </Button>
      </div>
    </Screen>
  );
}
