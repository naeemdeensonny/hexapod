import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Screen from '../components/Screen';
import { Button, KV, Panel, Segmented, Toggle } from '../components/ui';
import { startRound, useStore } from '../state/store';

export default function RoundSetup() {
  const { courseId } = useParams();
  const nav = useNavigate();
  const { courses, settings } = useStore();
  const course = courses.find((c) => c.id === courseId);

  const [tee, setTee] = useState(
    course?.tees.includes(settings.defaultTee) ? settings.defaultTee : (course?.tees[0] ?? 'Blue'),
  );
  const [handicapOn, setHandicapOn] = useState(false);

  if (!course) {
    return (
      <Screen title="ROUND SETUP" back="/courses">
        <div className="empty">COURSE NOT FOUND</div>
      </Screen>
    );
  }

  function begin() {
    if (!course) return;
    startRound(course.id, tee, handicapOn);
    nav('/hole');
  }

  return (
    <Screen title="ROUND SETUP" back="/courses">
      <Panel title="ROUND">
        <KV k="COURSE" v={course.name} />
        <KV k="TEE SET" v={`${tee} Tee`} color="var(--cyan)" />
        <KV k="HOLES" v={course.holeCount} />
        <KV k="FORMAT" v="Stroke Play" />
        <KV k="HANDICAP" v={handicapOn ? 'On' : 'Off'} />
      </Panel>

      <Panel title="TEE SET">
        <Segmented
          value={tee}
          onChange={setTee}
          options={course.tees.map((t) => ({ value: t, label: `${t.toUpperCase()} TEE` }))}
        />
      </Panel>

      <Panel title="OPTIONS">
        <div className="kv" style={{ alignItems: 'center', minHeight: 46 }}>
          <span className="kv__k">HANDICAP</span>
          <Toggle on={handicapOn} onChange={setHandicapOn} />
        </div>
        <p className="muted" style={{ fontSize: 11, color: 'var(--text-faint)' }}>
          V1 records gross strokes only. Handicap allowances are not applied yet.
        </p>
      </Panel>

      <Button variant="primary" style={{ marginTop: 'auto' }} onClick={begin}>
        START HOLE 1
      </Button>
    </Screen>
  );
}
