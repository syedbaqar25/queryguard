import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar,
} from 'recharts';
import { useQueryStore } from '../stores/queryStore';
import { useStats } from '../hooks/useStats';

export function StatsPanel() {
  const { stats } = useQueryStore();
  useStats(30000);

  if (!stats) {
    return <div className="stats-loading">Loading statistics...</div>;
  }

  const attackData = Object.entries(stats.attackTypeBreakdown).map(([type, count]) => ({
    type,
    count,
  }));

  return (
    <div className="stats-panel" data-testid="stats-panel">
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{stats.totalAnalyzed}</div>
          <div className="stat-label">Total Analyzed</div>
        </div>
        <div className="stat-card stat-card-danger">
          <div className="stat-value">{stats.totalMalicious}</div>
          <div className="stat-label">Malicious</div>
        </div>
        <div className="stat-card stat-card-safe">
          <div className="stat-value">{stats.totalSafe}</div>
          <div className="stat-label">Safe</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{(stats.detectionRate * 100).toFixed(1)}%</div>
          <div className="stat-label">Detection Rate</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{(stats.avgConfidence * 100).toFixed(1)}%</div>
          <div className="stat-label">Avg Confidence</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.avgLatencyMs.toFixed(0)}ms</div>
          <div className="stat-label">Avg Latency</div>
        </div>
      </div>

      <div className="chart-section">
        <h3>Last 24 Hours</h3>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={stats.recentTrend}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="hour" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(11, 16)} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="safe" stroke="#22c55e" dot={false} />
            <Line type="monotone" dataKey="malicious" stroke="#ef4444" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {attackData.length > 0 && (
        <div className="chart-section">
          <h3>Attack Types</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={attackData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="type" tick={{ fontSize: 10 }} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
