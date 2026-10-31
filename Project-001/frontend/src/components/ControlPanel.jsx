import React from 'react';
import { Bot, Flag, Ban, Eraser, Play, Pause, RotateCcw, Zap, Flame, Waves, Snowflake, Orbit, Layers } from 'lucide-react';

export default function ControlPanel({
  trainingStatus, activeTool, setActiveTool, pendingPortalEntry = null,
  onStart, onPause, onResume, onReset, onRunPolicy,
  delayMs, onSpeedChange,
  showQValues, setShowQValues, showPolicyArrows, setShowPolicyArrows,
  showValueHeatmap, setShowValueHeatmap, showVisitHeatmap, setShowVisitHeatmap,
  isPolicyRunning, isStarting = false,
}) {
  const isTraining = trainingStatus === 'training';
  const isPaused = trainingStatus === 'paused';

  const tools = [
    { id: 'agent', label: 'Agent', icon: <Bot size={14} />, color: '#0066ff' },
    { id: 'goal', label: 'Goal', icon: <Flag size={14} />, color: '#00c853' },
    { id: 'wall', label: 'Wall', icon: <Ban size={14} />, color: '#ff1744' },
    { id: 'cliff', label: 'Cliff', icon: <Flame size={14} />, color: '#e65100' },
    { id: 'mud', label: 'Mud', icon: <Waves size={14} />, color: '#8d6e63' },
    { id: 'ice', label: 'Ice', icon: <Snowflake size={14} />, color: '#00bcd4' },
    { id: 'portal', label: 'Portal', icon: <Orbit size={14} />, color: '#ab47bc' },
    { id: 'erase', label: 'Erase', icon: <Eraser size={14} />, color: '#6b6b6b' },
  ];

  return (
    <div className="card">
      {/* Editor Tools */}
      <div className="card-section">
        <div className="section-header">
          <span className="section-title">Editor Tools</span>
          <span
            style={{
              fontSize: 11,
              color: activeTool === 'portal' ? '#ab47bc' : '#bbb',
              fontWeight: activeTool === 'portal' ? 700 : 500,
              marginLeft: 'auto'
            }}
          >
            {activeTool === 'portal'
              ? (pendingPortalEntry ? 'Click 2nd cell: Exit' : 'Click 1st cell: Entry')
              : 'Select tool & click grid'}
          </span>
        </div>
        <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
          {tools.map(({ id, label, icon, color }) => (
            <button
              key={id}
              type="button"
              disabled={isTraining}
              onClick={() => setActiveTool(id)}
              className={`tool-chip ${activeTool === id ? 'active' : ''}`}
              style={{
                padding: '6px 4px',
                fontSize: 11,
                justifyContent: 'center',
                gap: 5,
              }}
            >
              {React.cloneElement(icon, {
                size: 13,
                color: activeTool === id ? 'white' : color,
              })}
              <span className="truncate">{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="card-divider" />

      {/* Training Controls */}
      <div className="card-section">
        <div className="section-header">
          <span className="section-title">Training Controls</span>
        </div>

        <div className="flex flex-wrap gap-2">
          {!isTraining && !isPaused && (
            <button className="btn btn-black flex-1" onClick={onStart} disabled={isStarting}>
              <Play size={15} fill="white" />
              {isStarting ? 'Starting...' : 'Start Learning'}
            </button>
          )}
          {isTraining && (
            <button className="btn btn-amber flex-1" onClick={onPause}>
              <Pause size={15} fill="white" />
              Pause
            </button>
          )}
          {isPaused && (
            <button className="btn btn-green flex-1" onClick={onResume}>
              <Play size={15} fill="white" />
              Resume
            </button>
          )}

          <button className="btn btn-white" onClick={onReset} title="Reset training">
            <RotateCcw size={15} />
            Reset
          </button>

          <button
            className="btn btn-white"
            onClick={onRunPolicy}
            disabled={isTraining || isPolicyRunning}
            title="Watch learned policy"
            style={{ border: '1.5px solid #ff6d00', color: '#ff6d00', fontWeight: 700 }}
          >
            <Zap size={15} />
            Run Policy
          </button>
        </div>
      </div>

      <div className="card-divider" />

      {/* Speed */}
      <div className="card-section">
        <div className="flex items-center justify-between mb-3">
          <span className="section-title">Simulation Speed</span>
          <span style={{ fontFamily: 'JetBrains Mono', fontSize: 12, fontWeight: 700, color: '#0a0a0a' }}>
            {delayMs === 0 ? 'Turbo (0ms)' : `${delayMs}ms`}
          </span>
        </div>
        <input type="range" min={0} max={300} step={10} value={delayMs}
          onChange={e => onSpeedChange(Number(e.target.value))} />
        <div className="flex justify-between mt-1.5" style={{ fontSize: 11, color: '#bbb', fontFamily: 'JetBrains Mono' }}>
          <span>Turbo</span><span>Live</span><span>Slow-mo</span>
        </div>
      </div>

      <div className="card-divider" />

      {/* Overlays & Heatmaps */}
      <div className="card-section" style={{ padding: '14px 24px' }}>
        <div className="section-header" style={{ marginBottom: 10 }}>
          <span className="section-title">Visual Overlays</span>
        </div>
        <div className="grid grid-cols-2 gap-y-2.5 gap-x-4">
          <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-medium text-neutral-700">
            <input type="checkbox" checked={showQValues} onChange={e => setShowQValues(e.target.checked)} />
            Q-Values
          </label>
          <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-medium text-neutral-700">
            <input type="checkbox" checked={showPolicyArrows} onChange={e => setShowPolicyArrows(e.target.checked)} />
            Policy Arrows
          </label>
          <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-medium text-neutral-700">
            <input
              type="checkbox"
              checked={showValueHeatmap}
              onChange={e => {
                setShowValueHeatmap(e.target.checked);
                if (e.target.checked) setShowVisitHeatmap(false);
              }}
            />
            State Value (V)
          </label>
          <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-medium text-neutral-700">
            <input
              type="checkbox"
              checked={showVisitHeatmap}
              onChange={e => {
                setShowVisitHeatmap(e.target.checked);
                if (e.target.checked) setShowValueHeatmap(false);
              }}
            />
            Visit Heatmap
          </label>
        </div>
      </div>
    </div>
  );
}
