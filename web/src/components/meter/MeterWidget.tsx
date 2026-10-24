import { t } from '../../i18n';
import { useEffect } from 'react';
import { patchMeter, refreshMeter, useMeter, useMeterSettings, watchMeter } from '../../lib/driveMeter';
import { openMenu } from '../ContextMenu';
import { meterMenuItems } from '../DriveMeter';
import MeterView, { meterTooltip } from './MeterView';

// Depolama göstergesinin ana sayfa bileşeni hâli: gadget ile aynı görünüm ayarlarını kullanır.

export default function MeterWidget() {
  const s = useMeterSettings();
  const data = useMeter((m) => m.data);
  const error = useMeter((m) => m.error);
  const loading = useMeter((m) => m.loading);
  useEffect(() => watchMeter(), []);
  const options = (e: React.MouseEvent) => {
    const b = (e.currentTarget as HTMLElement).getBoundingClientRect();
    openMenu(b.left, b.bottom + 2, meterMenuItems(s, s.hidden
      ? [{ key: 's3', sep: true }, { key: 'show', icon: '🖥', label: t('meter.show'), run: () => void patchMeter({ hidden: false }) }]
      : []));
  };
  return (
    <div className="meter-widget">
      <div className="row">
        <h2>{t('meter.widgetTitle')}</h2>
        <span className="spacer" />
        <button className={`iconbtn ${loading ? 'spin' : ''}`} title={t('meter.refresh')} onClick={() => void refreshMeter()}>⟳</button>
        <button className="iconbtn" title={t('meter.options')} onClick={options}>⋯</button>
      </div>
      <div className="meter-widget-body" title={meterTooltip(data, error)}>
        {data ? <MeterView data={data} s={s} /> : <span className="muted">{error ? t('meter.error', { msg: error }) : t('meter.loading')}</span>}
      </div>
    </div>
  );
}
