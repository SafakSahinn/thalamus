const CONTACT = 'safaksahin022@gmail.com';
const CONTROLLER = 'Şafak Şahin';
const UPDATED = '16 Ekim 2026';
const REPO = 'https://github.com/SafakSahinn/thalamus';

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
          <h2>Hangi verileri tutuyoruz?</h2>
          <ul>
            <li><b>Hesap bilgisi:</b> e-posta adresin ve şifrenin özeti (şifrenin kendisi saklanmaz).</li>
            <li><b>İçeriğin:</b> yazdığın notlar, alanlar (yazar, puan, tarih…), kelimeler, günlük ve rutin işaretlerin, ayarların.</li>
            <li><b>Yüklediğin dosyalar:</b> notlara eklediğin görseller ve PDF’ler.</li>
          </ul>
          <p>Reklam, analiz ya da izleme aracı kullanılmaz. Çerez yerine yalnızca oturumunu ve çevrimdışı kopyayı tutmak için tarayıcının yerel depolaması kullanılır.</p>
          <h2>Neden işliyoruz?</h2>
          <p>Yalnızca hizmeti sunmak için: hesabını açmak, notlarını saklamak ve cihazların arasında eşitlemek. Hukuki sebep, KVKK m.5/2-c (sözleşmenin ifası) ve m.5/2-f’dir (meşru menfaat: hizmetin güvenliği).</p>
          <h2>Nerede saklanıyor, kimler erişebilir?</h2>
          <ul>
            <li>Veriler Supabase altyapısında, Avrupa Birliği’ndeki (Frankfurt) sunucularda saklanır. Bu, KVKK m.9 kapsamında yurt dışına aktarım sayılır ve hizmetin sunulabilmesi için zorunludur.</li>
            <li>Her kullanıcı yalnızca kendi verisini görebilir. Bu, veritabanı düzeyinde kurallarla sağlanır.</li>
            <li>Veriler uçtan uca şifreli <b>değildir</b>. İletim ve depolama sırasında şifrelenir, ancak sistem yöneticisi teknik olarak veritabanına erişebilir. Yönetici, içeriğini yalnızca yasal zorunluluk ya da senin açık isteğin (ör. destek talebi) varsa görüntüler. Çok hassas bilgileri (şifreler, sağlık bilgileri vb.) buraya yazmamanı öneririz.</li>
            <li>Verilerin üçüncü kişilere satılmaz ya da paylaşılmaz.</li>
            <li>Notlarının bir kopyası, çevrimdışı çalışabilmesi için kullandığın cihazın tarayıcısında da tutulur. Çıkış yaptığında bu kopya silinir.</li>
          </ul>
          <h2>Hakların</h2>
          <p>KVKK m.11 kapsamındaki haklarını (bilgi talebi, düzeltme, silme vb.) kullanabilirsin:</p>
          <ul>
            <li><b>Dışa aktarma:</b> Ayarlar → Yedek → “Yedeği indir” ile bütün notlarını tek dosya olarak indirebilirsin.</li>
            <li><b>Silme:</b> Ayarlar → “Hesabımı sil” ile hesabın, notların ve dosyaların kalıcı olarak silinir.</li>
            <li>Diğer talepler için: <Mail />.</li>
          </ul>
        </>
      ) : (
        <>
          <h1>Kullanım Koşulları</h1>
          <p className="muted small">Son güncelleme: {UPDATED}</p>
          <ul>
            <li>Thalamus, kişisel not tutmak için ücretsiz sunulan bir hizmettir. Açık kaynaklıdır: <a href={REPO}>{REPO.replace('https://', '')}</a>.</li>
            <li>Hizmet “olduğu gibi” sunulur; kesintisiz çalışacağı ya da veri kaybı yaşanmayacağı garanti edilmez. Önemli notlarının düzenli olarak yedeğini (Ayarlar → Yedeği indir) almanı öneririz.</li>
            <li>Yazdığın içerik sana aittir ve sorumluluğu sendedir. Hukuka aykırı içerik, başkalarının haklarını ihlal eden dosyalar ya da sistemi kötüye kullanmaya yönelik yüklemeler yasaktır.</li>
            <li>Sistemi aşırı yükleyen ya da kötüye kullanan hesaplar uyarı yapılarak kapatılabilir.</li>
            <li>Koşullar değişirse bu sayfa güncellenir. İletişim: <Mail />.</li>
          </ul>
        </>
      )}
    </div>
  );
}
