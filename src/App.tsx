import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { clearToken, dashboard, login, storedToken, updateSessionLimit } from './api';
import type { ClientSummary, ConversationSession, DashboardResponse, RankRow, SeriesRow } from './types';

const DEFAULT_RANGE = '7d';
const RANGE_OPTIONS = [
  ['1d', '1 day'],
  ['7d', '7 days'],
  ['30d', '30 days'],
  ['3m', '3 months'],
  ['all', 'All time'],
] as const;

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
      setError(err instanceof Error ? err.message : 'Dashboard failed to load.');
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
  const { client, analytics, conversations } = data;
  return (
    <>
      <HeroPanel client={client} range={range} />
      <div className="metric-grid">
        <Metric label="Voice turns" value={analytics.metrics.turns} detail={rangeLabel(range)} />
        <Metric label="AI sessions" value={analytics.metrics.sessions ?? conversations.groups.length} detail="Shopper conversations" />
        <Metric label="Avg latency" value={`${number(Math.round(analytics.metrics.avg_latency_ms))} ms`} detail="Voice response speed" />
        <Metric label="Products indexed" value={client.catalog.active_products} detail={`${number(client.catalog.categories)} categories`} />
      </div>

      <div className="dashboard-layout">
        <StoreSummary summary={analytics.summary} source={analytics.summary_source || 'heuristic'} />
        <TokenPolicy client={client} onLimitUpdated={onLimitUpdated} />
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
        <CatalogPanel client={client} />
      </div>

      <ConversationPanel groups={conversations.groups} />
    </>
  );
}

function HeroPanel({ client, range }: { client: ClientSummary; range: string }) {
  return (
    <section className="hero-panel">
      <div>
        <p className="eyebrow">Voice commerce cockpit</p>
        <h1>{client.name}</h1>
        <p className="hero-copy">
          Track shopper demand, AI usage, catalog coverage, and token policy from one client-scoped view.
        </p>
      </div>
      <div className="hero-stats" aria-label="Client status">
        <span>{client.status}</span>
        <strong>{number(client.quota.client.remaining)}</strong>
        <small>tokens remaining for {rangeLabel(range).toLowerCase()}</small>
      </div>
    </section>
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
        <h1>AI-KART voice commerce panel</h1>
        <p>Client-only insight into demand, conversations, token usage, and catalog health.</p>
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
      <PanelHeader title="Store summary" detail={source} />
      <div className="summary-list">
        {lines.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
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
      setMessage('Policy updated.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Policy update failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel">
      <PanelHeader title="Token policy" detail={client.status} />
      <Progress value={percent(client.quota.client.used, client.quota.client.limit)} />
      <p className="muted">{number(client.quota.client.used)} of {number(client.quota.client.limit)} purchased tokens used.</p>
      <form className="policy-form" onSubmit={submit}>
        <label>
          <span>Per shopper/session limit</span>
          <input value={limit} onChange={(event) => setLimit(event.currentTarget.value)} type="number" min={1} max={1000000} />
        </label>
        <button className="button secondary" type="submit" disabled={busy}>Save limit</button>
      </form>
      {message ? <p className="muted">{message}</p> : null}
    </section>
  );
}

function DemandTrend({ rows, peakDay }: { rows: SeriesRow[]; peakDay?: SeriesRow | null }) {
  const visibleRows = rows.slice(-14);
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
      <PanelHeader title="Assistant health" detail="live range" />
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

function ConversationPanel({ groups }: { groups: Array<{ date: string; sessions: ConversationSession[] }> }) {
  const sessions = groups
    .flatMap((group) => group.sessions.map((session) => ({ ...session, date: group.date })))
    .slice(0, 6);
  return (
    <section className="panel conversation-panel">
      <PanelHeader title="Recent conversations" detail={`${number(sessions.length)} sessions`} />
      <div className="conversation-list">
        {sessions.map((session) => (
          <article className="conversation" key={`${session.date}-${session.session_id}`}>
            <div>
              <strong>{session.date}</strong>
              <small>{session.session_id}</small>
            </div>
            {session.turns.slice(0, 2).map((turn, index) => (
              <div className="turn" key={`${turn.created_at}-${index}`}>
                <p><b>User</b> {turn.transcript || '-'}</p>
                <p><b>AI</b> {turn.response_text || '-'}</p>
              </div>
            ))}
          </article>
        ))}
        {!sessions.length ? <p className="muted">No conversations in this range.</p> : null}
      </div>
    </section>
  );
}

function Metric({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return (
    <section className="panel metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </section>
  );
}

function RankPanel({ title, rows }: { title: string; rows: RankRow[] }) {
  return (
    <section className="panel">
      <PanelHeader title={title} detail={`${rows.length} signals`} />
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

function LoadingPanel() {
  return <section className="panel loading-panel">Loading panel...</section>;
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

function number(value: unknown): string {
  return new Intl.NumberFormat().format(Number(value || 0));
}
