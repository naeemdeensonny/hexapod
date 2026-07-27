import { useNavigate } from 'react-router-dom';
import Screen from '../components/Screen';
import { Button } from '../components/ui';
import { courseById, fmtToPar, roundTotals, toParColor, useStore } from '../state/store';

export default function History() {
  const nav = useNavigate();
  const { rounds } = useStore();

  return (
    <Screen title="ROUND HISTORY" subtitle={`${rounds.length}`}>
      {rounds.length === 0 && (
        <div className="empty">
          NO SAVED ROUNDS
          <br />
          COMPLETE A ROUND TO SEE IT HERE
        </div>
      )}

      <div className="stack">
        {rounds.map((r) => {
          const t = roundTotals(r, courseById(r.courseId));
          return (
            <button key={r.id} className="card" onClick={() => nav(`/history/${r.id}`)}>
              <span className="card__main">
                <span className="card__name">{r.courseName}</span>
                <span className="card__meta">
                  {new Date(r.completedAt ?? r.startedAt).toLocaleDateString(undefined, {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}{' '}
                  · {r.tee} Tee
                </span>
              </span>
              <span className="card__main" style={{ flex: '0 0 auto', alignItems: 'flex-end' }}>
                <span className="t-num">{t.gross || '-'}</span>
                <span className="card__meta" style={{ color: toParColor(t.toPar) }}>
                  {fmtToPar(t.toPar)}
                </span>
              </span>
              <span className="card__arrow">{'>'}</span>
            </button>
          );
        })}
      </div>

      {rounds.length > 0 && (
        <Button variant="ghost" size="sm" style={{ marginTop: 'auto' }} onClick={() => nav('/')}>
          HOME
        </Button>
      )}
    </Screen>
  );
}
