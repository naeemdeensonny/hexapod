import type { LatLng } from './types';

const R = 6371008.8; // mean earth radius, metres
const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

/** Great-circle distance in metres. */
export function distanceM(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const la1 = toRad(a.lat);
  const la2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Point at `dist` metres from `from` along `bearing` degrees. */
export function destination(from: LatLng, bearing: number, dist: number): LatLng {
  const d = dist / R;
  const br = toRad(bearing);
  const la1 = toRad(from.lat);
  const ln1 = toRad(from.lng);
  const la2 = Math.asin(Math.sin(la1) * Math.cos(d) + Math.cos(la1) * Math.sin(d) * Math.cos(br));
  const ln2 =
    ln1 +
    Math.atan2(
      Math.sin(br) * Math.sin(d) * Math.cos(la1),
      Math.cos(d) - Math.sin(la1) * Math.sin(la2),
    );
  return { lat: toDeg(la2), lng: toDeg(ln2) };
}

export function bearing(a: LatLng, b: LatLng): number {
  const la1 = toRad(a.lat);
  const la2 = toRad(b.lat);
  const dLng = toRad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(la2);
  const x = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

const YARDS_PER_M = 1.0936133;

/** Convert metres to the user's chosen unit and round to a whole number. */
export function toUnit(metres: number, units: 'm' | 'yd'): number {
  return Math.round(units === 'yd' ? metres * YARDS_PER_M : metres);
}

export function unitLabel(units: 'm' | 'yd'): string {
  return units === 'yd' ? 'yd' : 'm';
}

/** e.g. `142 m` — used for every distance readout in the app. */
export function fmtDist(metres: number | null | undefined, units: 'm' | 'yd'): string {
  if (metres == null || !Number.isFinite(metres)) return '--';
  return `${toUnit(metres, units)} ${unitLabel(units)}`;
}
