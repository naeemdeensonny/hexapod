import { useNavigate } from 'react-router-dom';
import Screen from '../components/Screen';
import MenuScene from '../components/MenuScene';
import { Button } from '../components/ui';
import { discardRound, useStore } from '../state/store';

export default function Menu() {
  const nav = useNavigate();
  const { activeRound } = useStore();

  const played = activeRound ? Object.keys(activeRound.scores).length : 0;

  return (
    <Screen title="TRON GOLF" hideHeader flush>
      <div className="menu-scene">
        <MenuScene />
      </div>

      <div className="menu-body">
        <h1 className="menu-title">TRON GOLF</h1>

        <div className="menu-buttons">
          {activeRound ? (
            <>
              <Button variant="primary" onClick={() => nav('/hole')}>
                RESUME ROUND
              </Button>
              <p className="muted center" style={{ fontSize: 11, margin: '-2px 0 4px' }}>
                {activeRound.courseName} — hole {activeRound.currentHole} ·{' '}
                {played}/{activeRound.holeCount} scored
              </p>
            </>
          ) : (
            <Button variant="primary" onClick={() => nav('/courses')}>
              START ROUND
            </Button>
          )}

          <Button onClick={() => nav('/courses')}>COURSES</Button>
          <Button onClick={() => nav('/scorecard')}>SCORECARD</Button>
          <Button onClick={() => nav('/history')}>ROUND HISTORY</Button>
          <Button onClick={() => nav('/settings')}>SETTINGS</Button>

          {activeRound && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                if (confirm('Discard the round in progress? Scores will be lost.')) discardRound();
              }}
            >
              DISCARD ROUND
            </Button>
          )}
        </div>
      </div>
    </Screen>
  );
}
