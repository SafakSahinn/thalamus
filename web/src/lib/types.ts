// Not tipleri (Notion'daki "veritabanları"). Tipler kodda tanımlıdır; her not
// bir tipe aittir, özellikleri (props) tipin alanlarına göre düzenlenir.
// "relation" alanları diğer notlara bağlantıdır ve grafikte kenar olarak görünür.

export type TypeId =
  | 'book' | 'paper' | 'movie' | 'talk' | 'course' | 'note'
  | 'word' | 'person' | 'concept' | 'daily';

export type PropKind =
  | 'text' | 'longtext' | 'number' | 'date' | 'url'
  | 'select' | 'multiselect' | 'rating' | 'relation' | 'checkbox';

export interface PropDef {
  key: string;
  label: string;
  kind: PropKind;
  options?: string[];
  /** relation alanları için: bağlanabilecek tip(ler); ilki yeni oluşturulacak tiptir. */
  target?: TypeId[];
  /** Koleksiyon tablosunda sütun olarak gösterilsin mi? */
  table?: boolean;
}

export interface TypeDef {
  id: TypeId;
  label: string;
  plural: string;
  icon: string;
  color: string;
  props: PropDef[];
  /** Kart görünümünde kapak olarak kullanılacak url alanı */
  cover?: string;
  /** Koleksiyonun varsayılan sıralama alanı */
  sort?: string;
}

const topics: PropDef = { key: 'topics', label: 'Konular', kind: 'relation', target: ['concept'], table: true };
const words: PropDef = { key: 'words', label: 'Kelimeler', kind: 'relation', target: ['word'] };

