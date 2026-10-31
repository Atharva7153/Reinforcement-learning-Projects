import React from 'react';
import { Bot, Flag, Ban, Eraser, Play, Pause, RotateCcw, Zap, Flame, Waves, Snowflake, Orbit, Layers, KeyRound, DoorClosed, Trophy, Users, User } from 'lucide-react';

export default function ControlPanel({
  mode = 'single', onModeChange,
  trainingStatus, activeTool, setActiveTool, pendingPortalEntry = null, pendingDoor = null,
  onStart, onPause, onResume, onReset, onRunPolicy,
  delayMs, onSpeedChange,
  showQValues, setShowQValues, showPolicyArrows, setShowPolicyArrows,
  showValueHeatmap, setShowValueHeatmap, showVisitHeatmap, setShowVisitHeatmap,
  isPolicyRunning, isStarting = false,
}) {
  const isTraining = trainingStatus === 'training';
  const isPaused = trainingStatus === 'paused';
  const isMultiAgent = mode === 'competitive' || mode === 'cooperative';

  const baseTools = [
    { id: 'agent', label: isMultiAgent ? 'Agent 1' : 'Agent', icon: <Bot size={14} />, color: '#0066ff' },
    ...(isMultiAgent ? [{ id: 'agent2', label: 'Agent 2', icon: <Bot size={14} />, color: '#ea580c' }] : []),
    { id: 'goal', label: mode === 'cooperative' ? 'Goal 1' : 'Goal', icon: <Flag size={14} />, color: '#00c853' },
    ...(mode === 'cooperative' ? [{ id: 'goal2', label: 'Goal 2', icon: <Flag size={14} />, color: '#10b981' }] : []),
    { id: 'wall', label: 'Wall', icon: <Ban size={14} />, color: '#ff1744' },
    { id: 'door', label: 'Door/Key', icon: <KeyRound size={14} />, color: '#d97706' },
    { id: 'cliff', label: 'Cliff', icon: <Flame size={14} />, color: '#e65100' },
    { id: 'mud', label: 'Mud', icon: <Waves size={14} />, color: '#8d6e63' },
    { id: 'ice', label: 'Ice', icon: <Snowflake size={14} />, color: '#00bcd4' },
    { id: 'portal', label: 'Portal', icon: <Orbit size={14} />, color: '#ab47bc' },
    { id: 'erase', label: 'Erase', icon: <Eraser size={14} />, color: '#6b6b6b' },
  ];

  const modes = [
    { id: 'single', label: 'Solo', icon: <User size={12} /> },
    { id: 'competitive', label: 'Race', icon: <Trophy size={12} /> },
    { id: 'cooperative', label: 'Co-op', icon: <Users size={12} /> },
  ];

  return (
    <div className="card">
      {/* Game Mode Selector */}
      <div className="card-section" style={{ borderBottom: '1.5px solid #e5e5e5', paddingBottom: 12 }}>
        <div className="flex items-center justify-between mb-2">
          <span className="section-title" style={{ marginBottom: 0 }}>Play Mode</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: mode === 'competitive' ? '#ea580c' : mode === 'cooperative' ? '#059669' : '#0066ff', textTransform: 'uppercase' }}>
            {mode === 'competitive' ? '🏁 2-Agent Duel' : mode === 'cooperative' ? '🤝 2-Agent Team' : '👤 Single Agent'}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-neutral-100 rounded-lg">
          {modes.map((m) => {
            const isActive = mode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                disabled={isTraining}
                onClick={() => onModeChange && onModeChange(m.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 5,
                  padding: '6px 4px',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: isTraining ? 'not-allowed' : 'pointer',
                  border: isActive ? '1px solid #d4d4d4' : '1px solid transparent',
                  background: isActive ? 'white' : 'transparent',
                  color: isActive ? '#0a0a0a' : '#737373',
                  boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                {m.icon}
                <span>{m.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Editor Tools */}
      <div className="card-section">
        <div className="section-header">
          <span className="section-title">Editor Tools</span>
          <span
            style={{
              fontSize: 11,
              color: activeTool === 'door' ? '#d97706' : activeTool === 'portal' ? '#ab47bc' : '#bbb',
              fontWeight: (activeTool === 'door' || activeTool === 'portal') ? 700 : 500,
              marginLeft: 'auto'
            }}
          >
            {activeTool === 'door'
              ? (pendingDoor ? 'Click 2nd cell: Key' : 'Click 1st cell: Door')
              : activeTool === 'portal'
              ? (pendingPortalEntry ? 'Click 2nd cell: Exit' : 'Click 1st cell: Entry')
              : 'Select tool & click grid'}
          </span>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-1.5 sm:gap-2">
          {baseTools.map(({ id, label, icon, color }) => (
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
              {isStarting ? 'Starting...' : isMultiAgent ? 'Start Dual Training' : 'Start Learning'}
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
        </div>

        {/* Speed Slider */}
        <div className="mt-3.5">
          <div className="flex justify-between mb-1">
            <span style={{ fontSize: 11, fontWeight: 600, color: '#6b6b6b' }}>Step Delay</span>
            <span style={{ fontFamily: 'JetBrains Mono', fontSize: 11, fontWeight: 700, color: '#0a0a0a' }}>
              {delayMs === 0 ? 'Turbo (0ms)' : `${delayMs}ms`}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={300}
            step={5}
            value={delayMs}
            onChange={(e) => onSpeedChange(Number(e.target.value))}
          />
        </div>

        {/* Overlays */}
        <div className="grid grid-cols-2 gap-2 mt-3.5 pt-3 border-t border-neutral-100">
          <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-neutral-700">
            <input
              type="checkbox"
              checked={showQValues}
              onChange={(e) => setShowQValues(e.target.checked)}
              className="rounded text-neutral-900 focus:ring-0"
            />
            Q-Values
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-neutral-700">
            <input
              type="checkbox"
              checked={showPolicyArrows}
              onChange={(e) => setShowPolicyArrows(e.target.checked)}
              className="rounded text-neutral-900 focus:ring-0"
            />
            Policy Arrows
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-neutral-700">
            <input
              type="checkbox"
              checked={showValueHeatmap}
              onChange={(e) => {
                setShowValueHeatmap(e.target.checked);
                if (e.target.checked) setShowVisitHeatmap(false);
              }}
              className="rounded text-neutral-900 focus:ring-0"
            />
            Value Heatmap
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-neutral-700">
            <input
              type="checkbox"
              checked={showVisitHeatmap}
              onChange={(e) => {
                setShowVisitHeatmap(e.target.checked);
                if (e.target.checked) setShowValueHeatmap(false);
              }}
              className="rounded text-neutral-900 focus:ring-0"
            />
            Visit Heatmap
          </label>
        </div>

        {/* Demo Button */}
        <button
          type="button"
          disabled={isTraining || isPolicyRunning}
          onClick={onRunPolicy}
          className="btn btn-white w-full mt-3.5 justify-center"
          style={{ borderColor: '#0066ff', color: '#0066ff', fontWeight: 700 }}
        >
          <Zap size={14} fill={isPolicyRunning ? '#0066ff' : 'none'} />
          {isPolicyRunning
            ? (isMultiAgent ? 'Dual Demo Running...' : 'Policy Demo Running...')
            : (isMultiAgent ? '⚡ Run Dual Policy Demo' : '⚡ Run Policy Demo')}
        </button>
      </div>
    </div>
  );
}
