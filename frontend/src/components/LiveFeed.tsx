import React from 'react';
import { useQueryStore } from '../stores/queryStore';
import { useSSE } from '../hooks/useSSE';
import type { SSEEvent } from '../types';

function EventItem({ event }: { event: SSEEvent }) {
  if (event.type !== 'analysis' || !event.data) return null;
  const { data } = event;
  const isMalicious = data.label === 'MALICIOUS';
  return (
    <div className={`live-event ${isMalicious ? 'event-malicious' : 'event-safe'}`}>
      <span className={`live-badge ${isMalicious ? 'badge-malicious' : 'badge-safe'}`}>
        {data.label}
      </span>
      {data.attackType && <span className="attack-type-sm">{data.attackType}</span>}
      <code className="live-query">
        {data.query.length > 50 ? data.query.slice(0, 47) + '...' : data.query}
      </code>
      <span className="live-time">{new Date(data.timestamp).toLocaleTimeString()}</span>
    </div>
  );
}

export function LiveFeed() {
  const { liveEvents, clearLiveEvents, sseConnected, apiKey } = useQueryStore();
  useSSE(apiKey);

  return (
    <div className="live-feed" data-testid="live-feed">
      <div className="live-feed-header">
        <h3>Live Feed</h3>
        <div className="connection-status">
          <span className={`status-dot ${sseConnected ? 'dot-connected' : 'dot-disconnected'}`} />
          {sseConnected ? 'Connected' : 'Disconnected'}
        </div>
        {liveEvents.length > 0 && (
          <button onClick={clearLiveEvents} className="clear-btn">Clear</button>
        )}
      </div>
      <div className="live-events-list">
        {liveEvents.length === 0 ? (
          <div className="empty-state">No live events yet</div>
        ) : (
          liveEvents.map((event, i) => <EventItem key={i} event={event} />)
        )}
      </div>
    </div>
  );
}
