import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Screen from '../components/Screen';
import { Button, KV, Panel } from '../components/ui';
import SatelliteMap from '../map/SatelliteMap';
import { previewTileUrl } from '../map/provider';
import { fmtDist } from '../state/geo';
import { useStore } from '../state/store';
import type { Course } from '../state/types';

function totalMetres(c: Course, tee: string): number {
  return c.holes.reduce((t, h) => t + (h.distances[tee] ?? h.distances.Blue ?? 0), 0);
}

function fmtDate(iso?: string): string {
  if (!iso) return 'Not played';
  return new Date(iso).toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function Courses() {
  const nav = useNavigate();
  const { courses, settings } = useStore();
  const [selected, setSelected] = useState<Course | null>(null);

  // Mobile layout: a list, then a stacked detail sheet for the chosen course.
  if (selected) {
    const tee = selected.tees.includes(settings.defaultTee) ? settings.defaultTee : selected.tees[0];
    return (
      <Screen title="COURSE" subtitle={`${selected.holeCount} holes`} back="/courses">
        <div style={{ height: 160, border: '1px solid var(--cyan-dim)' }}>
          <SatelliteMap centre={selected.centre} zoom={15} />
        </div>

        <Panel title={selected.name.toUpperCase()}>
          <KV k="HOLES" v={selected.holeCount} />
          <KV k="PAR" v={selected.par} />
          <KV k="TOTAL" v={fmtDist(totalMetres(selected, tee), settings.units)} />
          <KV k="LOCATION" v={selected.location} />
          <KV k="LAST PLAYED" v={fmtDate(selected.lastPlayed)} />
        </Panel>

        <p className="muted">{selected.description}</p>
        {selected.approximateCoords && (
          <p className="muted" style={{ color: 'var(--text-faint)', fontSize: 11 }}>
            Hole reference points are approximate and can be re-pinned per hole.
          </p>
        )}

        <div className="stack" style={{ marginTop: 'auto' }}>
          <Button variant="primary" onClick={() => nav(`/setup/${selected.id}`)}>
            SELECT COURSE
          </Button>
          <Button variant="ghost" onClick={() => setSelected(null)}>
            BACK TO LIST
          </Button>
        </div>
      </Screen>
    );
  }

  return (
    <Screen title="COURSES" subtitle={`${courses.length}`}>
      {courses.length === 0 && <div className="empty">NO COURSES SAVED</div>}

      <div className="stack">
        {courses.map((c) => (
          <button key={c.id} className="card" onClick={() => setSelected(c)}>
            <img
              className="card__thumb"
              src={previewTileUrl(c.centre)}
              alt=""
              loading="lazy"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
              }}
            />
            <span className="card__main">
              <span className="card__name">{c.name}</span>
              <span className="card__meta">
                {c.holeCount} holes · Par {c.par}
              </span>
              <span className="card__meta" style={{ color: 'var(--text-faint)' }}>
                {fmtDate(c.lastPlayed)}
              </span>
            </span>
            <span className="card__arrow">{'>'}</span>
          </button>
        ))}
      </div>

      <Button style={{ marginTop: 'auto' }} onClick={() => nav('/courses/add')}>
        ADD COURSE
      </Button>
    </Screen>
  );
}
