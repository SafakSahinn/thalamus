export default {
  category: { home: 'Ana sayfa bileşeni', tool: 'Araç' },
  sticky: {
    name: 'Yapışkan notlar',
    summary: 'Ekranın üstünde duran, Windows 7 tarzı renkli not kâğıtları.',
    description: {
      p1: 'Aklına gelen kısa şeyleri ekranın istediğin yerine yapıştır. Kâğıtlar sayfa değiştirsen de yerinde kalır, monitöre yapıştırılmış gibi.',
      p2: 'Bir kâğıdı istediğin zaman normal nota dönüştürebilirsin: ilk satırı başlık olur, gerisi not içeriği.',
    },
    features: {
      f1: 'Sürükle, köşesinden boyutlandır, 6 renk',
      f2: 'Tüm sayfalarda ya da yalnız ana sayfada görünme seçeneği',
      f3: 'Alt Y ile bu cihazda gizle / göster',
      f4: '“Not olarak kaydet” ile kalıcı nota dönüştürme',
      f5: 'Telefonda sağ altta renkli kareler, dokununca açılır',
    },
    usage: 'Ana sayfada boş bir yere sağ tıklayıp “Yapışkan not ekle” de ya da Ctrl K → “Yeni yapışkan not”.',
    dataLabel: 'tüm yapışkan notların ve ayarları',
  },
  stickyArt: {
    name: 'Desenli not kâğıtları',
    summary: 'Yapışkan notlara kurşun kalemle çizilmiş gibi desenli kâğıtlar: çiçek, şehir, deniz, araba, kimya…',
    description: {
      p1: 'Marketlerde satılan desenli not kâğıtları ya da desenli peçeteler gibi: kâğıdın üstü baştan sona, kuru boyayla çizilmiş küçük resimlerle kaplı.',
      p2: 'Yazdıkların desenin üstünde okunur kalır. Eklentiyi kaldırırsan desenli kâğıtlar düz renge döner, notların silinmez.',
    },
    features: {
      f1: '12 desen: çiçekler, lavanta, şehir, yapraklar, deniz, dağlar, gece, kiraz çiçeği, arabalar, Vahşi Batı, matematik, kimya',
      f2: 'Renk menüsünden tek tıkla seçilir',
      f3: 'Telefonda sağ alttaki karelerde desenin küçük bir parçası görünür',
    },
    usage: 'Bir yapışkan notun ⋯ düğmesine ya da başlığına sağ tıkla; renklerin altındaki desenlerden birini seç.',
    dataLabel: 'kâğıtlardaki desen seçimleri (notlar kalır, düz renge döner)',
  },
  stickyShape: {
    name: 'Şekilli not kâğıtları',
    summary: 'Kırtasiyedeki şekilli post-it’ler gibi: araba, çiçek, ev, kalp, bulut, fincan ve ok şeklinde yapışkan notlar.',
    description: {
      p1: 'Kâğıdın kendisi bir şekil: yandan görünen bir araba, bir papatya, bir ev, bir kalp… Kâğıt rengini yine sen seçersin.',
      p2: 'Bir kâğıda istediğin kadar yazı ekleyebilir, her birini sürükleyerek istediğin yere taşıyabilirsin. Kâğıdı büyütüp küçültünce şekil ezilmez, yazılar da onunla birlikte büyür. Eklentiyi kaldırırsan şekilli kâğıtlar dikdörtgene döner, notların silinmez.',
    },
    features: {
      f1: 'Şekiller: araba, papatya, ev, kalp, bulut, kahve fincanı ve dört yöne ok',
      f2: 'Kâğıdın boş bir yerine tıkla, oraya yeni bir yazı ekle; yazıları sürükleyerek taşı',
      f3: 'Boyutlandırınca şekil ezilmez, yazılar kâğıtla birlikte büyür',
    },
    usage: 'Bir yapışkan notun ⋯ düğmesine tıkla; renklerin altındaki şekillerden birini seç. Dikdörtgene dönmek için ilk kutucuğu seç.',
    dataLabel: 'kâğıtlardaki şekil seçimleri (notlar kalır, dikdörtgene döner)',
  },
  otd: {
    name: 'Gazete: Tarihte bugün',
    summary: 'Ana sayfada eski bir gazete sayfası gibi dizilmiş “tarihte bugün” olayları.',
    description: {
      p1: 'Bugünün tarihinde geçmişte yaşanmış olaylar, doğumlar ve ölümler; Wikipedia’dan alınıp gazete düzeninde, sütunlar hâlinde dizilir.',
      p2: 'Manşette günün öne çıkan olayı yer alır; sayfaları çevirerek geri kalanını okuyabilirsin.',
    },
    features: {
      f1: 'Türkçe ya da İngilizce Wikipedia kaynağı',
      f2: 'Manşet, sütunlar ve sayfa çevirme',
      f3: 'Her olayın Wikipedia maddesine bağlantı',
    },
    usage: 'Ana sayfada en altta görünür; sırasını Ayarlar > Ana sayfa’dan değiştirebilirsin.',
    dataLabel: 'dil tercihi ve ana sayfadaki yeri',
  },
  drivemeter: {
    name: 'Depolama göstergesi',
    summary: 'Google Drive’ında ne kadar yer kaldığını ve Thalamus’un ne kadar yer kapladığını gösterir.',
    description: {
      p1: 'Ekranın üstünde serbest duran iki kadranlı bir gösterge. Büyük kadran Google Drive’ının doluluğunu, küçük kadran Thalamus’un Drive’da kapladığı yeri gösterir.',
      p2: 'Dört görünümden birini seçebilirsin: birebir Windows 7 CPU meter, halka, pasta ya da küçük bir rozet. İstersen ana sayfaya bileşen olarak da ekleyebilirsin.',
    },
    features: {
      f1: 'Win7 CPU meter görünümü: orijinal ve 5 kaplama, büyük ve küçük boy',
      f2: 'Halka, pasta ve rozet görünümleri',
      f3: 'Açılışta ve 10 dakikada bir kendiliğinden yenilenir',
      f4: 'Drive bağlı değilken tarayıcının bu cihazda ayırdığı alanı gösterir',
      f5: 'Telefonda sol altta küçük bir metin rozeti olur',
    },
    usage: 'Kurulunca sağ üstte görünür; sürükleyerek taşıyabilirsin. Üzerine gelince çıkan ⚙ düğmesinden görünümü seçersin. Ana sayfa bileşenini Ayarlar > Ana sayfa’dan açabilirsin.',
    dataLabel: 'görünüm seçimleri, gadget’ın konumu ve ana sayfadaki yeri',
  },
  wallpaper: {
    name: 'Arka plan',
    summary: 'Uygulamanın arkasına bir sahne ya da renk koyar.',
    description: {
      p1: 'Seçtiğin sahne ekranın arkasına yerleşir; kenar çubuğu buzlu cam gibi, sayfa da yarı saydam bir kart gibi üstünde durur.',
      p2: 'Sekiz sahne (piksel gökyüzü, Windows 7, Aero, çöl, dağlar, okyanus, yıldızlı gece, orman) ve sekiz renk/gradyan arasından seçebilirsin.',
    },
    features: {
      f1: '8 sahne, 5 gradyan ve 3 düz renk',
      f2: 'Koyu temada sahne kısılır, yazılar okunur kalır',
      f3: 'Seçimin bütün cihazlarına eşitlenir',
      f4: 'Telefonda da çalışır',
    },
    usage: 'Kurulunca Ayarlar > Görünüm’de önizlemeler çıkar; birine tıklaman yeterli.',
    dataLabel: 'arka plan seçimi',
  },
};
