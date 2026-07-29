import { useSyncExternalStore } from 'react';
import { loadState, saveState, getStorageStatus, subscribeStorageStatus } from './persist';
import { DEFAULT_SETTINGS, parseAppState } from './schema';
import { seedCourses } from './seed';
import type { AppState, Course, Fairway, Hole, HoleScore, Round, Settings } from './types';

function initial(): AppState {
  return { courses: seedCourses(), rounds: [], activeRound: null, settings: DEFAULT_SETTINGS };
}

/**
 * Boot state: validated persisted data, or seed courses on a genuinely fresh
 * device. `loadState` handles corruption, versioning and snapshot recovery, and
 * records what it had to do in `getStorageStatus()`.
 */
let state: AppState = loadState() ?? initial();
const listeners = new Set<() => void>();

/** Every mutation writes straight through to storage — offline-first. */
function commit(next: AppState) {
  state = next;
  saveState(state);
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useStore(): AppState {
  return useSyncExternalStore(subscribe, () => state);
}

/** Live storage health: availability, write errors, and repairs made at load. */
export function useStorageStatus() {
  return useSyncExternalStore(subscribeStorageStatus, getStorageStatus);
}

export { getStorageStatus } from './persist';

export function getState(): AppState {
  return state;
}

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

/* --- courses ------------------------------------------------------------ */

export function addCourse(c: Omit<Course, 'id'>): Course {
  const course: Course = { ...c, id: uid() };
  commit({ ...state, courses: [...state.courses, course] });
  return course;
}

export function deleteCourse(id: string) {
  commit({ ...state, courses: state.courses.filter((c) => c.id !== id) });
}

export function updateCourse(id: string, patch: Partial<Omit<Course, 'id'>>) {
  const courses = state.courses.map((c) => (c.id === id ? { ...c, ...patch } : c));
  commit({ ...state, courses });
}

export function updateHole(courseId: string, holeNumber: number, patch: Partial<Hole>) {
  const courses = state.courses.map((c) => {
    if (c.id !== courseId) return c;
    const holes = c.holes.map((h) => (h.number === holeNumber ? { ...h, ...patch } : h));
    return { ...c, holes, approximateCoords: !holes.every((h) => h.coordsSet) };
  });
  commit({ ...state, courses });
}

/* --- rounds ------------------------------------------------------------- */

export function startRound(courseId: string, tee: string, handicapOn = false): Round | null {
  const course = state.courses.find((c) => c.id === courseId);
  if (!course) return null;
  const round: Round = {
    id: uid(),
    courseId: course.id,
    courseName: course.name,
    tee,
    holeCount: course.holeCount,
    format: 'Stroke Play',
    handicapOn,
    startedAt: new Date().toISOString(),
    currentHole: 1,
    scores: {},
    status: 'active',
  };
  commit({ ...state, activeRound: round });
  return round;
}

export function setCurrentHole(hole: number) {
  if (!state.activeRound) return;
  const max = state.activeRound.holeCount;
  const clamped = Math.min(max, Math.max(1, hole));
  commit({ ...state, activeRound: { ...state.activeRound, currentHole: clamped } });
}

export function saveHoleScore(entry: {
  hole: number;
  strokes: number;
  putts: number;
  penalties: number;
  fairway: Fairway;
}) {
  if (!state.activeRound) return;
  const score: HoleScore = { ...entry };
  const scores = { ...state.activeRound.scores, [entry.hole]: score };
  commit({ ...state, activeRound: { ...state.activeRound, scores } });
}

export function discardRound() {
  commit({ ...state, activeRound: null });
}

/** Move the active round into history and stamp the course's last-played date. */
export function completeRound(): Round | null {
  const active = state.activeRound;
  if (!active) return null;
  const finished: Round = {
    ...active,
    status: 'complete',
    completedAt: new Date().toISOString(),
  };
  const courses = state.courses.map((c) =>
    c.id === finished.courseId ? { ...c, lastPlayed: finished.completedAt } : c,
  );
  commit({ ...state, courses, rounds: [finished, ...state.rounds], activeRound: null });
  return finished;
}

export function deleteRound(id: string) {
  commit({ ...state, rounds: state.rounds.filter((r) => r.id !== id) });
}

/* --- settings ----------------------------------------------------------- */

export function updateSettings(patch: Partial<Settings>) {
  commit({ ...state, settings: { ...state.settings, ...patch } });
}

/* --- backup / restore --------------------------------------------------- */

/** Envelope version, so a future import can detect and migrate old backups. */
const BACKUP_VERSION = 1;

type Backup = {
  app: 'tron-golf';
  version: number;
  exportedAt: string;
  state: AppState;
};

/** Serialise the entire app (courses, rounds, settings) to a JSON string. */
export function exportBackup(): string {
  const backup: Backup = {
    app: 'tron-golf',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    state,
  };
  return JSON.stringify(backup, null, 2);
}

/** Human-friendly file name for a backup, e.g. `tron-golf-backup-2026-07-29.json`. */
export function backupFilename(): string {
  return `tron-golf-backup-${new Date().toISOString().slice(0, 10)}.json`;
}

export type ImportResult =
  | { ok: true; courses: number; rounds: number; repairs: string[] }
  | { ok: false; error: string };

/**
 * Replace all local data with the contents of a backup string.
 *
 * The payload goes through the same validator as persisted state, so a
 * truncated or hand-edited file is repaired field by field rather than trusted
 * wholesale — and an import that would leave you with nothing is refused
 * outright instead of wiping what you already have.
 */
export function importBackup(raw: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.trim());
  } catch {
    return { ok: false, error: 'Not valid backup text — check you pasted the whole thing.' };
  }

  const obj = parsed as Partial<Backup> & Partial<AppState>;
  const incoming: unknown = obj && (obj as Backup).state ? (obj as Backup).state : parsed;

  const result = parseAppState(incoming);
  if (result.empty) {
    return { ok: false, error: 'No readable courses in that file — nothing was changed.' };
  }

  commit(result.state);
  return {
    ok: true,
    courses: result.state.courses.length,
    rounds: result.state.rounds.length,
    repairs: result.repairs,
  };
}

