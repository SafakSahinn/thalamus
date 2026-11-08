import { t } from '../i18n';
import { lazy, Suspense, useEffect } from 'react';
import { create } from 'zustand';
import { go, useHash } from '../lib/router';

const NotePage = lazy(() => import('../pages/NotePage'));

/** Notion'daki "yan panelde aç": koleksiyondan çıkmadan notu sağda açar */
export const usePeek = create<{ id: string | null; closing: boolean }>(() => ({ id: null, closing: false }));
export const openPeek = (id: string) => usePeek.setState({ id, closing: false });
/** Paneli sağa kaydırarak kapatır; animasyon bitince kaldırılır */
export const closePeek = () => {
  if (!usePeek.getState().id) return;
  usePeek.setState({ closing: true });
  // Animasyon çalışmazsa (sekme arka planda vb.) yine de kapansın
  setTimeout(() => usePeek.getState().closing && removePeek(), 400);
};
const removePeek = () => usePeek.setState({ id: null, closing: false });

/** Bağlantı tıklamasını yan panele yönlendirir (Ctrl/⌘ ile tıklama tam sayfa açar) */
export const peekClick = (id: string) => (e: React.MouseEvent) => {
  if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
  e.preventDefault();
  openPeek(id);
};

export default function Peek() {
  const id = usePeek((s) => s.id);
  const closing = usePeek((s) => s.closing);
  const hash = useHash();
  // Sayfa değişince (ör. "Tam sayfa aç") beklemeden kapanır
  useEffect(() => removePeek(), [hash]);
  useEffect(() => {
    if (!id) return;
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('.modal-back')) closePeek();
    };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [id]);
  if (!id) return null;
  return (
    <>
      <div className={`peek-scrim${closing ? ' closing' : ''}`} onClick={closePeek} />
      <aside
        className={`peek${closing ? ' closing' : ''}`}
        role="dialog"
        aria-label={t('panels.peek.aria')}
        onAnimationEnd={(e) => e.target === e.currentTarget && closing && removePeek()}
      >
        <div className="peek-bar">
          <button type="button" className="iconbtn" title={t('panels.peek.close')} onClick={closePeek}>»</button>
          <button type="button" className="btn small ghost" onClick={() => go(`/n/${id}`)}>{t('panels.peek.full')}</button>
        </div>
        <div className="peek-body">
          <Suspense fallback={<div className="page muted">{t('common.loading')}</div>}>
            <NotePage key={id} id={id} />
          </Suspense>
        </div>
      </aside>
    </>
  );
}
