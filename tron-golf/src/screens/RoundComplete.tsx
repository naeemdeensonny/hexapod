import { useNavigate } from 'react-router-dom';
import Screen from '../components/Screen';
import { Button, KV, Panel } from '../components/ui';
import {
  completeRound,
  courseById,
  fmtToPar,
  roundTotals,
  toParColor,
  useStore,
} from '../state/store';

export default function RoundComplete() {
  const nav = useNavigate();
  const { activeRound } = useStore();

  if (!activeRound) {
    return (
      <Screen title="ROUND" back="/">
        <div className="empty">NO ACTIVE ROUND</div>
        <Button variant="primary" onClick={() => nav('/history')}>
          ROUND HISTORY
        </Button>
      </Screen>
    );
  }

  const course = courseById(activeRound.courseId);
  const t = roundTotals(activeRound, course);
  const complete = t.missing.length === 0;

  function save() {
    const finished = completeRound();
    nav(finished ? `/history/${finished.id}` : '/history');
  }

  return (
    <Screen title="ROUND COMPLETE" back="/scorecard">
      <Panel sunk>
        <div className="center stack" style={{ gap: 2 }}>
          <div className="t-pixel" style={{ fontSize: 10 }}>
            {activeRound.courseName}
          </div>
          <div className="muted">
            {activeRound.tee} Tee · {activeRound.holeCount} Holes
          </div>
        </div>
      </Panel>

      <Panel title="RESULT">
        <KV k="FRONT 9" v={t.front || '-'} />
        {activeRound.holeCount > 9 && <KV k="BACK 9" v={t.back || '-'} />}
        <KV k="TOTAL" v={t.gross || '-'} />
        <KV k="TO PAR" v={fmtToPar(t.toPar)} color={toParColor(t.toPar)} />
        <KV k="COURSE PAR" v={t.par} />
      </Panel>

      {complete ? (
        <Panel>
          <div className="t-pixel center" style={{ fontSize: 10, color: 'var(--green)' }}>
            <span className="dot" style={{ background: 'var(--green)' }} />
            ALL HOLES COMPLETED
          </div>
        </Panel>
      ) : (
        <Panel>
          <div className="t-pixel" style={{ fontSize: 9, color: 'var(--red)', marginBottom: 8 }}>
            {t.missing.length} HOLE{t.missing.length > 1 ? 'S' : ''} NOT SCORED
          </div>
          <p className="muted" style={{ color: 'var(--red)' }}>
            Missing: {t.missing.join(', ')}
          </p>
          <p className="muted" style={{ fontSize: 11, color: 'var(--text-faint)' }}>
            You can still save — unscored holes are stored as blank.
          </p>
        </Panel>
      )}

      <div className="stack" style={{ marginTop: 'auto' }}>
        <Button variant="primary" onClick={save}>
          SAVE ROUND
        </Button>
        <Button variant="ghost" onClick={() => nav('/scorecard')}>
          VIEW SCORECARD
        </Button>
      </div>
    </Screen>
  );
}
