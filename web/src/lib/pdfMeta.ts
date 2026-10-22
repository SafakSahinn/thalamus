// PDF'in içinden makale bilgisi: DOI/arXiv, başlık, yazarlar, özet, anahtar kelimeler, bölüm başlıkları.
// Her şey tarayıcıda olur, PDF hiçbir yere gönderilmez. Ayrıştırma saf (analyze) ve testli;
// pdfjs yalnızca satırları çıkarmak için kullanılır (extractLines).

import type { PDFDocumentProxy } from 'pdfjs-dist';

export interface PdfLine {
  text: string;
  page: number;
  /** satırdaki en büyük yazı boyutu */
  size: number;
}

export interface PdfSection {
  level: 1 | 2;
  text: string;
  page: number;
}

export interface PdfInfo {
  doi?: string;
  arxiv?: string;
  title?: string;
  authors: string[];
  year?: number;
  abstract?: string;
  keywords: string[];
  sections: PdfSection[];
}

export interface PdfMetaInput {
  /** PDF bilgi sözlüğündeki Title / Author */
  infoTitle?: string;
  infoAuthor?: string;
  /** XMP metaverisi (ham XML) */
  xmp?: string;
  /** PDF'in kendi yer imleri (varsa en güvenilir bölüm listesi) */
  outline?: { title: string; page: number; level: number }[];
}

const MAX_PAGES = 40;
const JUNK = /Authorized licensed use limited|Downloaded on .* from IEEE Xplore|Restrictions apply|^\s*\d+\s*$/i;

interface Item {
  str: string;
  transform: number[];
  width: number;
  height: number;
  hasEOL?: boolean;
}

/** pdfjs metin öğelerinden satırlar (küçük büyük harf "I NTRODUCTION" birleştirilir) */
export function itemsToLines(items: Item[], page: number): PdfLine[] {
  const lines: PdfLine[] = [];
  let cur: { text: string; y: number; size: number; endX: number; lastSize: number; lastStr: string } | null = null;
  const flush = () => {
    if (cur && cur.text.trim()) lines.push({ text: cur.text.replace(/\s+/g, ' ').trim(), page, size: Math.round(cur.size * 10) / 10 });
    cur = null;
  };
  for (const it of items) {
    const size = Math.hypot(it.transform[2], it.transform[3]) || it.height || 0;
    const x = it.transform[4];
    const y = it.transform[5];
    if (cur && Math.abs(y - cur.y) > Math.max(size, cur.size) * 0.6 && it.str.trim()) flush();
    if (!cur) {
      cur = { text: it.str, y, size: it.str.trim() ? size : 0, endX: x + it.width, lastSize: size, lastStr: it.str };
    } else {
      const c: NonNullable<typeof cur> = cur;
      const gap = x - c.endX;
      const smallCap = /(^|\s)[A-Z]$/.test(c.lastStr) && /^[A-Z]/.test(it.str) && size < c.lastSize * 0.92 && gap < size * 0.3;
      const needSpace = !smallCap && gap > size * 0.15 && !/\s$/.test(c.text) && !/^\s/.test(it.str);
      c.text += (needSpace ? ' ' : '') + it.str;
      if (it.str.trim()) {
        c.size = Math.max(c.size, size);
        c.lastSize = size;
        c.lastStr = it.str;
      }
      c.endX = x + it.width;
    }
    if (it.hasEOL) flush();
  }
  flush();
  return lines.filter((l) => !JUNK.test(l.text));
}

