import { useNavigate } from 'react-router-dom';
import Screen from '../components/Screen';
import { Button } from '../components/ui';
import { courseById, deleteRound, fmtToPar, roundTotals, toParColor, useStore } from '../state/store';

export default function History() {
  const nav = useNavigate();
  const { rounds } = useStore();

  function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (!confirm('Delete this round? This cannot be undone.')) return;
    deleteRound(id);
  }

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
            <div key={r.id} style={{ display: 'flex', gap: 0 }}>
              <button
                className="card"
                style={{ flex: 1 }}
                onClick={() => nav(`/history/${r.id}`)}
              >
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

              <button
                onClick={(e) => handleDelete(e, r.id)}
                style={{
                  flexShrink: 0,
                  width: 44,
                  background: 'var(--panel-sunk)',
                  border: '1px solid var(--red)',
                  borderLeft: 'none',
                  color: 'var(--red)',
                  fontFamily: 'var(--font-pixel)',
                  fontSize: 10,
                  cursor: 'pointer',
                }}
                aria-label="Delete round"
              >
                ✕
              </button>
            </div>
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
