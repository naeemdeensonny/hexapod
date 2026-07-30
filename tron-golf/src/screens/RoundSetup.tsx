import { useNavigate, useParams } from 'react-router-dom';
import Screen from '../components/Screen';
import { Button, KV, MarqueeText, Panel } from '../components/ui';
import { SINGLE_TEE } from '../state/seed';
import { startRound, useStore } from '../state/store';

export default function RoundSetup() {
  const { courseId } = useParams();
  const nav = useNavigate();
  const { courses } = useStore();
  const course = courses.find((c) => c.id === courseId);

  if (!course) {
    return (
      <Screen title="ROUND SETUP" back="/courses">
        <div className="empty">COURSE NOT FOUND</div>
      </Screen>
    );
  }

  // One tee set, no handicap prompt: both were choices with a single sensible
  // answer, so the setup screen is now just a confirmation of what you picked.
  const tee = course.tees[0] ?? SINGLE_TEE;

  function begin() {
    if (!course) return;
    startRound(course.id, tee, false);
    nav('/hole');
  }

  return (
    <Screen title="ROUND SETUP" back="/courses">
      <Panel title="ROUND">
        <div className="kv">
          <span className="kv__k">COURSE</span>
          <span className="kv__v" style={{ minWidth: 0, flex: 1, textAlign: 'right' }}>
            <MarqueeText text={course.name} />
          </span>
        </div>
        <KV k="HOLES" v={course.holeCount} />
        <KV k="PAR" v={course.par} />
        <KV k="FORMAT" v="Stroke Play" />
      </Panel>

      <Button variant="primary" style={{ marginTop: 'auto' }} onClick={begin}>
        START HOLE 1
      </Button>
    </Screen>
  );
}
