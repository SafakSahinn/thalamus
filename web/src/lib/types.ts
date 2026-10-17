// Not tipleri (Notion'daki "veritabanları"). Hazır tipler aşağıda tanımlıdır; kullanıcı yeni
// koleksiyon ekleyebilir, hazır olanlara alan ekleyip çıkarabilir (ayarlarda saklanır, Drive ile eşitlenir).
// "relation" alanları diğer notlara bağlantıdır ve grafikte kenar olarak görünür.

export type BuiltinTypeId =
  | 'book' | 'paper' | 'movie' | 'talk' | 'course' | 'lab' | 'conference' | 'event' | 'note'
  | 'word' | 'person' | 'concept' | 'daily';

/** Hazır tipler ya da kullanıcı koleksiyonları ("c_…") */
export type TypeId = BuiltinTypeId | (string & {});

export type PropKind =
  | 'text' | 'longtext' | 'number' | 'date' | 'url' | 'email' | 'phone'
  | 'select' | 'multiselect' | 'rating' | 'relation' | 'checkbox'
  | 'formula' | 'rollup' | 'created' | 'updated' | 'files' | 'uid';

/** Durum alanı grupları (Notion'daki gibi): yapılacak / sürüyor / bitti */
export type StatusGroup = 'todo' | 'doing' | 'done';
export const STATUS_GROUPS: { id: StatusGroup; label: string }[] = [
  { id: 'todo', label: 'Yapılacak' },
  { id: 'doing', label: 'Sürüyor' },
  { id: 'done', label: 'Bitti' },
];

/** Dosyalar alanının bir öğesi (src: gd://… ya da local://…) */
export interface FileRef {
  src: string;
  name: string;
}
/** Benzersiz numaranın gösterimi: önek-numara */
export const uidText = (def: Pick<PropDef, 'prefix'>, v: unknown) => (typeof v === 'number' ? `${def.prefix ? `${def.prefix}-` : ''}${v}` : '');
export const fileRefs = (v: unknown): FileRef[] => (Array.isArray(v) ? v.filter((x): x is FileRef => Boolean(x && typeof x === 'object' && 'src' in x)) : []);

export type RollupFn = 'count' | 'sum' | 'avg' | 'min' | 'max' | 'list' | 'checked' | 'percent_checked' | 'earliest' | 'latest';

export interface PropDef {
  key: string;
  label: string;
  kind: PropKind;
  options?: string[];
  /** relation alanları için: bağlanabilecek tip(ler); ilki yeni oluşturulacak tiptir. */
  target?: TypeId[];
  /** Koleksiyon tablosunda sütun olarak gösterilsin mi? */
  table?: boolean;
  /** formula: ifade, ör. prop("Sayfa") / 30 */
  formula?: string;
  /** rollup: bağlantı alanındaki notların bir alanı üzerinde toplama */
  rollup?: { relation: string; prop: string; fn: RollupFn };
  /** Kullanıcının eklediği alan (silinebilir) */
  custom?: boolean;
  /** Durum alanı: seçeneklerin grupları (bu alan bir "Durum" seçimidir) */
  statusGroups?: Record<string, StatusGroup>;
  /** Benzersiz numara: önek, ör. "DENEY" → DENEY-12 */
  prefix?: string;
  /** İlişkinin hedef koleksiyonda görünecek ters alanının adı (ör. "Üst öğe" → "Alt öğeler") */
  backLabel?: string;
  /** İki yönlü ilişkinin ters tarafı: değeri saklanmaz, "type" tipindeki notların "key" alanından hesaplanır */
  back?: { type: TypeId; key: string };
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
  /** Alt öğeler açıksa: "üst öğe" ilişki alanının anahtarı (tabloda iç içe satırlar) */
  subItems?: string;
  /** Bağımlılıklar açıksa: "beklediği" ilişki alanının anahtarı (zaman çizelgesinde oklar) */
  blockedBy?: string;
}

const topics: PropDef = { key: 'topics', label: 'Konular', kind: 'relation', target: ['concept'], table: true };
const words: PropDef = { key: 'words', label: 'Kelimeler', kind: 'relation', target: ['word'] };

