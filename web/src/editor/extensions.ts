import { Extension, type AnyExtension, type Editor } from '@tiptap/core';
import { Details, DetailsContent, DetailsSummary } from '@tiptap/extension-details';
import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import Mathematics from '@tiptap/extension-mathematics';
import { TableKit } from '@tiptap/extension-table';
import { Color, TextStyle } from '@tiptap/extension-text-style';
import Youtube from '@tiptap/extension-youtube';
import { Placeholder } from '@tiptap/extensions';
import { PluginKey } from '@tiptap/pm/state';
import StarterKit from '@tiptap/starter-kit';
import Suggestion from '@tiptap/suggestion';
import { promptText } from '../components/Prompt';
import { norm } from '../lib/links';
import { createNote, resolveFileUrl, uploadFile } from '../lib/store';
import { Bookmark, Callout, Column, Columns, columnsContent, DateChip, Embed, FileBlock, Mermaid, Toc } from './blocks';
import { CodeBlock } from './CodeBlock';
import { CollectionBlock } from './CollectionBlock';
import { newSyncedId, SyncedBlock, syncedList } from './SyncedBlock';
import { ButtonBlock } from './ButtonBlock';
import { FindReplace } from './FindReplace';
import { Mention } from './Mention';
import { suggestConfig, type Entry } from './suggest';
import { WikiLink } from './WikiLink';

const editMath = async (editor: Editor, kind: 'inline' | 'block', latex: string, pos: number) => {
  const v = await promptText(kind === 'inline' ? 'Satır içi formül (LaTeX)' : 'Blok formül (LaTeX)', latex, {
    multiline: kind === 'block',
    hint: 'Örnek: V = I \\cdot R  ·  \\frac{1}{2\\pi f C}  ·  Boş bırakırsan formül silinir.',
  });
  if (v === null) return;
  const chain = editor.chain().setNodeSelection(pos);
  if (!v.trim()) {
    (kind === 'inline' ? chain.deleteInlineMath({ pos }) : chain.deleteBlockMath({ pos })).run();
  } else {
    (kind === 'inline' ? chain.updateInlineMath({ latex: v, pos }) : chain.updateBlockMath({ latex: v, pos })).run();
  }
};

/** Görsel olmayan dosyalar (PDF, Word, veri…) dosya bloğu olarak eklenir. */
export async function insertFile(editor: Editor, file: File, pos?: number) {
  if (file.type.startsWith('image/')) return insertImageFile(editor, file, pos);
  try {
    const src = await uploadFile(file, file.name || 'dosya');
    const node = { type: 'fileBlock', attrs: { src, name: file.name || 'dosya', size: file.size, mime: file.type } };
    const chain = editor.chain().focus();
    (pos !== undefined ? chain.insertContentAt(pos, node) : chain.insertContent(node)).run();
  } catch (e) {
    alert(e instanceof Error ? e.message : String(e));
  }
}

/** Yeni açılır blok kapalı başlamasın: imlecin bulunduğu bloğun açma düğmesine bas (görünüm kendi durumunu günceller) */
export function openDetailsAt(editor: Editor) {
  setTimeout(() => {
    const { node } = editor.view.domAtPos(editor.state.selection.from);
    const el = (node instanceof Element ? node : node.parentElement)?.closest('.details');
    if (el && !el.classList.contains('is-open')) el.querySelector<HTMLButtonElement>(':scope > button')?.click();
    editor.commands.focus();
  }, 0);
  return true;
}

function pickFile(editor: Editor, accept = '*/*') {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = accept;
  input.onchange = () => {
    const f = input.files?.[0];
    if (f) void insertFile(editor, f);
  };
  input.click();
}

export async function insertImageFile(editor: Editor, file: File, pos?: number) {
  try {
    const src = await uploadFile(file, file.name || 'gorsel.png');
    const chain = editor.chain().focus();
    (pos !== undefined ? chain.insertContentAt(pos, { type: 'image', attrs: { src } }) : chain.setImage({ src })).run();
  } catch (e) {
    alert(e instanceof Error ? e.message : String(e));
  }
}


/** Ekler gd:// (Drive) veya local:// (yalnızca bu cihaz) olarak saklanır, gösterirken yerel adrese çevrilir. */
const StoredImage = Image.extend({
  addNodeView() {
    return ({ node }) => {
      const img = document.createElement('img');
      img.alt = (node.attrs.alt as string) ?? '';
      img.loading = 'lazy';
      resolveFileUrl(node.attrs.src as string).then((u) => (img.src = u), () => img.classList.add('broken'));
      return { dom: img };
    };
  },
});

