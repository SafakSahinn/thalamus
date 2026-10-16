// Notion'daki renk paleti. Renkler CSS değişkeni olarak saklanır (var(--tc-red) gibi),
// böylece açık ve koyu temada otomatik uyum sağlar.

export const TEXT_COLORS = [
  { id: 'default', label: 'Varsayılan' },
  { id: 'gray', label: 'Gri' },
  { id: 'brown', label: 'Kahverengi' },
  { id: 'orange', label: 'Turuncu' },
  { id: 'yellow', label: 'Sarı' },
  { id: 'green', label: 'Yeşil' },
  { id: 'blue', label: 'Mavi' },
  { id: 'purple', label: 'Mor' },
  { id: 'pink', label: 'Pembe' },
  { id: 'red', label: 'Kırmızı' },
] as const;

export const BG_COLORS = TEXT_COLORS;
