import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Screen from '../components/Screen';
import { Button, Field, Panel, Segmented, Stepper } from '../components/ui';
import GoogleMap, { markerIcon } from '../map/GoogleMap';
import { bearing, distanceM, fmtDist } from '../state/geo';
import { courseById, updateHole, useStore } from '../state/store';
import type { Course, Hole, LatLng } from '../state/types';

type Mode = 'tee' | 'green';

export default function HoleEditor() {
  const { courseId, holeNo } = useParams<{ courseId: string; holeNo: string }>();
  const course = courseId ? courseById(courseId) : undefined;
  const n = Number(holeNo);
  const hole = course?.holes.find((h) => h.number === n);

  if (!course || !hole) {
    return (
      <Screen title="HOLE" back={courseId ? `/courses/edit/${courseId}` : '/courses'}>
        <p className="muted">Hole not found.</p>
      </Screen>
    );
  }

  return <HoleEditorInner key={`${course.id}-${hole.number}`} course={course} hole={hole} />;
}

function CoordRow({
  label,
  point,
  active,
  onActivate,
  onApply,
}: {
  label: string;
  point: LatLng | null;
  active: boolean;
  onActivate: () => void;
  onApply: (p: LatLng) => void;
}) {
  const [lat, setLat] = useState(point?.lat.toFixed(6) ?? '');
  const [lng, setLng] = useState(point?.lng.toFixed(6) ?? '');

  useEffect(() => {
    setLat(point?.lat.toFixed(6) ?? '');
    setLng(point?.lng.toFixed(6) ?? '');
  }, [point?.lat, point?.lng]);

  function apply() {
    const la = parseFloat(lat);
    const ln = parseFloat(lng);
    if (!Number.isFinite(la) || !Number.isFinite(ln)) return;
    if (la < -90 || la > 90 || ln < -180 || ln > 180) return;
    onApply({ lat: la, lng: ln });
  }

  return (
    <div
      style={{
        border: `1px solid ${active ? 'var(--cyan)' : 'var(--cyan-dim)'}`,
        borderRadius: 4,
        padding: '10px 10px 8px',
        background: active ? 'rgba(53,224,255,0.05)' : 'transparent',
      }}
    >
      <div
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 8,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-pixel)', fontSize: 9,
            color: active ? 'var(--cyan)' : 'var(--text-dim)',
          }}
        >
          {label}
        </span>
        {!active && (
          <button
            type="button"
            onClick={onActivate}
            style={{
              fontFamily: 'var(--font-pixel)', fontSize: 8,
              color: 'var(--cyan)', background: 'transparent',
              border: '1px solid var(--cyan-dim)', padding: '3px 8px', cursor: 'pointer',
            }}
          >
            TAP TO EDIT
          </button>
        )}
        {active && (
          <span style={{ fontFamily: 'var(--font-pixel)', fontSize: 8, color: 'var(--cyan)' }}>
            ACTIVE — tap map or enter below
          </span>
        )}
      </div>
      <div className="btn-row">
        <Field label="LAT">
          <input
            className="input"
            inputMode="decimal"
            value={lat}
            onFocus={onActivate}
            onChange={(e) => setLat(e.target.value)}
            onBlur={apply}
          />
        </Field>
        <Field label="LNG">
          <input
            className="input"
            inputMode="decimal"
            value={lng}
            onFocus={onActivate}
            onChange={(e) => setLng(e.target.value)}
            onBlur={apply}
          />
        </Field>
      </div>
      {point && (
        <p style={{ fontSize: 10, color: 'var(--text-faint)', margin: '4px 0 0', fontFamily: 'var(--font-mono)' }}>
          {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
        </p>
      )}
    </div>
  );
}

