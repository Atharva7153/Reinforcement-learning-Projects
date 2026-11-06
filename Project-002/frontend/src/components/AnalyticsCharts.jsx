import React from 'react';
import { TrendingUp, History, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

export default function AnalyticsCharts({ stats }) {
  const history = stats?.recent_history || [];
  const successCount = stats?.success_count || 0;
  const crashCount = stats?.crash_count || 0;
  const stallCount = stats?.stall_count || 0;
  const total = successCount + crashCount + stallCount;

  const successPercent = total > 0 ? ((successCount / total) * 100).toFixed(1) : 0;
  const crashPercent = total > 0 ? ((crashCount / total) * 100).toFixed(1) : 0;
  const stallPercent = total > 0 ? ((stallCount / total) * 100).toFixed(1) : 0;

  // Mini reward sparkline path
  const rewardPoints = history.slice(-30).map(h => h.reward);
  const minReward = Math.min(-150, ...rewardPoints, 0);
  const maxReward = Math.max(160, ...rewardPoints, 50);
  const chartHeight = 80;
  const chartWidth = 360;

  const sparklineCoords = rewardPoints.map((r, i) => {
    const x = rewardPoints.length > 1 ? (i / (rewardPoints.length - 1)) * chartWidth : chartWidth / 2;
    const y = chartHeight - ((r - minReward) / (maxReward - minReward || 1)) * chartHeight;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* 1. Reward Convergence Curve */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm flex flex-col justify-between">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-indigo-600" />
            <h3 className="font-semibold text-slate-900 text-sm">Reward Curve (Last 30 Episodes)</h3>
          </div>
          <span className="font-mono text-xs text-slate-500">
            Total Trained: {stats?.current_episode || 0}
          </span>
        </div>

        {/* SVG Sparkline */}
        <div className="my-2 bg-slate-50 rounded-xl p-3 border border-slate-100 flex flex-col items-center">
          {rewardPoints.length > 1 ? (
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-24 overflow-visible">
              {/* Zero reward horizontal baseline */}
              {minReward < 0 && (
                <line
                  x1="0"
                  y1={chartHeight - ((0 - minReward) / (maxReward - minReward)) * chartHeight}
                  x2={chartWidth}
                  y2={chartHeight - ((0 - minReward) / (maxReward - minReward)) * chartHeight}
                  stroke="#CBD5E1"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
              )}
              {/* Polyline */}
              <polyline
                fill="none"
                stroke="#6366F1"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={sparklineCoords}
              />
              {/* Data points */}
              {rewardPoints.map((r, i) => {
                const x = (i / (rewardPoints.length - 1)) * chartWidth;
                const y = chartHeight - ((r - minReward) / (maxReward - minReward || 1)) * chartHeight;
                return (
                  <circle
                    key={i}
                    cx={x}
                    cy={y}
                    r="3"
                    className={r >= 100 ? 'fill-emerald-500' : r < 0 ? 'fill-rose-500' : 'fill-amber-500'}
                  />
                );
              })}
            </svg>
          ) : (
            <div className="h-24 flex items-center justify-center text-xs text-slate-400">
              Run training or turbo episodes to view reward trajectory.
            </div>
          )}

          <div className="flex justify-between w-full text-[10px] font-mono text-slate-400 mt-1">
            <span>Episode {Math.max(1, (stats?.current_episode || 0) - rewardPoints.length + 1)}</span>
            <span>Target: &gt; +100 reward</span>
            <span>Latest: {rewardPoints[rewardPoints.length - 1] ?? 0}</span>
          </div>
        </div>

        {/* Breakdown bar */}
        <div className="mt-2">
          <div className="flex justify-between text-xs font-medium text-slate-600 mb-1">
            <span className="flex items-center gap-1 text-emerald-600">
              <CheckCircle className="h-3.5 w-3.5" /> Safe Stop ({successPercent}%)
            </span>
            <span className="flex items-center gap-1 text-rose-600">
              <XCircle className="h-3.5 w-3.5" /> Crash ({crashPercent}%)
            </span>
            <span className="flex items-center gap-1 text-amber-600">
              <AlertCircle className="h-3.5 w-3.5" /> Stalled ({stallPercent}%)
            </span>
          </div>
          <div className="h-2.5 w-full bg-slate-100 rounded-full flex overflow-hidden">
            <div className="bg-emerald-500 h-full transition-all" style={{ width: `${successPercent}%` }} />
            <div className="bg-rose-500 h-full transition-all" style={{ width: `${crashPercent}%` }} />
            <div className="bg-amber-400 h-full transition-all" style={{ width: `${stallPercent}%` }} />
          </div>
        </div>
      </div>

      {/* 2. Recent Episode Log Feed */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm flex flex-col justify-between">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-indigo-600" />
            <h3 className="font-semibold text-slate-900 text-sm">Recent Episode Telemetry Log</h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">Last 7 runs</span>
        </div>

        <div className="space-y-1.5 overflow-y-auto max-h-[175px] pr-1">
          {history.length > 0 ? (
            history.slice(-7).reverse().map((ep, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100 text-xs hover:bg-slate-100/70 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono font-semibold text-slate-700 w-12">
                    #{ep.episode}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full font-semibold text-[11px] ${
                      ep.outcome === 'SUCCESS'
                        ? 'bg-emerald-100 text-emerald-700'
                        : ep.outcome === 'CRASH'
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {ep.outcome}
                  </span>
                </div>

                <div className="flex items-center gap-4 font-mono text-[11px] text-slate-600">
                  <span>dist: <strong>{ep.final_distance}m</strong></span>
                  <span>vel: <strong>{(ep.final_velocity * 3.6).toFixed(0)}km/h</strong></span>
                  <span
                    className={`font-bold ${
                      ep.reward > 0 ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {ep.reward > 0 ? `+${ep.reward}` : ep.reward}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-xs text-slate-400">
              No episode logs yet. Start training or manual drive!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
