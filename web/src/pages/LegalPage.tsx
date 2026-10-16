const CONTACT = 'getthalamus@gmail.com';
const CONTROLLER = 'Şafak Şahin';
const UPDATED = '16 Ekim 2026';
const REPO = 'https://github.com/SafakSahinn/thalamus';
const POLICY = 'https://developers.google.com/terms/api-services-user-data-policy';

const Mail = () => <a href={`mailto:${CONTACT}`}>{CONTACT}</a>;

export default function LegalPage({ kind }: { kind: 'privacy' | 'terms' }) {
  return (
    <div className="page legal">
      <p><a href="#/">← Thalamus</a></p>
      {kind === 'privacy' ? (
        <>
          <h1>Gizlilik ve KVKK Aydınlatma Metni</h1>
          <p className="muted small">Son güncelleme: {UPDATED}</p>
          <p>
            Bu metin, Thalamus’un hangi kişisel verileri neden ve nasıl işlediğini 6698 sayılı Kişisel Verilerin
            Korunması Kanunu (“KVKK”) kapsamında açıklar. Veri sorumlusu: <strong>{CONTROLLER}</strong>, iletişim: <Mail />.
          </p>

          <h2>Notların senin Google Drive’ında</h2>
          <p>
            Yazdığın notlar, kelimeler, günlükler ve yüklediğin dosyalar <b>yalnızca</b> iki yerde durur: kullandığın cihazın
            tarayıcısında (çevrimdışı çalışabilmek için) ve kendi Google Drive’ındaki <b>Thalamus</b> klasöründe. Uygulama
            bunları tarayıcından doğrudan Google’a gönderir; içerik sunucumuzdan geçmez ve sunucumuzda saklanmaz. Bu veriler üzerindeki tasarruf tamamen sana aittir; Drive’ındaki klasörü istediğin zaman
            indirebilir, taşıyabilir ya da silebilirsin.
          </p>
          <p>
            Uygulama Google Drive’da yalnızca <b>kendi oluşturduğu dosyalara</b> erişebilir (drive.file izni); Drive’ındaki
            diğer dosyaları göremez.
          </p>

          <h2>Herkese açık paylaştığın notlar</h2>
          <p>
            Bir notu “Paylaş” ile bağlantıyla yayınlarsan, o notun bir kopyası (başlık, alanlar ve içerik) bağlantıyı açanlara
            gösterilebilmesi için sunucumuzda tutulur ve bağlantıyı bilen herkes tarafından görülebilir. Paylaşımı kaldırdığında bu
            kopya silinir. Paylaşmadığın notlar sunucumuza hiç gelmez.
          </p>

          <h2>Bizde tutulan bilgiler</h2>
          <ul>
            <li>Google hesabının e-posta adresi, adı ve Google hesap kimliği,</li>
            <li>kayıt tarihin ve uygulamayı en son kullandığın zaman,</li>
            <li>duyuru e-postası almak isteyip istemediğin,</li>
            <li>Ayarlar’dan gönderdiğin geri bildirim mesajları.</li>
          </ul>
          <p>
            <b>Amaç:</b> hesabını tanımak, hizmetin kaç kişi tarafından kullanıldığını izlemek, hizmetle ilgili önemli
            bildirimleri iletmek ve (yalnızca onay verdiysen) yenilikleri duyurmak. <b>Hukuki sebep:</b> KVKK m.5/2-c
            (hizmet sözleşmesinin kurulması ve ifası), m.5/2-f (meşru menfaat: hizmetin işletilmesi ve güvenliği); duyuru
            e-postaları için açık rızan. Duyurulardan her e-postadaki bağlantıyla ya da Ayarlar’dan çıkabilirsin.
          </p>
          <p>
            Bu bilgiler Supabase altyapısında, Avrupa Birliği’ndeki (Frankfurt) sunucularda saklanır. Bu, KVKK m.9 kapsamında
            yurt dışına aktarım sayılır ve hizmetin sunulabilmesi için gereklidir. Satılmaz, reklam için kullanılmaz,
            üçüncü kişilerle paylaşılmaz. Reklam, analiz ya da izleme aracı kullanılmaz.
          </p>

          <h2>Google oturumu</h2>
          <p>
            Google ile giriş yaptığında Google’ın verdiği kalıcı oturum anahtarı, yeni cihazlarda izin ekranını tekrar göstermemek
            için sunucumuzda <b>şifrelenmiş</b> olarak saklanır. Bu anahtar yalnızca Thalamus’un kendi oluşturduğu Drive dosyalarına
            (ve takvim eşitlemesini açtıysan “Thalamus” takvimine) erişebilir; Drive’ındaki diğer dosyalara ve diğer takvimlerine
            erişemez. Hesabını sildiğinde ya da Google hesabından Thalamus’un erişimini kaldırdığında anahtar da silinir.
          </p>
          <p>
            Thalamus’un Google API’lerinden aldığı bilgileri kullanımı ve başka uygulamalara aktarımı, Sınırlı Kullanım (Limited
            Use) şartları dahil <a href={POLICY}>Google API Hizmetleri Kullanıcı Verileri Politikası</a>’na uygundur. Google
            hesabından alınan bilgiler yalnızca yukarıda yazan amaçlarla kullanılır; yapay zekâ modellerinin eğitimi dahil başka
            hiçbir amaçla kullanılmaz ve aktarılmaz.
          </p>

          <h2>Hakların</h2>
          <p>KVKK m.11 kapsamındaki haklarını (bilgi talebi, düzeltme, silme, itiraz vb.) kullanabilirsin:</p>
          <ul>
            <li><b>Hesabı silme:</b> Ayarlar → “Hesabımı sil”. Hesap kaydın ve geri bildirimlerinle ilişkin bağlantı silinir, uygulamanın Google iznini geri alırız. İstersen Drive’ındaki Thalamus klasörü de silinir.</li>
            <li><b>Google iznini geri alma:</b> Google hesabın → Güvenlik → Üçüncü taraf uygulamalar bölümünden de Thalamus’un erişimini istediğin an kaldırabilirsin.</li>
            <li><b>Dışa aktarma:</b> Notların zaten Drive’ında; ayrıca Ayarlar → “Yedeği indir” ile tek dosya olarak indirebilirsin.</li>
            <li>Diğer talepler için: <Mail />.</li>
          </ul>
        </>
      ) : (
        <>
          <h1>Kullanım Koşulları</h1>
          <p className="muted small">Son güncelleme: {UPDATED}</p>
          <ul>
            <li>Thalamus, kişisel not tutmak için ücretsiz sunulan bir uygulamadır. Açık kaynaklıdır: <a href={REPO}>{REPO.replace('https://', '')}</a>.</li>
            <li>Notların kendi Google Drive’ında saklanır; Google Drive kullanımın Google’ın kendi koşullarına ve depolama kotana tabidir.</li>
            <li>Uygulama “olduğu gibi” sunulur; kesintisiz çalışacağı ya da veri kaybı yaşanmayacağı garanti edilmez. Önemli notlarının ara sıra yedeğini almanı öneririz (Ayarlar → Yedeği indir).</li>
            <li>Yazdığın içerik sana aittir ve sorumluluğu sendedir. Uygulamayı ya da altyapısını kötüye kullanmaya yönelik girişimler yasaktır; bu durumda hesap kaydı silinebilir.</li>
            <li>Koşullar değişirse bu sayfa güncellenir. İletişim: <Mail />.</li>
          </ul>
        </>
      )}
    </div>
  );
}
