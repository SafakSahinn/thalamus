import { onLocaleChange, t, tOr, tSource } from '../i18n';
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
  | 'formula' | 'rollup' | 'created' | 'updated' | 'files' | 'uid' | 'button';

/** Durum alanı grupları (Notion'daki gibi): yapılacak / sürüyor / bitti */
export type StatusGroup = 'todo' | 'doing' | 'done';
const statusGroup = (id: StatusGroup) => ({ id, get label() { return t(`types.statusGroups.${id}`); } });
export const STATUS_GROUPS: { id: StatusGroup; readonly label: string }[] = [statusGroup('todo'), statusGroup('doing'), statusGroup('done')];

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
  /** Düğme alanı: tıklayınca o kayıtta yapılacaklar (bkz. automations.ts Action) */
  actions?: { key: string; value: string }[];
  /** Benzersiz numara: önek, ör. "DENEY" → DENEY-12 */
  prefix?: string;
  /** İlişki en fazla bir kayda bağlanabilir (Notion'daki "1 sayfa sınırı") */
  single?: boolean;
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

/** Hazır tiplerin tanımı; ad ve alan adları etkin dilden gelir (i18n: types.*) */
type BuiltinPropDef = Omit<PropDef, 'label'>;
type BuiltinDef = Omit<TypeDef, 'label' | 'plural' | 'props'> & { props: BuiltinPropDef[] };

const topics: BuiltinPropDef = { key: 'topics', kind: 'relation', target: ['concept'], table: true };
const words: BuiltinPropDef = { key: 'words', kind: 'relation', target: ['word'] };

