import { useRef, useState } from 'react';
import Screen from '../components/Screen';
import { Button, Panel, Segmented, SettingRow, Toggle } from '../components/ui';
import {
  backupFilename,
  exportBackup,
  importBackup,
  updateSettings,
  useStorageStatus,
  useStore,
} from '../state/store';
import { GOOGLE_MAPS_KEY } from '../map/provider';

function BackupPanel() {
  const { courses, rounds } = useStore();
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  function downloadFile() {
    const blob = new Blob([exportBackup()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = backupFilename();
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMsg({ tone: 'ok', text: `Saved ${backupFilename()}` });
  }

  async function copyText() {
    const text = exportBackup();
    try {
      await navigator.clipboard.writeText(text);
      setMsg({ tone: 'ok', text: 'Backup copied — paste it somewhere safe (email/notes).' });
    } catch {
      // Clipboard blocked (insecure context / permission) — fall back to a
      // prompt the user can copy from manually.
      window.prompt('Copy this backup text:', text);
    }
  }

  function restore(raw: string) {
    if (!raw.trim()) return;
    if (!confirm('Replace ALL data on this device with this backup? This cannot be undone.')) return;
    const r = importBackup(raw);
    setMsg(
      r.ok
        ? {
            tone: 'ok',
            text:
              `Restored ${r.courses} course(s), ${r.rounds} round(s).` +
              (r.repairs.length ? ` Repaired: ${r.repairs.join(' ')}` : ''),
          }
        : { tone: 'err', text: r.error },
    );
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => restore(String(reader.result ?? ''));
    reader.onerror = () => setMsg({ tone: 'err', text: 'Could not read that file.' });
    reader.readAsText(file);
  }

  return (
    <Panel title="BACKUP">
      <p className="muted" style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 8 }}>
        {courses.length} course(s), {rounds.length} saved round(s) on this device. Back up before
        reinstalling or upgrading the app.
      </p>

      <div className="btn-row" style={{ marginBottom: 6 }}>
        <Button size="sm" onClick={downloadFile}>
          SAVE FILE
        </Button>
        <Button size="sm" onClick={copyText}>
          COPY TEXT
        </Button>
      </div>

      <Button size="sm" variant="ghost" onClick={() => fileInput.current?.click()}>
        RESTORE FROM FILE
      </Button>
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json,text/plain"
        onChange={onFile}
        style={{ display: 'none' }}
      />

      {msg && (
        <p
          className="muted"
          style={{
            fontSize: 11,
            marginTop: 8,
            color: msg.tone === 'ok' ? 'var(--green)' : 'var(--red)',
          }}
        >
          {msg.text}
        </p>
      )}
    </Panel>
  );
}

/**
 * Storage health. Renders nothing when everything is fine — this only exists to
 * make silent data problems loud, not to add chrome to a working app.
 */
function StorageHealth() {
  const status = useStorageStatus();
  const bad = !status.available || !!status.lastError;
  if (!bad && status.repairs.length === 0) return null;

  return (
    <Panel title={bad ? 'STORAGE PROBLEM' : 'DATA REPAIRED'}>
      {status.lastError && (
        <p className="muted" style={{ fontSize: 11, color: 'var(--red)' }}>
          {status.lastError}
        </p>
      )}
      {!status.available && !status.lastError && (
        <p className="muted" style={{ fontSize: 11, color: 'var(--red)' }}>
          This device is blocking local storage — nothing will be saved.
        </p>
      )}
      {status.recoveredFromSnapshot && (
        <p className="muted" style={{ fontSize: 11, color: 'var(--amber)' }}>
          Recovered from the last good snapshot.
        </p>
      )}
      {status.repairs.map((r) => (
        <p key={r} className="muted" style={{ fontSize: 11, color: 'var(--amber)' }}>
          {r}
        </p>
      ))}
      <p className="muted" style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 8 }}>
        Export a backup below to be safe.
      </p>
    </Panel>
  );
}

export default function Settings() {
  const { settings } = useStore();

  return (
    <Screen title="SETTINGS">
      <StorageHealth />
      <Panel title="UNITS">
        <Segmented
          value={settings.units}
          onChange={(units) => updateSettings({ units })}
          options={[
            { value: 'm', label: 'METRES' },
            { value: 'yd', label: 'YARDS' },
          ]}
        />
      </Panel>

      <Panel title="GPS ACCURACY">
        <Segmented
          value={settings.gpsAccuracy}
          onChange={(gpsAccuracy) => updateSettings({ gpsAccuracy })}
          options={[
            { value: 'high', label: 'HIGH' },
            { value: 'balanced', label: 'BALANCED' },
          ]}
        />
        <p className="muted" style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 8 }}>
          High accuracy uses more battery.
        </p>
      </Panel>

      <Panel title="ROUND">
        <SettingRow label="AUTO SAVE">
          <Toggle on={settings.autoSave} onChange={(autoSave) => updateSettings({ autoSave })} />
        </SettingRow>
        <SettingRow label="KEEP SCREEN ON">
          <Toggle
            on={settings.keepScreenOn}
            onChange={(keepScreenOn) => updateSettings({ keepScreenOn })}
          />
        </SettingRow>
      </Panel>

      <BackupPanel />

      <Panel title="ABOUT">
        <div className="kv">
          <span className="kv__k">VERSION</span>
          <span className="kv__v">V1.0</span>
        </div>
        <div className="kv">
          <span className="kv__k">STORAGE</span>
          <span className="kv__v">Local · offline-first</span>
        </div>
        <div className="kv">
          <span className="kv__k">IMAGERY</span>
          <span className="kv__v" style={{ fontSize: 12 }}>
            {GOOGLE_MAPS_KEY ? 'Google Maps Satellite' : 'Not configured'}
          </span>
        </div>
        <p className="muted" style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 8 }}>
          Scores are stored on this device only. Auto save writes after every hole.
        </p>
      </Panel>
    </Screen>
  );
}
