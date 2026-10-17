// Makale bilgisi: DOI ya da arXiv kimliğinden başlık, yazarlar, yıl, dergi/konferans, cilt/sayı/sayfa, özet.
// Açık kaynaklar, anahtar gerekmez: Crossref (dergi/konferans DOI'leri), DataCite (arXiv ve diğer DataCite DOI'leri).
// Atıf bilgisi notun gizli alanında (props.__cite) saklanır; BibTeX ve kaynakça buradan üretilir.

export interface Person {
  given?: string;
  family: string;
}

export interface CiteMeta {
  /** BibTeX türü: article, inproceedings, misc (ön baskı), phdthesis, incollection, techreport, book */
  type: string;
  title: string;
  authors: Person[];
  year?: number;
  venue?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  publisher?: string;
  doi?: string;
  arxiv?: string;
  url?: string;
  abstract?: string;
  pdf?: string;
}

export type Ident = { kind: 'doi'; id: string } | { kind: 'arxiv'; id: string };

/** Yapıştırılan metinden DOI ya da arXiv kimliği */
export function parseIdent(input: string): Ident | null {
  const s = input.trim();
  const ax = s.match(/arxiv\.org\/(?:abs|pdf)\/([\w.-]+?)(?:v\d+)?(?:\.pdf)?(?:[?#].*)?$/i) ?? s.match(/^(?:arxiv:)?\s*(\d{4}\.\d{4,5})(?:v\d+)?$/i)
    ?? s.match(/10\.48550\/arxiv\.(\d{4}\.\d{4,5})/i);
  if (ax) return { kind: 'arxiv', id: ax[1] };
  const doi = s.match(/10\.\d{4,9}\/[^\s"<>]+/);
  if (doi) return { kind: 'doi', id: decodeURIComponent(doi[0]).replace(/[.,;)]+$/, '') };
  return null;
}

const stripTags = (s: string) => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const CROSSREF_TYPE: Record<string, string> = {
  'journal-article': 'article', 'proceedings-article': 'inproceedings', 'book-chapter': 'incollection',
  dissertation: 'phdthesis', 'posted-content': 'misc', report: 'techreport', book: 'book', monograph: 'book',
};

async function fromCrossref(doi: string): Promise<CiteMeta | null> {
  const r = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`);
  if (!r.ok) return null;
  const m = ((await r.json()) as { message: Record<string, unknown> }).message;
  const first = (v: unknown) => (Array.isArray(v) ? (v[0] as string | undefined) : undefined);
  const date = (m.issued as { 'date-parts'?: number[][] } | undefined)?.['date-parts']?.[0]?.[0];
  const authors = ((m.author as { given?: string; family?: string; name?: string }[] | undefined) ?? [])
    .map((a) => ({ given: a.given, family: a.family ?? a.name ?? '' }))
    .filter((a) => a.family);
  const pdf = ((m.link as { URL: string; 'content-type'?: string }[] | undefined) ?? []).find((l) => l['content-type'] === 'application/pdf')?.URL;
  return {
    type: CROSSREF_TYPE[String(m.type)] ?? 'misc',
    title: stripTags(first(m.title) ?? ''),
    authors,
    year: typeof date === 'number' ? date : undefined,
    venue: first(m['container-title']) || undefined,
    volume: (m.volume as string) || undefined,
    issue: (m.issue as string) || undefined,
    pages: (m.page as string) || undefined,
    publisher: (m.publisher as string) || undefined,
    doi,
    url: `https://doi.org/${doi}`,
    abstract: typeof m.abstract === 'string' ? stripTags(m.abstract) : undefined,
    pdf,
  };
}

async function fromDatacite(doi: string): Promise<CiteMeta | null> {
  const r = await fetch(`https://api.datacite.org/dois/${encodeURIComponent(doi)}`);
  if (!r.ok) return null;
  const a = ((await r.json()) as { data: { attributes: Record<string, unknown> } }).data.attributes;
  const creators = (a.creators as { givenName?: string; familyName?: string; name?: string }[] | undefined) ?? [];
  const arxiv = ((a.identifiers as { identifier: string; identifierType: string }[] | undefined) ?? []).find((x) => x.identifierType === 'arXiv')?.identifier;
  const general = String((a.types as { resourceTypeGeneral?: string } | undefined)?.resourceTypeGeneral ?? '');
  const abs = ((a.descriptions as { description: string; descriptionType: string }[] | undefined) ?? []).find((d) => d.descriptionType === 'Abstract')?.description;
  return {
    type: general === 'Preprint' || arxiv ? 'misc' : general === 'Dissertation' ? 'phdthesis' : general === 'Report' ? 'techreport' : 'misc',
    title: stripTags(((a.titles as { title: string }[] | undefined) ?? [])[0]?.title ?? ''),
    authors: creators.map((c) => ({ given: c.givenName, family: c.familyName ?? (c.name ?? '').split(',')[0] })).filter((c) => c.family),
    year: typeof a.publicationYear === 'number' ? a.publicationYear : Number(a.publicationYear) || undefined,
    venue: arxiv ? 'arXiv' : undefined,
    publisher: (a.publisher as string) || undefined,
    doi,
    arxiv,
    url: arxiv ? `https://arxiv.org/abs/${arxiv}` : `https://doi.org/${doi}`,
    abstract: abs ? stripTags(abs) : undefined,
    pdf: arxiv ? `https://arxiv.org/pdf/${arxiv}` : undefined,
  };
}

/** Kimlikten makale bilgisi (bulunamazsa hata) */
export async function fetchMeta(ident: Ident): Promise<CiteMeta> {
  const doi = ident.kind === 'arxiv' ? `10.48550/arXiv.${ident.id}` : ident.id;
  const m = ident.kind === 'arxiv' ? await fromDatacite(doi) : (await fromCrossref(doi)) ?? (await fromDatacite(doi));
  if (!m || !m.title) throw new Error('Bu kimlikle bir yayın bulunamadı. DOI ya da arXiv numarasını kontrol et.');
  return m;
}

export const personName = (p: Person) => [p.given, p.family].filter(Boolean).join(' ');

/** "Tür" alanının Türkçe karşılığı */
export const KIND_LABEL: Record<string, string> = {
  article: 'Dergi makalesi', inproceedings: 'Konferans bildirisi', phdthesis: 'Tez', misc: 'Ön baskı',
  incollection: 'Kitap bölümü', techreport: 'Rapor', book: 'Kitap bölümü',
};
