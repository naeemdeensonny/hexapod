import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Screen from '../components/Screen';
import { Button, Field, Panel } from '../components/ui';
import GoogleMap, { markerIcon } from '../map/GoogleMap';
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
  const tees = [...TEE_OPTIONS];
  const [point, setPoint] = useState<LatLng | null>(null);

  // Separate text state so partial typing doesn't reset the map marker.
  const [latText, setLatText] = useState('');
  const [lngText, setLngText] = useState('');

  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);

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
        </div>
      </Panel>

      <Panel title="MAP LOCATION">
        <div className="stack">
          <div className="btn-row">
            <Field label="LATITUDE">
              <input
                className="input"
                inputMode="decimal"
                placeholder="3.04250"
                value={latText}
                onChange={(e) => setLatText(e.target.value)}
                onBlur={applyCoordText}
              />
            </Field>
            <Field label="LONGITUDE">
              <input
                className="input"
                inputMode="decimal"
                placeholder="101.63500"
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
              centre={point ?? DEFAULT_CENTRE}
              zoom={15}
              onReady={(m) => { mapRef.current = m; }}
              onMapClick={(p) => placeMarker(p)}
            />
          </div>
          <p className="muted" style={{ fontSize: 11 }}>
            {point
              ? `Pin: ${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`
              : 'Enter coordinates above, tap the map, or use GPS.'}
          </p>
        </div>
      </Panel>

      <div className="stack">
        <Button onClick={useMyLocation}>USE MY GPS LOCATION</Button>
        <Button variant="primary" disabled={!canSave} onClick={save}>
          SAVE COURSE
        </Button>
      </div>
    </Screen>
  );
}