function HoleEditorInner({ course, hole }: { course: Course; hole: Hole }) {
  const nav = useNavigate();
  const { settings } = useStore();

  const [mode, setMode] = useState<Mode>('tee');
  const [tee, setTee] = useState<LatLng | null>(hole.tee ?? null);
  const [greenC, setGreenC] = useState<LatLng | null>(hole.greenCentre ?? null);
  const [par, setPar] = useState(hole.par);
  const [index, setIndex] = useState(hole.index);
  const [saved, setSaved] = useState(false);

  const mapRef = useRef<google.maps.Map | null>(null);
  const teeMarker = useRef<google.maps.Marker | null>(null);
  const greenMarker = useRef<google.maps.Marker | null>(null);
  const greenRing = useRef<google.maps.Circle | null>(null);
  const lineRef = useRef<google.maps.Polyline | null>(null);
  const modeRef = useRef<Mode>(mode);
  modeRef.current = mode;

  const measured = tee && greenC ? distanceM(tee, greenC) : null;

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const upsert = (
      ref: React.MutableRefObject<google.maps.Marker | null>,
      point: LatLng | null,
      kind: 'tee' | 'flag',
      title: string,
      onMove: (p: LatLng) => void,
    ) => {
      if (!point) { ref.current?.setMap(null); ref.current = null; return; }
      if (ref.current) { ref.current.setPosition({ lat: point.lat, lng: point.lng }); return; }
      const m = new google.maps.Marker({
        position: { lat: point.lat, lng: point.lng },
        map, icon: markerIcon(kind, kind === 'tee' ? 'T' : ''), title,
        draggable: true, zIndex: kind === 'tee' ? 20 : 15,
      });
      const sync = () => { const p = m.getPosition(); if (p) onMove({ lat: p.lat(), lng: p.lng() }); };
      m.addListener('drag', sync);
      m.addListener('dragend', sync);
      ref.current = m;
    };

    upsert(teeMarker, tee, 'tee', 'Tee box', setTee);
    upsert(greenMarker, greenC, 'flag', 'Green centre', setGreenC);

    const GREEN_RADIUS = 14;
    if (greenC) {
      if (greenRing.current) {
        greenRing.current.setCenter({ lat: greenC.lat, lng: greenC.lng });
      } else {
        greenRing.current = new google.maps.Circle({
          map, center: { lat: greenC.lat, lng: greenC.lng }, radius: GREEN_RADIUS,
          strokeColor: '#00ff88', strokeWeight: 1, strokeOpacity: 0.9,
          fillColor: '#00ff88', fillOpacity: 0.15, clickable: false, zIndex: 5,
        });
      }
    } else { greenRing.current?.setMap(null); greenRing.current = null; }

    if (tee && greenC) {
      const path = [{ lat: tee.lat, lng: tee.lng }, { lat: greenC.lat, lng: greenC.lng }];
      if (lineRef.current) lineRef.current.setPath(path);
      else lineRef.current = new google.maps.Polyline({
        path, map, strokeColor: 'rgba(255,255,255,0.6)', strokeWeight: 1.5, clickable: false,
      });
    } else { lineRef.current?.setMap(null); lineRef.current = null; }
  }, [tee, greenC]);

  useEffect(() => () => {
    teeMarker.current?.setMap(null);
    greenMarker.current?.setMap(null);
    greenRing.current?.setMap(null);
    lineRef.current?.setMap(null);
  }, []);

  useEffect(() => {
    if (mapRef.current && tee && greenC) mapRef.current.setHeading(bearing(tee, greenC));
  }, [tee, greenC]);

  function onMapReady(map: google.maps.Map) {
    mapRef.current = map;
    const anchor = hole.tee ?? hole.greenCentre ?? course.centre;
    map.setCenter({ lat: anchor.lat, lng: anchor.lng });
    map.setZoom(18);
    if (hole.tee && hole.greenCentre) map.setHeading(bearing(hole.tee, hole.greenCentre));
    setTee((t) => (t ? { ...t } : t));
    setGreenC((g) => (g ? { ...g } : g));
  }

  function onMapClick(p: LatLng) {
    if (modeRef.current === 'tee') setTee(p);
    else setGreenC(p);
  }

  function lockFence() {
    const map = mapRef.current;
    if (!map) return;
    const b = map.getBounds();
    if (!b) return;
    updateHole(course.id, hole.number, {
      fence: {
        north: b.getNorthEast().lat(), south: b.getSouthWest().lat(),
        east: b.getNorthEast().lng(), west: b.getSouthWest().lng(),
      },
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  function save() {
    const dist = measured ? Math.round(measured) : null;
    const distances = dist
      ? Object.fromEntries(course.tees.map((t) => [t, dist]))
      : hole.distances;
    updateHole(course.id, hole.number, {
      par, index, distances,
      tee: tee ?? undefined,
      greenCentre: greenC ?? undefined,
      greenFront: undefined,
      greenBack: undefined,
      coordsSet: !!tee && !!greenC,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  const prev = hole.number > 1 ? hole.number - 1 : null;
  const next = hole.number < course.holeCount ? hole.number + 1 : null;
  const goto = (h: number) => nav(`/courses/edit/${course.id}/hole/${h}`, { replace: true });

  return (
    <Screen
      title={`HOLE ${hole.number}`}
      subtitle={`Par ${par} · ${course.name}`}
      back={`/courses/edit/${course.id}`}
    >
      <div style={{ height: 240, border: '1px solid var(--cyan-dim)', position: 'relative' }}>
        <GoogleMap
          centre={hole.tee ?? hole.greenCentre ?? course.centre}
          zoom={18}
          onReady={onMapReady}
          onMapClick={onMapClick}
        />
        <div
          style={{
            position: 'absolute', top: 8, left: 8, zIndex: 10,
            background: 'rgba(5,10,18,0.85)', border: '1px solid var(--cyan)',
            color: 'var(--cyan)', fontFamily: 'var(--font-pixel)', fontSize: 8,
            padding: '5px 8px', lineHeight: 1.4,
          }}
        >
          PLACING: {mode === 'tee' ? 'TEE BOX' : 'GREEN CENTRE'}
        </div>
        {measured && (
          <div
            style={{
              position: 'absolute', bottom: 8, left: 8, zIndex: 10,
              background: 'rgba(5,10,18,0.85)', border: '1px solid var(--cyan-dim)',
              color: 'var(--text-dim)', fontFamily: 'var(--font-pixel)', fontSize: 8,
              padding: '5px 7px', lineHeight: 1.4,
            }}
          >
            {fmtDist(measured, settings.units)}
          </div>
        )}
      </div>

      <Panel title="PIN POINTS">
        <div className="stack">
          <Segmented<Mode>
            value={mode}
            onChange={setMode}
            options={[
              { value: 'tee', label: '▸ TEE BOX' },
              { value: 'green', label: '▸ GREEN CENTRE' },
            ]}
          />
          <p className="muted" style={{ fontSize: 10, color: 'var(--text-faint)' }}>
            Select which pin map taps move, then tap the satellite image.
          </p>

          <CoordRow
            label="TEE BOX"
            point={tee}
            active={mode === 'tee'}
            onActivate={() => setMode('tee')}
            onApply={(p) => { setTee(p); mapRef.current?.setCenter(p); }}
          />

          <CoordRow
            label="GREEN CENTRE"
            point={greenC}
            active={mode === 'green'}
            onActivate={() => setMode('green')}
            onApply={(p) => { setGreenC(p); mapRef.current?.setCenter(p); }}
          />
        </div>
      </Panel>

      <Panel title="HOLE DATA">
        <div className="stack">
          <div className="btn-row">
            <Field label="PAR">
              <Stepper value={par} onChange={setPar} min={3} max={6} />
            </Field>
            <Field label="STROKE INDEX">
              <Stepper value={index} onChange={setIndex} min={1} max={course.holeCount} />
            </Field>
          </div>
          {measured && (
            <p className="muted" style={{ fontSize: 10, color: 'var(--text-faint)' }}>
              Distance {fmtDist(measured, settings.units)} — saved automatically from the map.
            </p>
          )}
        </div>
      </Panel>

      <div className="stack">
        <div className="btn-row">
          <Button size="sm" disabled={!prev} onClick={() => prev && goto(prev)}>{'‹ PREV'}</Button>
          <Button size="sm" variant="ghost" onClick={lockFence}>LOCK FENCE</Button>
          <Button size="sm" disabled={!next} onClick={() => next && goto(next)}>{'NEXT ›'}</Button>
        </div>
        <Button
          variant="primary"
          onClick={save}
          style={saved ? { color: 'var(--green)' } : undefined}
        >
          {saved ? 'SAVED ✓' : 'SAVE HOLE'}
        </Button>
      </div>
    </Screen>
  );
}
