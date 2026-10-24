import { t } from '../../i18n';
import { patchMeter, SKINS, useMeterSettings, VIEWS } from '../../lib/driveMeter';

// Ayarlar > Depolama göstergesi: görünüm, kaplama, boy ve gadget'ın görünürlüğü

export default function MeterSettings() {
  const s = useMeterSettings();
  const view = s.view ?? 'win7';
  const row = (label: string, body: React.ReactNode) => <div className="meter-set-row"><span className="muted small">{label}</span>{body}</div>;
  return (
    <div className="meter-settings">
      {row(t('meter.settings.view'), (
        <div className="seg">
          {VIEWS.map((v) => <button key={v} className={view === v ? 'on' : ''} onClick={() => void patchMeter({ view: v })}>{t(`meter.views.${v}`)}</button>)}
        </div>
      ))}
      {view === 'win7' && row(t('meter.settings.skin'), (
        <select value={s.skin ?? 'original'} onChange={(e) => void patchMeter({ skin: e.target.value as (typeof SKINS)[number] })}>
          {SKINS.map((k) => <option key={k} value={k}>{t(`meter.skins.${k}`)}</option>)}
        </select>
      ))}
      {view === 'win7' && row(t('meter.settings.size'), (
        <div className="seg">
          <button className={s.size !== 'small' ? 'on' : ''} onClick={() => void patchMeter({ size: 'large' })}>{t('meter.larger')}</button>
          <button className={s.size === 'small' ? 'on' : ''} onClick={() => void patchMeter({ size: 'small' })}>{t('meter.smaller')}</button>
        </div>
      ))}
      {row(t('meter.settings.scope'), (
        <div className="seg">
          <button className={s.scope !== 'home' ? 'on' : ''} onClick={() => void patchMeter({ scope: 'all' })}>{t('meter.settings.scopeAll')}</button>
          <button className={s.scope === 'home' ? 'on' : ''} onClick={() => void patchMeter({ scope: 'home' })}>{t('meter.settings.scopeHome')}</button>
        </div>
      ))}
      {row(t('meter.settings.gadget'), (
        <div className="seg">
          <button className={!s.hidden ? 'on' : ''} onClick={() => void patchMeter({ hidden: false })}>{t('meter.settings.visible')}</button>
          <button className={s.hidden ? 'on' : ''} onClick={() => void patchMeter({ hidden: true })}>{t('meter.settings.hidden')}</button>
        </div>
      ))}
    </div>
  );
}
