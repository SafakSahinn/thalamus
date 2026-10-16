# Thalamus

Notion'daki koleksiyonları ve Obsidian'daki bağlantı haritasını tek uygulamada birleştiren kişisel not uygulaması. Telefona ve bilgisayara uygulama olarak yüklenebilir (PWA), çevrimdışı çalışır, Supabase ile cihazlar arasında eşitlenir.

- **Koleksiyonlar:** kitap, makale/bildiri, film, söyleşi, ders, not, kişi, kavram, günlük
- **Bağlantılar:** metinde `[[` ile not bağlantısı; yazar, konu ve kelime alanları da bağlantıdır. Her notta geri bağlantılar ve yerel harita, ayrıca tüm notların grafiği
- **Ortak sözlük:** kitaplara/makalelere eklenen kelimeler tek sözlükte toplanır ve geçtiği bütün kaynaklarla bağlanır
- **Editör:** `/` komutları, LaTeX formüller (`$$V=IR$$`), görev listesi, tablo, görsel
- **Günlük:** rutin işaretleme, ızgara, seri
- **Notion'dan içe aktarma:** "Markdown & CSV" dışa aktarımı

## Geliştirme

```sh
cd web
npm install
npm run dev     # Supabase ayarı yoksa yalnızca tarayıcıda (yerel modda) çalışır
npm test
```

Bulut için `web/.env.local`:

```
VITE_SUPABASE_URL=https://<proje>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon anahtar>
```

Veritabanı şeması: `supabase/migrations/`. Yayın: `main` dalına push → GitHub Pages (repo değişkenleri `SUPABASE_URL`, `SUPABASE_ANON_KEY`).
