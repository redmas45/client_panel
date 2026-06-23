import type { ClientSummary, DashboardResponse } from '../types';
import { number, type ConversationPreview } from '../utils';
import { RecentConversations } from '../components/ConversationPanel';
import { SinceLastVisit, StoreQuestionSimulator, TodayBrief } from '../components/InsightPanels';
import { StoreSummary } from '../components/StoreSummary';
import { TokenSnapshot } from '../components/TokenPolicy';
import { KpiCard, RankPanel } from '../components/ui';

export function OverviewTab({
  data,
  sessions,
  onLimitUpdated,
}: {
  data: DashboardResponse;
  sessions: ConversationPreview[];
  onLimitUpdated: (client: ClientSummary) => void;
}) {
  const { client, analytics } = data;

  return (
    <div className="tab-stack tab-content fade-in">
      <div className="overview-layout">
        <TodayBrief client={client} analytics={analytics} sessions={sessions} />

        <div className="kpi-strip">
          <KpiCard label="Turns" value={analytics.metrics.turns} tone="accent" icon="T" />
          <KpiCard label="Sessions" value={analytics.metrics.sessions ?? sessions.length} tone="blue" icon="S" />
          <KpiCard label="Avg response" value={`${number(Math.round(analytics.metrics.avg_latency_ms))} ms`} tone="green" icon="A" />
          <KpiCard label="Indexed" value={client.catalog.active_products} tone="amber" icon="C" />
        </div>

        <div className="overview-main">
          <StoreSummary summary={analytics.summary} source={analytics.summary_source || 'heuristic'} />
          <TokenSnapshot client={client} onLimitUpdated={onLimitUpdated} />
        </div>

        <div className="overview-lower">
          <SinceLastVisit client={client} analytics={analytics} sessions={sessions} />
          <StoreQuestionSimulator analytics={analytics} sessions={sessions} />
        </div>

        <div className="overview-lower">
          <RankPanel title="Products customers asked about" rows={analytics.top_products} />
          <RecentConversations sessions={sessions.slice(0, 3)} />
        </div>
      </div>
    </div>
  );
}
