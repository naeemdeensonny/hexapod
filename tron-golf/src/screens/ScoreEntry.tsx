import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Screen from '../components/Screen';
import { Button, Panel, Segmented, Stepper } from '../components/ui';
import {
  courseById,
  saveHoleScore,
  scoreName,
  setCurrentHole,
  toParColor,
  useStore,
} from '../state/store';
import type { Fairway } from '../state/types';

export default function ScoreEntry() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const { activeRound } = useStore();

  const paramHole = Number(params.get('hole'));
  const holeNo = paramHole || activeRound?.currentHole || 1;

  const course = activeRound ? courseById(activeRound.courseId) : undefined;
  const hole = course?.holes.find((h) => h.number === holeNo);
  const par = hole?.par ?? 4;
  const existing = activeRound?.scores[holeNo];

  const [strokes, setStrokes] = useState(existing?.strokes ?? par);
  const [putts, setPutts] = useState(existing?.putts ?? 2);
  const [penalties, setPenalties] = useState(existing?.penalties ?? 0);
  const [fairway, setFairway] = useState<Fairway>(existing?.fairway ?? null);

  // Re-seed the controls whenever the hole being edited changes.
  useEffect(() => {
    const s = activeRound?.scores[holeNo];
    setStrokes(s?.strokes ?? par);
    setPutts(s?.putts ?? 2);
    setPenalties(s?.penalties ?? 0);
    setFairway(s?.fairway ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holeNo]);

  if (!activeRound) {
    return (
      <Screen title="SCORE" back="/">
        <div className="empty">NO ACTIVE ROUND</div>
      </Screen>
    );
  }

  const last = holeNo >= activeRound.holeCount;

  function saveAndNext() {
    if (!activeRound) return;
    // Persisted synchronously to localStorage before navigating on.
    saveHoleScore({ hole: holeNo, strokes, putts, penalties, fairway });
    if (last) {
      nav('/complete');
    } else {
      setCurrentHole(holeNo + 1);
      nav('/hole');
    }
  }

  return (
    <Screen title="SCORE ENTRY" subtitle={`Hole ${holeNo}`} back="/hole">
      <Panel sunk>
        <div className="center stack" style={{ gap: 2 }}>
          <div className="t-pixel" style={{ fontSize: 10 }}>
            {activeRound.courseName}
          </div>
          <div className="muted">
            Hole {holeNo} · Par {par}
          </div>
        </div>
      </Panel>

      <Panel title="STROKES">
        <Stepper value={strokes} onChange={setStrokes} min={1} max={20} />
        <p
          className="center t-pixel"
          style={{ fontSize: 10, marginTop: 10, color: toParColor(strokes - par) }}
        >
          {scoreName(strokes, par).toUpperCase()}
        </p>
      </Panel>

      <Panel title="DETAIL">
        <div className="kv" style={{ alignItems: 'center' }}>
          <span className="kv__k">PUTTS</span>
          <div style={{ width: 150 }}>
            <Stepper value={putts} onChange={setPutts} min={0} max={10} compact />
          </div>
        </div>
        <div className="kv" style={{ alignItems: 'center' }}>
          <span className="kv__k">PENALTY</span>
          <div style={{ width: 150 }}>
            <Stepper value={penalties} onChange={setPenalties} min={0} max={9} compact />
          </div>
        </div>
        <div className="stack" style={{ marginTop: 10 }}>
          <span className="kv__k">FAIRWAY</span>
          <Segmented<Exclude<Fairway, null>>
            value={fairway}
            onChange={(v) => setFairway(v === fairway ? null : v)}
            options={[
              { value: 'L', label: 'LEFT' },
              { value: 'H', label: 'HIT' },
              { value: 'R', label: 'RIGHT' },
            ]}
          />
        </div>
      </Panel>

      <Button variant="primary" style={{ marginTop: 'auto' }} onClick={saveAndNext}>
        {last ? 'SAVE & FINISH' : 'SAVE & NEXT'}
      </Button>
    </Screen>
  );
}
