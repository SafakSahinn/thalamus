import 'fake-indexeddb/auto';
import { Editor } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import { schemaExtensions } from '../editor/extensions';
import { builtinTemplates } from './templates';

describe('hazır şablonlar', () => {
  for (const tpl of builtinTemplates()) {
    it(`${tpl.name} editöre yüklenir`, () => {
      const el = document.createElement('div');
      const ed = new Editor({ element: el, extensions: schemaExtensions(), content: '' });
      const t0 = Date.now();
      ed.commands.setContent(tpl.content!, { emitUpdate: false });
      expect(Date.now() - t0).toBeLessThan(2000);
      expect(ed.getJSON().content?.length).toBeGreaterThan(2);
      ed.destroy();
    });
  }
});
