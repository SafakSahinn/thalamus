import { lazy, Suspense, useEffect, useState } from 'react';
import CommandPalette, { openPalette } from './components/CommandPalette';
import { PromptHost } from './components/Prompt';
import Sidebar from './components/Sidebar';
import Peek from './components/Peek';
import Shortcuts from './components/Shortcuts';
import CommentsPanel from './components/CommentsPanel';
import ErrorBoundary from './components/ErrorBoundary';
import Tour from './components/Tour';
import Welcome from './components/Welcome';
import { parse, useHash } from './lib/router';
import './lib/gcal';
import { cloud } from './lib/google';
import { createNote, initAuth, initLocal, startSync, useStore } from './lib/store';
import CollectionPage from './pages/CollectionPage';
import DailyPage from './pages/DailyPage';
import Home from './pages/Home';
import Login from './pages/Login';
import NotePage from './pages/NotePage';
import { go } from './lib/router';

const GraphPage = lazy(() => import('./pages/GraphPage'));
const CalendarPage = lazy(() => import('./pages/CalendarPage'));
const DictionaryPage = lazy(() => import('./pages/DictionaryPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const ImportPage = lazy(() => import('./pages/ImportPage'));
const TrashPage = lazy(() => import('./pages/TrashPage'));
const LegalPage = lazy(() => import('./pages/LegalPage'));
const SharedPage = lazy(() => import('./pages/SharedPage'));

export default function App() {
  const account = useStore((s) => s.account);
  const ready = useStore((s) => s.ready);
  // Koleksiyon/alan tanımları değişince bütün ağaç yeniden çizilsin (sayfa durumu korunur)
  useStore((s) => s.settings.types);
  const route = parse(useHash());
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    if (!cloud) void initLocal();
    else void initAuth();
  }, []);

  useEffect(() => {
    if (cloud && account) void initLocal().then(startSync);
  }, [account]);

  // Herkese açık paylaşılan sayfa: giriş gerekmez
  if (route.name === 'shared') {
    return <Suspense fallback={null}><SharedPage id={route.id} /></Suspense>;
  }
  // Yasal sayfalar girişsiz de açılır
  if (route.name === 'legal' && (!cloud || !account)) {
    return <Suspense fallback={null}><LegalPage kind={route.kind} /></Suspense>;
  }
  if (cloud && account === undefined) return <div className="splash" />;
  if (cloud && !account) return <Login />;

  let page: React.ReactNode;
  switch (route.name) {
    case 'home': page = <Home />; break;
    case 'note': page = <NotePage id={route.id} />; break;
    case 'collection': page = <CollectionPage type={route.type} edit={route.edit} />; break;
    case 'graph': page = <GraphPage />; break;
    case 'calendar': page = <CalendarPage />; break;
    case 'daily': page = <DailyPage date={route.date} />; break;
    case 'dictionary': page = <DictionaryPage />; break;
    case 'settings': page = <SettingsPage />; break;
    case 'import': page = <ImportPage />; break;
    case 'trash': page = <TrashPage />; break;
    case 'legal': page = <LegalPage kind={route.kind} />; break;
  }

  return (
    <div className={`app ${drawer ? 'drawer-open' : ''}`}>
      <Sidebar route={route} onNav={() => setDrawer(false)} />
      <div className="scrim" onClick={() => setDrawer(false)} />
      <main>
        <header className="topbar">
          <button className="iconbtn menu" data-tour="menu" onClick={() => setDrawer(true)} aria-label="Menü">☰</button>
          <button className="iconbtn" onClick={() => history.back()} aria-label="Geri" title="Geri">←</button>
          <button className="iconbtn" onClick={() => history.forward()} aria-label="İleri" title="İleri">→</button>
          <span className="spacer" />
          <button className="iconbtn" data-tour="search" onClick={openPalette} aria-label="Ara" title="Ara (Ctrl+K)">🔍</button>
          <button className="btn small primary" data-tour="new-note" onClick={() => go(`/n/${createNote('note').id}`)} title="Yeni not">+ Not</button>
        </header>
        <ErrorBoundary resetKey={location.hash}>
          {ready ? <Suspense fallback={<div className="page muted">Yükleniyor…</div>}>{page}</Suspense> : <div className="page muted">Yükleniyor…</div>}
        </ErrorBoundary>
      </main>
      <CommandPalette />
      <PromptHost />
      <Welcome />
      <Tour />
      <CommentsPanel />
      <Shortcuts />
      <Peek />
    </div>
  );
}
