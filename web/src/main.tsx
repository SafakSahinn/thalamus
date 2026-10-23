import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { initI18n } from './i18n';
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

// Dil paketi yüklenmeden çizilmesin (Türkçe dışındaki diller ayrı parça olarak gelir)
void initI18n().finally(() =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  ),
);
