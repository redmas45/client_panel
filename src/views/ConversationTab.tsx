import { ConversationPanel } from '../components/ConversationPanel';
import { IntentInbox } from '../components/InsightPanels';
import { number, type ConversationPreview } from '../utils';

export function ConversationTab({ sessions }: { sessions: ConversationPreview[] }) {
  return (
    <div className="tab-stack tab-content fade-in">
      <div className="section-intro">
        <div>
          <p className="eyebrow">Conversations</p>
          <h2>Recent shopper sessions</h2>
        </div>
        <span>{number(sessions.length)} sessions in range</span>
      </div>
      <IntentInbox sessions={sessions} />
      <ConversationPanel sessions={sessions} />
    </div>
  );
}
