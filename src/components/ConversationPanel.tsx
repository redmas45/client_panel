import { useMemo, useState } from 'react';
import { number, shortSessionId, type ConversationPreview } from '../utils';
import { EmptyState, PaginationControl, PanelHeader } from './ui';

export function ConversationPanel({ sessions }: { sessions: ConversationPreview[] }) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const filteredSessions = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return sessions;
    return sessions.filter((session) =>
      [session.date, session.session_id, ...session.turns.flatMap((turn) => [turn.transcript, turn.response_text])]
        .join(' ')
        .toLowerCase()
        .includes(search),
    );
  }, [query, sessions]);
  const pageCount = Math.max(1, Math.ceil(filteredSessions.length / 20));
  const visiblePage = Math.min(page, pageCount);
  const pageSessions = filteredSessions.slice((visiblePage - 1) * 20, visiblePage * 20);

  return (
    <section className="panel conversation-panel">
      <PanelHeader title="Conversation log" detail={`${number(filteredSessions.length)} sessions`} />
      <label className="field" style={{ marginBottom: 14 }}>
        <span>Search conversations</span>
        <input
          value={query}
          placeholder="Session, transcript, or response"
          onChange={(event) => {
            setQuery(event.currentTarget.value);
            setPage(1);
          }}
        />
      </label>
      <div className="conversation-list">
        {pageSessions.map((session) => (
          <ConversationCard key={`${session.date}-${session.session_id}`} session={session} />
        ))}
        {!pageSessions.length ? <EmptyState title="No conversations" message="Try a wider range or wait for new shopper sessions." /> : null}
      </div>
      <PaginationControl page={visiblePage} pageCount={pageCount} onPageChange={setPage} />
    </section>
  );
}

export function RecentConversations({ sessions }: { sessions: ConversationPreview[] }) {
  return (
    <section className="panel">
      <PanelHeader title="Recent conversations" detail={`${number(sessions.length)} shown`} />
      <div className="conversation-list compact">
        {sessions.map((session) => (
          <ConversationCard key={`${session.date}-${session.session_id}`} session={session} compact />
        ))}
        {!sessions.length ? <EmptyState title="No recent sessions" message="Recent conversations will appear here as shoppers interact." /> : null}
      </div>
    </section>
  );
}

function ConversationCard({ session, compact = false }: { session: ConversationPreview; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const turns = compact || !open ? session.turns.slice(0, 1) : session.turns;

  return (
    <article className="convo-card">
      <button className="convo-header" type="button" onClick={() => setOpen((current) => !current)}>
        <div className="conversation-meta">
          <strong>{session.date}</strong>
          <small>{shortSessionId(session.session_id)}</small>
        </div>
        {!compact ? <span className={`convo-expand-btn ${open ? 'open' : ''}`}>v</span> : null}
      </button>
      <div className="convo-turns">
      {turns.map((turn, index) => (
        <div className="grid gap-3" key={`${turn.created_at}-${index}`}>
          <div className="turn-user">
            <span className="turn-avatar">U</span>
            <div className="turn-body">
              <p>{turn.transcript || '-'}</p>
            </div>
          </div>
          <div className="turn-ai">
            <span className="turn-avatar">AI</span>
            <div className="turn-body">
              <p>{turn.response_text || '-'}</p>
            </div>
          </div>
        </div>
      ))}
      {!compact && session.turns.length > 1 ? (
        <button className="btn btn-ghost btn-sm" type="button" onClick={() => setOpen((current) => !current)}>
          {open ? 'Show less' : `Show ${session.turns.length - 1} more turns`}
        </button>
      ) : null}
      </div>
    </article>
  );
}
