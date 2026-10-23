import { t } from '../i18n';
import { useEffect, useRef } from 'react';

/**
 * Ayarlar → "Bilgisayardan kaydet": yer imleri çubuğuna sürüklenen düğme (Notion Web Clipper'ın karşılığı).
 * Tıklanınca açık sayfanın başlığını, adresini ve seçili metni Thalamus'un paylaşım penceresine gönderir
 * (telefondaki "Paylaş → Thalamus" ile aynı yol).
 */
export default function ClipperSettings() {
  const link = useRef<HTMLAnchorElement>(null);
  const app = `${location.origin}${import.meta.env.BASE_URL}`;
  useEffect(() => {
    // React javascript: adreslerini engellediği için doğrudan DOM'a yazılır
    const code = `(function(){var u='${app}?share=1&title='+encodeURIComponent(document.title)+'&url='+encodeURIComponent(location.href)+'&text='+encodeURIComponent(String(window.getSelection()||''));window.open(u,'_blank');})();`;
    link.current?.setAttribute('href', `javascript:${code}`);
  }, [app]);
  return (
    <section>
      <h3>{t('misc.clipper.title')}</h3>
      <p className="muted small">{t.rich('misc.clipper.body', { drag: <b>{t('misc.clipper.drag')}</b> })}</p>
      <a ref={link} className="btn clipper" onClick={(e) => e.preventDefault()} draggable title={t('misc.clipper.dragTitle')}>{t('misc.clipper.button')}</a>
    </section>
  );
}
