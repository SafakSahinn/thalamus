import { t } from '../i18n';
import { mergeAttributes, Node } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from '@tiptap/react';
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { displayTitle } from '../lib/format';
import { walk } from '../lib/links';
import { refreshDerived, saveSettings, uid, useStore } from '../lib/store';

// Senkron blok (Notion'daki gibi): aynı içerik birden çok sayfada; birinde düzenleyince hepsinde değişir.
// İçerik ayarlarda (settings.synced) tutulur, Drive ile eşitlenir. Blok yalnızca içeriğin kimliğini taşır.

// Editör bu dosyayı içe aktardığı için döngüyü kırmak üzere tembel yükle
const NoteEditor = lazy(() => import('./Editor'));

const EVENT = 'thalamus-synced';
interface SyncedEvent { sid: string; from: string }

let saveTimer: ReturnType<typeof setTimeout> | undefined;
/** Senkron içeriği kaydet (sık yazarken ayar dosyasını her tuşta yazmamak için kısa bekleme) */
function saveSynced(sid: string, content: unknown) {
  const s = useStore.getState().settings;
  const synced = { ...(s.synced ?? {}), [sid]: { content, updated_at: new Date().toISOString() } };
  // Ekranda hemen güncelle, diske/Drive'a biraz sonra
  useStore.setState({ settings: { ...s, synced } });
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    void saveSettings(useStore.getState().settings);
    // Bu bloğu kullanan sayfaların bağlantıları (harita, geri bağlantılar) ve arama metni güncellensin
    const users = Object.values(useStore.getState().notes).filter((n) => {
      let found = false;
      walk(n.content, (x) => {
        if (x.type === 'syncedBlock' && (x.attrs as { sid?: string } | undefined)?.sid === sid) found = true;
      });
      return found;
    });
    refreshDerived(users.map((n) => n.id));
  }, 800);
}

/** Bu senkron bloğu kullanan notlar */
function useUsage(sid: string) {
  const notes = useStore((s) => s.notes);
  return useMemo(() => Object.values(notes).filter((n) => {
    if (n.deleted_at || !n.content) return false;
    let found = false;
    walk(n.content, (x) => {
      if (x.type === 'syncedBlock' && (x.attrs as { sid?: string } | undefined)?.sid === sid) found = true;
    });
    return found;
  }), [notes, sid]);
}

function SyncedView({ node, editor }: ReactNodeViewProps) {
  const sid = node.attrs.sid as string;
  const data = useStore((s) => s.settings.synced?.[sid]);
  const usage = useUsage(sid);
  const me = useRef(uid());
  const [rev, setRev] = useState(0);
  const [showWhere, setShowWhere] = useState(false);

  // Aynı sayfadaki (ya da açık başka paneldeki) kopyası düzenlenince bunu yenile
  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<SyncedEvent>).detail;
      if (d.sid === sid && d.from !== me.current) setRev((r) => r + 1);
    };
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, [sid]);

  return (
    <NodeViewWrapper className="synced-block" data-drag-handle="">
      <div className="synced-head" contentEditable={false}>
        <span className="synced-badge">{t('writing.synced.badge')}</span>
        <button type="button" className="linkbtn small" onClick={() => setShowWhere(!showWhere)}>{t('writing.synced.pages', { count: usage.length })}</button>
        <span className="spacer" />
        <button
          type="button"
          className="linkbtn small"
          title={t('writing.synced.copyTitle')}
          onClick={() => void navigator.clipboard?.writeText(sid)}
        >{t('writing.synced.copyId')}</button>
      </div>
      {showWhere && (
        <div className="synced-where" contentEditable={false}>
          {usage.map((n) => <a key={n.id} href={`#/n/${n.id}`} className="notechip">{displayTitle(n)}</a>)}
        </div>
      )}
      <div className="synced-body">
        <Suspense fallback={<p className="muted small">{t('common.loading')}</p>}>
          <NoteEditor
            docKey={`synced-${sid}`}
            content={data?.content ?? null}
            rev={rev}
            readOnly={!editor.isEditable}
            placeholder={t('writing.synced.placeholder')}
            onChange={(doc) => {
              saveSynced(sid, doc);
              window.dispatchEvent(new CustomEvent<SyncedEvent>(EVENT, { detail: { sid, from: me.current } }));
            }}
          />
        </Suspense>
      </div>
    </NodeViewWrapper>
  );
}

export const SyncedBlock = Node.create({
  name: 'syncedBlock',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes: () => ({
    sid: { default: null, parseHTML: (el) => el.getAttribute('data-sid'), renderHTML: (a) => (a.sid ? { 'data-sid': a.sid } : {}) },
  }),
  parseHTML: () => [{ tag: 'div[data-type="synced-block"]' }],
  renderHTML: ({ HTMLAttributes }) => ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'synced-block' })],
  addNodeView() {
    // İç editörün olayları dış editöre geçmesin
    return ReactNodeViewRenderer(SyncedView, { stopEvent: () => true });
  },
});

/** Yeni senkron blok: boş içerik oluşturur, kimliğini döndürür */
export function newSyncedId(): string {
  const sid = uid();
  saveSynced(sid, { type: 'doc', content: [{ type: 'paragraph' }] });
  return sid;
}

/** Mevcut senkron bloklar (seçim listesi için): kimlik + ilk satır */
export function syncedList(): { sid: string; label: string }[] {
  const all = useStore.getState().settings.synced ?? {};
  return Object.entries(all)
    .sort((a, b) => b[1].updated_at.localeCompare(a[1].updated_at))
    .map(([sid, v]) => {
      let text = '';
      walk(v.content, (x) => {
        if (!text && x.type === 'text' && x.text) text = x.text;
      });
      return { sid, label: text.slice(0, 60) || t('writing.synced.empty') };
    });
}
