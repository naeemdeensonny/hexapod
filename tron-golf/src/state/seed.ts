import { destination } from './geo';
import type { Course, Hole, LatLng } from './types';

/**
 * Kinrara Golf Club — Bandar Kinrara, Puchong, Selangor.
 *
 * Par and stroke index follow a standard 18-hole championship layout. Tee and
 * green coordinates are DERIVED around the clubhouse coordinate rather than
 * surveyed, so the map has real geographic reference points to work with from
 * the first run. They are flagged via `approximateCoords` and can be re-pinned
 * per hole later; the satellite imagery underneath is always the real thing.
 */
const KINRARA_CENTRE: LatLng = { lat: 3.0425, lng: 101.635 };

type HoleSpec = { par: number; index: number; blue: number };

const KINRARA_SPEC: HoleSpec[] = [
  { par: 4, index: 9, blue: 358 },
  { par: 5, index: 3, blue: 486 },
  { par: 4, index: 13, blue: 331 },
  { par: 3, index: 17, blue: 156 },
  { par: 4, index: 1, blue: 401 },
  { par: 4, index: 11, blue: 344 },
  { par: 4, index: 5, blue: 392 },
  { par: 3, index: 15, blue: 168 },
  { par: 5, index: 7, blue: 471 },
  { par: 4, index: 8, blue: 369 },
  { par: 5, index: 2, blue: 494 },
  { par: 3, index: 18, blue: 149 },
  { par: 4, index: 4, blue: 397 },
  { par: 4, index: 12, blue: 336 },
  { par: 4, index: 6, blue: 381 },
  { par: 3, index: 16, blue: 172 },
  { par: 4, index: 10, blue: 355 },
  { par: 5, index: 14, blue: 462 },
];

/** Tee multipliers relative to the blue (championship) tee. */
const TEE_FACTOR: Record<string, number> = { Blue: 1, White: 0.93, Red: 0.84 };

function buildHoles(centre: LatLng, spec: HoleSpec[]): Hole[] {
  return spec.map((s, i) => {
    // Fan the holes around the clubhouse so they occupy a plausible footprint.
    const ring = i < 9 ? 420 : 620;
    const teeBearing = (i * 360) / spec.length;
    const tee = destination(centre, teeBearing, ring);
    const playBearing = (teeBearing + 118) % 360;
    const greenCentre = destination(tee, playBearing, s.blue);
    const greenFront = destination(tee, playBearing, s.blue - 14);
    const greenBack = destination(tee, playBearing, s.blue + 14);

    const distances: Record<string, number> = {};
    for (const [teeName, f] of Object.entries(TEE_FACTOR)) {
      distances[teeName] = Math.round(s.blue * f);
    }

    return {
      number: i + 1,
      par: s.par,
      index: s.index,
      distances,
      tee,
      greenFront,
      greenCentre,
      greenBack,
      hazards:
        s.par === 5
          ? [{ name: 'Bunker', point: destination(tee, playBearing, s.blue * 0.62) }]
          : s.par === 4
            ? [{ name: 'Water', point: destination(tee, (playBearing + 8) % 360, s.blue * 0.55) }]
            : [],
    };
  });
}

export function seedCourses(): Course[] {
  const holes = buildHoles(KINRARA_CENTRE, KINRARA_SPEC);
  return [
    {
      id: 'kinrara',
      name: 'Kinrara Golf Club',
      location: 'Puchong, Selangor',
      holeCount: 18,
      par: KINRARA_SPEC.reduce((t, h) => t + h.par, 0),
      tees: [SINGLE_TEE],
      centre: KINRARA_CENTRE,
      description:
        'Mature parkland layout with tight tree-lined fairways and water in play on the closing stretch.',
      holes,
      approximateCoords: true,
    },
  ];
}

/**
 * The app plays a single tee set. Multiple tee sets were dropped because they
 * multiplied every distance table and every setup screen for a feature nobody
 * used — one set of pins per hole is what actually gets measured on the course.
 * Kept as a named constant (rather than inlined) so the distance tables stay
 * keyed consistently.
 */
export const SINGLE_TEE = 'Blue';

export const TEE_OPTIONS = [SINGLE_TEE];

/**
 * Build a playable hole list for a user-added course: pars are distributed to
 * hit the requested total, distances follow the par, and reference points are
 * fanned around the pinned location so the map has something to draw. Marked
 * approximate — the user re-pins per hole as they play.
 */
export function generateHoles(
  centre: LatLng,
  holeCount: number,
  totalPar: number,
  tees: string[],
): Hole[] {
  const pars = Array.from({ length: holeCount }, () => 4);
  let diff = totalPar - 4 * holeCount;
  // Push holes to par 5 (or down to par 3) alternately until the total matches.
  for (let i = 0; diff !== 0 && i < holeCount * 2; i++) {
    const idx = (i * 3) % holeCount;
    if (diff > 0 && pars[idx] < 5) {
      pars[idx]++;
      diff--;
    } else if (diff < 0 && pars[idx] > 3) {
      pars[idx]--;
      diff++;
    }
  }

  const baseFor = (par: number) => (par === 3 ? 160 : par === 5 ? 480 : 370);

  const spec: HoleSpec[] = pars.map((par, i) => ({
    par,
    index: i + 1,
    blue: baseFor(par),
  }));

  const holes = buildHoles(centre, spec);
  // Restrict the distance table to the tee sets this course actually offers.
  return holes.map((h) => ({
    ...h,
    distances: Object.fromEntries(
      tees.map((t) => [t, h.distances[t] ?? Math.round(h.distances.Blue * (TEE_FACTOR[t] ?? 1))]),
    ),
  }));
}
