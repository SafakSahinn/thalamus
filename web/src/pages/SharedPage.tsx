import { generateHTML, type JSONContent } from '@tiptap/core';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { schemaExtensions } from '../editor/extensions';
import { loadShare, type SharedPage as Page } from '../lib/share';

const fmt = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });

/** Herkese açık paylaşılan not (giriş gerekmez, salt okunur) */
export default function SharedPage({ id }: { id: string }) {
  const [page, setPage] = useState<Page | null | undefined>(undefined);
  const [err, setErr] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadShare(id).then(setPage, (e) => setErr(e instanceof Error ? e.message : String(e)));
  }, [id]);

  const html = useMemo(() => {
    if (!page?.content) return '';
    try {
      return generateHTML(page.content as JSONContent, schemaExtensions());
    } catch {
      return '<p>İçerik gösterilemedi.</p>';
    }
  }, [page]);

  useEffect(() => {
    if (page) document.title = `${page.title} · Thalamus`;
    const el = ref.current;
    if (!el) return;
    el.querySelectorAll('a[href^="javascript:"]').forEach((a) => a.removeAttribute('href'));
    el.querySelectorAll('a[href]').forEach((a) => {
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
    });
    el.querySelectorAll<HTMLElement>('[data-type="inline-math"], [data-type="block-math"]').forEach((m) => {
      try {
        katex.render(m.getAttribute('data-latex') ?? '', m, { throwOnError: false, displayMode: m.dataset.type === 'block-math' });
      } catch {
        /* yok say */
      }
    });
    el.querySelectorAll<HTMLElement>('[data-type="callout"]').forEach((c) => {
      c.classList.add('callout', `bg-${c.dataset.color ?? 'gray'}`);
      const icon = document.createElement('span');
      icon.className = 'callout-emoji';
      icon.textContent = c.dataset.emoji ?? '💡';
      const body = document.createElement('div');
      body.className = 'callout-body';
      body.append(...c.childNodes);
      c.append(icon, body);
    });
    el.querySelectorAll<HTMLElement>('[data-type="date"]').forEach((d) => d.classList.add('datechip'));
  }, [html, page]);

  return (
    <div className="shared-page">
      <div className="shared-bar">
        <a href={import.meta.env.BASE_URL}><img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" width={20} height={20} /> Thalamus</a>
        <span className="muted small">ile paylaşıldı</span>
      </div>
      <div className="page">
        {page === undefined && !err && <p className="muted">Yükleniyor…</p>}
        {err && <p className="err">{err}</p>}
        {page === null && (
          <div className="empty">
            <p>Bu sayfa bulunamadı. Paylaşım kaldırılmış olabilir.</p>
          </div>
        )}
        {page && (
          <>
            {page.icon && <div className="shared-icon">{page.icon}</div>}
            <h1 className="title static">{page.title}</h1>
            {page.props.length > 0 && (
              <div className="props shared-props">
                {page.props.map((p) => (
                  <div className="prop" key={p.label}><label>{p.label}</label><div className="val">{p.value}</div></div>
                ))}
              </div>
            )}
            <div ref={ref} className="prose" dangerouslySetInnerHTML={{ __html: html }} />
            <p className="muted small shared-foot">Son güncelleme: {fmt.format(new Date(page.updated_at))}</p>
          </>
        )}
      </div>
    </div>
  );
}
