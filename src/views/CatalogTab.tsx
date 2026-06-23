import { CatalogPanel } from '../components/CatalogPanel';
import { CatalogOpportunityMap } from '../components/InsightPanels';
import type { ClientSummary, DashboardResponse } from '../types';
import { Metric, PanelHeader, RankPanel } from '../components/ui';

export function CatalogTab({ client, analytics }: { client: ClientSummary; analytics: DashboardResponse['analytics'] }) {
  return (
    <div className="tab-stack tab-content fade-in">
      <div className="section-intro catalog-toolbar">
        <div>
          <p className="eyebrow">Catalog</p>
          <h2>Coverage and indexing</h2>
        </div>
        <span>{client.plan}</span>
      </div>

      <div className="catalog-workspace">
        <CatalogPanel client={client} />
        <section className="panel">
          <PanelHeader title="Catalog signals" detail="current range" />
          <div className="signal-grid">
            <Metric label="Total products" value={client.catalog.total_products} detail="All catalog rows" tone="ink" />
            <Metric label="Active products" value={client.catalog.active_products} detail="Available to AI" tone="green" />
            <Metric label="Categories" value={client.catalog.categories} detail="Indexed groups" tone="blue" />
          </div>
        </section>
      </div>

      <CatalogOpportunityMap client={client} topProducts={analytics.top_products} />

      <div className="rank-grid two">
        <RankPanel title="Most requested products" rows={analytics.top_products} />
        <RankPanel title="Intent mix near catalog" rows={analytics.top_intents} />
      </div>
    </div>
  );
}