export const BUILTIN_TYPES: TypeDef[] = [
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
    id: 'lab', label: 'Deney', plural: 'Laboratuvar deneyleri', icon: '🧪', color: '#0f8a7e', sort: 'date',
    props: [
      { key: 'course', label: 'Ders', kind: 'relation', target: ['course'], table: true },
      { key: 'date', label: 'Deney tarihi', kind: 'date', table: true },
      { key: 'status', label: 'Durum', kind: 'select', options: ['Hazırlanıyor', 'Yapıldı', 'Rapor yazılıyor', 'Teslim edildi'], table: true },
      { key: 'due', label: 'Rapor teslimi', kind: 'date', table: true },
      { key: 'partners', label: 'Grup arkadaşları', kind: 'relation', target: ['person'] },
      { key: 'equipment', label: 'Kullanılan cihazlar', kind: 'multiselect', options: ['Osiloskop', 'Multimetre', 'Sinyal üreteci', 'DC güç kaynağı', 'Breadboard', 'Mikrodenetleyici', 'FPGA', 'Spektrum analizörü', 'LCR metre', 'MATLAB/Simulink', 'LTspice'], table: true },
      { key: 'grade', label: 'Not', kind: 'number' },
      { key: 'report', label: 'Rapor (PDF)', kind: 'url' },
      topics,
    ],
  },
  {
    id: 'conference', label: 'Konferans', plural: 'Konferanslar', icon: '🎤', color: '#b5462f', sort: 'start',
    props: [
      { key: 'acronym', label: 'Kısaltma', kind: 'text', table: true },
      { key: 'status', label: 'Durum', kind: 'select', options: ['İlgileniyorum', 'Başvuracağım', 'Başvurdum', 'Kabul edildi', 'Reddedildi', 'Katıldım'], table: true },
      { key: 'deadline', label: 'Son başvuru', kind: 'date', table: true },
      { key: 'start', label: 'Başlangıç', kind: 'date', table: true },
      { key: 'end', label: 'Bitiş', kind: 'date' },
      { key: 'location', label: 'Yer', kind: 'text', table: true },
      { key: 'role', label: 'Katılım', kind: 'select', options: ['Dinleyici', 'Sözlü sunum', 'Poster', 'Hakem', 'Oturum başkanı'] },
      { key: 'papers', label: 'Bildirilerim', kind: 'relation', target: ['paper'] },
      { key: 'url', label: 'Web sitesi', kind: 'url' },
      topics,
    ],
  },
  {
    id: 'event', label: 'Etkinlik', plural: 'Etkinlikler', icon: '🗓️', color: '#1a73e8', sort: 'date',
    props: [
      { key: 'date', label: 'Tarih', kind: 'date', table: true },
      { key: 'time', label: 'Saat', kind: 'text', table: true },
      { key: 'endTime', label: 'Bitiş saati', kind: 'text' },
      { key: 'location', label: 'Yer', kind: 'text', table: true },
      { key: 'people', label: 'Kişiler', kind: 'relation', target: ['person'] },
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

// ---------- kullanıcı ayarlarıyla birleştirilmiş tip kayıt defteri ----------

export interface PropOverride {
  label?: string;
  options?: string[];
  table?: boolean;
  hidden?: boolean;
}

export interface TypeSettings {
  /** Kullanıcının oluşturduğu koleksiyonlar */
  custom: TypeDef[];
  /** Hazır tiplere eklenen alanlar */
  extra: Record<string, PropDef[]>;
  /** Hazır tiplerde ad/simge/alan değişiklikleri */
  overrides: Record<string, { label?: string; plural?: string; icon?: string; color?: string; props?: Record<string, PropOverride>; order?: string[]; subItems?: string; blockedBy?: string }>;
}

export const EMPTY_TYPE_SETTINGS: TypeSettings = { custom: [], extra: {}, overrides: {} };

function applyOverrides(t: TypeDef, ts: TypeSettings, keepHidden: boolean): TypeDef {
  const o = ts.overrides[t.id] ?? {};
  let props = [...t.props, ...(ts.extra[t.id] ?? [])].map((p) => {
    const po = o.props?.[p.key];
    return po ? { ...p, ...po, options: po.options ?? p.options } : p;
  });
  if (!keepHidden) props = props.filter((p) => !(o.props?.[p.key]?.hidden));
  if (o.order) {
    const idx = (k: string) => {
      const i = o.order!.indexOf(k);
      return i < 0 ? 1e6 : i;
    };
    props = [...props].sort((a, b) => idx(a.key) - idx(b.key));
  }
  return { ...t, label: o.label ?? t.label, plural: o.plural ?? t.plural, icon: o.icon ?? t.icon, color: o.color ?? t.color, props, subItems: o.subItems ?? t.subItems, blockedBy: o.blockedBy ?? t.blockedBy };
}

/** Ters ilişki alanının anahtarı: "~<kaynak tip>.<kaynak alan>" */
export const backKey = (type: string, key: string) => `~${type}.${key}`;
export const isBackKey = (key: string) => key.startsWith('~');

/**
 * İki yönlü ilişkiler (Notion'daki gibi): bir tipteki her bağlantı alanı, hedef tipte bir ters alan olarak da görünür.
 * Ör. Makale → "Ders" alanı, Ders sayfasında "Makaleler" alanı olur. Ters alanlar saklanmaz; düzenlenince kaynak notlar güncellenir.
 */
function withBacks(types: TypeDef[]): TypeDef[] {
  return types.map((t) => {
    const backs: PropDef[] = [];
    for (const s of types) {
      const rels = s.props.filter((p) => p.kind === 'relation' && !p.back && p.target?.includes(t.id));
      for (const p of rels) {
        const label = p.backLabel ?? (s.id === t.id ? `${p.label} (geri)` : rels.length > 1 ? `${s.plural} · ${p.label}` : s.plural);
        backs.push({ key: backKey(s.id, p.key), label, kind: 'relation', target: [s.id], back: { type: s.id, key: p.key } });
      }
    }
    return backs.length ? { ...t, props: [...t.props, ...backs] } : t;
  });
}

/** Güncel tip listesi (hazır + kullanıcı). ES modül canlı bağlaması sayesinde her yerde güncel kalır. */
export let TYPES: TypeDef[] = withBacks(BUILTIN_TYPES);
export let TYPE_MAP: Record<string, TypeDef> = Object.fromEntries(TYPES.map((t) => [t.id, t]));
let typeSettings: TypeSettings = EMPTY_TYPE_SETTINGS;

export function applyTypeSettings(ts: TypeSettings | undefined) {
  typeSettings = ts ?? EMPTY_TYPE_SETTINGS;
  TYPES = withBacks([...BUILTIN_TYPES.map((t) => applyOverrides(t, typeSettings, false)), ...typeSettings.custom.map((t) => applyOverrides(t, typeSettings, false))]);
  TYPE_MAP = Object.fromEntries(TYPES.map((t) => [t.id, t]));
}

/** Düzenleme ekranı için: gizlenmiş alanlar dahil */
export function editableType(id: string): TypeDef | undefined {
  const base = BUILTIN_TYPES.find((t) => t.id === id) ?? typeSettings.custom.find((t) => t.id === id);
  return base && applyOverrides(base, typeSettings, true);
}

export const isBuiltinType = (id: string) => BUILTIN_TYPES.some((t) => t.id === id);
export const isBuiltinProp = (typeId: string, key: string) =>
  Boolean(BUILTIN_TYPES.find((t) => t.id === typeId)?.props.some((p) => p.key === key));

export const typeOf = (id: string): TypeDef => TYPE_MAP[id] ?? TYPE_MAP.note;

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

export type ViewKind = 'table' | 'cards' | 'board' | 'calendar' | 'list' | 'timeline';

export interface ViewFilter {
  key: string;
  op: string;
  value?: unknown;
}

export interface SavedView {
  id: string;
  name: string;
  kind: ViewKind;
  filters: ViewFilter[];
  /** Filtreler nasıl birleşsin: hepsi (ve) / herhangi biri (veya) */
  filterMode?: 'and' | 'or';
  sort: { key: string; dir: 'asc' | 'desc' }[];
  /** board: gruplanacak seçim alanı · table/list: gruplama alanı */
  groupBy?: string;
  /** calendar/timeline: (başlangıç) tarih alanı */
  dateKey?: string;
  /** timeline: bitiş tarihi alanı */
  endKey?: string;
  /** table: gizli sütunlar */
  hidden?: string[];
}

export interface Settings {
  routines: Routine[];
  types?: TypeSettings;
  /** Koleksiyon başına kayıtlı görünümler */
  views?: Record<string, SavedView[]>;
  /** Koleksiyon başına varsayılan şablon kimliği */
  defaultTemplates?: Record<string, string>;
  /** Google Takvim eşitlemesi */
  calendar?: { enabled: boolean; calendarId?: string; fields: string[]; reminders: number[]; eventOff?: boolean; external?: string[] };
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
