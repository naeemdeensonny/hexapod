import { useSyncExternalStore } from 'react';
import { seedCourses } from './seed';
import type { AppState, Course, Fairway, HoleScore, Round, Settings } from './types';

const KEY = 'tron-golf:v1';

const DEFAULT_SETTINGS: Settings = {
  units: 'm',
  defaultTee: 'Blue',
  gpsAccuracy: 'high',
  autoSave: true,
  keepScreenOn: false,
};

function initial(): AppState {
  return { courses: seedCourses(), rounds: [], activeRound: null, settings: DEFAULT_SETTINGS };
}

/** Read persisted state, falling back to seed data on first run or bad JSON. */
function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return initial();
    const parsed = JSON.parse(raw) as Partial<AppState>;
    return {
      courses: parsed.courses?.length ? parsed.courses : seedCourses(),
      rounds: parsed.rounds ?? [],
      activeRound: parsed.activeRound ?? null,
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
    };
  } catch {
    return initial();
  }
}

let state: AppState = load();
const listeners = new Set<() => void>();

/** Every mutation writes straight through to localStorage — offline-first. */
function commit(next: AppState) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage full or blocked: keep running from memory */
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useStore(): AppState {
  return useSyncExternalStore(subscribe, () => state);
}

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
