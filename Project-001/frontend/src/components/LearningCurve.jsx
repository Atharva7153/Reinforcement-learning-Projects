import React, { useState } from 'react';
import { TrendingUp, Zap, Activity, Crosshair, BarChart2 } from 'lucide-react';

export default function LearningCurve({ history = [], onSelectEpisode }) {
  const [activeTab, setActiveTab] = useState('reward'); // 'reward' | 'steps' | 'td_error'
  const [hoverIndex, setHoverIndex] = useState(null);

  if (!history || history.length < 2) {
    return (
      <div className="card">
        <div className="card-section flex flex-col items-center justify-center" style={{ minHeight: 140, gap: 8 }}>
          <TrendingUp size={20} color="#ccc" />
          <span style={{ fontSize: 13, color: '#bbb' }}>Interactive charts will populate as agent starts training</span>
        </div>
      </div>
    );
  }

  const W = 620, H = 160;
  const pad = { top: 18, right: 24, bottom: 30, left: 48 };
  const iW = W - pad.left - pad.right;
  const iH = H - pad.top - pad.bottom;

  // Extract series based on active tab
  let values = [];
  let secondaryValues = [];
  let yLabelFormat = (v) => Math.round(v);
  let chartTitle = '';
  let primaryColor = '#00c853';
  let primaryLabel = 'Reward';

  if (activeTab === 'reward') {
    chartTitle = 'Episode Reward & Convergence';
    values = history.map((h) => h.avgReward ?? h.reward);
    secondaryValues = history.map((h) => h.reward);
    primaryColor = '#00c853';
    primaryLabel = 'Moving Avg(20)';
  } else if (activeTab === 'steps') {
    chartTitle = 'Steps per Episode (Path Optimization)';
    values = history.map((h) => h.steps ?? 100);
    primaryColor = '#0066ff';
    primaryLabel = 'Steps Taken';
    yLabelFormat = (v) => `${Math.round(v)}s`;
  } else if (activeTab === 'td_error') {
    chartTitle = 'Bellman TD Error (Loss Convergence)';
    values = history.map((h) => h.avg_td_error ?? 0);
    primaryColor = '#ff6d00';
    primaryLabel = 'Avg TD Error';
    yLabelFormat = (v) => v.toFixed(2);
  }

  const allVals = [...values, ...(secondaryValues.length ? secondaryValues : [])];
  const mn = Math.min(...allVals, activeTab === 'reward' ? -10 : 0);
  const mx = Math.max(...allVals, activeTab === 'reward' ? 10 : 1);
  const range = mx - mn || 1;

  const getX = (i) => pad.left + (i / (history.length - 1)) * iW;
  const getY = (v) => pad.top + iH - ((v - mn) / range) * iH;

  const primaryPts = values.map((v, i) => `${getX(i)},${getY(v)}`).join(' ');
  const secondaryPts = secondaryValues.length
    ? secondaryValues.map((v, i) => `${getX(i)},${getY(v)}`).join(' ')
    : null;

  // Horizontal gridlines
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
    y: pad.top + iH * t,
    val: yLabelFormat(mx - t * range),
  }));

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const svgX = (x / rect.width) * W;

    if (svgX < pad.left || svgX > W - pad.right) {
      setHoverIndex(null);
      return;
    }

    const ratio = (svgX - pad.left) / iW;
    const idx = Math.min(history.length - 1, Math.max(0, Math.round(ratio * (history.length - 1))));
    setHoverIndex(idx);
  };

  const hoveredData = hoverIndex !== null ? history[hoverIndex] : null;

  return (
    <div className="card">
      {/* Header & Tabs */}
      <div className="card-section" style={{ borderBottom: '1.5px solid #e5e5e5', paddingBottom: 12 }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BarChart2 size={16} color="#6b6b6b" />
            <span className="section-title" style={{ marginBottom: 0 }}>Analytics & Diagnostics</span>
          </div>

          {/* Interactive Chart Type Tabs */}
          <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 bg-neutral-100 p-1 rounded-lg">
            {[
              { id: 'reward', label: 'Reward', icon: TrendingUp },
              { id: 'steps', label: 'Steps', icon: Zap },
              { id: 'td_error', label: 'TD Loss', icon: Activity },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => { setActiveTab(id); setHoverIndex(null); }}
                className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 rounded-md text-[11px] sm:text-xs font-semibold transition-all ${
                  activeTab === id
                    ? 'bg-white text-black shadow-sm font-bold'
                    : 'text-neutral-500 hover:text-black'
                }`}
              >
                <Icon size={12} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* SVG Canvas Area */}
      <div className="card-section relative" style={{ padding: '12px 14px 16px' }}>
        <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] sm:text-xs font-mono text-neutral-500 mb-2">
          <span className="font-semibold text-neutral-800">{chartTitle}</span>
          <span className="text-[11px] text-neutral-400">Hover graph to inspect point · Click to replay</span>
        </div>

        <svg
          viewBox={`0 0 ${W} ${H}`}
          style={{ width: '100%', height: 'auto', cursor: 'crosshair', userSelect: 'none' }}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverIndex(null)}
          onClick={() => {
            if (hoveredData && onSelectEpisode) {
              onSelectEpisode(hoveredData.episode);
            }
          }}
        >
          {/* Subtle horizontal grid lines */}
          {gridLines.map(({ y, val }) => (
            <g key={y}>
              <line x1={pad.left} y1={y} x2={W - pad.right} y2={y} stroke="#f0eeeb" strokeDasharray="3 3" />
              <text x={pad.left - 6} y={y + 3.5} textAnchor="end" style={{ fill: '#bbb', fontSize: 9, fontFamily: 'JetBrains Mono' }}>
                {val}
              </text>
            </g>
          ))}

          {/* X axis */}
          <line x1={pad.left} y1={pad.top + iH} x2={W - pad.right} y2={pad.top + iH} stroke="#e5e5e5" />

          {/* Secondary line (Raw episode rewards when on reward tab) */}
          {secondaryPts && (
            <polyline fill="none" stroke="#d5d5d5" strokeWidth={1.2} points={secondaryPts} />
          )}

          {/* Primary Trend Line */}
          <polyline
            fill="none"
            stroke={primaryColor}
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            points={primaryPts}
          />

          {/* Hover Crosshair and Tooltip Point */}
          {hoverIndex !== null && (
            <g>
              <line
                x1={getX(hoverIndex)}
                y1={pad.top}
                x2={getX(hoverIndex)}
                y2={pad.top + iH}
                stroke="#0a0a0a"
                strokeWidth={1.2}
                strokeDasharray="2 2"
              />
              <circle
                cx={getX(hoverIndex)}
                cy={getY(values[hoverIndex])}
                r={5.5}
                fill={primaryColor}
                stroke="white"
                strokeWidth={2}
              />
            </g>
          )}

          {/* Axis Labels */}
          {[0, Math.floor(history.length / 2), history.length - 1].map((i) => (
            i < history.length && (
              <text
                key={i}
                x={getX(i)}
                y={H - 4}
                textAnchor="middle"
                style={{ fill: '#bbb', fontSize: 9, fontFamily: 'JetBrains Mono' }}
              >
                Ep {history[i].episode}
              </text>
            )
          ))}
        </svg>

        {/* Hover Floating Tooltip Card */}
        {hoveredData && (
          <div
            className="absolute bg-black text-white px-3 py-2 rounded-lg text-xs font-mono shadow-xl pointer-events-none z-20 flex flex-col gap-1 border border-neutral-700"
            style={{
              left: `${Math.min(80, Math.max(15, (getX(hoverIndex) / W) * 100))}%`,
              top: 14,
              transform: 'translateX(-50%)',
            }}
          >
            <div className="flex items-center justify-between gap-3 text-neutral-400 border-b border-neutral-800 pb-1">
              <span className="font-bold text-white">Episode #{hoveredData.episode}</span>
              <span className="text-[10px] text-amber-300">Click to replay</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span>{primaryLabel}:</span>
              <strong style={{ color: primaryColor }}>
                {activeTab === 'reward'
                  ? hoveredData.avgReward ?? hoveredData.reward
                  : activeTab === 'steps'
                  ? `${hoveredData.steps ?? 100} steps`
                  : (hoveredData.avg_td_error ?? 0).toFixed(3)}
              </strong>
            </div>
            {activeTab === 'reward' && hoveredData.reward !== undefined && (
              <div className="flex items-center justify-between gap-4 text-neutral-400 text-[11px]">
                <span>Ep Reward:</span>
                <span className={hoveredData.reward > 0 ? 'text-emerald-400 font-bold' : 'text-red-400'}>
                  {hoveredData.reward}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
