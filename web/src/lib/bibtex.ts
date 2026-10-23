// BibTeX dışa/içe aktarma ve kaynakça biçimleri (IEEE, APA).
// Atıf bilgisi makale notunun gizli alanında (props.__cite, bkz. scholar.ts); yoksa görünen alanlardan kurulur.

import { t } from '../i18n';
import { displayTitle } from './format';
import type { CiteMeta, Person } from './scholar';
import { relationIds, type Note } from './types';

/** Makale notunun atıf bilgisi (DOI'den gelmediyse alanlardan) */
export function citeOf(n: Note, notes: Record<string, Note>): CiteMeta {
  const c = n.props.__cite as CiteMeta | undefined;
  if (c?.title) return { ...c, title: n.title || c.title };
  const authors: Person[] = relationIds(n.props.authors).map((id) => notes[id]).filter(Boolean).map((p) => {
    const parts = p.title.trim().split(/\s+/);
    return { family: parts.pop() ?? '', given: parts.join(' ') || undefined };
  });
  const kind = String(n.props.kind ?? '');
  const doi = typeof n.props.doi === 'string' ? n.props.doi.match(/10\.\d{4,9}\/\S+/)?.[0] : undefined;
  return {
    type: /konferans/i.test(kind) ? 'inproceedings' : /tez/i.test(kind) ? 'phdthesis' : /ön baskı/i.test(kind) ? 'misc' : /bölüm/i.test(kind) ? 'incollection' : /rapor/i.test(kind) ? 'techreport' : 'article',
    title: displayTitle(n),
    authors,
    year: typeof n.props.year === 'number' ? n.props.year : undefined,
    venue: typeof n.props.venue === 'string' ? n.props.venue : undefined,
    doi,
    url: typeof n.props.doi === 'string' ? n.props.doi : undefined,
  };
}

const ascii = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i').replace(/[^A-Za-z0-9]/g, '');

/** Atıf anahtarı: soyad + yıl + başlığın ilk anlamlı kelimesi (ör. kalman1960new) */
export function citeKey(c: CiteMeta): string {
  const word = c.title.split(/\s+/).find((w) => ascii(w).length > 3 && !/^(the|and|for|with|from|bir|ile|için)$/i.test(w)) ?? 'paper';
  return `${ascii(c.authors[0]?.family ?? 'anon').toLowerCase()}${c.year ?? ''}${ascii(word).toLowerCase()}`;
}

