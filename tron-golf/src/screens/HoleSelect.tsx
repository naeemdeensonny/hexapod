import { useNavigate } from 'react-router-dom';
import Screen from '../components/Screen';
import { Button, KV, Panel } from '../components/ui';
import { fmtDist } from '../state/geo';
import { courseById, setCurrentHole, useStore } from '../state/store';

const pad = (n: number) => String(n).padStart(2, '0');

export default function HoleSelect() {
  const nav = useNavigate();
  const { activeRound, settings } = useStore();

  if (!activeRound) {
    return (
      <Screen title="HOLE" back="/">
        <div className="empty">NO ACTIVE ROUND</div>
        <Button variant="primary" onClick={() => nav('/courses')}>
          START ROUND
        </Button>
      </Screen>
    );
  }

  const course = courseById(activeRound.courseId);
  const n = activeRound.currentHole;
  const max = activeRound.holeCount;
  const hole = course?.holes.find((h) => h.number === n);
  const dist = hole?.distances[activeRound.tee];

  return (
    <Screen title="SELECT HOLE" subtitle={`${n}/${max}`} back="/">
      <Panel sunk>
        <div className="center stack" style={{ gap: 2 }}>
          <div className="t-pixel" style={{ fontSize: 10 }}>
            {activeRound.courseName}
          </div>
          <div className="muted">
            {activeRound.tee} Tee · {max} Holes
          </div>
        </div>
      </Panel>

      <div className="holesel">
        <div className="holesel__ghost">{n > 1 ? pad(n - 1) : '--'}</div>
        <button
          className="holesel__arrow holesel__arrow--l"
          aria-label="Previous hole"
          disabled={n <= 1}
          onClick={() => setCurrentHole(n - 1)}
        >
          {'<'}
        </button>
        <div className="holesel__now">{pad(n)}</div>
        <button
          className="holesel__arrow holesel__arrow--r"
          aria-label="Next hole"
          disabled={n >= max}
          onClick={() => setCurrentHole(n + 1)}
        >
          {'>'}
        </button>
        <div className="holesel__ghost">{n < max ? pad(n + 1) : '--'}</div>
      </div>

      <Panel>
        <KV k="PAR" v={hole?.par ?? '--'} />
        <KV k="DISTANCE" v={fmtDist(dist, settings.units)} />
        <KV k="INDEX" v={hole?.index ?? '--'} />
        {activeRound.scores[n] && (
          <KV k="SCORED" v={`${activeRound.scores[n].strokes} strokes`} color="var(--green)" />
        )}
      </Panel>

      <div className="stack" style={{ marginTop: 'auto' }}>
        <Button variant="primary" onClick={() => nav('/play')}>
          CONFIRM HOLE
        </Button>
        <div className="btn-row">
          <Button variant="ghost" size="sm" onClick={() => nav('/score')}>
            SCORE
          </Button>
          <Button variant="ghost" size="sm" onClick={() => nav('/complete')}>
            FINISH ROUND
          </Button>
        </div>
      </div>
    </Screen>
  );
}
