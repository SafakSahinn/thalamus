import { t } from '../i18n';
// Notion'daki renk paleti. Renkler CSS değişkeni olarak saklanır (var(--tc-red) gibi),
// böylece açık ve koyu temada otomatik uyum sağlar.

const COLOR_IDS = ['default', 'gray', 'brown', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'red'] as const;

export const TEXT_COLORS = COLOR_IDS.map((id) => ({ id, get label() { return t(`panels.colors.${id}`); } }));

export const BG_COLORS = TEXT_COLORS;
