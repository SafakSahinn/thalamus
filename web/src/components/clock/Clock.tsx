import { t } from '../../i18n';
import { CLOCK_SKINS, clockParts, clockTooltip, handAngles, patchClock, useNow, type ClockSettings } from '../../lib/clock';
import type { MenuItem } from '../ContextMenu';
import ClockFace from './ClockFace';

// Saatin kendisi: seçili saat dilimindeki an + kaplama (gadget, rozet ve ana sayfa bileşeni ortak)

export default function Clock({ s, bare }: { s: ClockSettings; bare?: boolean }) {
  const now = useNow();
  const a = handAngles(clockParts(now, s.tz));
  return (
    <ClockFace skin={s.skin ?? 'classic'} hour={a.hour} minute={a.minute} second={a.second}
      seconds={s.seconds ?? true} label={s.label} bare={bare} title={clockTooltip(now, s.tz)} />
  );
}

/** Kaplama ve saniye ibresi seçimleri (gadget menüsü ve ana sayfa bileşeni ortak) */
export function clockMenuItems(s: ClockSettings, extra: MenuItem[] = []): MenuItem[] {
  const check = (on: boolean) => (on ? '✓' : '');
  return [
    ...CLOCK_SKINS.map((k): MenuItem => ({ key: `k-${k}`, icon: check((s.skin ?? 'classic') === k), label: t(`clock.skins.${k}`), run: () => void patchClock({ skin: k }) })),
    { key: 's1', sep: true },
    { key: 'sec', icon: check(s.seconds ?? true), label: t('clock.settings.seconds'), run: () => void patchClock({ seconds: !(s.seconds ?? true) }) },
    ...extra,
  ];
}
