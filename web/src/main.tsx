import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { useStore } from './lib/store';
import { applyTheme } from './lib/theme';
import './styles.css';

applyTheme();
// Geliştirme sırasında tarayıcı konsolundan durumu incelemek için (yayın paketine girmez)
if (import.meta.env.DEV) (window as unknown as { __store: typeof useStore }).__store = useStore;
registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
