import { useEffect, useLayoutEffect, useState, type ReactNode } from 'react';
import { create } from 'zustand';
import { parse, useHash, type Route } from '../lib/router';

// Adım adım tanıtım turu: gerçek düğmeleri sırayla vurgular, kullanıcı kendisi tıklar.
// Hedefler data-tour="…" ile işaretli. Hedef görünmüyorsa (telefonda kapalı menü) önce menü düğmesi gösterilir.

interface Step {
  target: string;
  text: ReactNode;
  /** Bu sayfaya gelince kendiliğinden ilerler (yoksa "İleri" düğmesi) */
  until?: (r: Route) => boolean;
  /** Hedef kenar çubuğunda: telefonda önce menü açılmalı */
  sidebar?: boolean;
}

const STEPS: Step[] = [
  {
    target: 'new-note',
    text: <>Her şey bir notla başlar. Sağ üstteki <b>+ Not</b> düğmesine bas.</>,
    until: (r) => r.name === 'note',
  },
  {
    target: 'title',
    text: <>Notuna bir başlık ver, ör. <i>“Thalamus’u deniyorum”</i>. Sonra <b>İleri</b>’ye bas.</>,
  },
  {
    target: 'editor',
    text: (
      <>
        Burası yazı alanı. Boş bir satırda <b>/</b> yaz: başlık, liste, tablo, formül, görsel, PDF gibi blokların listesi açılır.
        <br /><b>[[</b> yazıp bir notun adını seçersen iki not birbirine bağlanır. <b>@</b> ile tarih eklersin. Biraz dene, sonra <b>İleri</b>.
      </>
    ),
  },
  {
    target: 'props',
    text: <>Notun alanları: türü (kitap, makale, ders…), konular ve bağlantılar. Türünü değiştirirsen o koleksiyonun alanları gelir.</>,
  },
  {
    target: 'nav-daily',
    sidebar: true,
    text: <>Soldan <b>Günlük</b>’e tıkla.</>,
    until: (r) => r.name === 'daily',
  },
  {
    target: 'routines',
    text: <>Her gün için bir günlük sayfası açılır. Üstteki <b>rutinlerini</b> (ör. okuma, spor) işaretlersin; altta ne kadar düzenli gittiğini gösteren bir ısı haritası birikir. Rutinleri <b>Ayarlar</b>’dan değiştirebilirsin.</>,
  },
  {
    target: 'coll-book',
    sidebar: true,
    text: <>Kitaplar, makaleler, dersler, deneyler… her biri bir <b>koleksiyon</b>. Soldan <b>Kitaplar</b>’a tıkla.</>,
    until: (r) => r.name === 'collection' && r.type === 'book',
  },
  {
    target: 'views',
    text: <>Bir koleksiyonu tablo, galeri, pano ya da takvim olarak görebilir; süzüp sıralayabilirsin. <b>+ Yeni</b> ile kayıt eklerken kitap kapağını da otomatik bulur.</>,
  },
  {
    target: 'coll-word',
    sidebar: true,
    text: <>Şimdi soldan <b>Sözlük</b>’e tıkla.</>,
    until: (r) => r.name === 'dictionary',
  },
  {
    target: 'dictionary',
    text: <>Okurken bir kelime eklediğinde (not içinde <b>Kelimeler</b> alanından) burada toplanır ve hangi kitap, makale ya da derslerde geçtiği görünür. Aynı kelime farklı kaynaklarda geçse de tek kayıttır; tekrar kartlarıyla çalışabilirsin.</>,
  },
  {
    target: 'nav-calendar',
    sidebar: true,
    text: <>Şimdi <b>Takvim</b>’e tıkla.</>,
    until: (r) => r.name === 'calendar',
  },
  {
    target: 'calendar',
    text: <>Bütün notlarındaki tarihler burada toplanır. Bir günün köşesindeki <b>＋</b> ile o güne etkinlik eklersin, öğeleri sürükleyerek tarihini değiştirirsin.</>,
  },
  {
    target: 'nav-graph',
    sidebar: true,
    text: <><b>Bağlantı haritası</b>’na tıkla.</>,
    until: (r) => r.name === 'graph',
  },
  {
    target: 'graph',
    text: <>Notların ve aralarındaki bağlantılar bir harita olarak görünür. Ne kadar bağlantı verirsen o kadar zenginleşir.</>,
  },
  {
    target: 'search',
    text: <>Her yerden <b>Ctrl K</b> (telefonda 🔍) ile arayabilir, yoksa aynı yerden yeni not oluşturabilirsin.</>,
  },
  {
    target: 'nav-settings',
    sidebar: true,
    text: <>Son olarak <b>Ayarlar</b>’a tıkla.</>,
    until: (r) => r.name === 'settings',
  },
  {
    target: 'gcal',
    text: <>Buradan <b>Google Takvim</b>’i bağlarsan tarihlerin telefonundaki takvimde de görünür, hatırlatma gelir. İstediğin zaman bağlayabilirsin.</>,
  },
  {
    target: '',
    text: (
      <>
        Hazırsın! Notların Google Drive’ındaki <b>Thalamus</b> klasöründe güvende.
        <br />Sol menünün altında ayrıca <b>İçe aktar</b> (Notion, Obsidian, Markdown), <b>Çöp kutusu</b> ve <b>Kısayollar</b> (Ctrl /) var. Bu turu istediğin zaman <b>Ayarlar</b>’dan yeniden başlatabilirsin.
      </>
    ),
  },
];

const useTour = create<{ step: number | null }>(() => ({ step: null }));

export const startTour = () => useTour.setState({ step: 0 });
const stop = () => useTour.setState({ step: null });
const next = () => useTour.setState((s) => ({ step: s.step === null || s.step + 1 >= STEPS.length ? null : s.step + 1 }));

const find = (name: string): HTMLElement | null => {
  if (!name) return null;
  for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`)) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && r.right > 0 && r.left < innerWidth) return el;
  }
  return null;
};

export default function Tour() {
  const step = useTour((s) => s.step);
  const hash = useHash();
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [viaMenu, setViaMenu] = useState(false);
  const s = step === null ? null : STEPS[step];

  // Hedef sayfaya gelindiyse ilerle
  // Kullanıcı birkaç adım öne geçtiyse (ör. açıklamayı okumadan başka sayfaya tıkladıysa) tur da oraya atlar
  useEffect(() => {
    if (step === null) return;
    const r = parse(hash);
    for (let i = STEPS.length - 1; i >= step; i--) {
      if (STEPS[i].until?.(r)) {
        useTour.setState({ step: i + 1 < STEPS.length ? i + 1 : null });
        return;
      }
    }
  }, [hash, step]);

  // Hedefi izle (sayfa değişir, menü açılır, düzen kayar)
  useLayoutEffect(() => {
    if (!s) return;
    let shown: HTMLElement | null = null;
    const tick = () => {
      let el = find(s.target);
      let menu = false;
      if (!el && s.sidebar) {
        el = find('menu');
        menu = Boolean(el);
      }
      setViaMenu(menu);
      // Yalnızca hedef ilk bulunduğunda kaydır; kullanıcının kaydırmasıyla kavga etme
      if (el && !menu && el !== shown) el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      shown = menu ? null : el;
      setRect(el ? el.getBoundingClientRect() : null);
    };
    tick();
    const id = setInterval(tick, 250);
    addEventListener('resize', tick);
    return () => {
      clearInterval(id);
      removeEventListener('resize', tick);
    };
  }, [s]);

  if (!s || step === null) return null;

  const pad = 6;
  const W = Math.min(340, innerWidth - 32);
  let top = innerHeight / 2 - 90;
  let left = innerWidth / 2 - W / 2;
  if (rect) {
    const below = rect.bottom + pad + 12;
    top = below + 190 < innerHeight ? below : Math.max(16, rect.top - pad - 12 - 190);
    left = Math.min(Math.max(16, rect.left + rect.width / 2 - W / 2), innerWidth - W - 16);
    // Büyük hedefte (editör, takvim) kartı hedefin içine, alta yerleştir
    if (rect.height > innerHeight * 0.5) top = Math.min(innerHeight - 220, Math.max(rect.top + 16, innerHeight - 240));
  }

  return (
    <div className="tour" aria-live="polite">
      {rect ? (
        <div className="tour-hole" style={{ top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }} />
      ) : (
        <div className="tour-dim" />
      )}
      <div className="tour-card" role="dialog" aria-label="Tanıtım turu" style={{ top, left, width: W }}>
        <div className="tour-text">{viaMenu ? <>Önce sol üstteki <b>☰</b> menüyü aç.</> : s.text}</div>
        <div className="tour-foot">
          <span className="muted small">{step + 1} / {STEPS.length}</span>
          <span className="spacer" />
          {step + 1 < STEPS.length && <button type="button" className="btn ghost small" onClick={stop}>Turu atla</button>}
          {!s.until && (
            <button type="button" className="btn primary small" onClick={next}>{step + 1 < STEPS.length ? 'İleri' : 'Bitir'}</button>
          )}
          {s.until && <button type="button" className="btn small" onClick={next} title="Bu adımı atla">Adımı atla</button>}
        </div>
      </div>
    </div>
  );
}