const BUILTIN_DEFS: BuiltinDef[] = [
  {
    id: 'book', icon: '📚', color: '#d9822b', cover: 'cover',
    props: [
      { key: 'author', kind: 'relation', target: ['person'], table: true },
      { key: 'status', kind: 'select', options: ['Okunacak', 'Okunuyor', 'Bitti', 'Yarım bıraktım'], table: true },
      { key: 'rating', kind: 'rating', table: true },
      { key: 'started', kind: 'date' },
      { key: 'finished', kind: 'date', table: true },
      { key: 'pages', kind: 'number' },
      { key: 'cover', kind: 'url' },
      words, topics,
    ],
  },
  {
    id: 'paper', icon: '📄', color: '#3d7bd9', sort: 'year',
    props: [
      { key: 'kind', kind: 'select', options: ['Dergi makalesi', 'Konferans bildirisi', 'Tez', 'Ön baskı', 'Kitap bölümü', 'Rapor'], table: true },
      { key: 'authors', kind: 'relation', target: ['person'], table: true },
      { key: 'venue', kind: 'text', table: true },
      { key: 'year', kind: 'number', table: true },
      { key: 'status', kind: 'select', options: ['Okunacak', 'Okunuyor', 'Okundu'], table: true },
      { key: 'context', kind: 'select', options: ['Ders', 'Araştırma', 'Kişisel ilgi'], table: true },
      { key: 'course', kind: 'relation', target: ['course'] },
      { key: 'rating', kind: 'rating' },
      { key: 'doi', kind: 'url' },
      { key: 'pdf', kind: 'url' },
      { key: 'cites', kind: 'relation', target: ['paper'] },
      words, topics,
    ],
  },
  {
    id: 'movie', icon: '🎬', color: '#c2417a', cover: 'cover',
    props: [
      { key: 'kind', kind: 'select', options: ['Film', 'Dizi', 'Belgesel'], table: true },
      { key: 'director', kind: 'relation', target: ['person'], table: true },
      { key: 'year', kind: 'number', table: true },
      { key: 'status', kind: 'select', options: ['İzlenecek', 'İzleniyor', 'İzlendi'], table: true },
      { key: 'rating', kind: 'rating', table: true },
      { key: 'watched', kind: 'date' },
      { key: 'cover', kind: 'url' },
      words, topics,
    ],
  },
  {
    id: 'talk', icon: '🎙️', color: '#8a55d4', sort: 'date',
    props: [
      { key: 'speakers', kind: 'relation', target: ['person'], table: true },
      { key: 'event', kind: 'text', table: true },
      { key: 'date', kind: 'date', table: true },
      { key: 'status', kind: 'select', options: ['İzlenecek', 'İzlendi'], table: true },
      { key: 'url', kind: 'url' },
      words, topics,
    ],
  },
  {
    id: 'course', icon: '🎓', color: '#2f9e6e',
    props: [
      { key: 'code', kind: 'text', table: true },
      { key: 'instructor', kind: 'relation', target: ['person'], table: true },
      { key: 'term', kind: 'text', table: true },
      { key: 'status', kind: 'select', options: ['Devam ediyor', 'Tamamlandı', 'Planlanan'], table: true },
      topics,
    ],
  },
  {
    id: 'lab', icon: '🧪', color: '#0f8a7e', sort: 'date',
    props: [
      { key: 'course', kind: 'relation', target: ['course'], table: true },
      { key: 'date', kind: 'date', table: true },
      { key: 'status', kind: 'select', options: ['Hazırlanıyor', 'Yapıldı', 'Rapor yazılıyor', 'Teslim edildi'], table: true },
      { key: 'due', kind: 'date', table: true },
      { key: 'partners', kind: 'relation', target: ['person'] },
      { key: 'equipment', kind: 'multiselect', options: ['Osiloskop', 'Multimetre', 'Sinyal üreteci', 'DC güç kaynağı', 'Breadboard', 'Mikrodenetleyici', 'FPGA', 'Spektrum analizörü', 'LCR metre', 'MATLAB/Simulink', 'LTspice'], table: true },
      { key: 'grade', kind: 'number' },
      { key: 'report', kind: 'url' },
      topics,
    ],
  },
  {
    id: 'conference', icon: '🎤', color: '#b5462f', sort: 'start',
    props: [
      { key: 'acronym', kind: 'text', table: true },
      { key: 'status', kind: 'select', options: ['İlgileniyorum', 'Başvuracağım', 'Başvurdum', 'Kabul edildi', 'Reddedildi', 'Katıldım'], table: true },
      { key: 'deadline', kind: 'date', table: true },
      { key: 'start', kind: 'date', table: true },
      { key: 'end', kind: 'date' },
      { key: 'location', kind: 'text', table: true },
      { key: 'role', kind: 'select', options: ['Dinleyici', 'Sözlü sunum', 'Poster', 'Hakem', 'Oturum başkanı'] },
      { key: 'papers', kind: 'relation', target: ['paper'] },
      { key: 'url', kind: 'url' },
      topics,
    ],
  },
  {
    id: 'event', icon: '🗓️', color: '#1a73e8', sort: 'date',
    props: [
      { key: 'date', kind: 'date', table: true },
      { key: 'time', kind: 'text', table: true },
      { key: 'endTime', kind: 'text' },
      { key: 'location', kind: 'text', table: true },
      { key: 'people', kind: 'relation', target: ['person'] },
      topics,
    ],
  },
  {
    id: 'note', icon: '📝', color: '#6b7280',
    props: [
      { key: 'course', kind: 'relation', target: ['course'], table: true },
      { key: 'source', kind: 'relation', target: ['book', 'paper', 'talk', 'movie'], table: true },
      topics,
    ],
  },
  {
    id: 'word', icon: '🔤', color: '#0e9aa7',
    props: [
      { key: 'meaning', kind: 'longtext', table: true },
      { key: 'language', kind: 'select', options: ['İngilizce', 'Almanca', 'Fransızca', 'Türkçe', 'Osmanlıca', 'Diğer'], table: true },
      { key: 'pos', kind: 'select', options: ['İsim', 'Fiil', 'Sıfat', 'Zarf', 'Deyim', 'Terim'] },
      { key: 'example', kind: 'longtext' },
      { key: 'learned', kind: 'checkbox', table: true },
    ],
  },
  {
    id: 'person', icon: '👤', color: '#b5892f',
    props: [
      { key: 'role', kind: 'text', table: true },
      { key: 'affiliation', kind: 'text', table: true },
      { key: 'url', kind: 'url' },
      topics,
    ],
  },
  {
    id: 'concept', icon: '💡', color: '#2aa198',
    props: [
      { key: 'definition', kind: 'longtext', table: true },
      { key: 'related', kind: 'relation', target: ['concept'], table: true },
    ],
  },
  {
    id: 'daily', icon: '📅', color: '#5c7cfa', sort: 'date',
    props: [
      { key: 'date', kind: 'date', table: true },
    ],
  },
];

const SHARED_PROPS = new Set(['topics', 'words']);
const propLabelKey = (type: string, key: string) => (SHARED_PROPS.has(key) ? `types.shared.${key}` : `types.${type}.props.${key}`);

function localizeBuiltins(): TypeDef[] {
  return BUILTIN_DEFS.map((d) => ({
    ...d,
    label: tOr(`types.${d.id}.label`, d.id),
    plural: tOr(`types.${d.id}.plural`, d.id),
    props: d.props.map((p) => ({ ...p, label: tOr(propLabelKey(d.id, p.key), p.key) })),
  }));
}

export let BUILTIN_TYPES: TypeDef[] = localizeBuiltins();

/** Hazır alanın kaynak dildeki adı: formüller prop("Sayfa") gibi bu adla yazılmış olabilir */
export const builtinSourceLabel = (type: string, key: string) =>
  BUILTIN_DEFS.some((d) => d.id === type && d.props.some((p) => p.key === key)) ? tSource(propLabelKey(type, key)) : undefined;

