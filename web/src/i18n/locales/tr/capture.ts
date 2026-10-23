// Dışa aktarma, hızlı kayıt, kaynakça, paylaşılan sayfa, makale arama
export default {
  export: {
    figure: 'sekil',
    attachments: 'ekler',
    file: 'dosya',
    journal: 'Günlükler',
    readme: '# Thalamus dışa aktarımı\n\n{date} tarihinde oluşturuldu. {notes} not, {assets} ek.\n\nHer koleksiyon ayrı bir klasörde; not alanları dosyaların başındaki YAML bölümünde. Bağlantılar [[Not adı]] biçiminde olduğu için klasör Obsidian’da doğrudan açılabilir.\n',
  },
  quick: {
    aria: 'Thalamus’a kaydet',
    title: '📥 Thalamus’a kaydet',
    titleField: 'Başlık',
    collection: 'Koleksiyon',
    note: 'Not',
    notePlaceholder: 'İstersen bir not ekle…',
    ident: '🔎 Bu bir {kind} bağlantısı: başlık, yazarlar, yıl ve özet kendiliğinden doldurulacak.',
    fetching: 'Bilgiler alınıyor…',
  },
  bib: {
    title: '📚 Kaynakça',
    copied: '✓ Kopyalandı',
    copyText: 'Metni kopyala',
    copyBib: 'BibTeX kopyala',
    empty: 'Bu notta henüz makaleye atıf yok. Metinde {code} yazıp bir makaleyi seçtiğinde burada listelenir.',
  },
  shared: {
    failed: 'İçerik gösterilemedi.',
    sharedWith: 'ile paylaşıldı',
    notFound: 'Bu sayfa bulunamadı. Paylaşım kaldırılmış olabilir.',
    updated: 'Son güncelleme: {date}',
  },
  scholar: {
    notFound: 'Bu kimlikle bir yayın bulunamadı. DOI ya da arXiv numarasını kontrol et.',
  },
};
