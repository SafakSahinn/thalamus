import { useEffect } from 'react';

/** Eski #/gizlilik ve #/kosullar bağlantıları: metinler tek kaynakta, statik sayfalarda durur */
export default function LegalPage({ kind }: { kind: 'privacy' | 'terms' }) {
  useEffect(() => {
    location.replace(`${import.meta.env.BASE_URL}${kind}.html`);
  }, [kind]);
  return null;
}