export const TYPES: TypeDef[] = [
  {
    id: 'book', label: 'Kitap', plural: 'Kitaplar', icon: '📚', color: '#d9822b', cover: 'cover',
    props: [
      { key: 'author', label: 'Yazar', kind: 'relation', target: ['person'], table: true },
      { key: 'status', label: 'Durum', kind: 'select', options: ['Okunacak', 'Okunuyor', 'Bitti', 'Yarım bıraktım'], table: true },
      { key: 'rating', label: 'Puan', kind: 'rating', table: true },
      { key: 'started', label: 'Başlama', kind: 'date' },
      { key: 'finished', label: 'Bitiş', kind: 'date', table: true },
      { key: 'pages', label: 'Sayfa', kind: 'number' },
      { key: 'cover', label: 'Kapak görseli (bağlantı)', kind: 'url' },
      words, topics,
    ],
  },
  {
    id: 'paper', label: 'Yayın', plural: 'Makale & Bildiriler', icon: '📄', color: '#3d7bd9', sort: 'year',
    props: [
      { key: 'kind', label: 'Tür', kind: 'select', options: ['Dergi makalesi', 'Konferans bildirisi', 'Tez', 'Ön baskı', 'Kitap bölümü', 'Rapor'], table: true },
      { key: 'authors', label: 'Yazarlar', kind: 'relation', target: ['person'], table: true },
      { key: 'venue', label: 'Dergi / Konferans', kind: 'text', table: true },
      { key: 'year', label: 'Yıl', kind: 'number', table: true },
      { key: 'status', label: 'Durum', kind: 'select', options: ['Okunacak', 'Okunuyor', 'Okundu'], table: true },
      { key: 'context', label: 'Bağlam', kind: 'select', options: ['Ders', 'Araştırma', 'Kişisel ilgi'], table: true },
      { key: 'course', label: 'Ders', kind: 'relation', target: ['course'] },
      { key: 'rating', label: 'Puan', kind: 'rating' },
      { key: 'doi', label: 'DOI / Bağlantı', kind: 'url' },
      { key: 'pdf', label: 'PDF', kind: 'url' },
      { key: 'cites', label: 'Atıf yaptığı yayınlar', kind: 'relation', target: ['paper'] },
      words, topics,
    ],
  },
  {
    id: 'movie', label: 'Film', plural: 'Filmler & Diziler', icon: '🎬', color: '#c2417a', cover: 'cover',
    props: [
      { key: 'kind', label: 'Tür', kind: 'select', options: ['Film', 'Dizi', 'Belgesel'], table: true },
      { key: 'director', label: 'Yönetmen', kind: 'relation', target: ['person'], table: true },
      { key: 'year', label: 'Yıl', kind: 'number', table: true },
      { key: 'status', label: 'Durum', kind: 'select', options: ['İzlenecek', 'İzleniyor', 'İzlendi'], table: true },
      { key: 'rating', label: 'Puan', kind: 'rating', table: true },
      { key: 'watched', label: 'İzlediğim tarih', kind: 'date' },
      { key: 'cover', label: 'Afiş (bağlantı)', kind: 'url' },
      words, topics,
    ],
  },
  {
    id: 'talk', label: 'Söyleşi', plural: 'Söyleşiler', icon: '🎙️', color: '#8a55d4', sort: 'date',
    props: [
      { key: 'speakers', label: 'Konuşmacılar', kind: 'relation', target: ['person'], table: true },
      { key: 'event', label: 'Etkinlik / Kanal', kind: 'text', table: true },
      { key: 'date', label: 'Tarih', kind: 'date', table: true },
      { key: 'status', label: 'Durum', kind: 'select', options: ['İzlenecek', 'İzlendi'], table: true },
      { key: 'url', label: 'Bağlantı', kind: 'url' },
      words, topics,
    ],
  },
  {
    id: 'course', label: 'Ders', plural: 'Dersler', icon: '🎓', color: '#2f9e6e',
    props: [
      { key: 'code', label: 'Kod', kind: 'text', table: true },
      { key: 'instructor', label: 'Öğretim üyesi', kind: 'relation', target: ['person'], table: true },
      { key: 'term', label: 'Dönem', kind: 'text', table: true },
      { key: 'status', label: 'Durum', kind: 'select', options: ['Devam ediyor', 'Tamamlandı', 'Planlanan'], table: true },
      topics,
    ],
  },
  {
    id: 'note', label: 'Not', plural: 'Notlar', icon: '📝', color: '#6b7280',
    props: [
      { key: 'course', label: 'Ders', kind: 'relation', target: ['course'], table: true },
      { key: 'source', label: 'Kaynak', kind: 'relation', target: ['book', 'paper', 'talk', 'movie'], table: true },
      topics,
    ],
  },
  {
    id: 'word', label: 'Kelime', plural: 'Sözlük', icon: '🔤', color: '#0e9aa7',
    props: [
      { key: 'meaning', label: 'Anlamı', kind: 'longtext', table: true },
      { key: 'language', label: 'Dil', kind: 'select', options: ['İngilizce', 'Almanca', 'Fransızca', 'Türkçe', 'Osmanlıca', 'Diğer'], table: true },
      { key: 'pos', label: 'Tür', kind: 'select', options: ['İsim', 'Fiil', 'Sıfat', 'Zarf', 'Deyim', 'Terim'] },
      { key: 'example', label: 'Örnek cümle', kind: 'longtext' },
      { key: 'learned', label: 'Öğrendim', kind: 'checkbox', table: true },
    ],
  },
  {
    id: 'person', label: 'Kişi', plural: 'Kişiler', icon: '👤', color: '#b5892f',
    props: [
      { key: 'role', label: 'Unvan / Rol', kind: 'text', table: true },
      { key: 'affiliation', label: 'Kurum', kind: 'text', table: true },
      { key: 'url', label: 'Bağlantı', kind: 'url' },
      topics,
    ],
  },
  {
    id: 'concept', label: 'Kavram', plural: 'Kavramlar', icon: '💡', color: '#2aa198',
    props: [
      { key: 'definition', label: 'Tanım', kind: 'longtext', table: true },
      { key: 'related', label: 'İlişkili kavramlar', kind: 'relation', target: ['concept'], table: true },
    ],
  },
  {
    id: 'daily', label: 'Günlük', plural: 'Günlükler', icon: '📅', color: '#5c7cfa', sort: 'date',
    props: [
      { key: 'date', label: 'Tarih', kind: 'date', table: true },
    ],
  },
];

export const TYPE_MAP = Object.fromEntries(TYPES.map((t) => [t.id, t])) as Record<TypeId, TypeDef>;

export const typeOf = (id: string): TypeDef => TYPE_MAP[id as TypeId] ?? TYPE_MAP.note;

export interface Note {
  id: string;
  type: TypeId;
  title: string;
  props: Record<string, unknown>;
  /** TipTap belge JSON'u */
  content: unknown | null;
  /** Arama için düz metin */
  text: string;
  /** Giden bağlantılar: içerikteki [[...]] + relation alanları */
  links: string[];
  pinned: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  synced_at?: string | null;
}

export interface Routine {
  id: string;
  label: string;
  icon: string;
}

export interface Settings {
  routines: Routine[];
}

export const DEFAULT_SETTINGS: Settings = {
  routines: [
    { id: 'read', label: 'Kitap okudum', icon: '📖' },
    { id: 'paper', label: 'Makale okudum', icon: '📄' },
    { id: 'sport', label: 'Spor', icon: '🏃' },
    { id: 'study', label: 'Ders çalıştım', icon: '🎓' },
  ],
};

export const relationIds = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
