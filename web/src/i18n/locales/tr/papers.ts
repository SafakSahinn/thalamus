// Drive hataları, makale içe aktarma, kaynak gösterimi
export default {
  drive: {
    notFound: 'Drive dosyası bulunamadı',
    full: 'Google Drive alanın dolu.',
  },
  paper: {
    abstract: 'Özet',
    keywords: 'Anahtar kelimeler: ',
    noIdent: 'Bunda bir DOI ya da arXiv numarası bulamadım. Örnek: 10.1109/TAC.1979.1101943 ya da arxiv.org/abs/1706.03762',
    noIdentShort: 'DOI ya da arXiv numarası bulunamadı.',
    noteNotFound: 'Not bulunamadı.',
    fromDoi: 'PDF’teki DOI ile',
    fromTitle: 'başlıkla Crossref’te bulunarak',
    fromText: 'yalnızca PDF metninden (yayın kaydı bulunamadı, kontrol et)',
    gotAbstract: 'özet',
    gotSections: '{count} bölüm başlığı',
    and: ' ve ',
    written: '{got} notun içine yazıldı',
    noContent: 'içerik bulunamadı',
    untouched: 'notta yazdıkların olduğu için içeriğe dokunulmadı (⋯ → “PDF’ten bilgileri al” ile sona ekleyebilirsin)',
    filled: 'Bilgiler {from} dolduruldu; {content}.',
  },
  cite: {
    noDate: 't.y.',
  },
};
