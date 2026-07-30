/**
 * Location watching, native-first.
 *
 * The app previously called `navigator.geolocation` directly. Inside the
 * Capacitor WebView that path is unreliable — it depends on the WebView's
 * HTML5 geolocation bridge and silently fails when the OS runtime permission
 * has never been granted, which is exactly what happened on the course: a
 * permanent "NO GPS FIX" with no way to recover.
 *
 * `@capacitor/geolocation` instead talks to Android's native location services
 * directly and can raise the OS permission dialog. On the web the same package
 * transparently wraps `navigator.geolocation`, so one code path serves both.
 *
 * The watch is reported back with a distinct failure *reason* so the UI can
 * tell "you denied permission" (fixable in system settings) apart from "no
 * signal yet" (wait, or move to open sky).
 */
import { Geolocation } from '@capacitor/geolocation';

export type GeoFix = { lat: number; lng: number; accuracy: number };

/** Why a location watch is not producing fixes. */
export type GeoErrorKind = 'denied' | 'unavailable' | 'timeout' | 'unsupported';

function classify(err: unknown): GeoErrorKind {
  // Web/WebView errors carry a numeric `code`; native errors carry a message.
  const code = (err as { code?: number } | null)?.code;
  if (code === 1) return 'denied';
  if (code === 2) return 'unavailable';
  if (code === 3) return 'timeout';
  const msg = String((err as { message?: string } | null)?.message ?? err ?? '').toLowerCase();
  if (msg.includes('denied') || msg.includes('permission')) return 'denied';
  if (msg.includes('timeout')) return 'timeout';
  return 'unavailable';
}

/**
 * Begin watching the device location.
 *
 * Resolves to a cleanup function that stops the watch. Because acquiring the
 * watch id is itself asynchronous, the caller's effect may tear down before
 * this resolves; the returned cleanup and the internal `cancelled` guard both
 * handle that race so a watch is never left running.
 */
export async function watchLocation(
  highAccuracy: boolean,
  onFix: (fix: GeoFix) => void,
  onError: (kind: GeoErrorKind) => void,
): Promise<() => void> {
  // Ask up front. On native this shows the OS dialog; on web it inspects the
  // Permissions API (and is a harmless no-op where that is unavailable).
  try {
    const perm = await Geolocation.requestPermissions({ permissions: ['location'] });
    if (perm.location === 'denied' && perm.coarseLocation === 'denied') {
      onError('denied');
      return () => {};
    }
  } catch {
    // requestPermissions is not implemented everywhere on web — fall through
    // and let watchPosition surface any real problem.
  }

  let cancelled = false;
  let watchId: string | null = null;

  try {
    watchId = await Geolocation.watchPosition(
      { enableHighAccuracy: highAccuracy, timeout: 20000, maximumAge: 3000 },
      (pos, err) => {
        if (err) {
          onError(classify(err));
          return;
        }
        if (pos) {
          onFix({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          });
        }
      },
    );
    // Effect unmounted while the id was resolving — stop immediately.
    if (cancelled && watchId) Geolocation.clearWatch({ id: watchId }).catch(() => {});
  } catch (err) {
    onError(classify(err));
  }

  return () => {
    cancelled = true;
    if (watchId) Geolocation.clearWatch({ id: watchId }).catch(() => {});
    watchId = null;
  };
}