/** Açık bir PDF belgesinden satırlar ve metaveri */
export async function extractLines(doc: PDFDocumentProxy): Promise<{ lines: PdfLine[]; meta: PdfMetaInput }> {
  const lines: PdfLine[] = [];
  for (let p = 1; p <= Math.min(doc.numPages, MAX_PAGES); p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    lines.push(...itemsToLines(tc.items.filter((i) => 'str' in i) as Item[], p));
  }
  const meta: PdfMetaInput = {};
  try {
    const md = await doc.getMetadata();
    const info = md.info as { Title?: string; Author?: string };
    meta.infoTitle = info?.Title || undefined;
    meta.infoAuthor = info?.Author || undefined;
    const raw = (md.metadata as unknown as { getRaw?: () => string } | null)?.getRaw?.();
    if (raw) meta.xmp = raw;
  } catch {
    /* metaveri yoksa sorun değil */
  }
  try {
    const outline = await doc.getOutline();
    if (outline?.length) {
      const flat: NonNullable<PdfMetaInput['outline']> = [];
      const walk = async (nodes: typeof outline, level: number) => {
        for (const n of nodes) {
          let page = 0;
          try {
            const dest = typeof n.dest === 'string' ? await doc.getDestination(n.dest) : n.dest;
            if (dest?.[0]) page = (await doc.getPageIndex(dest[0] as Parameters<PDFDocumentProxy['getPageIndex']>[0])) + 1;
          } catch {
            /* sayfası bulunamayan yer imi */
          }
          flat.push({ title: n.title, page, level });
          if (level < 2 && n.items?.length) await walk(n.items, level + 1);
        }
      };
      await walk(outline, 1);
      meta.outline = flat;
    }
  } catch {
    /* yer imi yok */
  }
  return { lines, meta };
}

/** PDF baytlarından makale bilgisi (pdfjs tembel yüklenir) */
export async function readPdf(data: ArrayBuffer | Uint8Array): Promise<PdfInfo> {
  const [{ getDocument, GlobalWorkerOptions }, { default: workerUrl }] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ]);
  if (!GlobalWorkerOptions.workerSrc) GlobalWorkerOptions.workerSrc = workerUrl;
  const task = getDocument({ data: data instanceof Uint8Array ? data.slice() : new Uint8Array(data) });
  try {
    const { lines, meta } = await extractLines(await task.promise);
    return analyze(lines, meta);
  } finally {
    void task.destroy();
  }
}

// ---------- saf ayrıştırma ----------

const DOI_RE = /\b(10\.\d{4,9}\/[^\s"<>]+)/;
const cleanDoi = (s: string) => s.replace(/[.,;)\]]+$/, '');

const ABSTRACT_RE = /^(?:A[bh]stract|ABSTRACT|Özet|ÖZET|Summary|SUMMARY)\b\s*[—–\-:.]*\s*/;
const KEYWORDS_RE = /^(?:Index Terms|INDEX TERMS|Keywords|KEYWORDS|Key words|Key Words|Anahtar [Kk]elimeler|ANAHTAR KELİMELER)\s*[—–\-:.]*\s*/;
const STOP_RE = /^(?:ARTICLE HISTORY|Received:?\s+\d|Manuscript received|This work was supported|Digital Object Identifier|Color versions|Recommended by|Paper no\.|The authors are with|\S+@\S+\.\w+|©|\(c\)|978-|\d{4}-\d{3}[\dX]\s*©)/i;
const REFS_RE = /^(?:REFERENCES|References|R EFERENCES|Bibliography|BIBLIOGRAPHY|KAYNAKLAR|Kaynaklar|Kaynakça)\s*$/;
const EXTRA_HEAD_RE = /^(?:CONCLUSIONS?|C ONCLUSIONS?|Conclusions?|APPENDIX(?: [A-Z])?|Appendix(?: [A-Z])?|SONUÇ(?:LAR)?|Sonuç(?:lar)?)\s*$/;
const IEEE_GRADE = /,?\s*(?:Student|Senior|Life|Graduate Student)?\s*(?:Member|Fellow)\s*,?\s*IEEE/g;

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV'];

/** Satırları paragraf metnine çevir (satır sonu tirelerini birleştirir) */
function joinLines(ls: string[]): string {
  let out = '';
  for (const l of ls) {
    if (!out) out = l;
    else if (/[a-zçğıöşü]-$/.test(out) && /^[a-zçğıöşü]/.test(l)) out = out.slice(0, -1) + l;
    else out += ' ' + l;
  }
  return out.replace(/\s+/g, ' ').trim();
}

