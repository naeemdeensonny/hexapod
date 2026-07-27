export type LatLng = { lat: number; lng: number };

export type Fairway = 'L' | 'H' | 'R' | null;

export type Hole = {
  number: number;
  par: number;
  index: number;
  /** Playing distance per tee set, always stored in metres. */
  distances: Record<string, number>;
  /** Approximate reference points. Editable per course; may be undefined. */
  tee?: LatLng;
  greenFront?: LatLng;
  greenCentre?: LatLng;
  greenBack?: LatLng;
  hazards?: { name: string; point: LatLng }[];
};

export type Course = {
  id: string;
  name: string;
  location: string;
  holeCount: number;
  par: number;
  tees: string[];
  centre: LatLng;
  description: string;
  holes: Hole[];
  lastPlayed?: string; // ISO date
  /** True when hole coordinates are generated rather than surveyed. */
  approximateCoords?: boolean;
};

export type HoleScore = {
  hole: number;
  strokes: number;
  putts: number;
  penalties: number;
  fairway: Fairway;
};

export type Round = {
  id: string;
  courseId: string;
  courseName: string;
  tee: string;
  holeCount: number;
  format: 'Stroke Play';
  handicapOn: boolean;
  startedAt: string;
  completedAt?: string;
  currentHole: number;
  scores: Record<number, HoleScore>;
  status: 'active' | 'complete';
};

export type Settings = {
  units: 'm' | 'yd';
  defaultTee: string;
  gpsAccuracy: 'high' | 'balanced';
  autoSave: boolean;
  keepScreenOn: boolean;
};

export type AppState = {
  courses: Course[];
  rounds: Round[];
  activeRound: Round | null;
  settings: Settings;
};
