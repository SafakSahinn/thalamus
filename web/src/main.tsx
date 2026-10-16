import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import * as storeApi from './lib/store';
import { applyTheme } from './lib/theme';
import './styles.css';
import './blocks.css';
import './pages.css';
import './db.css';

applyTheme();
// Geliştirme sırasında tarayıcı konsolundan durumu incelemek için (yayın paketine girmez)
if (import.meta.env.DEV) Object.assign(window, { __store: storeApi.useStore, __api: storeApi });
registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
