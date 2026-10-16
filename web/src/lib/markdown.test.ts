import { describe, expect, it } from 'vitest';
import { noteToMarkdown } from './markdown';
import type { Note } from './types';

const mk = (id: string, type: string, title: string, props: Record<string, unknown> = {}, content: unknown = null): Note => ({
  id, type, title, props, content, text: '', links: [], pinned: false, created_at: '2026-10-16T10:00:00.000Z', updated_at: '2026-10-16T11:00:00.000Z', deleted_at: null,
});

const t = (text: string, marks?: { type: string; attrs?: Record<string, unknown> }[]) => ({ type: 'text', text, ...(marks ? { marks } : {}) });
const p = (...c: unknown[]) => ({ type: 'paragraph', content: c });

describe('Markdown dışa aktarma', () => {
  const author = mk('a', 'person', 'Harari');
  const book = mk('b', 'book', 'Sapiens', { author: ['a'], status: 'Bitti', rating: 5, pages: 456 }, {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 2 }, content: [t('Özet')] },
      p(t('Kalın', [{ type: 'bold' }]), t(' ve '), { type: 'wikiLink', attrs: { id: 'a', label: 'eski' } }, t(' '), { type: 'inlineMath', attrs: { latex: 'E=mc^2' } }),
      { type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: true }, content: [p(t('bitti'))] }, { type: 'taskItem', attrs: { checked: false }, content: [p(t('yapılacak'))] }] },
      { type: 'codeBlock', attrs: { language: 'c' }, content: [t('int x = 1;')] },
      { type: 'table', content: [
        { type: 'tableRow', content: [{ type: 'tableHeader', content: [p(t('A'))] }, { type: 'tableHeader', content: [p(t('B'))] }] },
        { type: 'tableRow', content: [{ type: 'tableCell', content: [p(t('1'))] }, { type: 'tableCell', content: [p(t('x|y'))] }] },
      ] },
      { type: 'callout', attrs: { emoji: '💡' }, content: [p(t('Not'))] },
      { type: 'blockMath', attrs: { latex: '\\frac{1}{2}' } },
      { type: 'image', attrs: { src: 'gd://f1#şema.png' } },
    ],
  });
  const notes = { a: author, b: book };

  it('ön bilgi ve gövde', () => {
    const md = noteToMarkdown(book, { notes, asset: (src) => (src.startsWith('gd://f1') ? 'ekler/şema.png' : null) });
    expect(md).toContain('title: "Sapiens"');
    expect(md).toContain('"Yazar":\n  - "[[Harari]]"');
    expect(md).toContain('"Durum": "Bitti"');
    expect(md).toContain('"Puan": 5');
    expect(md).toContain('## Özet');
    expect(md).toContain('**Kalın** ve [[Harari]] $E=mc^2$');
    expect(md).toContain('- [x] bitti\n- [ ] yapılacak');
    expect(md).toContain('```c\nint x = 1;\n```');
    expect(md).toContain('| A | B |\n| --- | --- |\n| 1 | x\\|y |');
    expect(md).toContain('> 💡 Not');
    expect(md).toContain('$$\n\\frac{1}{2}\n$$');
    expect(md).toContain('![şema.png](ekler/%C5%9Fema.png)');
  });
});
