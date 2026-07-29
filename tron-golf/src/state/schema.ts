/**
 * Runtime validation and repair for persisted state.
 *
 * Everything here follows one rule: **repair, never reject**. Persisted data is
 * the user's course setup, hand-placed pin by pin — losing all of it because
 * one hole has a corrupt latitude would be indefensible. So every parser
 * coerces what it can, substitutes a sane default for what it can't, and
 * records a human-readable note describing what happened. Only genuinely
 * unusable records (a course with no identity at all) are dropped.
 *
 * The parsers are hand-written rather than schema-library-driven: the shape is
 * small and closed, the app must work offline, and this keeps the bundle free
 * of another dependency.
 */
import { TEE_OPTIONS } from './seed';
import type {
  AppState,
  Course,
  Fairway,
  Hole,
  HoleScore,
  LatLng,
  Round,
  Settings,
} from './types';

export const DEFAULT_SETTINGS: Settings = {
  units: 'm',
  defaultTee: 'Blue',
  gpsAccuracy: 'high',
  autoSave: true,
  keepScreenOn: false,
};

/** Widest hole count we will accept; guards against absurd persisted values. */
const MAX_HOLES = 36;

/* --- primitives ----------------------------------------------------------- */

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Finite number within bounds, or null. Rejects NaN/Infinity, which JSON allows in via `null` coercion elsewhere. */
function num(v: unknown, min: number, max: number, integer = false): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return integer ? Math.round(n) : n;
}

function str(v: unknown, maxLen = 200): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (!s) return null;
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

/** ISO-ish date string, or null. Kept permissive — only used for display/sort. */
function isoDate(v: unknown): string | null {
  const s = str(v, 40);
  if (!s) return null;
  return Number.isNaN(Date.parse(s)) ? null : s;
}

function latLng(v: unknown): LatLng | null {
  if (!isObj(v)) return null;
  const lat = num(v.lat, -90, 90);
  const lng = num(v.lng, -180, 180);
  if (lat === null || lng === null) return null;
  // 0,0 is in the Atlantic — always a placeholder or a parse artefact, never a golf hole.
  if (lat === 0 && lng === 0) return null;
  return { lat, lng };
}

/* --- holes ---------------------------------------------------------------- */

/** A usable stand-in for a hole we could not read, so numbering stays intact. */
function defaultHole(number: number): Hole {
  return { number, par: 4, index: number, distances: {} };
}

function parseDistances(v: unknown): Record<string, number> {
  if (!isObj(v)) return {};
  const out: Record<string, number> = {};
  for (const [tee, raw] of Object.entries(v)) {
    const key = str(tee, 30);
    const d = num(raw, 1, 1000);
    if (key && d !== null) out[key] = Math.round(d);
  }
  return out;
}

function parseHazards(v: unknown): { name: string; point: LatLng }[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: { name: string; point: LatLng }[] = [];
  for (const h of v) {
    if (!isObj(h)) continue;
    const name = str(h.name, 40);
    const point = latLng(h.point);
    if (name && point) out.push({ name, point });
  }
  return out.length ? out : undefined;
}

function parseFence(v: unknown): Hole['fence'] {
  if (!isObj(v)) return undefined;
  const north = num(v.north, -90, 90);
  const south = num(v.south, -90, 90);
  const east = num(v.east, -180, 180);
  const west = num(v.west, -180, 180);
  if (north === null || south === null || east === null || west === null) return undefined;
  if (north <= south || east <= west) return undefined;
  return { north, south, east, west };
}

