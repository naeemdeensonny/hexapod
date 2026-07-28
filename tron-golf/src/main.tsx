import React from 'react';
import ReactDOM from 'react-dom/client';

// Android WebView doesn't expose safe-area-inset-* to CSS env() automatically.
// Inject fixed values for the status bar and gesture nav bar.
const _cap = (window as any).Capacitor;
if (_cap?.isNativePlatform?.() && _cap?.getPlatform?.() === 'android') {
  document.documentElement.style.setProperty('--safe-top', '30px');
  document.documentElement.style.setProperty('--safe-bottom', '48px');
}
// Latin subsets only — fonts are bundled locally so the app works offline.
import '@fontsource/press-start-2p/latin.css';
import '@fontsource/share-tech-mono/latin.css';
import './theme/tokens.css';
import './theme/components.css';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
