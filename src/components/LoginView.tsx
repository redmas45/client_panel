import { type FormEvent, useState } from 'react';

export function LoginView({
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
  const [showPassword, setShowPassword] = useState(false);

  return (
    <main className="login-shell">
      <section className="login-hero">
        <span className="brand-mark">AK</span>
        <p className="eyebrow">Client analytics</p>
        <h1>Store performance for the AI assistant</h1>
        <p>Review demand, conversations, catalog coverage, and token policy for your store.</p>
        <ul className="login-bullets">
          <li>Demand trends and peak days</li>
          <li>Recent shopper conversations</li>
          <li>Catalog coverage and indexing</li>
          <li>Token usage and session limits</li>
        </ul>
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
        <label className="password-field">
          <span>Password</span>
          <input name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required />
          <button className="password-toggle" type="button" onClick={() => setShowPassword((visible) => !visible)}>
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </label>
        {error ? <div className="notice error">{error}</div> : null}
        <button className="btn btn-primary btn-lg" type="submit" disabled={busy}>
          {busy ? <span className="spinner" aria-hidden="true" /> : null}
          {busy ? 'Checking...' : 'Open panel'}
        </button>
        <p className="muted">Powered by AI Hub - ask your store admin for access.</p>
      </form>
    </main>
  );
}
