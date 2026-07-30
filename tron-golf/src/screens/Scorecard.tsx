import { useNavigate, useParams } from 'react-router-dom';
import Screen from '../components/Screen';
import { Button, KV, Panel } from '../components/ui';
import { courseById, fmtToPar, roundTotals, toParColor, useStore } from '../state/store';
import type { Course, Round } from '../state/types';

function Nine({
  round,
  course,
  from,
  to,
  label,
  editable,
  onEdit,
}: {
  round: Round;
  course?: Course;
  from: number;
  to: number;
  label: string;
  editable: boolean;
  onEdit: (hole: number) => void;
}) {
  const holes = [];
  let par = 0;
  let score = 0;
  for (let n = from; n <= to; n++) {
    const h = course?.holes.find((x) => x.number === n);
    const s = round.scores[n];
    par += h?.par ?? 4;
    if (s) score += s.strokes;
    holes.push({ n, par: h?.par ?? 4, s });
  }

  return (
    <table className="tbl">
      <thead>
        <tr>
          <th style={{ width: '25%' }}>HOLE</th>
          <th style={{ width: '25%' }}>PAR</th>
          <th style={{ width: '25%' }}>SCORE</th>
          <th style={{ width: '25%' }}>+/-</th>
        </tr>
      </thead>
      <tbody>
        {holes.map(({ n, par: p, s }) => {
          const diff = s ? s.strokes - p : null;
          return (
            <tr
              key={n}
              onClick={() => editable && onEdit(n)}
              style={{ cursor: editable ? 'pointer' : 'default' }}
            >
              <td>{n}</td>
              <td className="t-dim">{p}</td>
              <td style={{ color: s ? 'var(--text)' : 'var(--text-faint)' }}>
                {s ? s.strokes : '-'}
              </td>
              <td style={{ color: diff == null ? 'var(--text-faint)' : toParColor(diff) }}>
                {diff == null ? '-' : fmtToPar(diff)}
              </td>
            </tr>
          );
        })}
        <tr className="row-total">
          <td>{label}</td>
          <td>{par}</td>
          <td>{score || '-'}</td>
          <td style={{ color: score ? toParColor(score - par) : 'var(--cyan)' }}>
            {score ? fmtToPar(score - par) : '-'}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

export default function Scorecard() {
  const nav = useNavigate();
  const { roundId } = useParams();
  const { activeRound, rounds } = useStore();

  const round = roundId ? rounds.find((r) => r.id === roundId) : activeRound;
  const editable = !roundId && !!activeRound;

  if (!round) {
    return (
      <Screen title="SCORECARD" back={roundId ? '/history' : undefined}>
        <div className="empty">
          NO ACTIVE ROUND
          <br />
          START A ROUND TO SCORE
        </div>
        <Button variant="primary" onClick={() => nav('/courses')}>
          START ROUND
        </Button>
      </Screen>
    );
  }

  const course = courseById(round.courseId);
  const t = roundTotals(round, course);
  const hasBack = round.holeCount > 9;

  return (
    <Screen
      title="SCORECARD"
      subtitle={`${t.played}/${round.holeCount}`}
      back={roundId ? '/history' : undefined}
    >
      <Panel sunk>
        <div className="center stack" style={{ gap: 2 }}>
          <div className="t-pixel" style={{ fontSize: 10 }}>
            {round.courseName}
          </div>
          <div className="muted">
            {round.holeCount} Holes · {round.format}
          </div>
        </div>
      </Panel>

      <Panel title="FRONT NINE">
        <Nine
          round={round}
          course={course}
          from={1}
          to={Math.min(9, round.holeCount)}
          label="OUT"
          editable={editable}
          onEdit={(h) => nav(`/score?hole=${h}`)}
        />
      </Panel>

      {hasBack && (
        <Panel title="BACK NINE">
          <Nine
            round={round}
            course={course}
            from={10}
            to={round.holeCount}
            label="IN"
            editable={editable}
            onEdit={(h) => nav(`/score?hole=${h}`)}
          />
        </Panel>
      )}

      <Panel title="TOTALS">
        <KV k="FRONT 9" v={t.front || '-'} />
        {hasBack && <KV k="BACK 9" v={t.back || '-'} />}
        <KV k="GROSS" v={t.gross || '-'} />
        <KV k="TO PAR" v={fmtToPar(t.toPar)} color={toParColor(t.toPar)} />
      </Panel>

      {editable && (
        <div className="stack" style={{ marginTop: 'auto' }}>
          <p className="muted center" style={{ fontSize: 11 }}>
            Tap any hole row to edit its score.
          </p>
          <Button variant="primary" onClick={() => nav('/complete')}>
            FINISH ROUND
          </Button>
        </div>
      )}
    </Screen>
  );
}