/** Parse one hole. Returns null only when the hole number itself is unreadable. */
function parseHole(v: unknown, holeCount: number): Hole | null {
  if (!isObj(v)) return null;
  const number = num(v.number, 1, MAX_HOLES, true);
  if (number === null) return null;

  const tee = latLng(v.tee) ?? undefined;
  const greenCentre = latLng(v.greenCentre) ?? undefined;

  return {
    number,
    par: num(v.par, 3, 6, true) ?? 4,
    index: num(v.index, 1, holeCount, true) ?? number,
    distances: parseDistances(v.distances),
    tee,
    greenFront: latLng(v.greenFront) ?? undefined,
    greenCentre,
    greenBack: latLng(v.greenBack) ?? undefined,
    hazards: parseHazards(v.hazards),
    // Derived, never trusted from storage: a hole is "set" iff both pins exist.
    coordsSet: !!tee && !!greenCentre,
    fence: parseFence(v.fence),
  };
}

/* --- courses -------------------------------------------------------------- */

function parseCourse(v: unknown, repairs: string[]): Course | null {
  if (!isObj(v)) return null;

  const id = str(v.id, 60);
  const name = str(v.name, 80);
  // Without an id we cannot route to it, and without a name it is unusable in
  // any list. This is the only condition that drops a course outright.
  if (!id || !name) return null;

  const holeCount = num(v.holeCount, 1, MAX_HOLES, true) ?? 18;

  // Rebuild the hole list by number so the scorecard can never end up with
  // gaps or duplicates, whatever the stored array looked like.
  const parsed = new Map<number, Hole>();
  if (Array.isArray(v.holes)) {
    for (const raw of v.holes) {
      const h = parseHole(raw, holeCount);
      if (h && h.number <= holeCount && !parsed.has(h.number)) parsed.set(h.number, h);
    }
  }

  const holes: Hole[] = [];
  let synthesised = 0;
  for (let n = 1; n <= holeCount; n++) {
    const h = parsed.get(n);
    if (h) holes.push(h);
    else {
      holes.push(defaultHole(n));
      synthesised++;
    }
  }
  if (synthesised) {
    repairs.push(`${name}: rebuilt ${synthesised} unreadable hole(s) with defaults.`);
  }

  const tees = Array.isArray(v.tees)
    ? (v.tees.map((t) => str(t, 30)).filter(Boolean) as string[])
    : [];

  const centre =
    latLng(v.centre) ??
    // Fall back to the first pin we have rather than dropping the course.
    holes.find((h) => h.tee)?.tee ??
    holes.find((h) => h.greenCentre)?.greenCentre ??
    null;
  if (!latLng(v.centre) && centre) {
    repairs.push(`${name}: centre point recovered from hole pins.`);
  }

  return {
    id,
    name,
    location: str(v.location, 120) ?? '',
    holeCount,
    // Recomputed, never trusted: keeps the header total honest even if the
    // stored value drifted from the actual hole pars.
    par: holes.reduce((sum, h) => sum + h.par, 0),
    tees: tees.length ? tees : [...TEE_OPTIONS],
    centre: centre ?? { lat: 0, lng: 0 },
    description: str(v.description, 500) ?? '',
    holes,
    lastPlayed: isoDate(v.lastPlayed) ?? undefined,
    approximateCoords: !holes.every((h) => h.coordsSet),
  };
}

/* --- rounds --------------------------------------------------------------- */

function parseFairway(v: unknown): Fairway {
  return v === 'L' || v === 'H' || v === 'R' ? v : null;
}

function parseScores(v: unknown, holeCount: number): Record<number, HoleScore> {
  if (!isObj(v)) return {};
  const out: Record<number, HoleScore> = {};
  for (const [key, raw] of Object.entries(v)) {
    const hole = num(key, 1, holeCount, true);
    if (hole === null || !isObj(raw)) continue;
    const strokes = num(raw.strokes, 1, 30, true);
    if (strokes === null) continue; // a score with no strokes is not a score
    out[hole] = {
      hole,
      strokes,
      putts: num(raw.putts, 0, 20, true) ?? 0,
      penalties: num(raw.penalties, 0, 20, true) ?? 0,
      fairway: parseFairway(raw.fairway),
    };
  }
  return out;
}

