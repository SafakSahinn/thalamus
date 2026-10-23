import { localeTag, t } from '../i18n';
import { useEffect, useRef, useState } from 'react';
import { go } from '../lib/router';
import { createNote, useStore } from '../lib/store';
import { createDefault, createFromTemplate, defaultTemplateId, newBlankTemplate, setDefaultTemplate, templatesFor } from '../lib/templates';
import type { TypeDef } from '../lib/types';

/** "+ Yeni" düğmesi ve şablon menüsü */
export default function NewButton({ t: type, extraProps }: { t: TypeDef; extraProps: () => Record<string, unknown> }) {
  const notes = useStore((s) => s.notes);
  useStore((s) => s.settings.defaultTemplates);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const out = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', out);
    return () => document.removeEventListener('mousedown', out);
  }, [open]);
  const tpls = templatesFor(type.id, notes);
  const def = defaultTemplateId(type.id);
  const label = type.label.toLocaleLowerCase(localeTag());

  return (
    <div className="split-btn" ref={ref}>
      <button className="btn primary" onClick={() => go(`/n/${createDefault(type.id, extraProps()).id}`)}>{t('pages.newButton.new', { label })}</button>
      <button className="btn primary caret" onClick={() => setOpen(!open)} aria-label={t('pages.newButton.templates')}>▾</button>
      {open && (
        <div className="tb-pop tpl-menu">
          <button type="button" className="bm-row" onClick={() => go(`/n/${createNote(type.id, '', extraProps()).id}`)}>
            {t('pages.newButton.blank', { label })} {!def && <span className="muted small">{t('pages.newButton.default')}</span>}
          </button>
          {tpls.length > 0 && <div className="bm-h">{t('pages.newButton.templates')}</div>}
          {tpls.map((tp) => (
            <div key={tp.id} className="tpl-row">
              <button type="button" className="bm-row grow" onClick={() => go(`/n/${createFromTemplate(tp, extraProps()).id}`)}>
                {tp.icon} {tp.name}
              </button>
              <button type="button" className={`iconbtn ${def === tp.id ? 'on' : ''}`} title={def === tp.id ? t('pages.newButton.isDefault') : t('pages.newButton.makeDefault')}
                onClick={() => void setDefaultTemplate(type.id, def === tp.id ? undefined : tp.id)}>{def === tp.id ? '★' : '☆'}</button>
              {tp.noteId && <button type="button" className="iconbtn" title={t('pages.newButton.editTemplate')} onClick={() => go(`/n/${tp.noteId}`)}>✎</button>}
            </div>
          ))}
          <div className="bm-sep" />
          <button type="button" className="bm-row" onClick={() => go(`/n/${newBlankTemplate(type.id).id}`)}>{t('pages.newButton.newTemplate')}</button>
        </div>
      )}
    </div>
  );
}
