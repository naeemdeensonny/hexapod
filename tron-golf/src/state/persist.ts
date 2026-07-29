/**
 * Durable storage for the app state.
 *
 * Three things this layer guarantees that a bare `localStorage.setItem` does
 * not:
 *
 * 1. **Versioning.** Saved data carries a schema version, so a future release
 *    can migrate it instead of silently starting from scratch. The storage key
 *    itself never changes — bumping the key is what orphans real user data.
 * 2. **A known-good snapshot.** Every successful load is mirrored to a second
 *    key. If the primary record is ever unreadable, that mirror is tried before
 *    falling back to seed data, so a single bad write cannot erase a
 *    hand-placed course.
 * 3. **Honest failures.** A write that fails (quota, private mode, blocked
 *    storage) is reported rather than swallowed. Silently pretending to save is
 *    the worst possible behaviour for an app whose whole value is a course the
 *    user pinned by hand.
 */
import { emptyState, parseAppState } from './schema';
import type { AppState } from './types';

/** Unchanged since v1 on purpose — existing installs keep their data. */
const KEY = 'tron-golf:v1';
/** Mirror of the last state that loaded cleanly. */
const SAFE_KEY = 'tron-golf:v1:safe';

/**
 * Bump when the *shape* of `AppState` changes, and add a migration below.
 * v1 = bare AppState (pre-hardening). v2 = versioned envelope.
 */
const SCHEMA_VERSION = 2;

/**
 * Version metadata sits *alongside* the state fields rather than wrapping them:
 *
 *     { schemaVersion, savedAt, courses, rounds, activeRound, settings }
 *
 * This is deliberate. A nested `{ schemaVersion, state: {...} }` shape would be
 * unreadable by the pre-hardening build, which looks for `courses` at the top
 * level — so rolling back to an older APK would find no courses, fall through
 * to seed data, and overwrite a hand-placed course. Keeping the state flat
 * means old and new builds can both read the record, and a downgrade is
 * survivable.
 */
type Envelope = AppState & { schemaVersion: number; savedAt: string };

/**
 * Shape migrations, applied in order from the stored version up to current.
 * v1 → v2 is structural only (the state was lifted into an envelope), so the
 * payload passes through untouched.
 */
const MIGRATIONS: Record<number, (state: unknown) => unknown> = {
  1: (state) => state,
};

export type StorageStatus = {
  /** False when the browser refuses storage entirely (private mode, blocked). */
  available: boolean;
  /** Message from the most recent failed write, if any. Cleared on success. */
  lastError: string | null;
  /** Notes from the last load about data that had to be repaired. */
  repairs: string[];
  /** True when the primary record was unusable and the mirror was used. */
  recoveredFromSnapshot: boolean;
};

let status: StorageStatus = {
  available: true,
  lastError: null,
  repairs: [],
  recoveredFromSnapshot: false,
};

const statusListeners = new Set<() => void>();

export function getStorageStatus(): StorageStatus {
  return status;
}

export function subscribeStorageStatus(fn: () => void): () => void {
  statusListeners.add(fn);
  return () => statusListeners.delete(fn);
}

function setStatus(patch: Partial<StorageStatus>) {
  status = { ...status, ...patch };
  statusListeners.forEach((l) => l());
}

/** Clear a stale write error once a later write succeeds. */
function noteWriteOk() {
  if (status.lastError) setStatus({ lastError: null });
}

/* --- low-level access ----------------------------------------------------- */

