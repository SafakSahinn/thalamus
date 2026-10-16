import { lazy, Suspense, useEffect, useState } from 'react';
import CommandPalette, { openPalette } from './components/CommandPalette';
import { PromptHost } from './components/Prompt';
import Sidebar from './components/Sidebar';
import { parse, useHash } from './lib/router';
import { createNote, initLocal, startSync, useStore } from './lib/store';
import { cloud, supabase } from './lib/supabase';
import CollectionPage from './pages/CollectionPage';
import DailyPage from './pages/DailyPage';
import Home from './pages/Home';
import Login, { NewPassword } from './pages/Login';
import NotePage from './pages/NotePage';
import { go } from './lib/router';

const GraphPage = lazy(() => import('./pages/GraphPage'));
const DictionaryPage = lazy(() => import('./pages/DictionaryPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const ImportPage = lazy(() => import('./pages/ImportPage'));
const TrashPage = lazy(() => import('./pages/TrashPage'));
const LegalPage = lazy(() => import('./pages/LegalPage'));

export default function App() {
  const session = useStore((s) => s.session);
  const ready = useStore((s) => s.ready);
  const route = parse(useHash());
  const [drawer, setDrawer] = useState(false);
  const [recovery, setRecovery] = useState(false);

  useEffect(() => {
    if (!cloud) {
      void initLocal();
      return;
    }
    void supabase.auth.getSession().then(({ data }) => useStore.setState({ session: data.session }));
    const { data } = supabase.auth.onAuthStateChange((ev, s) => {
      if (ev === 'PASSWORD_RECOVERY') setRecovery(true);
      useStore.setState({ session: s });
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (cloud && session) {
      void initLocal().then(startSync);
    }
  }, [session]);

  // Yasal sayfalar girişsiz de açılır
  if (route.name === 'legal' && (!cloud || !session)) {
    return <Suspense fallback={null}><LegalPage kind={route.kind} /></Suspense>;
  }
  if (recovery) return <NewPassword onDone={() => setRecovery(false)} />;
  if (cloud && session === undefined) return <div className="splash" />;
  if (cloud && !session) return <Login />;

  let page: React.ReactNode;
  switch (route.name) {
    case 'home': page = <Home />; break;
    case 'note': page = <NotePage id={route.id} />; break;
    case 'collection': page = <CollectionPage type={route.type} />; break;
    case 'graph': page = <GraphPage />; break;
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
          <button className="iconbtn menu" onClick={() => setDrawer(true)} aria-label="Menü">☰</button>
          <button className="iconbtn" onClick={() => history.back()} aria-label="Geri" title="Geri">←</button>
          <button className="iconbtn" onClick={() => history.forward()} aria-label="İleri" title="İleri">→</button>
          <span className="spacer" />
          <button className="iconbtn" onClick={openPalette} aria-label="Ara" title="Ara (Ctrl+K)">🔍</button>
          <button className="btn small primary" onClick={() => go(`/n/${createNote('note').id}`)} title="Yeni not">+ Not</button>
        </header>
        {ready ? <Suspense fallback={<div className="page muted">Yükleniyor…</div>}>{page}</Suspense> : <div className="page muted">Yükleniyor…</div>}
      </main>
      <CommandPalette />
      <PromptHost />
    </div>
  );
}