/** Hazır seçeneklerin değerleri kaynak dilde saklanır (kod onlara bakar); ekranda etkin dildeki adları gösterilir */
export const optionLabel = (o: string) => tOr(`options.${o}`, o);

// ---------- kullanıcı ayarlarıyla birleştirilmiş tip kayıt defteri ----------

export interface PropOverride {
  label?: string;
  single?: boolean;
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
  return types.map((ty) => {
    const backs: PropDef[] = [];
    for (const s of types) {
      const rels = s.props.filter((p) => p.kind === 'relation' && !p.back && p.target?.includes(ty.id));
      for (const p of rels) {
        const label = p.backLabel ?? (s.id === ty.id ? t('types.backLabel', { label: p.label }) : rels.length > 1 ? `${s.plural} · ${p.label}` : s.plural);
        backs.push({ key: backKey(s.id, p.key), label, kind: 'relation', target: [s.id], back: { type: s.id, key: p.key } });
      }
    }
    return backs.length ? { ...ty, props: [...ty.props, ...backs] } : ty;
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

// Dil değişince hazır tiplerin adları yeniden kurulur
onLocaleChange(() => {
  BUILTIN_TYPES = localizeBuiltins();
  applyTypeSettings(typeSettings);
});

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

export type ViewKind = 'table' | 'cards' | 'board' | 'calendar' | 'list' | 'timeline' | 'chart' | 'form';

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
  /** board: alt gruplama (satırlar) */
  subGroupBy?: string;
  /** calendar/timeline: (başlangıç) tarih alanı */
  dateKey?: string;
  /** timeline: bitiş tarihi alanı */
  endKey?: string;
  /** table: gizli sütunlar */
  hidden?: string[];
  /** Grafik görünümü ayarları (bkz. ChartView) */
  chart?: { type?: 'bar' | 'hbar' | 'line'; x?: string; bucket?: 'week' | 'month' | 'year'; fn?: 'count' | 'sum' | 'avg'; y?: string };
}

export interface Settings {
  routines: Routine[];
  types?: TypeSettings;
  /** Koleksiyon başına kayıtlı görünümler */
  views?: Record<string, SavedView[]>;
  /** Senkron blokların içerikleri (bkz. editor/SyncedBlock.tsx) */
  synced?: Record<string, { content: unknown; updated_at: string }>;
  /** Koleksiyon başına otomasyon kuralları (bkz. automations.ts) */
  automations?: Record<string, import('./automations').Rule[]>;
  /** Koleksiyon başına varsayılan şablon kimliği */
  defaultTemplates?: Record<string, string>;
  /** Google Takvim eşitlemesi */
  calendar?: { enabled: boolean; calendarId?: string; fields: string[]; reminders: number[]; eventOff?: boolean; external?: string[] };
  /** Ana sayfa bileşenlerinin sırası ve görünürlüğü */
  homeLayout?: { id: string; on: boolean }[];
  /** Yıllık okuma hedefleri (yıl → kitap/makale sayısı) */
  readingGoals?: Record<string, import('./reading').ReadingGoal>;
  /** "Tarihte bugün" bileşeninin dili */
  otdLang?: import('./onThisDay').OtdLang;
  /** Yapışkan notlar (bkz. sticky.ts) */
  stickies?: import('./sticky').Sticky[];
  /** Yapışkan notlar her sayfada mı yoksa yalnız ana sayfada mı görünsün (varsayılan: her sayfada) */
  stickyScope?: import('./sticky').StickyScope;
  /** Yapışkan notlar ekranda sabit mi dursun yoksa sayfayla birlikte mi kaysın (varsayılan: sabit); her not kendisi de seçebilir */
  stickyFixed?: boolean;
  /** Depolama göstergesi: görünüm, kaplama, gadget konumu (bkz. driveMeter.ts) */
  meter?: import('./driveMeter').MeterSettings;
  /** Arka plan eklentisinde seçili sahne/renk kimliği (bkz. wallpaper.ts); yoksa arka plan yok */
  wallpaper?: string;
  /** Marketten kurulan eklentiler (bkz. plugins.ts); hiç kaydedilmemişse o an kullanılanlar kurulu sayılır */
  installed?: string[];
}

export const DEFAULT_SETTINGS: Settings = {
  routines: [
    { id: 'read', get label() { return t('types.routines.read'); }, icon: '📖' },
    { id: 'paper', get label() { return t('types.routines.paper'); }, icon: '📄' },
    { id: 'sport', get label() { return t('types.routines.sport'); }, icon: '🏃' },
    { id: 'study', get label() { return t('types.routines.study'); }, icon: '🎓' },
  ],
};

export const relationIds = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
