import 'fake-indexeddb/auto';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { createNote, initLocal } from '../lib/store';
import { applyTemplate, builtinTemplates } from '../lib/templates';
import NotePage from './NotePage';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('not sayfası + şablon', () => {
  for (const tpl of builtinTemplates()) {
    it(`${tpl.name} açık editöre uygulanır`, async () => {
      await initLocal();
      const n = createNote(tpl.type, 'Deneme');
      const el = document.createElement('div');
      document.body.appendChild(el);
      const root = createRoot(el);
      await act(async () => root.render(<NotePage id={n.id} />));
      const t0 = Date.now();
      await act(async () => applyTemplate(n, tpl));
      await act(async () => new Promise((r) => setTimeout(r, 50)));
      expect(Date.now() - t0).toBeLessThan(3000);
      expect(el.querySelector('.ProseMirror h2')?.textContent).toBeTruthy();
      await act(async () => root.unmount());
      el.remove();
    }, 15000);
  }
});
