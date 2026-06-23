import { useState } from 'react';
import { DASHBOARD_TABS, type DashboardTab } from '../constants';
import type { ClientSummary, DashboardResponse } from '../types';
import { flattenedSessions, number, rangeLabel } from '../utils';
import { CatalogTab } from '../views/CatalogTab';
import { ConversationTab } from '../views/ConversationTab';
import { DemandTab } from '../views/DemandTab';
import { OverviewTab } from '../views/OverviewTab';
import { PolicyTab } from '../views/PolicyTab';
import { MiniStat, StatusPill } from './ui';

export function Dashboard({
  data,
  range,
  onLimitUpdated,
}: {
  data: DashboardResponse;
  range: string;
  onLimitUpdated: (client: ClientSummary) => void;
}) {
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const { client, analytics, conversations } = data;
  const sessions = flattenedSessions(conversations.groups);

  return (
    <>
      <ClientSummaryBar client={client} range={range} sessions={sessions.length} />
      <TabBar activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === 'overview' ? (
        <OverviewTab data={data} sessions={sessions} onLimitUpdated={onLimitUpdated} />
      ) : null}
      {activeTab === 'demand' ? <DemandTab data={data} /> : null}
      {activeTab === 'conversations' ? <ConversationTab sessions={sessions} /> : null}
      {activeTab === 'catalog' ? <CatalogTab client={client} analytics={analytics} /> : null}
      {activeTab === 'policy' ? <PolicyTab client={client} analytics={analytics} onLimitUpdated={onLimitUpdated} /> : null}
      <footer className="client-footer">
        <span>Powered by <strong>AI Hub</strong></span>
        <span className="client-footer-sep">&middot;</span>
        <span>{new Date().getFullYear()}</span>
      </footer>
    </>
  );
}

function ClientSummaryBar({ client, range, sessions }: { client: ClientSummary; range: string; sessions: number }) {
  return (
    <section className="client-summary-bar">
      <div>
        <p className="eyebrow">Client workspace</p>
        <h1>{client.name}</h1>
        <p>
          {client.store_url} - {rangeLabel(range)} - {number(sessions)} sessions
        </p>
      </div>
      <div className="summary-strip">
        <StatusPill label={client.status} />
        <MiniStat label="Products" value={client.catalog.active_products} />
        <MiniStat label="Tokens left" value={client.quota.client.remaining} />
      </div>
    </section>
  );
}

function TabBar({ activeTab, onChange }: { activeTab: DashboardTab; onChange: (tab: DashboardTab) => void }) {
  return (
    <nav className="panel-tabs" aria-label="Client panel sections">
      {DASHBOARD_TABS.map(([value, label]) => (
        <button
          key={value}
          className={`panel-tab-btn ${value === activeTab ? 'active' : ''}`}
          type="button"
          onClick={() => onChange(value)}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}
