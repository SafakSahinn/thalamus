import { t } from '../../i18n';
import { useMemo } from 'react';
import { DEFAULT_SKIN, SVG_SKINS, WIN7_SKINS, patchClock, setClockFixed, timeZones, tzLabel, useClockSettings } from '../../lib/clock';
import { pageScrollTop } from '../../lib/pageScroll';
import { SkinPreview } from './Clock';

// Ayarlar > Saat: kaplama (önizlemeli), ad, saat dilimi, saniye ibresi, gadget'ın yeri, sabitliği ve görünürlüğü

export default function ClockSettings() {
  const s = useClockSettings();
  const zones = useMemo(() => timeZones().map((z) => ({ z, label: tzLabel(z) })).sort((a, b) => a.label.localeCompare(b.label)), []);
  const row = (label: string, body: React.ReactNode) => <div className="meter-set-row"><span className="muted small">{label}</span>{body}</div>;
  const seg = <T,>(value: T, opts: [T, string][], set: (v: T) => void) => (
    <div className="seg">{opts.map(([v, l]) => <button key={String(v)} className={value === v ? 'on' : ''} onClick={() => set(v)}>{l}</button>)}</div>
  );
  return (
    <div className="meter-settings clock-settings">
      {row(t('clock.settings.skin'), (
        <div className="clock-skins">
          {[WIN7_SKINS, SVG_SKINS].map((group, i) => (
            <div key={i} className="clock-skin-row">
              {group.map((k) => (
                <button key={k} className={(s.skin ?? DEFAULT_SKIN) === k ? 'on' : ''} title={t(`clock.skins.${k}`)} aria-label={t(`clock.skins.${k}`)}
                  onClick={() => void patchClock({ skin: k })}>
                  <SkinPreview skin={k} />
                </button>
              ))}
            </div>
          ))}
        </div>
      ))}
      {row(t('clock.settings.label'), (
        <input type="text" maxLength={24} placeholder={t('clock.settings.labelHint')} defaultValue={s.label ?? ''}
          onBlur={(e) => { const v = e.target.value.trim(); if (v !== (s.label ?? '')) void patchClock({ label: v || undefined }); }}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
      ))}
      {row(t('clock.settings.tz'), (
        <select value={s.tz ?? ''} onChange={(e) => void patchClock({ tz: e.target.value || undefined })}>
          <option value="">{t('clock.settings.tzLocal')}</option>
          {zones.map(({ z, label }) => <option key={z} value={z}>{label}</option>)}
        </select>
      ))}
      {row(t('clock.settings.seconds'), seg(s.seconds ?? true, [[true, t('clock.settings.on')], [false, t('clock.settings.off')]], (v) => void patchClock({ seconds: v })))}
      {row(t('clock.settings.size'), seg<'large' | 'small'>(s.size ?? 'large', [['large', t('clock.larger')], ['small', t('clock.smaller')]], (v) => void patchClock({ size: v })))}
      {row(t('clock.settings.scope'), seg<'all' | 'home'>(s.scope ?? 'all', [['all', t('clock.settings.scopeAll')], ['home', t('clock.settings.scopeHome')]], (v) => void patchClock({ scope: v })))}
      {row(t('clock.settings.fixed'), seg(s.fixed ?? true, [[true, t('clock.settings.fixedOn')], [false, t('clock.settings.fixedOff')]], (v) => void setClockFixed(v, pageScrollTop())))}
      {row(t('clock.settings.gadget'), seg(!!s.hidden, [[false, t('clock.settings.visible')], [true, t('clock.settings.hidden')]], (v) => void patchClock({ hidden: v })))}
    </div>
  );
}
