import { t } from '../../i18n';
import { DEFAULT_SKIN, SVG_SKINS, WIN7_SKINS, clockParts, clockTooltip, handAngles, patchClock, useNow, type ClockSettings, type ClockSkin } from '../../lib/clock';
import type { MenuItem } from '../ContextMenu';
import ClockFace from './ClockFace';

// Saatin kendisi: seçili saat dilimindeki an + kaplama (gadget, rozet ve ana sayfa bileşeni ortak)

export default function Clock({ s, bare }: { s: ClockSettings; bare?: boolean }) {
  const now = useNow();
  const a = handAngles(clockParts(now, s.tz));
  return (
    <ClockFace skin={s.skin ?? DEFAULT_SKIN} hour={a.hour} minute={a.minute} second={a.second}
      seconds={s.seconds ?? true} label={s.label} bare={bare} title={clockTooltip(now, s.tz)} />
  );
}

/** Kaplama önizlemesi: ibreler 10:10'u gösterir (saat reklamlarındaki gibi) */
export const SkinPreview = ({ skin }: { skin: ClockSkin }) => <ClockFace skin={skin} hour={305} minute={60} second={210} seconds bare />;

const ROW = 4;

/** Kaplama seçimi: not kâğıdı renkleri gibi yazısız kutucuk sıraları (önce orijinal Win7 kadranları, sonra bizimkiler) */
function skinRows(s: ClockSettings): MenuItem[] {
  const cur = s.skin ?? DEFAULT_SKIN;
  const rows: MenuItem[] = [];
  for (const group of [WIN7_SKINS, SVG_SKINS] as ClockSkin[][]) {
    for (let i = 0; i < group.length; i += ROW) {
      rows.push({
        key: `k-${group[i]}`,
        className: 'clock-swatch',
        swatches: group.slice(i, i + ROW).map((k) => ({ id: k, label: t(`clock.skins.${k}`), on: cur === k, content: <SkinPreview skin={k} /> })),
        pick: (id) => void patchClock({ skin: id as ClockSkin }),
      });
    }
    if (group === WIN7_SKINS) rows.push({ key: 'k-sep', sep: true });
  }
  return rows;
}

/** Kaplama ve saniye ibresi seçimleri (gadget menüsü ve ana sayfa bileşeni ortak) */
export function clockMenuItems(s: ClockSettings, extra: MenuItem[] = []): MenuItem[] {
  const check = (on: boolean) => (on ? '✓' : '');
  return [
    ...skinRows(s),
    { key: 's1', sep: true },
    { key: 'sec', icon: check(s.seconds ?? true), label: t('clock.settings.seconds'), run: () => void patchClock({ seconds: !(s.seconds ?? true) }) },
    ...extra,
  ];
}
