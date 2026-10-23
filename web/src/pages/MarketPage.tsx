import { useEffect, useState } from 'react';
import { t } from '../i18n';
import {
  CATEGORIES, categoryLabel, installPlugin, pluginImage, pluginImageFallback, pluginOf, PLUGINS, purgePlugin, uninstallPlugin, useInstalledList,
  usePluginData, type Plugin, type PluginCategory,
} from '../lib/plugins';

// Eklenti marketi: yerleşik eklentilerin kataloğu, kur / kaldır ve detay paneli (bkz. lib/plugins.ts)

type Filter = 'all' | 'installed' | PluginCategory;

/** Tanıtım görseli: etkin dildeki, yoksa kaynak dildeki; o da yoksa simgeli bir yer tutucu */
function Shot({ p, big }: { p: Plugin; big?: boolean }) {
  const [step, setStep] = useState(0);
  const src = [pluginImage(p.id), pluginImageFallback(p.id)].filter((x, i, a) => a.indexOf(x) === i)[step];
  return (
    <div className={`market-shot ${big ? 'big' : ''}`}>
      {!src
        ? <span className="market-shot-ph">{p.icon}</span>
        : <img src={`${import.meta.env.BASE_URL}${src}`} alt={t('market.screenshot', { name: p.name })} loading="lazy" onError={() => setStep(step + 1)} />}
    </div>
  );
}

function InstallButton({ p, on }: { p: Plugin; on: boolean }) {
  return on
    ? <button className="btn small" onClick={(e) => { e.stopPropagation(); void uninstallPlugin(p.id); }}>{t('market.uninstall')}</button>
    : <button className="btn small primary" onClick={(e) => { e.stopPropagation(); void installPlugin(p.id); }}>{t('market.install')}</button>;
}

function Detail({ p, on, onClose }: { p: Plugin; on: boolean; onClose: () => void }) {
  const data = usePluginData(p.id);
  const installed = useInstalledList();
  const names = (ids: string[]) => ids.map((id) => pluginOf(id)?.name).join(', ');
  const needs = (p.requires ?? []).filter((id) => !installed.includes(id));
  const dependents = installed.filter((id) => pluginOf(id)?.requires?.includes(p.id));
  const purge = () => {
    if (confirm(t(on ? 'market.confirmPurgeInstalled' : 'market.confirmPurge', { name: p.name, data: p.dataLabel }))) void purgePlugin(p.id);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal market-detail" role="dialog" aria-label={p.name}>
        <button className="iconbtn market-close" onClick={onClose} aria-label={t('common.close')}>×</button>
        <Shot p={p} big />
        <div className="market-detail-body">
          <div className="market-head">
            <span className="market-icon">{p.icon}</span>
            <div>
              <h2>{p.name}</h2>
              <div className="muted small">{p.author} · {categoryLabel(p.category)}</div>
            </div>
            <span className="spacer" />
            {on && <span className="market-badge">{t('market.installed')}</span>}
            <InstallButton p={p} on={on} />
          </div>
          {p.description.map((d, i) => <p key={i}>{d}</p>)}
          <ul className="market-features">
            {p.features.map((f) => <li key={f}>{f}</li>)}
          </ul>
          <p className="market-usage small"><b>{t('market.howTo')}</b> {p.usage}</p>
          {!on && needs.length > 0 && <p className="muted small">{t('market.requires', { names: names(needs) })}</p>}
          {on && dependents.length > 0 && <p className="muted small">{t('market.dependents', { names: names(dependents) })}</p>}
          {on && (
            <div className="market-purge">
              <p className="muted small">{t('market.uninstallKeeps')}</p>
              <button className="btn small danger" onClick={purge}>{t('market.purge')}</button>
            </div>
          )}
          {!on && data && (
            <div className="market-purge">
              <p className="muted small">{t('market.leftover', { data: p.dataLabel })}</p>
              <button className="btn small danger" onClick={purge}>{t('market.purgeLeftover')}</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MarketPage() {
  const installed = useInstalledList();
  const [filter, setFilter] = useState<Filter>('all');
  const [open, setOpen] = useState<string | null>(null);
  const list = PLUGINS.filter((p) => filter === 'all' || (filter === 'installed' ? installed.includes(p.id) : p.category === filter));
  const cur = PLUGINS.find((p) => p.id === open);
  const filters: [Filter, string][] = [
    ['all', t('market.all')], ['installed', t('market.installedCount', { count: installed.length })],
    ...CATEGORIES.map((c) => [c, categoryLabel(c)] as [Filter, string]),
  ];

  return (
    <div className="page wide market">
      <h1>🧩 {t('market.title')}</h1>
      <p className="muted">{t('market.intro')}</p>
      <div className="seg market-filter">
        {filters.map(([v, label]) => (
          <button key={v} className={filter === v ? 'on' : ''} onClick={() => setFilter(v)}>{label}</button>
        ))}
      </div>
      {list.length === 0 && <p className="muted">{t('market.noneInstalled')}</p>}
      <div className="market-grid">
        {list.map((p) => {
          const on = installed.includes(p.id);
          return (
            <div key={p.id} className="card market-card" role="button" tabIndex={0}
              onClick={() => setOpen(p.id)} onKeyDown={(e) => e.key === 'Enter' && setOpen(p.id)}>
              <Shot p={p} />
              <div className="card-body">
                <div className="market-head">
                  <span className="market-icon">{p.icon}</span>
                  <span className="card-title">{p.name}</span>
                </div>
                <div className="market-summary">{p.summary}</div>
                <div className="market-foot">
                  <span className="muted small">{p.author} · {categoryLabel(p.category)}</span>
                  <span className="spacer" />
                  {on && <span className="market-badge">✓</span>}
                  <InstallButton p={p} on={on} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {cur && <Detail p={cur} on={installed.includes(cur.id)} onClose={() => setOpen(null)} />}
    </div>
  );
}
