import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Screen from '../components/Screen';
import { Button, MarqueeText } from '../components/ui';
import { courseById, deleteRound, fmtToPar, roundTotals, toParColor, useStore } from '../state/store';

export default function History() {
  const nav = useNavigate();
  const { rounds } = useStore();
  // The delete target sits directly beside the row you tap to open a round, so
  // one press only arms it — a second, deliberate press does the deleting.
  const [armed, setArmed] = useState<string | null>(null);

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(null), 4000);
    return () => clearTimeout(t);
  }, [armed]);

  function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (armed !== id) {
      setArmed(id);
      return;
    }
    setArmed(null);
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
                  <MarqueeText className="card__name" text={r.courseName} />
                  <span className="card__meta">
                    {new Date(r.completedAt ?? r.startedAt).toLocaleDateString(undefined, {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}{' '}
                    · {r.holeCount} holes
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
                className={armed === r.id ? 'btn--armed' : ''}
                style={{
                  flexShrink: 0,
                  width: armed === r.id ? 92 : 44,
                  background: armed === r.id ? 'var(--red)' : 'var(--panel-sunk)',
                  border: '1px solid var(--red)',
                  borderLeft: 'none',
                  color: armed === r.id ? '#180205' : 'var(--red)',
                  fontFamily: 'var(--font-pixel)',
                  fontSize: armed === r.id ? 7 : 10,
                  cursor: 'pointer',
                  transition: 'width 0.12s ease',
                }}
                aria-label={armed === r.id ? 'Confirm delete round' : 'Delete round'}
              >
                {armed === r.id ? 'SURE?' : '✕'}
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
