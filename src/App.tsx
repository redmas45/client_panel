import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { clearToken, dashboard, login, storedToken, updateSessionLimit } from './api';
import type { ClientSummary, DashboardResponse, RankRow, SeriesRow } from './types';

const RANGE_OPTIONS = [
  ['1d', '1 day'],
  ['7d', '7 days'],
  ['30d', '30 days'],
  ['3m', '3 months'],
  ['all', 'All time'],
] as const;

export function App() {
  const [range, setRange] = useState('7d');
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
    <main className="min-h-dvh bg-page text-ink">
      <header className="border-b border-line bg-panel">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase text-muted">Client panel</p>
            <h1 className="mt-1 text-2xl font-semibold">{data?.client.name || siteHint}</h1>
          </div>
          <div className="flex items-center gap-3">
            <select value={range} onChange={(event) => setRange(event.currentTarget.value)}>
              {RANGE_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <button className="button secondary" type="button" onClick={() => loadDashboard()} disabled={busy}>Refresh</button>
            <button className="button ghost" type="button" onClick={logout}>Logout</button>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-5 px-5 py-5">
        {error ? <div className="notice error">{error}</div> : null}
        {data ? <Dashboard data={data} onLimitUpdated={(client) => setData({ ...data, client })} /> : <div className="panel">Loading panel...</div>}
      </section>
    </main>
  );
}

function Dashboard({
  data,
  onLimitUpdated,
}: {
  data: DashboardResponse;
  onLimitUpdated: (client: ClientSummary) => void;
}) {
  const { client, analytics, conversations } = data;
  return (
    <>
      <div className="grid gap-4 md:grid-cols-4">
        <Metric label="Turns" value={analytics.metrics.turns} detail="Selected range" />
        <Metric label="Tokens used" value={analytics.metrics.tokens} detail={`${client.quota.client.remaining} remaining`} />
        <Metric label="Avg latency" value={`${Math.round(analytics.metrics.avg_latency_ms)} ms`} detail="Voice response speed" />
        <Metric label="Products indexed" value={client.catalog.active_products} detail={`${client.catalog.categories} categories`} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <section className="panel">
          <div className="panel-head">
            <h2>Store summary</h2>
            <span>{analytics.summary_source || 'heuristic'}</span>
          </div>
          <div className="summary">{analytics.summary}</div>
          <Trend rows={analytics.series} />
        </section>
        <TokenPolicy client={client} onLimitUpdated={onLimitUpdated} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <RankPanel title="Top products" rows={analytics.top_products} />
        <RankPanel title="Intent mix" rows={analytics.top_intents} />
      </div>

      <section className="panel">
        <div className="panel-head">
          <h2>Recent conversations</h2>
          <span>{conversations.groups.length} days</span>
        </div>
        <div className="conversation-list">
          {conversations.groups.flatMap((group) =>
            group.sessions.map((session) => (
              <article className="conversation" key={`${group.date}-${session.session_id}`}>
                <strong>{group.date}</strong>
                <small>{session.session_id}</small>
                {session.turns.slice(0, 3).map((turn, index) => (
                  <div className="turn" key={`${turn.created_at}-${index}`}>
                    <p><b>User:</b> {turn.transcript || '-'}</p>
                    <p><b>AI:</b> {turn.response_text || '-'}</p>
                  </div>
                ))}
              </article>
            )),
          )}
          {!conversations.groups.length ? <p className="muted">No conversations in this range.</p> : null}
        </div>
      </section>
    </>
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
    <main className="grid min-h-dvh place-items-center bg-page px-5 text-ink">
      <form className="login-card" onSubmit={onSubmit}>
        <div>
          <p className="text-xs font-semibold uppercase text-muted">Client panel</p>
          <h1 className="mt-2 text-2xl font-semibold">{siteHint}</h1>
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
      <div className="panel-head">
        <h2>Token policy</h2>
        <span>{client.status}</span>
      </div>
      <div className="quota">
        <span style={{ width: `${percent(client.quota.client.used, client.quota.client.limit)}%` }} />
      </div>
      <p className="muted">{client.quota.client.used} of {client.quota.client.limit} purchased tokens used.</p>
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
  const max = Math.max(...rows.map((row) => row.count), 1);
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>{title}</h2>
        <span>{rows.length}</span>
      </div>
      <div className="bars">
        {rows.map((row) => (
          <div className="bar-row" key={row.label}>
            <span>{row.label}</span>
            <div><i style={{ width: `${percent(row.count, max)}%` }} /></div>
            <b>{row.count}</b>
          </div>
        ))}
        {!rows.length ? <p className="muted">No data yet.</p> : null}
      </div>
    </section>
  );
}

function Trend({ rows }: { rows: SeriesRow[] }) {
  const max = Math.max(...rows.map((row) => row.turns), 1);
  return (
    <div className="trend">
      {rows.slice(-14).map((row) => (
        <span key={row.date} title={`${row.date}: ${row.turns} turns`} style={{ height: `${Math.max(percent(row.turns, max), 8)}%` }} />
      ))}
    </div>
  );
}

function clientSlugFromUrl(): string {
  const slug = window.location.pathname.split('/').filter(Boolean)[0] || 'vercel_website';
  return slug.replace(/-/g, '_');
}

function percent(value: number, max: number): number {
  if (!max) return 0;
  return Math.max(0, Math.min(100, Math.round((value / max) * 100)));
}