function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeRaw(key: string, value: string): string | null {
  try {
    localStorage.setItem(key, value);
    return null;
  } catch (err) {
    const quota =
      err instanceof DOMException &&
      (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED');
    return quota
      ? 'Device storage is full — changes are not being saved. Export a backup, then free up space.'
      : 'This device is blocking local storage — changes are not being saved.';
  }
}

/** One-time probe so the UI can warn before the user does hours of pin placement. */
function probeStorage(): boolean {
  const probe = '__tron_probe__';
  try {
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

/* --- decode --------------------------------------------------------------- */

/** Unwrap an envelope (or a legacy bare state) and run it up to the current version. */
function decode(raw: string): unknown | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;

  const env = parsed as Partial<Envelope> & { state?: unknown };

  // Three layouts must be readable:
  //   1. legacy bare  — no schemaVersion, state fields at top level
  //   2. flat         — schemaVersion alongside the state fields (current)
  //   3. nested       — schemaVersion with the state under `state`
  // Only the version number differs between 1 and 2; 3 needs unwrapping.
  let version = typeof env.schemaVersion === 'number' ? env.schemaVersion : 1;
  let state: unknown =
    env.state && typeof env.state === 'object' ? env.state : parsed;

  // Data written by a NEWER build than this one: don't guess at its shape,
  // hand it to the parser as-is and let field-level repair do what it can.
  if (version > SCHEMA_VERSION) return state;

  while (version < SCHEMA_VERSION) {
    const migrate = MIGRATIONS[version];
    if (!migrate) break;
    state = migrate(state);
    version++;
  }
  return state;
}

/** True when a stored record is already an envelope at the current version. */
function isCurrentEnvelope(raw: string): boolean {
  try {
    const parsed = JSON.parse(raw) as Partial<Envelope>;
    return parsed?.schemaVersion === SCHEMA_VERSION;
  } catch {
    return false;
  }
}

/** Decode + validate one key. Returns null when nothing usable is there. */
function loadFrom(key: string): { state: AppState; repairs: string[]; stale: boolean } | null {
  const raw = readRaw(key);
  if (!raw) return null;
  const decoded = decode(raw);
  if (decoded === null) return null;
  const result = parseAppState(decoded);
  if (result.empty && result.repairs.length === 0) return null;
  return {
    state: result.state,
    repairs: result.repairs,
    // Worth rewriting if the record predates the current envelope, or if we
    // had to repair it — otherwise the same damage is re-parsed every launch.
    stale: !isCurrentEnvelope(raw) || result.repairs.length > 0,
  };
}

/* --- public API ----------------------------------------------------------- */

/**
 * Load persisted state, or `null` when this device has none yet (so the caller
 * can seed). Falls back to the known-good snapshot if the primary record is
 * unreadable, and records what happened in `getStorageStatus()`.
 */
export function loadState(): AppState | null {
  if (!probeStorage()) {
    setStatus({
      available: false,
      lastError: 'This device is blocking local storage — nothing will be saved.',
    });
    return null;
  }

  const primary = loadFrom(KEY);
  if (primary) {
    setStatus({ available: true, repairs: primary.repairs, recoveredFromSnapshot: false });
    // Migrate in place so a legacy or damaged record is normalised now rather
    // than being re-parsed and re-repaired on every launch.
    if (primary.stale) saveState(primary.state);
    snapshot(primary.state);
    return primary.state;
  }

  // Primary missing or corrupt. If anything was stored there at all, this is a
  // real failure rather than a first run — try the mirror before giving up.
  const hadPrimary = readRaw(KEY) !== null;
  const backup = loadFrom(SAFE_KEY);
  if (backup) {
    setStatus({
      available: true,
      repairs: [
        ...(hadPrimary ? ['Saved data was damaged — restored from the last good snapshot.'] : []),
        ...backup.repairs,
      ],
      recoveredFromSnapshot: hadPrimary,
    });
    // Promote the recovered state to primary so the damaged record is replaced.
    saveState(backup.state);
    return backup.state;
  }

  setStatus({
    available: true,
    repairs: hadPrimary ? ['Saved data could not be read and has been reset.'] : [],
    recoveredFromSnapshot: false,
  });
  return null;
}

function envelope(state: AppState): Envelope {
  return { schemaVersion: SCHEMA_VERSION, savedAt: new Date().toISOString(), ...state };
}

/** Persist state. Returns an error message on failure, or null on success. */
export function saveState(state: AppState): string | null {
  const err = writeRaw(KEY, JSON.stringify(envelope(state)));
  if (err) setStatus({ lastError: err });
  else noteWriteOk();
  return err;
}

/**
 * Mirror a known-good state to the snapshot key. Best-effort: a failure here
 * must never block the app, since the primary record is what matters.
 */
function snapshot(state: AppState): void {
  writeRaw(SAFE_KEY, JSON.stringify(envelope(state)));
}

/**
 * Raw persisted text, for rescuing data from a crashed app. Reads storage
 * directly so it works even when the store module is in a bad way.
 */
export function readRawBackup(): string | null {
  return readRaw(KEY) ?? readRaw(SAFE_KEY);
}

/** Wipe every key this app owns. Used by the crash screen's last-resort reset. */
export function clearAllStorage(): void {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(SAFE_KEY);
  } catch {
    /* nothing further we can do */
  }
}

export { emptyState };
