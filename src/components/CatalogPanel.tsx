import type { ClientSummary } from '../types';
import { number } from '../utils';
import { KeyLine, PanelHeader } from './ui';

export function CatalogPanel({ client }: { client: ClientSummary }) {
  return (
    <section className="panel catalog-panel">
      <PanelHeader title="Catalog health" detail={client.plan} />
      <CatalogDonut active={client.catalog.active_products} total={client.catalog.total_products} />
      <KeyLine label="Total products" value={number(client.catalog.total_products)} />
      <KeyLine label="Categories" value={number(client.catalog.categories)} />
      <KeyLine label="Store URL" value={client.store_url} />
    </section>
  );
}

function CatalogDonut({ active, total }: { active: number; total: number }) {
  const pct = total > 0 ? Math.round((active / total) * 100) : 0;
  const r = 54;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <div className="donut-wrapper">
      <svg viewBox="0 0 128 128" width="128" height="128" aria-hidden="true">
        <circle cx="64" cy="64" r={r} fill="none" stroke="var(--line)" strokeWidth="14" />
        <circle
          cx="64"
          cy="64"
          r={r}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="14"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 64 64)"
          style={{ transition: 'stroke-dasharray 800ms cubic-bezier(0.4,0,0.2,1)' }}
        />
      </svg>
      <div className="donut-center">
        <strong>{pct}%</strong>
        <span>active</span>
      </div>
    </div>
  );
}
