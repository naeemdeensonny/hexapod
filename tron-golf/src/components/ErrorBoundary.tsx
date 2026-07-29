import { Component, type ErrorInfo, type ReactNode } from 'react';
import { clearAllStorage, readRawBackup } from '../state/persist';

/**
 * Last line of defence against a blank screen.
 *
 * In a browser a render crash is an annoyance — you open devtools. Inside the
 * Capacitor WebView there are no devtools and no address bar, so an unhandled
 * error leaves a black rectangle and no way out but reinstalling, which throws
 * away the user's hand-placed course.
 *
 * So this screen does three things, in order of how much the user stands to
 * lose: rescue the data first, then try to recover the session, and only offer
 * the destructive reset last.
 */
type Props = { children: ReactNode };
type State = { error: Error | null; copied: 'idle' | 'ok' | 'fail' };

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, copied: 'idle' };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Kept for remote debugging over chrome://inspect, which is the only
    // diagnostic channel available once the app is on a phone.
    console.error('TRON Golf crashed:', error, info.componentStack);
  }

  /** Pull the raw persisted text straight from storage, bypassing the store. */
  private rescue = async () => {
    const raw = readRawBackup();
    if (!raw) {
      this.setState({ copied: 'fail' });
      return;
    }
    try {
      await navigator.clipboard.writeText(raw);
      this.setState({ copied: 'ok' });
    } catch {
      window.prompt('Copy your data and keep it somewhere safe:', raw);
      this.setState({ copied: 'ok' });
    }
  };

  private reset = () => {
    if (!confirm('Erase all courses and scores on this device? This cannot be undone.')) return;
    clearAllStorage();
    location.reload();
  };

  render() {
    const { error, copied } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="app grid-texture">
        <header className="hdr">
          <h1 className="hdr__title" style={{ color: 'var(--red)' }}>
            SOMETHING BROKE
          </h1>
        </header>

        <main className="screen-body">
          <section className="panel">
            <h2 className="panel__title">YOUR DATA IS STILL HERE</h2>
            <p className="muted" style={{ marginBottom: 12 }}>
              The screen failed to draw, but your courses are untouched in storage. Copy them out
              first — then try reloading.
            </p>

            <button className="btn btn--primary" onClick={this.rescue}>
              {copied === 'ok' ? 'COPIED ✓' : 'COPY MY DATA'}
            </button>

            {copied === 'ok' && (
              <p className="muted" style={{ fontSize: 11, marginTop: 8, color: 'var(--green)' }}>
                Paste it somewhere safe. Settings → BACKUP → RESTORE brings it back.
              </p>
            )}
            {copied === 'fail' && (
              <p className="muted" style={{ fontSize: 11, marginTop: 8, color: 'var(--amber)' }}>
                No saved data found on this device.
              </p>
            )}
          </section>

          <section className="panel">
            <h2 className="panel__title">RECOVER</h2>
            <div className="stack">
              <button className="btn" onClick={() => location.reload()}>
                RELOAD APP
              </button>
              <button
                className="btn"
                onClick={() => {
                  location.hash = '#/';
                  location.reload();
                }}
              >
                RELOAD ON HOME SCREEN
              </button>
            </div>
            <p className="muted" style={{ fontSize: 11, marginTop: 8, color: 'var(--text-faint)' }}>
              If the crash keeps happening on one screen, reloading on Home avoids it.
            </p>
          </section>

          <section className="panel panel--sunk">
            <h2 className="panel__title">DETAILS</h2>
            <p className="muted" style={{ fontSize: 11, wordBreak: 'break-word' }}>
              {error.message || String(error)}
            </p>
          </section>

          <section className="panel">
            <h2 className="panel__title" style={{ color: 'var(--red)' }}>
              LAST RESORT
            </h2>
            <button className="btn btn--danger btn--sm" onClick={this.reset}>
              ERASE ALL DATA
            </button>
            <p className="muted" style={{ fontSize: 11, marginTop: 8, color: 'var(--text-faint)' }}>
              Only after you have copied your data above.
            </p>
          </section>
        </main>
      </div>
    );
  }
}
