import Screen from '../components/Screen';
import { Panel, Segmented, SettingRow, Toggle } from '../components/ui';
import { TEE_OPTIONS } from '../state/seed';
import { updateSettings, useStore } from '../state/store';
import { GOOGLE_MAPS_KEY } from '../map/provider';

export default function Settings() {
  const { settings } = useStore();

  return (
    <Screen title="SETTINGS">
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

      <Panel title="DEFAULT TEE">
        <Segmented
          value={settings.defaultTee}
          onChange={(defaultTee) => updateSettings({ defaultTee })}
          options={TEE_OPTIONS.map((t) => ({ value: t, label: `${t.toUpperCase()} TEE` }))}
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
