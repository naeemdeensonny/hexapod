import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Screen from '../components/Screen';
import { Button, Panel } from '../components/ui';
import { discardRound, useStore } from '../state/store';

function useOnline() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

export default function Menu() {
  const nav = useNavigate();
  const { activeRound } = useStore();
  const online = useOnline();

  const played = activeRound ? Object.keys(activeRound.scores).length : 0;

  return (
    <Screen title="TRON GOLF">
      <Panel sunk>
        <div className="stack" style={{ gap: 6 }}>
          <div className="t-pixel" style={{ fontSize: 11, color: activeRound ? 'var(--amber)' : 'var(--green)' }}>
            <span
              className="dot"
              style={{ background: activeRound ? 'var(--amber)' : 'var(--green)' }}
            />
            {activeRound ? 'ROUND IN PROGRESS' : 'READY TO PLAY'}
          </div>
          <div className="muted">
            {activeRound
              ? `${activeRound.courseName} — hole ${activeRound.currentHole} · ${played}/${activeRound.holeCount} scored`
              : 'No active round'}
          </div>
          <div className="muted">
            <span
              className="dot"
              style={{ background: online ? 'var(--cyan)' : 'var(--text-faint)' }}
            />
            {online ? 'ONLINE' : 'OFFLINE'} · local storage active
          </div>
        </div>
      </Panel>

      {activeRound && (
        <div className="stack">
          <Button variant="primary" onClick={() => nav('/hole')}>
            RESUME ROUND
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              if (confirm('Discard the round in progress? Scores will be lost.')) discardRound();
            }}
          >
            DISCARD ROUND
          </Button>
        </div>
      )}

      <div className="stack">
        {!activeRound && (
          <Button variant="primary" onClick={() => nav('/courses')}>
            START ROUND
          </Button>
        )}
        <Button onClick={() => nav('/courses')}>COURSES</Button>
        <Button onClick={() => nav('/scorecard')}>SCORECARD</Button>
        <Button onClick={() => nav('/history')}>ROUND HISTORY</Button>
        <Button onClick={() => nav('/settings')}>SETTINGS</Button>
      </div>

      <p className="muted center" style={{ fontSize: 11, marginTop: 'auto' }}>
        V1 · OFFLINE-FIRST · SATELLITE MAP
      </p>
    </Screen>
  );
}