/** Sütunları ekler ve imleci ilk sütuna koyar */
function insertColumns(e: Editor, r: { from: number; to: number }, n: number) {
  e.chain().focus().deleteRange(r).insertContent(columnsContent(n)).run();
  let target = -1;
  e.state.doc.descendants((node, pos) => {
    if (target < 0 && node.type.name === 'columns' && pos >= r.from - 2) target = pos;
    return target < 0;
  });
  if (target >= 0) e.commands.setTextSelection(target + 3);
}

const SLASH: (Omit<Entry, 'key'> & { keys?: string })[] = [
  { icon: 'H1', label: 'Başlık 1', action: (e, r) => e.chain().focus().deleteRange(r).setHeading({ level: 1 }).run() },
  { icon: 'H2', label: 'Başlık 2', action: (e, r) => e.chain().focus().deleteRange(r).setHeading({ level: 2 }).run() },
  { icon: 'H3', label: 'Başlık 3', action: (e, r) => e.chain().focus().deleteRange(r).setHeading({ level: 3 }).run() },
  { icon: '•', label: 'Madde listesi', keys: 'liste bullet', action: (e, r) => e.chain().focus().deleteRange(r).toggleBulletList().run() },
  { icon: '1.', label: 'Numaralı liste', keys: 'liste ordered', action: (e, r) => e.chain().focus().deleteRange(r).toggleOrderedList().run() },
  { icon: '☑', label: 'Yapılacaklar', keys: 'todo gorev checkbox', action: (e, r) => e.chain().focus().deleteRange(r).toggleTaskList().run() },
  { icon: '❝', label: 'Alıntı', keys: 'quote', action: (e, r) => e.chain().focus().deleteRange(r).toggleBlockquote().run() },
  { icon: '{}', label: 'Kod bloğu', keys: 'code c cpp python matlab verilog program', action: (e, r) => e.chain().focus().deleteRange(r).toggleCodeBlock().run() },
  { icon: '∑', label: 'Formül (blok)', keys: 'math latex denklem', action: (e, r) => {
    e.chain().focus().deleteRange(r).run();
    void promptText('Blok formül (LaTeX)', '', { multiline: true, hint: 'Örnek: H(s) = \\frac{1}{1 + sRC}' }).then((v) => {
      if (v?.trim()) e.chain().focus().insertBlockMath({ latex: v }).run();
    });
  } },
  { icon: '𝑥', label: 'Formül (satır içi)', keys: 'math latex inline', action: (e, r) => {
    e.chain().focus().deleteRange(r).run();
    void promptText('Satır içi formül (LaTeX)', '', { hint: 'Kısayol: metin içinde $$V=IR$$ yaz.' }).then((v) => {
      if (v?.trim()) e.chain().focus().insertInlineMath({ latex: v }).run();
    });
  } },
  { icon: '▦', label: 'Tablo', keys: 'table', action: (e, r) => e.chain().focus().deleteRange(r).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
  { icon: '―', label: 'Ayırıcı çizgi', keys: 'hr divider', action: (e, r) => e.chain().focus().deleteRange(r).setHorizontalRule().run() },
  { icon: '🖼', label: 'Görsel yükle', keys: 'image resim foto', action: (e, r) => {
    e.chain().focus().deleteRange(r).run();
    pickFile(e, 'image/*');
  } },
  { icon: '📎', label: 'Dosya / PDF / ses / video', keys: 'file pdf ek belge dosya yukle ses video audio mp3 mp4 kayit', action: (e, r) => {
    e.chain().focus().deleteRange(r).run();
    pickFile(e);
  } },
  { icon: '▸', label: 'Açılır bölüm (toggle)', keys: 'toggle details katla gizle', action: (e, r) => e.chain().focus().deleteRange(r).setDetails().run() && openDetailsAt(e) },
  { icon: '▸1', label: 'Açılır başlık 1', keys: 'toggle heading baslik katla h1', action: (e, r) => e.chain().focus().deleteRange(r).setDetails().updateAttributes('details', { level: 1 }).run() && openDetailsAt(e) },
  { icon: '▸2', label: 'Açılır başlık 2', keys: 'toggle heading baslik katla h2', action: (e, r) => e.chain().focus().deleteRange(r).setDetails().updateAttributes('details', { level: 2 }).run() && openDetailsAt(e) },
  { icon: '▸3', label: 'Açılır başlık 3', keys: 'toggle heading baslik katla h3', action: (e, r) => e.chain().focus().deleteRange(r).setDetails().updateAttributes('details', { level: 3 }).run() && openDetailsAt(e) },
  { icon: '💡', label: 'Bilgi kutusu (callout)', keys: 'callout not uyari kutu', action: (e, r) => e.chain().focus().deleteRange(r).insertContent({ type: 'callout', content: [{ type: 'paragraph' }] }).run() },
  { icon: '▥', label: '2 sütun', keys: 'columns kolon yan yana', action: (e, r) => insertColumns(e, r, 2) },
  { icon: '▥', label: '3 sütun', keys: 'columns kolon yan yana', action: (e, r) => insertColumns(e, r, 3) },
  { icon: '▶', label: 'Düğme', keys: 'button dugme sablon ekle tekrar', action: (e, r) => e.chain().focus().deleteRange(r).insertContent({ type: 'buttonBlock' }).run() },
  { icon: '↻', label: 'Senkron blok (yeni)', keys: 'synced senkron esitlenen ortak blok kopya', action: (e, r) => e.chain().focus().deleteRange(r).insertContent({ type: 'syncedBlock', attrs: { sid: newSyncedId() } }).run() },
  { icon: '↻', label: 'Senkron blok (mevcut)', keys: 'synced senkron esitlenen ortak blok kopya yapistir mevcut', action: (e, r) => {
    e.chain().focus().deleteRange(r).run();
    const list = syncedList();
    void promptText('Hangi senkron blok?', '', {
      hint: list.length
        ? `Senkron bloğun üstündeki “Kimliği kopyala”ya basıp buraya yapıştır ya da ilk kelimelerini yaz. Son bloklar: ${list.slice(0, 5).map((x) => `“${x.label}”`).join(', ')}`
        : 'Henüz senkron blok yok. Önce / → “Senkron blok (yeni)” ile bir tane oluştur.',
    }).then((v) => {
      const q = v?.trim().toLocaleLowerCase('tr');
      if (!q) return;
      const hit = list.find((x) => x.sid === v!.trim()) ?? list.find((x) => x.label.toLocaleLowerCase('tr').startsWith(q)) ?? list.find((x) => x.label.toLocaleLowerCase('tr').includes(q));
      if (hit) e.chain().focus().insertContent({ type: 'syncedBlock', attrs: { sid: hit.sid } }).run();
    });
  } },
  { icon: '🗂', label: 'Sayfa içinde koleksiyon', keys: 'veritabani database tablo pano koleksiyon inline liste', action: (e, r) => e.chain().focus().deleteRange(r).insertContent({ type: 'collectionView' }).run() },
  { icon: '☰', label: 'İçindekiler', keys: 'toc icindekiler basliklar', action: (e, r) => e.chain().focus().deleteRange(r).insertContent({ type: 'toc' }).run() },
  { icon: '🔀', label: 'Diyagram (Mermaid)', keys: 'mermaid diyagram akis sema flowchart graph', action: (e, r) => {
    e.chain().focus().deleteRange(r).run();
    void promptText('Diyagram (Mermaid)', 'graph LR\n  A[Giriş] --> B[Filtre] --> C[Çıkış]', { multiline: true, hint: 'Akış şeması, sıralama diyagramı, durum makinesi… Ayrıntı: mermaid.js.org' }).then((v) => {
      if (v?.trim()) e.chain().focus().insertContent({ type: 'mermaid', attrs: { code: v } }).run();
    });
  } },
  { icon: '▶', label: 'YouTube videosu', keys: 'youtube video', action: (e, r) => {
    e.chain().focus().deleteRange(r).run();
    void promptText('YouTube bağlantısı', '', { hint: 'https://www.youtube.com/watch?v=…' }).then((v) => {
      if (v?.trim() && !e.commands.setYoutubeVideo({ src: v.trim() })) alert('Geçerli bir YouTube bağlantısı değil.');
    });
  } },
  { icon: '🌐', label: 'Sayfa göm', keys: 'embed iframe harita maps figma spotify desmos', action: (e, r) => {
    e.chain().focus().deleteRange(r).run();
    void promptText('Gömülecek sayfanın adresi', 'https://', { hint: 'Google Haritalar "Haritayı yerleştir" adresi, Figma, Desmos, Spotify, Google Slaytlar yayın bağlantısı…' }).then((v) => {
      if (v?.trim()?.startsWith('http')) e.chain().focus().insertContent({ type: 'embed', attrs: { src: v.trim() } }).run();
    });
  } },
  { icon: '🔖', label: 'Yer imi (bağlantı kartı)', keys: 'bookmark link url web', action: (e, r) => {
    e.chain().focus().deleteRange(r).run();
    void promptText('Bağlantı adresi', 'https://').then((v) => {
      if (v?.trim()?.startsWith('http')) e.chain().focus().insertContent({ type: 'bookmark', attrs: { url: v.trim() } }).run();
    });
  } },
  { icon: '📅', label: 'Tarih', keys: 'date tarih bugun yarin gun', action: (e, r) => e.chain().focus().deleteRange(r).insertContent('@').run() },
  { icon: '📄', label: 'Alt sayfa', keys: 'sayfa page subpage alt', action: (e, r) => {
    e.chain().focus().deleteRange(r).run();
    void promptText('Alt sayfanın adı', '').then((v) => {
      if (!v?.trim()) return;
      const parent = (e.storage as unknown as { noteCtx?: { noteId: string | null } }).noteCtx?.noteId ?? undefined;
      const n = createNote('note', v.trim(), parent ? { parent: [parent] } : {});
      e.chain().focus().insertContent([{ type: 'wikiLink', attrs: { id: n.id, label: n.title } }, { type: 'text', text: ' ' }]).run();
    });
  } },
  { icon: '🔗', label: 'Not bağlantısı [[ ]]', keys: 'link wiki baglanti', action: (e, r) => e.chain().focus().deleteRange(r).insertContent('[[').run() },
];

const SlashCommand = Extension.create({
  name: 'slashCommand',
  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        pluginKey: new PluginKey('slashSuggest'),
        char: '/',
        allowSpaces: true,
        ...suggestConfig((q) => {
          const nq = norm(q);
          // Önce kelime başında eşleşenler, sonra herhangi bir yerde geçenler
          const score = (x: (typeof SLASH)[number]) => {
            const all = norm(`${x.label} ${x.keys ?? ''}`);
            if (norm(x.label).startsWith(nq)) return 3;
            if (all.split(/[^a-z0-9]+/).some((w) => w.startsWith(nq))) return 2;
            return all.includes(nq) ? 1 : 0;
          };
          return SLASH.map((x) => ({ x, sc: nq ? score(x) : 1 }))
            .filter((r) => r.sc > 0)
            .sort((p, q) => q.sc - p.sc)
            .map(({ x }) => ({ ...x, key: x.label }));
        }),
      }),
    ];
  },
});

