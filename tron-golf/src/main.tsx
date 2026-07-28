import React from 'react';
import ReactDOM from 'react-dom/client';
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
