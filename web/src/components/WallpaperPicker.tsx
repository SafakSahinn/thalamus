import { t } from '../i18n';
import { setWallpaper, useWallpaper, WALLS } from '../lib/wallpaper';
import './wallpaper.css';

/** Ayarlar sayfasındaki arka plan seçici: küçük önizlemelerden oluşan ızgara */
export default function WallpaperPicker() {
  const current = useWallpaper();
  return (
    <div className="wall-grid">
      <button className={`wall-tile none ${current ? '' : 'on'}`} onClick={() => void setWallpaper(undefined)} title={t('settings.wallpaper.none')}>
        <span>{t('settings.wallpaper.none')}</span>
      </button>
      {WALLS.map((w) => (
        <button key={w.id} className={`wall-tile ${current?.id === w.id ? 'on' : ''}`} style={{ background: w.css }}
          onClick={() => void setWallpaper(w.id)} title={t(`settings.wallpaper.names.${w.id}`)} aria-label={t(`settings.wallpaper.names.${w.id}`)} />
      ))}
    </div>
  );
}
