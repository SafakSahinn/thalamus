import { t } from '../i18n';
import { useEffect } from 'react';
import { create } from 'zustand';
import { go } from '../lib/router';
import { createNote } from '../lib/store';

export const useShortcutsHelp = create<{ open: boolean }>(() => ({ open: false }));
export const openShortcuts = () => useShortcutsHelp.setState({ open: true });

const mod = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl';

const groups = (): [string, [string, string][]][] => [
  [t('keys.shortcuts.general'), [
    [`${mod} K`, t('keys.shortcuts.search')],
    ['Alt N', t('keys.shortcuts.newNote')],
    ['Alt D', t('keys.shortcuts.daily')],
    ['Alt G', t('keys.shortcuts.graph')],
    ['Alt Y', t('keys.shortcuts.stickies')],
    [`${mod} /`, t('keys.shortcuts.list')],
    ['Esc', t('keys.shortcuts.close')],
  ]],
  [t('keys.shortcuts.inNote'), [
    [`${mod} F`, t('keys.shortcuts.find')],
    ['/', t('keys.shortcuts.slash')],
    ['[[', t('keys.shortcuts.link')],
    ['@', t('keys.shortcuts.mention')],
    [`${mod} Z  /  ${mod} Shift Z`, t('keys.shortcuts.undo')],
  ]],
  [t('keys.shortcuts.format'), [
    [`${mod} B`, t('keys.shortcuts.bold')],
    [`${mod} I`, t('keys.shortcuts.italic')],
    [`${mod} U`, t('keys.shortcuts.underline')],
    [`${mod} Shift S`, t('keys.shortcuts.strike')],
    [`${mod} Shift H`, t('keys.shortcuts.highlight')],
    [`${mod} E`, t('keys.shortcuts.code')],
    [`${mod} Alt 1 / 2 / 3`, t('keys.shortcuts.headings')],
    [`${mod} Shift 8`, t('keys.shortcuts.bullet')],
    [`${mod} Shift 7`, t('keys.shortcuts.ordered')],
    [`${mod} Shift 9`, t('keys.shortcuts.todo')],
    [`${mod} Shift B`, t('keys.shortcuts.quote')],
    [`${mod} Alt C`, t('keys.shortcuts.codeBlock')],
    ['Tab / Shift Tab', t('keys.shortcuts.indent')],
  ]],
  [t('keys.shortcuts.markdown'), [
    ['# , ## , ###', t('keys.shortcuts.heading')],
    [`- ${t('keys.shortcuts.or')} *`, t('keys.shortcuts.bullet')],
    ['1.', t('keys.shortcuts.ordered')],
    ['[ ]', t('keys.shortcuts.task')],
    ['>', t('keys.shortcuts.quote')],
    ['```', t('keys.shortcuts.codeBlockLang')],
    ['---', t('keys.shortcuts.divider')],
    ['$$x^2$$', t('keys.shortcuts.inlineMath')],
    [`**${t('keys.shortcuts.text')}**`, t('keys.shortcuts.bold')],
    [`==${t('keys.shortcuts.text')}==`, t('keys.shortcuts.mark')],
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
      <div className="modal shortcuts" role="dialog" aria-label={t('keys.shortcuts.aria')}>
        <div className="row"><h3>{t('keys.shortcuts.title')}</h3><span className="spacer" /><button className="iconbtn" onClick={() => useShortcutsHelp.setState({ open: false })} aria-label={t('common.close')}>×</button></div>
        <div className="sc-grid">
          {groups().map(([g, items]) => (
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
