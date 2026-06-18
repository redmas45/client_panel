import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { clearToken, dashboard, login, storedToken, updateSessionLimit } from './api';
import type { ClientSummary, ConversationSession, DashboardResponse, RankRow, SeriesRow } from './types';

const DEFAULT_RANGE = '7d';
const RECENT_SESSION_LIMIT = 6;
const TREND_BAR_LIMIT = 14;

const RANGE_OPTIONS = [
  ['1d', '1 day'],
  ['7d', '7 days'],
  ['30d', '30 days'],
  ['3m', '3 months'],
  ['all', 'All time'],
] as const;

const DASHBOARD_TABS = [
  ['overview', 'Overview'],
  ['demand', 'Demand'],
  ['conversations', 'Conversations'],
  ['catalog', 'Catalog'],
  ['policy', 'Token policy'],
] as const;

type DashboardTab = (typeof DASHBOARD_TABS)[number][0];

export function App() {
  const [range, setRange] = useState(DEFAULT_RANGE);
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [authenticated, setAuthenticated] = useState(Boolean(storedToken()));
  const siteHint = useMemo(() => clientSlugFromUrl(), []);

  useEffect(() => {
    if (!authenticated) return;
    loadDashboard(range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated, range]);

  async function loadDashboard(nextRange = range): Promise<void> {
    setBusy(true);
    setError('');
    try {
      setData(await dashboard(nextRange));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Panel failed to load.');
      clearToken();
      setAuthenticated(false);
    } finally {
      setBusy(false);
    }
  }

  async function submitLogin(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setError('');
    const formData = new FormData(event.currentTarget);
    try {
      await login(String(formData.get('site_id') || siteHint), String(formData.get('password') || ''));
      setAuthenticated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed.');
    } finally {
      setBusy(false);
    }
  }

  function logout(): void {
    clearToken();
    setData(null);
    setAuthenticated(false);
  }

  if (!authenticated) {
    return <LoginView siteHint={siteHint} error={error} busy={busy} onSubmit={submitLogin} />;
  }

  return (
    <main className="client-app">
      <Header
        clientName={data?.client.name || siteHint}
        range={range}
        busy={busy}
        onRangeChange={setRange}
        onRefresh={() => loadDashboard()}
        onLogout={logout}
      />
      <section className="client-shell">
        {error ? <div className="notice error">{error}</div> : null}
        {data ? <Dashboard data={data} range={range} onLimitUpdated={(client) => setData({ ...data, client })} /> : <LoadingPanel />}
      </section>
    </main>
  );
}

function Header({
  clientName,
  range,
  busy,
  onRangeChange,
  onRefresh,
  onLogout,
}: {
  clientName: string;
  range: string;
  busy: boolean;
  onRangeChange: (range: string) => void;
  onRefresh: () => void;
  onLogout: () => void;
}) {
  return (
    <header className="client-header">
      <div className="brand-lockup">
        <span className="brand-mark">AK</span>
        <div>
          <p>Client Panel</p>
          <strong>{clientName}</strong>
        </div>
      </div>
      <div className="header-actions">
        <select value={range} onChange={(event) => onRangeChange(event.currentTarget.value)} aria-label="Analytics range">
          {RANGE_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <button className="button secondary" type="button" onClick={onRefresh} disabled={busy}>Refresh</button>
        <button className="button ghost" type="button" onClick={onLogout}>Logout</button>
      </div>
    </header>
  );
}

function Dashboard({
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
        <OverviewTab data={data} range={range} sessions={sessions} onLimitUpdated={onLimitUpdated} />
      ) : null}
      {activeTab === 'demand' ? <DemandTab data={data} /> : null}
      {activeTab === 'conversations' ? <ConversationTab sessions={sessions} /> : null}
      {activeTab === 'catalog' ? <CatalogTab client={client} analytics={analytics} /> : null}
      {activeTab === 'policy' ? <PolicyTab client={client} onLimitUpdated={onLimitUpdated} /> : null}
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
          {client.store_url} · {rangeLabel(range)} · {number(sessions)} sessions
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
          className={value === activeTab ? 'active' : ''}
          type="button"
          onClick={() => onChange(value)}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}

function OverviewTab({
  data,
  range,
  sessions,
  onLimitUpdated,
}: {
  data: DashboardResponse;
  range: string;
  sessions: ConversationPreview[];
  onLimitUpdated: (client: ClientSummary) => void;
}) {
  const { client, analytics } = data;

  return (
    <div className="tab-stack">
      <div className="metric-grid">
        <Metric label="Turns" value={analytics.metrics.turns} detail={rangeLabel(range)} tone="accent" />
        <Metric label="Sessions" value={analytics.metrics.sessions ?? sessions.length} detail="Shopper conversations" tone="blue" />
        <Metric label="Avg response" value={`${number(Math.round(analytics.metrics.avg_latency_ms))} ms`} detail="Assistant latency" tone="green" />
        <Metric label="Indexed" value={client.catalog.active_products} detail={`${number(client.catalog.categories)} categories`} tone="ink" />
      </div>

      <div className="overview-grid">
        <StoreSummary summary={analytics.summary} source={analytics.summary_source || 'heuristic'} />
        <TokenSnapshot client={client} onLimitUpdated={onLimitUpdated} />
      </div>

      <div className="overview-grid compact">
        <RankPanel title="Products customers asked about" rows={analytics.top_products} />
        <RecentConversations sessions={sessions.slice(0, 3)} />
      </div>
    </div>
  );
}

function DemandTab({ data }: { data: DashboardResponse }) {
  const { analytics } = data;

  return (
    <div className="tab-stack">
      <div className="section-intro">
        <div>
          <p className="eyebrow">Demand</p>
          <h2>What shoppers are asking for</h2>
        </div>
        <span>{analytics.peak_day ? `Peak day: ${analytics.peak_day.date}` : 'No peak day yet'}</span>
      </div>

      <div className="dashboard-layout wide-left">
        <DemandTrend rows={analytics.series} peakDay={analytics.peak_day} />
        <OperationsPanel
          actionRate={analytics.metrics.action_rate ?? 0}
          errorRate={analytics.metrics.error_rate ?? 0}
          latencyRows={analytics.latency_buckets ?? []}
          transportRows={analytics.transport_mix ?? []}
        />
      </div>

      <div className="rank-grid">
        <RankPanel title="Product demand" rows={analytics.top_products} />
        <RankPanel title="Intent mix" rows={analytics.top_intents} />
        <RankPanel title="Status mix" rows={analytics.status_mix ?? []} />
      </div>
    </div>
  );
}

function ConversationTab({ sessions }: { sessions: ConversationPreview[] }) {
  return (
    <div className="tab-stack">
      <div className="section-intro">
        <div>
          <p className="eyebrow">Conversations</p>
          <h2>Recent shopper sessions</h2>
        </div>
        <span>{number(sessions.length)} sessions in range</span>
      </div>
      <ConversationPanel sessions={sessions} />
    </div>
  );
}

function CatalogTab({ client, analytics }: { client: ClientSummary; analytics: DashboardResponse['analytics'] }) {
  return (
    <div className="tab-stack">
      <div className="section-intro">
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

      <div className="rank-grid two">
        <RankPanel title="Most requested products" rows={analytics.top_products} />
        <RankPanel title="Intent mix near catalog" rows={analytics.top_intents} />
      </div>
    </div>
  );
}

function PolicyTab({ client, onLimitUpdated }: { client: ClientSummary; onLimitUpdated: (client: ClientSummary) => void }) {
  return (
    <div className="tab-stack">
      <div className="section-intro">
        <div>
          <p className="eyebrow">Token policy</p>
          <h2>Control client usage</h2>
        </div>
        <span>{number(client.quota.client.remaining)} tokens remaining</span>
      </div>

      <div className="policy-layout">
        <TokenPolicy client={client} onLimitUpdated={onLimitUpdated} />
        <section className="panel">
          <PanelHeader title="Usage guardrails" detail={client.status} />
          <div className="guardrail-list">
            <KeyLine label="Purchased limit" value={number(client.quota.client.limit)} />
            <KeyLine label="Purchased used" value={number(client.quota.client.used)} />
            <KeyLine label="Per session limit" value={number(client.session_token_limit)} />
            <KeyLine label="Session remaining" value={number(client.quota.session.remaining)} />
          </div>
        </section>
      </div>
    </div>
  );
}

function LoginView({
  siteHint,
  error,
  busy,
  onSubmit,
}: {
  siteHint: string;
  error: string;
  busy: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <main className="login-shell">
      <section className="login-hero">
        <span className="brand-mark">AK</span>
        <p className="eyebrow">Client analytics</p>
        <h1>Store performance for the AI assistant</h1>
        <p>Review demand, conversations, catalog coverage, and token policy for your store.</p>
      </section>
      <form className="login-card" onSubmit={onSubmit}>
        <div>
          <p className="eyebrow">Secure access</p>
          <h2>{siteHint}</h2>
        </div>
        <label>
          <span>Client ID</span>
          <input name="site_id" defaultValue={siteHint} required />
        </label>
        <label>
          <span>Password</span>
          <input name="password" type="password" autoComplete="current-password" required />
        </label>
        {error ? <div className="notice error">{error}</div> : null}
        <button className="button primary" type="submit" disabled={busy}>
          {busy ? 'Checking...' : 'Open panel'}
        </button>
      </form>
    </main>
  );
}

function StoreSummary({ summary, source }: { summary: string; source: string }) {
  const lines = summaryLines(summary);
  return (
    <section className="panel summary-panel">
      <PanelHeader title="Store notes" detail={source} />
      <div className="summary-list">
        {lines.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
    </section>
  );
}

function TokenSnapshot({
  client,
  onLimitUpdated,
}: {
  client: ClientSummary;
  onLimitUpdated: (client: ClientSummary) => void;
}) {
  return (
    <section className="panel">
      <PanelHeader title="Token snapshot" detail={client.status} />
      <Progress value={percent(client.quota.client.used, client.quota.client.limit)} />
      <p className="muted">
        {number(client.quota.client.used)} of {number(client.quota.client.limit)} purchased tokens used.
      </p>
      <TokenLimitForm client={client} onLimitUpdated={onLimitUpdated} compact />
    </section>
  );
}

function TokenPolicy({
  client,
  onLimitUpdated,
}: {
  client: ClientSummary;
  onLimitUpdated: (client: ClientSummary) => void;
}) {
  return (
    <section className="panel">
      <PanelHeader title="Per shopper limit" detail="editable" />
      <Progress value={percent(client.quota.client.used, client.quota.client.limit)} />
      <p className="muted">
        {number(client.quota.client.remaining)} purchased tokens remain. Set the maximum each shopper/session can use.
      </p>
      <TokenLimitForm client={client} onLimitUpdated={onLimitUpdated} />
    </section>
  );
}

function TokenLimitForm({
  client,
  compact = false,
  onLimitUpdated,
}: {
  client: ClientSummary;
  compact?: boolean;
  onLimitUpdated: (client: ClientSummary) => void;
}) {
  const [limit, setLimit] = useState(String(client.session_token_limit));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const updated = await updateSessionLimit(Number(limit));
      onLimitUpdated(updated);
      setMessage('Saved.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Policy update failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={`policy-form ${compact ? 'compact' : ''}`} onSubmit={submit}>
      <label>
        <span>Per shopper/session limit</span>
        <input value={limit} onChange={(event) => setLimit(event.currentTarget.value)} type="number" min={1} max={1000000} />
      </label>
      <button className="button secondary" type="submit" disabled={busy}>Save limit</button>
      {message ? <p className="muted">{message}</p> : null}
    </form>
  );
}

function DemandTrend({ rows, peakDay }: { rows: SeriesRow[]; peakDay?: SeriesRow | null }) {
  const visibleRows = rows.slice(-TREND_BAR_LIMIT);
  const maxTurns = Math.max(...visibleRows.map((row) => row.turns), 1);
  const maxTokens = Math.max(...visibleRows.map((row) => row.tokens), 1);

  return (
    <section className="panel">
      <PanelHeader title="Demand trend" detail={peakDay ? `Peak ${peakDay.date}` : 'No peak yet'} />
      {visibleRows.length ? (
        <div className="demand-chart">
          {visibleRows.map((row) => (
            <div key={row.date} className="demand-column" title={`${row.date}: ${row.turns} turns, ${row.tokens} tokens`}>
              <i style={{ bottom: `${Math.max(8, percent(row.tokens, maxTokens))}%` }} />
              <span style={{ height: `${Math.max(8, percent(row.turns, maxTurns))}%` }} />
              <small>{row.date.slice(5)}</small>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">No trend data yet.</p>
      )}
    </section>
  );
}

function OperationsPanel({
  actionRate,
  errorRate,
  latencyRows,
  transportRows,
}: {
  actionRate: number;
  errorRate: number;
  latencyRows: RankRow[];
  transportRows: RankRow[];
}) {
  return (
    <section className="panel">
      <PanelHeader title="Assistant health" detail="current range" />
      <div className="meter-stack">
        <Meter label="Action rate" value={actionRate} />
        <Meter label="Error rate" value={errorRate} danger />
      </div>
      <MiniRank title="Latency" rows={latencyRows} />
      <MiniRank title="Transport" rows={transportRows} />
    </section>
  );
}

function CatalogPanel({ client }: { client: ClientSummary }) {
  return (
    <section className="panel catalog-panel">
      <PanelHeader title="Catalog health" detail={client.plan} />
      <div className="catalog-ring">
        <strong>{number(client.catalog.active_products)}</strong>
        <span>active products</span>
      </div>
      <KeyLine label="Total products" value={number(client.catalog.total_products)} />
      <KeyLine label="Categories" value={number(client.catalog.categories)} />
      <KeyLine label="Store URL" value={client.store_url} />
    </section>
  );
}

function ConversationPanel({ sessions }: { sessions: ConversationPreview[] }) {
  return (
    <section className="panel conversation-panel">
      <PanelHeader title="Conversation log" detail={`${number(sessions.length)} sessions`} />
      <div className="conversation-list">
        {sessions.map((session) => (
          <ConversationCard key={`${session.date}-${session.session_id}`} session={session} />
        ))}
        {!sessions.length ? <p className="muted">No conversations in this range.</p> : null}
      </div>
    </section>
  );
}

function RecentConversations({ sessions }: { sessions: ConversationPreview[] }) {
  return (
    <section className="panel">
      <PanelHeader title="Recent conversations" detail={`${number(sessions.length)} shown`} />
      <div className="conversation-list compact">
        {sessions.map((session) => (
          <ConversationCard key={`${session.date}-${session.session_id}`} session={session} compact />
        ))}
        {!sessions.length ? <p className="muted">No conversations in this range.</p> : null}
      </div>
    </section>
  );
}

function ConversationCard({ session, compact = false }: { session: ConversationPreview; compact?: boolean }) {
  const turns = compact ? session.turns.slice(0, 1) : session.turns;

  return (
    <article className="conversation">
      <div className="conversation-meta">
        <strong>{session.date}</strong>
        <small>{shortSessionId(session.session_id)}</small>
      </div>
      {turns.map((turn, index) => (
        <div className="turn" key={`${turn.created_at}-${index}`}>
          <p><b>User</b> {turn.transcript || '-'}</p>
          <p><b>AI</b> {turn.response_text || '-'}</p>
          {!compact ? (
            <small>{turn.intent || 'unknown'} · {number(turn.tokens)} tokens · {number(Math.round(turn.latency_ms))} ms</small>
          ) : null}
        </div>
      ))}
    </article>
  );
}

function Metric({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string | number;
  detail: string;
  tone: 'accent' | 'blue' | 'green' | 'ink';
}) {
  return (
    <section className={`panel metric tone-${tone}`}>
      <span>{label}</span>
      <strong>{typeof value === 'number' ? number(value) : value}</strong>
      <small>{detail}</small>
    </section>
  );
}

function RankPanel({ title, rows }: { title: string; rows: RankRow[] }) {
  return (
    <section className="panel">
      <PanelHeader title={title} detail={`${number(rows.length)} signals`} />
      <MiniRank title="" rows={rows} />
    </section>
  );
}

function MiniRank({ title, rows }: { title: string; rows: RankRow[] }) {
  const max = Math.max(...rows.map((row) => row.count), 1);

  return (
    <div className="mini-rank">
      {title ? <h3>{title}</h3> : null}
      {rows.map((row) => (
        <div className="rank-row" key={`${title}-${row.label}`}>
          <span>{row.label}</span>
          <div><i style={{ width: `${Math.max(8, percent(row.count, max))}%` }} /></div>
          <b>{number(row.count)}</b>
        </div>
      ))}
      {!rows.length ? <p className="muted">No data yet.</p> : null}
    </div>
  );
}

function Meter({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) {
  return (
    <div>
      <div className="meter-label">
        <span>{label}</span>
        <strong>{number(value)}%</strong>
      </div>
      <Progress value={value} danger={danger} />
    </div>
  );
}

function Progress({ value, danger = false }: { value: number; danger?: boolean }) {
  return (
    <div className={`progress ${danger ? 'danger' : ''}`}>
      <span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

function PanelHeader({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="panel-head">
      <h2>{title}</h2>
      <span>{detail}</span>
    </div>
  );
}

function KeyLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="key-line">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StatusPill({ label }: { label: string }) {
  return <span className={`status-pill ${label.toLowerCase()}`}>{label}</span>;
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="mini-stat">
      <span>{label}</span>
      <strong>{number(value)}</strong>
    </div>
  );
}

function LoadingPanel() {
  return <section className="panel loading-panel">Loading panel...</section>;
}

interface ConversationPreview extends ConversationSession {
  date: string;
}

function flattenedSessions(groups: DashboardResponse['conversations']['groups']): ConversationPreview[] {
  return groups
    .flatMap((group) => group.sessions.map((session) => ({ ...session, date: group.date })))
    .slice(0, RECENT_SESSION_LIMIT);
}

function summaryLines(summary: string): string[] {
  const lines = summary
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*]\s+/, '').trim())
    .filter(Boolean);
  return lines.length ? lines : ['No customer conversations are logged for this range yet.'];
}

function clientSlugFromUrl(): string {
  const parts: string[] = window.location.pathname.split('/').filter(Boolean);
  const baseParts: string[] = (import.meta.env.VITE_CLIENT_PANEL_BASE_PATH || '/client-panel/')
    .split('/')
    .filter(Boolean);
  const scopedParts = baseParts.every((part, index) => parts[index] === part)
    ? parts.slice(baseParts.length)
    : parts;
  const slug = scopedParts[0] || import.meta.env.VITE_DEFAULT_CLIENT_ID || 'ai_kart';
  return slug.replace(/-/g, '_');
}

function rangeLabel(range: string): string {
  return RANGE_OPTIONS.find(([value]) => value === range)?.[1] || RANGE_OPTIONS[1][1];
}

function percent(value: number, max: number): number {
  if (!max) return 0;
  return Math.max(0, Math.min(100, Math.round((value / max) * 100)));
}

function shortSessionId(sessionId: string): string {
  if (sessionId.length <= 18) return sessionId;
  return `${sessionId.slice(0, 8)}...${sessionId.slice(-6)}`;
}

function number(value: unknown): string {
  return new Intl.NumberFormat().format(Number(value || 0));
}