const upperRatio = (s: string) => {
  const letters = s.replace(/[^A-Za-zÇĞİÖŞÜçğıöşü]/g, '');
  if (!letters) return 0;
  return letters.replace(/[^A-ZÇĞİÖŞÜ]/g, '').length / letters.length;
};

const SMALL = new Set(['a', 'an', 'and', 'as', 'at', 'by', 'for', 'from', 'in', 'into', 'of', 'on', 'or', 'the', 'to', 'via', 'vs', 'with', 've', 'ile', 'için']);

/** BÜYÜK HARFLİ başlığı okunur hâle getir; metinde büyük harfle geçen kısaltmalar (PID, DC) korunur */
export function prettyHeading(text: string, acronyms: Set<string>): string {
  if (upperRatio(text) < 0.8) return text;
  // küçük büyük harfin ayrık kalmış ilk harfi: "I NTRODUCTION" → "INTRODUCTION" ("A" tek başına kelime olabilir, dokunulmaz)
  text = text.replace(/(^|[\s(])([B-Z]) (?=[A-Z]{2,})/g, '$1$2');
  const tr = /[ÇĞİÖŞÜ]/.test(text) ? 'tr' : 'en';
  let first = true;
  return text.replace(/[A-Za-zÇĞİÖŞÜçğıöşü][A-Za-zÇĞİÖŞÜçğıöşü0-9']*/g, (w) => {
    const isFirst = first;
    first = false;
    const low = w.toLocaleLowerCase(tr);
    if (!isFirst && SMALL.has(low)) return low;
    if (acronyms.has(w) || /\d/.test(w)) return w;
    return low.charAt(0).toLocaleUpperCase(tr) + low.slice(1);
  });
}

function splitAuthors(line: string): string[] {
  return line
    .replace(IEEE_GRADE, ',')
    .replace(/[0-9*†‡§¶∗]+/g, ' ')
    .split(/\s*(?:,|;|\band\b|&)\s*/)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => /^[A-ZÇĞİÖŞÜ][\p{L}.'-]*(?:\s+[\p{L}.'-]+){1,3}$/u.test(s) && !/University|Institute|Department|School|College|Faculty|Group|Cent(?:er|re)|Lab|IEEE|Abstract/i.test(s))
    .map((s) => (upperRatio(s) > 0.8 ? prettyHeading(s, new Set()) : s));
}

