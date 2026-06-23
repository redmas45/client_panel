import { RANGE_OPTIONS } from '../constants';

export function Header({
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
        <select className="header-range-select" value={range} onChange={(event) => onRangeChange(event.currentTarget.value)} aria-label="Analytics range">
          {RANGE_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <button className="btn btn-secondary" type="button" onClick={onRefresh} disabled={busy}>Refresh</button>
        <button className="btn btn-ghost" type="button" onClick={onLogout}>Logout</button>
      </div>
    </header>
  );
}
