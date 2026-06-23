import { summaryLines } from '../utils';
import { PanelHeader } from './ui';

export function StoreSummary({ summary, source }: { summary: string; source: string }) {
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