export function analyze(lines: PdfLine[], meta: PdfMetaInput = {}): PdfInfo {
  const info: PdfInfo = { authors: [], keywords: [], sections: [] };
  const first = lines.filter((l) => l.page <= 2);
  const firstText = first.map((l) => l.text).join('\n');

  // DOI: önce XMP, sonra ilk sayfalar
  const xmpDoi = meta.xmp?.match(/(?:prism:doi>|doi:|dc:identifier>\s*(?:doi:)?)\s*(10\.\d{4,9}\/[^\s<"]+)/i)?.[1];
  const textDoi = firstText.match(/(?:Digital Object Identifier|DOI|doi\.org\/)\s*:?\s*(10\.\d{4,9}\/[^\s"<>]+)/i)?.[1] ?? firstText.match(DOI_RE)?.[1];
  const doi = xmpDoi ?? textDoi;
  if (doi) info.doi = cleanDoi(doi);
  const ax = firstText.match(/arXiv:\s*(\d{4}\.\d{4,5})(?:v\d+)?/i);
  if (ax) info.arxiv = ax[1];

  // Yıl: telif satırı ya da "Manuscript received … 2016"
  const yr = firstText.match(/©\s*((?:19|20)\d{2})/) ?? firstText.match(/(?:received|published|accepted)[^\n]*?((?:19|20)\d{2})/i);
  if (yr) info.year = Number(yr[1]);

  // Başlık: ilk sayfanın üst kısmındaki en büyük yazılı ardışık satırlar
  const p1 = lines.filter((l) => l.page === (lines[0]?.page ?? 1)).slice(0, 40);
  const abstractIdx = p1.findIndex((l) => ABSTRACT_RE.test(l.text));
  const top = (abstractIdx > 0 ? p1.slice(0, abstractIdx) : p1.slice(0, 25)).filter((l) => l.text.replace(/[^\p{L}]/gu, '').length >= 3);
  // aynı boyuttaki ardışık satır grupları, büyükten küçüğe; dergi adı, yazar, kaynakça gibi adaylar elenir
  const groups: { text: string; size: number; end: number }[] = [];
  for (let i = 0; i < top.length; i++) {
    let j = i;
    while (j + 1 < top.length && Math.abs(top[j + 1].size - top[i].size) <= top[i].size * 0.05 && p1.indexOf(top[j + 1]) === p1.indexOf(top[j]) + 1) j++;
    groups.push({ text: joinLines(top.slice(i, j + 1).map((l) => l.text)), size: top[i].size, end: p1.indexOf(top[j]) });
    i = j;
  }
  const okTitle = (t: string) => t.length >= 10 && t.length <= 250 && t.split(' ').length >= 3 && !/@|_{3,}|^\[|^\d|�|Proceedings|Transactions|Conference|Journal|Letters|Vol\.|pp\.|ISSN|www\.|https?:/i.test(t)
    && splitAuthors(t).join(' ').length < t.length * 0.6;
  const best = groups.filter((g) => okTitle(g.text)).sort((a, b) => b.size - a.size)[0];
  let titleEnd = -1;
  if (best) {
    const t = best.text.replace(/[\s*†‡∗¹²³]+$/, '');
    info.title = upperRatio(t) > 0.8 ? prettyHeading(t, new Set()) : t;
    titleEnd = best.end;
  }
  const it = meta.infoTitle?.trim();
  if (!info.title && it && it.length > 8 && !/^(?:microsoft word|untitled|title)|\.(?:docx?|pdf|tex|dvi)$/i.test(it)) info.title = it;

  // Yazarlar: başlığın hemen altındaki satırlar (DOI yoksa kullanılır)
  if (titleEnd >= 0) {
    const after = p1.slice(titleEnd + 1, abstractIdx > titleEnd ? abstractIdx : titleEnd + 6);
    for (const l of after.slice(0, 3)) {
      if (STOP_RE.test(l.text) || /University|Institute|Department|Laboratory|School|College|Üniversite/i.test(l.text)) break;
      const names = splitAuthors(l.text);
      if (!names.length) break;
      info.authors.push(...names);
    }
  }
  if (!info.authors.length && meta.infoAuthor) info.authors = splitAuthors(meta.infoAuthor);

  // Özet ve anahtar kelimeler
  const ai = first.findIndex((l) => ABSTRACT_RE.test(l.text));
  let bodyFrom = 0;
  if (ai >= 0) {
    const parts: string[] = [];
    const head = first[ai].text.replace(ABSTRACT_RE, '');
    if (head) parts.push(head);
    let j = ai + 1;
    for (; j < first.length && parts.join(' ').length < 4000; j++) {
      const t = first[j].text;
      if (KEYWORDS_RE.test(t) || STOP_RE.test(t) || isHeadingStart(t)) break;
      parts.push(t);
    }
    const abs = joinLines(parts);
    if (abs.length > 40) info.abstract = abs;
    bodyFrom = lines.indexOf(first[ai]);
  }
  const ki = first.findIndex((l) => KEYWORDS_RE.test(l.text));
  if (ki >= 0) {
    const parts = [first[ki].text.replace(KEYWORDS_RE, '')];
    for (let j = ki + 1; j < first.length && j < ki + 4; j++) {
      const t = first[j].text;
      if (STOP_RE.test(t) || isHeadingStart(t) || ABSTRACT_RE.test(t)) break;
      if (/[.]$/.test(parts[parts.length - 1])) break;
      parts.push(t);
    }
    info.keywords = joinLines(parts)
      .replace(/\.$/, '')
      .split(/\s*[,;·•]\s*/)
      .map((s) => s.trim())
      .filter((s) => s.length > 1 && s.length < 60)
      .slice(0, 15);
  }

  info.sections = meta.outline && meta.outline.filter((o) => o.level === 1).length >= 3
    ? fromOutline(meta.outline)
    : findSections(lines.slice(bodyFrom), lines);
  return info;
}

function isHeadingStart(t: string): boolean {
  return /^(?:I\.\s*I?\s?NTRODUCTION|1\.?\s+Introduction|1\.?\s+INTRODUCTION|1\.?\s+Giriş|1\.?\s+GİRİŞ|INTRODUCTION|Introduction)\s*$/.test(t);
}

function fromOutline(outline: NonNullable<PdfMetaInput['outline']>): PdfSection[] {
  const out: PdfSection[] = [];
  for (const o of outline) {
    const t = o.title.replace(/\s+/g, ' ').trim();
    if (!t || /^(?:abstract|references|bibliography|kaynaklar|özet|title|front matter|acknowledg|nomenclature|disclosure|data availability|orcid|funding|author contributions|conflicts? of interest|notes on contributors|declaration)/i.test(t.replace(/^[\dIVX.\s]+/, ''))) continue;
    out.push({ level: o.level === 1 ? 1 : 2, text: t, page: o.page });
  }
  return out;
}

/** Numaralı bölüm başlıkları: I./II. (IEEE) ya da 1/2 (diğer). Numaralar sırayla artmalı — gürültüyü bu eler. */
function findSections(body: PdfLine[], all: PdfLine[]): PdfSection[] {
  const sizes = body.map((l) => l.size).sort((a, b) => a - b);
  const bodySize = sizes[Math.floor(sizes.length / 2)] ?? 0;
  const acronyms = new Set<string>();
  for (const l of all) {
    if (upperRatio(l.text) > 0.6) continue;
    for (const m of l.text.matchAll(/\b[A-Z][A-Z0-9]{1,7}s?\b/g)) acronyms.add(m[0]);
  }

  // Sayfadaki tipik satır uzunluğu: iki satıra taşan başlığı paragrafın ilk satırından ayırmak için
  const lens = body.map((l) => l.text.length).sort((a, b) => a - b);
  const typLen = lens[Math.floor(lens.length * 0.7)] ?? 60;
  const ends = (s: string) => /[.,;:]$/.test(s);
  const isNumbered = (s: string) => /^(?:[IVX]{1,5}\.|[A-H]\.\s|\d{1,2}(?:\.\d{1,2})*\.?\s)/.test(s);

  /** Başlık bir sonraki satıra taşıyorsa birleştir */
  const continued = (i: number, text: string, upper: boolean): [string, number] => {
    const l = body[i];
    const n = body[i + 1];
    if (!n || n.page !== l.page || Math.abs(n.size - l.size) > l.size * 0.06 || isNumbered(n.text) || REFS_RE.test(n.text) || ends(n.text)) return [text, i];
    const fits = upper
      ? upperRatio(n.text) > 0.8 && n.text.length < 70
      : text.length >= Math.min(40, typLen * 0.7) && n.text.length <= Math.min(40, typLen * 0.6) && /^[\p{L}(]/u.test(n.text);
    if (!fits) return [text, i];
    // "ANAL-" + "YSIS" → "ANALYSIS", "FULL-" + "ORDER" → "FULL-ORDER"
    const glued = /-$/.test(text)
      ? (/^(?:ysis|tion|sion|ment|ing|ness|ity|ical|ance|ence|ive|ization|ized?|ated?|ally|ous|ure)\b/i.test(n.text) ? text.slice(0, -1) : text) + n.text
      : joinLines([text, n.text]);
    return [glued, i + 1];
  };

  const out: PdfSection[] = [];
  let scheme: 'roman' | 'arabic' | null = null;
  let dotStyle: boolean | null = null;
  let top = 0;
  let sub = 0;
  for (let i = 0; i < body.length; i++) {
    const l = body[i];
    const t = l.text;
    if (REFS_RE.test(t)) break;
    if (t.length > 90 || l.size < bodySize * 0.75) continue;

    const rm = t.match(/^([IVX]{1,5})\.\s*([A-Z].*)$/);
    if (rm && scheme !== 'arabic' && ROMAN[top] === rm[1] && !ends(rm[2]) && rm[2].length <= 80) {
      const upper = upperRatio(rm[2]) > 0.8;
      if (!upper && (rm[2].length > 70 || /^References?$/i.test(rm[2]))) continue;
      if (/^R\s?EFERENCES?$/i.test(rm[2])) break;
      if (/^A\s?CKNOWLEDG/i.test(rm[2])) continue;
      const [text, j] = continued(i, rm[2], upper);
      i = j;
      scheme = 'roman';
      top++;
      sub = 0;
      out.push({ level: 1, text: `${rm[1]}. ${prettyHeading(text, acronyms)}`, page: l.page });
      continue;
    }
    if (scheme === 'roman') {
      const sm = t.match(/^([A-H])\.\s+([A-Z].{2,80})$/);
      const footnote = /,/.test(sm?.[2] ?? '') && t.length >= typLen * 0.9;
      if (sm && sm[1].charCodeAt(0) - 65 === sub && !ends(sm[2]) && upperRatio(sm[2]) < 0.8 && !footnote) {
        const [text, j] = continued(i, sm[2], false);
        i = j;
        sub++;
        out.push({ level: 2, text: `${sm[1]}. ${text}`, page: l.page });
        continue;
      }
    }
    if (scheme !== 'roman') {
      const am = t.match(/^(\d{1,2})\.?\s+([A-ZÇĞİÖŞÜ].{1,80})$/);
      const upper = am ? upperRatio(am[2]) > 0.8 : false;
      const dot = /^\d{1,2}\./.test(t);
      const hasSub = am && body.slice(i + 1, i + 4).some((n) => n.text.startsWith(`${am[1]}.1 `) || n.text.startsWith(`${am[1]}.1. `));
      // gövde metnindeki numaralı listeleri elemek için: numara biçimi ilk başlıkla aynı olmalı,
      // satır sonunda tire olmamalı; ve büyük harf, daha büyük yazı, hemen ardından N.1 ya da kısa satır
      if (am && Number(am[1]) === top + 1 && !ends(am[2]) && !/\.\s/.test(am[2]) && (dotStyle === null || dotStyle === dot) && (upper || !/-$/.test(am[2]))
        && (upper || hasSub || l.size > bodySize * 1.02 || am[2].length < typLen * 0.85)) {
        dotStyle = dot;
        if (/^(?:R\s?EFERENCES?|References?|Kaynak(?:lar|ça))$/.test(am[2])) break;
        const [text, j] = continued(i, am[2], upper);
        i = j;
        scheme = 'arabic';
        top++;
        sub = 0;
        out.push({ level: 1, text: `${am[1]}. ${prettyHeading(text, acronyms)}`, page: l.page });
        continue;
      }
      const asub = t.match(/^(\d{1,2})\.(\d{1,2})\.?\s+([A-ZÇĞİÖŞÜ].{1,80})$/);
      if (asub && scheme === 'arabic' && Number(asub[1]) === top && Number(asub[2]) === sub + 1 && !ends(asub[3])) {
        const [text, j] = continued(i, asub[3], upperRatio(asub[3]) > 0.8);
        i = j;
        sub++;
        out.push({ level: 2, text: `${asub[1]}.${asub[2]} ${prettyHeading(text, acronyms)}`, page: l.page });
        continue;
      }
    }
    if (EXTRA_HEAD_RE.test(t) && top > 0) {
      out.push({ level: 1, text: prettyHeading(t.replace(/^C ONCLUSION/, 'CONCLUSION'), acronyms), page: l.page });
      sub = 0;
    }
  }
  return out;
}
