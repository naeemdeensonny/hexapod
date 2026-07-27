import { useRef, useState } from 'react';
import L from 'leaflet';
import { useNavigate } from 'react-router-dom';
import Screen from '../components/Screen';
import { Button, Field, Panel } from '../components/ui';
import SatelliteMap, { pixelIcon } from '../map/SatelliteMap';
import { addCourse, useStore } from '../state/store';
import { generateHoles, TEE_OPTIONS } from '../state/seed';
import type { LatLng } from '../state/types';

const DEFAULT_CENTRE: LatLng = { lat: 3.0425, lng: 101.635 };

export default function AddCourse() {
  const nav = useNavigate();
  const { settings } = useStore();

  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [holeCount, setHoleCount] = useState(18);
  const [par, setPar] = useState(72);
  const [tees, setTees] = useState<string[]>([...TEE_OPTIONS]);
  const [point, setPoint] = useState<LatLng | null>(null);
  const [picking, setPicking] = useState(false);

  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  function placeMarker(p: LatLng) {
    setPoint(p);
    const map = mapRef.current;
    if (!map) return;
    if (markerRef.current) markerRef.current.setLatLng([p.lat, p.lng]);
    else markerRef.current = L.marker([p.lat, p.lng], { icon: pixelIcon('tee') }).addTo(map);
  }

  function useMyLocation() {
    setPicking(true);
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        mapRef.current?.setView([p.lat, p.lng], 16);
        placeMarker(p);
      },
      () => {
        /* permission denied: the user can still tap the map */
      },
      { enableHighAccuracy: settings.gpsAccuracy === 'high', timeout: 8000 },
    );
  }

  const canSave = name.trim().length > 0 && !!point && tees.length > 0;

  function save() {
    if (!point || !canSave) return;
    const course = addCourse({
      name: name.trim(),
      location: location.trim() || 'Unknown',
      holeCount,
      par,
      tees,
      centre: point,
      description: 'Added locally.',
      holes: generateHoles(point, holeCount, par, tees),
      approximateCoords: true,
    });
    nav(`/setup/${course.id}`);
  }

  return (
    <Screen title="ADD COURSE" back="/courses">
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
          <Field label="TEE SETS">
            <div className="seg">
              {TEE_OPTIONS.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`seg__opt ${tees.includes(t) ? 'seg__opt--on' : ''}`}
                  onClick={() =>
                    setTees((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]))
                  }
                >
                  {t.toUpperCase()}
                </button>
              ))}
            </div>
          </Field>
        </div>
      </Panel>

      <Panel title="MAP LOCATION" className="stack">
        <div style={{ height: 200, border: '1px solid var(--cyan-dim)' }}>
          <SatelliteMap
            centre={point ?? DEFAULT_CENTRE}
            zoom={15}
            onReady={(m) => {
              mapRef.current = m;
            }}
            onMapClick={(p) => {
              setPicking(true);
              placeMarker(p);
            }}
          />
        </div>
        <p className="muted" style={{ marginTop: 8 }}>
          {point
            ? `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`
            : picking
              ? 'Tap the map to drop the course pin.'
              : 'No location selected.'}
        </p>
      </Panel>

      <div className="stack">
        <Button onClick={useMyLocation}>SELECT LOCATION ON MAP</Button>
        <Button variant="primary" disabled={!canSave} onClick={save}>
          SAVE COURSE
        </Button>
      </div>
    </Screen>
  );
}