/* --- derived helpers ---------------------------------------------------- */

export function courseById(id: string): Course | undefined {
  return state.courses.find((c) => c.id === id);
}

export type RoundTotals = {
  front: number;
  back: number;
  gross: number;
  frontPar: number;
  backPar: number;
  par: number;
  toPar: number;
  played: number;
  missing: number[];
};

export function roundTotals(round: Round, course: Course | undefined): RoundTotals {
  const holes = course?.holes ?? [];
  let front = 0;
  let back = 0;
  let frontPar = 0;
  let backPar = 0;
  let played = 0;
  const missing: number[] = [];

  for (let n = 1; n <= round.holeCount; n++) {
    const s = round.scores[n];
    const par = holes.find((h) => h.number === n)?.par ?? 4;
    if (!s) {
      missing.push(n);
      continue;
    }
    played++;
    if (n <= 9) {
      front += s.strokes;
      frontPar += par;
    } else {
      back += s.strokes;
      backPar += par;
    }
  }

  const gross = front + back;
  const par = frontPar + backPar;
  return { front, back, gross, frontPar, backPar, par, toPar: gross - par, played, missing };
}

/** `E`, `+3`, `-2` — the standard to-par presentation. */
export function fmtToPar(v: number): string {
  if (v === 0) return 'E';
  return v > 0 ? `+${v}` : `${v}`;
}

/** Red for over par, green for under, cyan for level. */
export function toParColor(v: number): string {
  if (v > 0) return 'var(--red)';
  if (v < 0) return 'var(--green)';
  return 'var(--cyan)';
}

export function scoreName(strokes: number, par: number): string {
  const d = strokes - par;
  if (strokes === 1) return 'Hole in One';
  if (d <= -3) return 'Albatross';
  if (d === -2) return 'Eagle';
  if (d === -1) return 'Birdie';
  if (d === 0) return 'Par';
  if (d === 1) return 'Bogey';
  if (d === 2) return 'Double Bogey';
  if (d === 3) return 'Triple Bogey';
  return `+${d}`;
}
