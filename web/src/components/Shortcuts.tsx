import { useEffect } from 'react';
import { create } from 'zustand';
import { go } from '../lib/router';
import { createNote } from '../lib/store';

export const useShortcutsHelp = create<{ open: boolean }>(() => ({ open: false }));
export const openShortcuts = () => useShortcutsHelp.setState({ open: true });

const mod = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl';

const GROUPS: [string, [string, string][]][] = [
  ['Genel', [
    [`${mod} K`, 'Ara / not oluştur'],
    ['Alt N', 'Yeni not'],
    ['Alt D', 'Bugünün günlüğü'],
    ['Alt G', 'Bağlantı haritası'],
    [`${mod} /`, 'Bu kısayol listesi'],
    ['Esc', 'Pencereyi kapat'],
  ]],
  ['Not içinde', [
    [`${mod} F`, 'Bul ve değiştir'],
    ['/', 'Blok ekleme menüsü'],
    ['[[', 'Nota bağlantı ver'],
    ['@', 'Tarih ya da not ekle'],
    [`${mod} Z  /  ${mod} Shift Z`, 'Geri al / yinele'],
  ]],
  ['Biçim', [
    [`${mod} B`, 'Kalın'],
    [`${mod} I`, 'İtalik'],
    [`${mod} U`, 'Altı çizili'],
    [`${mod} Shift S`, 'Üstü çizili'],
    [`${mod} Shift H`, 'Vurgula'],
    [`${mod} E`, 'Satır içi kod'],
    [`${mod} Alt 1 / 2 / 3`, 'Başlık 1 / 2 / 3'],
    [`${mod} Shift 8`, 'Madde listesi'],
    [`${mod} Shift 7`, 'Numaralı liste'],
    [`${mod} Shift 9`, 'Yapılacaklar listesi'],
    [`${mod} Shift B`, 'Alıntı'],
    [`${mod} Alt C`, 'Kod bloğu'],
    ['Tab / Shift Tab', 'Listede içeri / dışarı'],
  ]],
  ['Yazarken (Markdown)', [
    ['# , ## , ###', 'Başlık'],
    ['- veya *', 'Madde listesi'],
    ['1.', 'Numaralı liste'],
    ['[ ]', 'Yapılacak'],
    ['>', 'Alıntı'],
    ['```', 'Kod bloğu (```c gibi dil de yazılabilir)'],
    ['---', 'Ayırıcı çizgi'],
    ['$$x^2$$', 'Satır içi formül'],
    ['**metin**', 'Kalın'],
    ['==metin==', 'Vurgu'],
  ]],
];

/** Genel kısayollar ve kısayol listesi penceresi */
export default function Shortcuts() {
  const open = useShortcutsHelp((s) => s.open);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        useShortcutsHelp.setState({ open: !useShortcutsHelp.getState().open });
        return;
      }
      if (e.key === 'Escape' && useShortcutsHelp.getState().open) useShortcutsHelp.setState({ open: false });
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      const k = e.code;
      if (k === 'KeyN') { e.preventDefault(); go(`/n/${createNote('note').id}`); }
      else if (k === 'KeyD') { e.preventDefault(); go('/daily'); }
      else if (k === 'KeyG') { e.preventDefault(); go('/graph'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  if (!open) return null;
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && useShortcutsHelp.setState({ open: false })}>
      <div className="modal shortcuts" role="dialog" aria-label="Klavye kısayolları">
        <div className="row"><h3>⌨ Klavye kısayolları</h3><span className="spacer" /><button className="iconbtn" onClick={() => useShortcutsHelp.setState({ open: false })}>×</button></div>
        <div className="sc-grid">
          {GROUPS.map(([g, items]) => (
            <section key={g}>
              <h4>{g}</h4>
              {items.map(([k, d]) => (
                <div key={k} className="sc-row"><span>{d}</span><kbd>{k}</kbd></div>
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
