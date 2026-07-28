import { useEffect, useRef, useState } from 'react';
import { HashRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import Menu from './screens/Menu';
import Courses from './screens/Courses';
import AddCourse from './screens/AddCourse';
import EditCourse from './screens/EditCourse';
import HoleEditor from './screens/HoleEditor';
import RoundSetup from './screens/RoundSetup';
import HoleSelect from './screens/HoleSelect';
import PlayMap from './screens/PlayMap';
import ScoreEntry from './screens/ScoreEntry';
import Scorecard from './screens/Scorecard';
import RoundComplete from './screens/RoundComplete';
import History from './screens/History';
import Settings from './screens/Settings';
import { discardRound, getState, useStore } from './state/store';

/** Holds the screen awake during a round when the setting is on. */
function useWakeLock(enabled: boolean) {
  const lock = useRef<WakeLockSentinel | null>(null);
  useEffect(() => {
    let cancelled = false;
    async function acquire() {
      try {
        if (!enabled || !('wakeLock' in navigator)) return;
        lock.current = await navigator.wakeLock.request('screen');
      } catch {
        /* denied or unsupported: nothing to do */
      }
    }
    if (enabled) acquire();
    const onVisible = () => {
      if (enabled && document.visibilityState === 'visible' && !cancelled) acquire();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      lock.current?.release().catch(() => {});
      lock.current = null;
    };
  }, [enabled]);
}

/**
 * Cold-start prompt: an unfinished round found in local storage is offered
 * back to the user before anything else happens.
 */
function ResumePrompt() {
  const nav = useNavigate();
  // Captured once at mount so the prompt reflects the state we booted with.
  const [pending, setPending] = useState(() => getState().activeRound);
  if (!pending) return null;

  return (
    <div className="overlay">
      <div className="overlay__box">
        <h2 className="panel__title">ROUND IN PROGRESS</h2>
        <p className="muted" style={{ marginBottom: 16 }}>
          {pending.courseName} · {pending.tee} Tee · hole {pending.currentHole} of{' '}
          {pending.holeCount}
        </p>
        <div className="stack">
          <button
            className="btn btn--primary"
            onClick={() => {
              setPending(null);
              nav('/hole');
            }}
          >
            RESUME ROUND
          </button>
          <button className="btn btn--ghost" onClick={() => setPending(null)}>
            NOT NOW
          </button>
          <button
            className="btn btn--danger btn--sm"
            onClick={() => {
              discardRound();
              setPending(null);
            }}
          >
            DISCARD
          </button>
        </div>
      </div>
    </div>
  );
}

function Shell() {
  const { settings, activeRound } = useStore();
  useWakeLock(settings.keepScreenOn && !!activeRound);

  return (
    <>
      <ResumePrompt />
      <Routes>
        <Route path="/" element={<Menu />} />
        <Route path="/courses" element={<Courses />} />
        <Route path="/courses/add" element={<AddCourse />} />
        <Route path="/courses/edit/:courseId" element={<EditCourse />} />
        <Route path="/courses/edit/:courseId/hole/:holeNo" element={<HoleEditor />} />
        <Route path="/setup/:courseId" element={<RoundSetup />} />
        <Route path="/hole" element={<HoleSelect />} />
        <Route path="/play" element={<PlayMap />} />
        <Route path="/score" element={<ScoreEntry />} />
        <Route path="/scorecard" element={<Scorecard />} />
        <Route path="/complete" element={<RoundComplete />} />
        <Route path="/history" element={<History />} />
        <Route path="/history/:roundId" element={<Scorecard />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <HashRouter>
      <Shell />
    </HashRouter>
  );
}
