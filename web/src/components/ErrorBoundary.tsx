import { t } from '../i18n';
import { Component, type ReactNode } from 'react';

/** Bir sayfa çökerse bütün uygulama boş kalmasın: hata mesajı ve yenile düğmesi göster */
export default class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidUpdate(prev: { resetKey?: string }) {
    // Başka sayfaya geçilince yeniden dene
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="page">
        <h2>{t('misc.error.title')}</h2>
        <p className="muted">{t('misc.error.body')}</p>
        <p className="muted small"><code>{this.state.error.message}</code></p>
        <div className="row">
          <button className="btn primary" onClick={() => location.reload()}>{t('misc.error.reload')}</button>
          <button className="btn" onClick={() => { location.hash = '#/'; this.setState({ error: null }); }}>{t('misc.error.home')}</button>
        </div>
      </div>
    );
  }
}