/** Editörde ve içe aktarmada (şema için) kullanılan ortak eklentiler. */
export function baseExtensions(): AnyExtension[] {
  return [
    StarterKit.configure({ link: { openOnClick: false, autolink: true }, codeBlock: false }),
    CodeBlock,
    TextStyle,
    Color,
    Highlight.configure({ multicolor: true }),
    // Açılır başlıklar: aynı açılır blok, özeti başlık büyüklüğünde (level 1-3)
    Details.extend({
      addAttributes() {
        return {
          ...this.parent?.(),
          level: {
            default: null,
            parseHTML: (el) => Number(el.getAttribute('data-level')) || null,
            renderHTML: (a) => (a.level ? { 'data-level': a.level } : {}),
          },
        };
      },
    }).configure({ persist: true, HTMLAttributes: { class: 'details' } }),
    DetailsSummary,
    DetailsContent,
    Callout,
    Column,
    Columns,
    Toc,
    Mermaid,
    FileBlock,
    Bookmark,
    Embed,
    DateChip,
    CollectionBlock,
    SyncedBlock,
    ButtonBlock,
    Youtube.configure({ nocookie: true, modestBranding: true, HTMLAttributes: { class: 'yt' } }),
    TaskList,
    TaskItem.configure({ nested: true }),
    TableKit.configure({ table: { resizable: false } }),
    StoredImage,
    WikiLink,
  ];
}

export function editorExtensions(placeholder: string, noteId: string | null = null): AnyExtension[] {
  let editorRef: Editor | null = null;
  return [
    Extension.create({ name: 'noteCtx', addStorage: () => ({ noteId }) }),
    ...baseExtensions(),
    Mathematics.configure({
      katexOptions: { throwOnError: false },
      inlineOptions: { onClick: (node, pos) => editorRef && void editMath(editorRef, 'inline', node.attrs.latex, pos) },
      blockOptions: { onClick: (node, pos) => editorRef && void editMath(editorRef, 'block', node.attrs.latex, pos) },
    }),
    Placeholder.configure({ placeholder }),
    SlashCommand,
    Mention,
    FindReplace,
    Extension.create({
      name: 'editorRef',
      onCreate() {
        editorRef = this.editor;
      },
    }),
  ];
}

/** Şema için matematik düğümleri (KaTeX çizimi olmadan da ayrıştırılabilir). */
export function schemaExtensions(): AnyExtension[] {
  return [...baseExtensions(), Mathematics];
}