function parseRound(v: unknown): Round | null {
  if (!isObj(v)) return null;
  const id = str(v.id, 60);
  const courseId = str(v.courseId, 60);
  const courseName = str(v.courseName, 80);
  const startedAt = isoDate(v.startedAt);
  if (!id || !courseId || !courseName || !startedAt) return null;

  const holeCount = num(v.holeCount, 1, MAX_HOLES, true) ?? 18;
  const status = v.status === 'complete' ? 'complete' : 'active';

  return {
    id,
    courseId,
    courseName,
    tee: str(v.tee, 30) ?? TEE_OPTIONS[0],
    holeCount,
    format: 'Stroke Play',
    handicapOn: bool(v.handicapOn, false),
    startedAt,
    completedAt: isoDate(v.completedAt) ?? undefined,
    currentHole: num(v.currentHole, 1, holeCount, true) ?? 1,
    scores: parseScores(v.scores, holeCount),
    status,
  };
}

/* --- settings ------------------------------------------------------------- */

function parseSettings(v: unknown): Settings {
  if (!isObj(v)) return { ...DEFAULT_SETTINGS };
  return {
    units: v.units === 'yd' ? 'yd' : 'm',
    defaultTee: str(v.defaultTee, 30) ?? DEFAULT_SETTINGS.defaultTee,
    gpsAccuracy: v.gpsAccuracy === 'balanced' ? 'balanced' : 'high',
    autoSave: bool(v.autoSave, DEFAULT_SETTINGS.autoSave),
    keepScreenOn: bool(v.keepScreenOn, DEFAULT_SETTINGS.keepScreenOn),
  };
}

/* --- top level ------------------------------------------------------------ */

export type ParseResult = {
  state: AppState;
  /** Human-readable notes about anything that had to be fixed or dropped. */
  repairs: string[];
  /** True when nothing usable could be read and the caller should seed instead. */
  empty: boolean;
};

/**
 * Parse an untrusted value into a valid `AppState`.
 *
 * Never throws. `empty` is set when no courses survived, which lets the caller
 * decide between seeding fresh data and falling back to a backup snapshot —
 * a decision this function deliberately does not make for it.
 */
export function parseAppState(raw: unknown): ParseResult {
  const repairs: string[] = [];

  if (!isObj(raw)) {
    return { state: emptyState(), repairs: ['Saved data was not readable.'], empty: true };
  }

  const courses: Course[] = [];
  if (Array.isArray(raw.courses)) {
    let dropped = 0;
    for (const c of raw.courses) {
      const parsed = parseCourse(c, repairs);
      if (parsed) courses.push(parsed);
      else dropped++;
    }
    if (dropped) repairs.push(`Dropped ${dropped} unreadable course(s).`);
  }

  const rounds: Round[] = [];
  if (Array.isArray(raw.rounds)) {
    let dropped = 0;
    for (const r of raw.rounds) {
      const parsed = parseRound(r);
      if (parsed) rounds.push(parsed);
      else dropped++;
    }
    if (dropped) repairs.push(`Dropped ${dropped} unreadable round(s) from history.`);
  }

  let activeRound = parseRound(raw.activeRound);
  if (raw.activeRound && !activeRound) {
    repairs.push('The round in progress could not be read and was cleared.');
  }
  // An active round pointing at a course that no longer exists strands the user
  // on screens that cannot render — drop it rather than ship a broken session.
  if (activeRound && !courses.some((c) => c.id === activeRound!.courseId)) {
    repairs.push(`Round on "${activeRound.courseName}" cleared — its course is gone.`);
    activeRound = null;
  }

  return {
    state: { courses, rounds, activeRound, settings: parseSettings(raw.settings) },
    repairs,
    empty: courses.length === 0,
  };
}

export function emptyState(): AppState {
  return { courses: [], rounds: [], activeRound: null, settings: { ...DEFAULT_SETTINGS } };
}
