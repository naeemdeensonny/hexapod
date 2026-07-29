import React from 'react';
import ReactDOM from 'react-dom/client';
// Latin subsets only — fonts are bundled locally so the app works offline.
import '@fontsource/press-start-2p/latin.css';
import '@fontsource/share-tech-mono/latin.css';
import './theme/tokens.css';
import './theme/components.css';
import App from './App';

/*
 * Service worker policy.
 *
 * On the web the worker is what makes the app installable and usable offline.
 * Inside the Capacitor WebView it is actively harmful: Workbox precaches the
 * whole app into WebView storage, and that storage is NOT cleared when a new
 * APK is installed over an old one — so the native app keeps serving the first
 * build it ever cached, no matter how many times it is rebuilt and reinstalled.
 *
 * So: register only on the web, and on native tear down any worker and caches
 * left behind by an earlier build.
 */
const isNative = !!(window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
  ?.isNativePlatform?.();

if (isNative) {
  navigator.serviceWorker
    ?.getRegistrations?.()
    .then((regs) => regs.forEach((r) => r.unregister()))
    .catch(() => {});
  window.caches?.keys?.().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => {});
} else if ('serviceWorker' in navigator) {
  import('virtual:pwa-register')
    .then(({ registerSW }) => registerSW({ immediate: true }))
    .catch(() => {});
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
