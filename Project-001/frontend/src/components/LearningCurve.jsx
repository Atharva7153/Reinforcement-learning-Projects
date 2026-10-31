import React from 'react';
import { TrendingUp } from 'lucide-react';

export default function LearningCurve({ history = [] }) {
  if (!history || history.length < 2) {
    return (
      <div className="card">
        <div className="card-section flex flex-col items-center justify-center" style={{ minHeight: 130, gap: 8 }}>
          <TrendingUp size={20} color="#ccc" />
          <span style={{ fontSize: 13, color: '#bbb' }}>Reward curve will appear after training starts</span>
        </div>
      </div>
    );
  }

  const W = 560, H = 140;
  const pad = { top: 14, right: 18, bottom: 28, left: 44 };
  const iW = W - pad.left - pad.right;
  const iH = H - pad.top - pad.bottom;

  const rews = history.map(h => h.reward);
  const avgs = history.map(h => h.avgReward ?? h.reward);
  const mn = Math.min(...rews, ...avgs, -5);
  const mx = Math.max(...rews, ...avgs, 5);
  const range = mx - mn || 1;

  const getX = i => pad.left + (i / (history.length - 1)) * iW;
  const getY = v => pad.top + iH - ((v - mn) / range) * iH;

  const rawPts = history.map((h, i) => `${getX(i)},${getY(h.reward)}`).join(' ');
  const avgPts = history.map((h, i) => `${getX(i)},${getY(h.avgReward ?? h.reward)}`).join(' ');

  // Gridlines
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map(t => ({
    y: pad.top + iH * t,
    val: Math.round(mx - t * range),
  }));

  return (
    <div className="card">
      <div className="card-section" style={{ borderBottom: '1.5px solid #e5e5e5', paddingBottom: 14 }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp size={15} color="#6b6b6b" />
            <span className="section-title" style={{ marginBottom: 0 }}>Reward Convergence</span>
          </div>
          <div className="flex items-center gap-5" style={{ fontSize: 11, fontFamily: 'JetBrains Mono', fontWeight: 600 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#bbb' }}>
              <span style={{ display: 'inline-block', width: 18, height: 1.5, background: '#d0d0d0' }} />
              Episode
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#00843d' }}>
              <span style={{ display: 'inline-block', width: 18, height: 2.5, background: '#00c853', borderRadius: 2 }} />
              Avg(20)
            </span>
          </div>
        </div>
      </div>

      <div className="card-section" style={{ padding: '8px 16px 16px' }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
          {gridLines.map(({ y, val }) => (
            <g key={y}>
              <line x1={pad.left} y1={y} x2={W - pad.right} y2={y}
                stroke="#f0eeeb" strokeDasharray="3 3" />
              <text x={pad.left - 6} y={y + 3.5} textAnchor="end"
                style={{ fill: '#bbb', fontSize: 9, fontFamily: 'JetBrains Mono' }}>
                {val}
              </text>
            </g>
          ))}

          {/* X axis */}
          <line x1={pad.left} y1={pad.top + iH} x2={W - pad.right} y2={pad.top + iH} stroke="#e5e5e5" />

          {/* Raw episode rewards */}
          <polyline fill="none" stroke="#d0d0d0" strokeWidth={1.5} points={rawPts} />

          {/* Moving average */}
          <polyline fill="none" stroke="#00c853" strokeWidth={2.5}
            strokeLinecap="round" strokeLinejoin="round" points={avgPts} />

          {/* Live dot */}
          {history.length > 0 && (() => {
            const last = history[history.length - 1];
            const x = getX(history.length - 1);
            const y = getY(last.avgReward ?? last.reward);
            return (
              <>
                <circle cx={x} cy={y} r={5} fill="#00c853" />
                <circle cx={x} cy={y} r={3} fill="white" />
              </>
            );
          })()}

          {/* Episode axis labels */}
          {[0, Math.floor(history.length / 2), history.length - 1].map((i) => (
            i < history.length && (
              <text key={i} x={getX(i)} y={H - 4} textAnchor="middle"
                style={{ fill: '#bbb', fontSize: 9, fontFamily: 'JetBrains Mono' }}>
                {history[i].episode}
              </text>
            )
          ))}
        </svg>
      </div>
    </div>
  );
}