const tex = (s: string) => s.replace(/([&%$#_])/g, '\\$1');

export function toBibtex(c: CiteMeta, key = citeKey(c)): string {
  const f: [string, string | undefined][] = [
    ['title', c.title ? `{${tex(c.title)}}` : undefined],
    ['author', c.authors.length ? c.authors.map((a) => (a.given ? `${a.family}, ${a.given}` : a.family)).join(' and ') : undefined],
    [c.type === 'inproceedings' || c.type === 'incollection' ? 'booktitle' : c.type === 'article' ? 'journal' : c.type === 'phdthesis' ? 'school' : 'howpublished', c.venue],
    ['year', c.year ? String(c.year) : undefined],
    ['volume', c.volume],
    ['number', c.issue],
    ['pages', c.pages?.replace(/-+/, '--')],
    ['publisher', c.type === 'article' ? undefined : c.publisher],
    ['doi', c.doi],
    ['eprint', c.arxiv],
    ['archivePrefix', c.arxiv ? 'arXiv' : undefined],
    ['url', c.url],
  ];
  const body = f.filter(([, v]) => v).map(([k, v]) => `  ${k} = ${v!.startsWith('{') ? v : `{${tex(v!)}}`}`).join(',\n');
  return `@${c.type}{${key},\n${body}\n}`;
}

/** Birden çok makale: anahtarlar tekrar etmesin (a, b, c ekleri) */
export function bibFile(list: CiteMeta[]): string {
  const used = new Map<string, number>();
  return list.map((c) => {
    const k = citeKey(c);
    const n = used.get(k) ?? 0;
    used.set(k, n + 1);
    return toBibtex(c, n ? `${k}${String.fromCharCode(97 + n)}` : k);
  }).join('\n\n');
}

// ---------- içe aktarma ----------

const unbrace = (s: string) => s.replace(/[{}]/g, '').replace(/\\([&%$#_])/g, '$1').replace(/\s+/g, ' ').trim();

function parsePeople(s: string): Person[] {
  return s.split(/\s+and\s+/i).map((p) => {
    const t = unbrace(p);
    if (t.includes(',')) {
      const [family, given] = t.split(',').map((x) => x.trim());
      return { family, given: given || undefined };
    }
    const parts = t.split(' ');
    return { family: parts.pop() ?? t, given: parts.join(' ') || undefined };
  }).filter((p) => p.family);
}

/** .bib dosyasındaki kayıtlar (Zotero, Mendeley, Google Scholar dışa aktarımları) */
export function parseBibtex(src: string): CiteMeta[] {
  const out: CiteMeta[] = [];
  const re = /@(\w+)\s*\{\s*([^,\s]*)\s*,/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const type = m[1].toLowerCase();
    if (type === 'comment' || type === 'string' || type === 'preamble') continue;
    // Kaydın gövdesi: dengeli süslü parantezle biter
    let depth = 1;
    let i = re.lastIndex;
    for (; i < src.length && depth; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') depth--;
    }
    const body = src.slice(re.lastIndex, i - 1);
    re.lastIndex = i;
    const fields: Record<string, string> = {};
    const fre = /(\w+)\s*=\s*/g;
    let fm: RegExpExecArray | null;
    while ((fm = fre.exec(body))) {
      let j = fre.lastIndex;
      let val = '';
      if (body[j] === '{') {
        let d = 1;
        const s0 = ++j;
        for (; j < body.length && d; j++) {
          if (body[j] === '{') d++;
          else if (body[j] === '}') d--;
        }
        val = body.slice(s0, j - 1);
      } else if (body[j] === '"') {
        const end = body.indexOf('"', j + 1);
        val = body.slice(j + 1, end);
        j = end + 1;
      } else {
        const end = body.slice(j).search(/[,\n]/);
        val = end < 0 ? body.slice(j) : body.slice(j, j + end);
        j += Math.max(0, end);
      }
      fields[fm[1].toLowerCase()] = val;
      fre.lastIndex = j;
    }
    if (!fields.title) continue;
    const arxiv = fields.eprint && /arxiv/i.test(fields.archiveprefix ?? fields.eprinttype ?? '') ? fields.eprint : undefined;
    out.push({
      type: ['article', 'inproceedings', 'conference', 'phdthesis', 'mastersthesis', 'incollection', 'techreport', 'book'].includes(type) ? (type === 'conference' ? 'inproceedings' : type === 'mastersthesis' ? 'phdthesis' : type) : 'misc',
      title: unbrace(fields.title),
      authors: fields.author ? parsePeople(fields.author) : [],
      year: Number(fields.year) || undefined,
      venue: unbrace(fields.journal ?? fields.booktitle ?? fields.school ?? fields.howpublished ?? '') || (arxiv ? 'arXiv' : undefined),
      volume: fields.volume ? unbrace(fields.volume) : undefined,
      issue: fields.number ? unbrace(fields.number) : undefined,
      pages: fields.pages ? unbrace(fields.pages).replace(/--/, '-') : undefined,
      publisher: fields.publisher ? unbrace(fields.publisher) : undefined,
      doi: fields.doi ? unbrace(fields.doi) : undefined,
      arxiv,
      url: fields.url ? unbrace(fields.url) : fields.doi ? `https://doi.org/${unbrace(fields.doi)}` : arxiv ? `https://arxiv.org/abs/${arxiv}` : undefined,
      abstract: fields.abstract ? unbrace(fields.abstract) : undefined,
    });
  }
  return out;
}

// ---------- kaynakça biçimleri ----------

export type CiteStyle = 'ieee' | 'apa';

const initials = (g?: string) => (g ? g.split(/[\s-]+/).filter(Boolean).map((x) => `${x[0].toUpperCase()}.`).join(' ') : '');

/** Tek kaynak, düz metin. IEEE: "R. E. Kalman, “Başlık,” Dergi, cilt 82, sayı 1, s. 35–45, 1960." */
export function formatCite(c: CiteMeta, style: CiteStyle): string {
  const pages = c.pages?.replace(/-+/, '–');
  if (style === 'ieee') {
    const names = c.authors.map((a) => [initials(a.given), a.family].filter(Boolean).join(' '));
    const au = names.length > 6 ? `${names[0]} et al.` : names.length > 1 ? `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}` : names[0] ?? '';
    const parts = [
      au && `${au},`,
      `“${c.title},”`,
      c.venue && `${c.type === 'inproceedings' ? 'in ' : ''}${c.venue},`,
      c.volume && `vol. ${c.volume},`,
      c.issue && `no. ${c.issue},`,
      pages && `pp. ${pages},`,
      c.year && `${c.year}`,
    ].filter(Boolean).join(' ').replace(/,$/, '');
    return `${parts}.${c.doi ? ` doi: ${c.doi}.` : c.arxiv ? ` arXiv:${c.arxiv}.` : ''}`;
  }
  const names = c.authors.map((a) => `${a.family}${a.given ? `, ${initials(a.given)}` : ''}`);
  const au = names.length > 20 ? `${names.slice(0, 19).join(', ')}, … ${names[names.length - 1]}` : names.length > 1 ? `${names.slice(0, -1).join(', ')}, & ${names[names.length - 1]}` : names[0] ?? '';
  const venue = [c.venue, c.volume && `${c.volume}${c.issue ? `(${c.issue})` : ''}`, pages].filter(Boolean).join(', ');
  return `${au ? `${au} ` : ''}(${c.year ?? t('papers.cite.noDate')}). ${c.title}.${venue ? ` ${venue}.` : ''}${c.doi ? ` https://doi.org/${c.doi}` : c.url ? ` ${c.url}` : ''}`;
}
