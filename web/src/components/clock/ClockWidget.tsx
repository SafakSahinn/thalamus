import { t } from '../../i18n';
import { patchClock, useClockSettings } from '../../lib/clock';
import { openMenu } from '../ContextMenu';
import Clock, { clockMenuItems } from './Clock';

// Saatin ana sayfa bileşeni hâli: gadget ile aynı ayarları kullanır.

export default function ClockWidget() {
  const s = useClockSettings();
  const options = (e: React.MouseEvent) => {
    const b = (e.currentTarget as HTMLElement).getBoundingClientRect();
    openMenu(b.left, b.bottom + 2, clockMenuItems(s, s.hidden
      ? [{ key: 's3', sep: true }, { key: 'show', icon: '🖥', label: t('clock.show'), run: () => void patchClock({ hidden: false }) }]
      : []));
  };
  return (
    <div className="clock-widget">
      <div className="row">
        <h2>{t('clock.widgetTitle')}</h2>
        <span className="spacer" />
        <button className="iconbtn" title={t('clock.options')} onClick={options}>⋯</button>
      </div>
      <div className="clock-widget-body"><Clock s={s} /></div>
    </div>
  );
}
