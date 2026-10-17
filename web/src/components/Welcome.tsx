import { useStore } from '../lib/store';

const POINTS = [
  { icon: '📚', title: 'Her şey tek yerde', text: 'Kitaplar, makaleler, dersler, filmler, söyleşiler ve günlüğün.' },
  { icon: '🕸', title: 'Birbirine bağlı', text: 'Metinde [[ yaz, notlarını bağla; haritada nasıl birleştiklerini gör.' },
  { icon: '🔤', title: 'Ortak sözlük', text: 'Okurken eklediğin kelimeler, geçtikleri bütün kaynaklarla birlikte toplanır.' },
  { icon: '🔒', title: 'Notların senin', text: 'Hepsi Google Drive’ındaki Thalamus klasöründe; bizim sunucumuzda hiçbir şey saklanmaz.' },
];

/** Yeni kayıt olan kullanıcıya bir kez: kısa tanıtım. */
export default function Welcome() {
  const welcome = useStore((s) => s.welcome);
  const name = useStore((s) => s.account?.name);
  if (!welcome) return null;

  return (
    <div className="modal-back">
      <div className="modal welcome" role="dialog" aria-label="Thalamus’a hoş geldin">
        <div className="welcome-hero">
          <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" width={76} height={76} />
          <h2>Hoş geldin{name ? `, ${name.split(' ')[0]}` : ''}!</h2>
          <p>Thalamus, beynin bilgileri birbirine bağlayan merkezi gibi, okuduğun ve öğrendiğin her şeyi birbirine bağlar.</p>
        </div>
        <div className="welcome-points">
          {POINTS.map((p) => (
            <div key={p.title} className="wpoint">
              <span className="wicon">{p.icon}</span>
              <div>
                <b>{p.title}</b>
                <div className="muted small">{p.text}</div>
              </div>
            </div>
          ))}
        </div>
        <button className="btn primary welcome-go" onClick={() => useStore.setState({ welcome: false })}>
          Başlayalım →
        </button>
      </div>
    </div>
  );
}
