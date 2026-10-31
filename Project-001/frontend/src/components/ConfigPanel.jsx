import React from 'react';
import { Settings2, RefreshCw } from 'lucide-react';

const PRESETS = [
  { id: 'classic', label: '3×3 Classic' },
  { id: 'maze', label: '5×5 Maze' },
  { id: 'complex', label: '6×6 Grid' },
];

export default function ConfigPanel({ config, onChange, onApply, isTraining, onLoadPreset }) {
  const set = (field, val) => onChange({ ...config, [field]: val });

  return (
    <div className="card">
      <div className="card-section" style={{ borderBottom: '1.5px solid #e5e5e5', paddingBottom: 14 }}>
        <div className="flex items-center gap-2">
          <Settings2 size={15} color="#6b6b6b" />
          <span className="section-title" style={{ marginBottom: 0 }}>Environment & Hyperparameters</span>
        </div>
      </div>

      <div className="card-section" style={{ paddingBottom: 14 }}>
        {/* Presets */}
        <div className="mb-4">
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#bbb', marginBottom: 8 }}>
            Quick Presets
          </p>
          <div className="flex gap-2">
            {PRESETS.map(({ id, label }) => (
              <button key={id} type="button" disabled={isTraining}
                onClick={() => onLoadPreset(id)}
                style={{
                  flex: 1, padding: '7px 4px', borderRadius: 8, fontSize: 12,
                  fontWeight: 600, border: '1.5px solid #e5e5e5',
                  background: 'white', color: '#6b6b6b', cursor: 'pointer',
                  transition: 'all 0.12s', opacity: isTraining ? 0.4 : 1,
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Grid size */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-5">
          {[
            { label: 'Rows', field: 'rows', min: 3, max: 8, value: config.rows },
            { label: 'Cols', field: 'cols', min: 3, max: 8, value: config.cols },
          ].map(({ label, field, min, max, value }) => (
            <div key={field}>
              <div className="flex justify-between mb-1">
                <span style={{ fontSize: 12, fontWeight: 600, color: '#6b6b6b' }}>{label}</span>
                <span style={{ fontFamily: 'JetBrains Mono', fontSize: 12, fontWeight: 700, color: '#0a0a0a' }}>{value}</span>
              </div>
              <input type="range" min={min} max={max} step={1} value={value}
                disabled={isTraining}
                onChange={e => set(field, Number(e.target.value))} />
            </div>
          ))}

          {/* Alpha */}
          <div>
            <div className="flex justify-between mb-1">
              <span style={{ fontSize: 12, fontWeight: 600, color: '#6b6b6b' }}>Learning Rate (α)</span>
              <span style={{ fontFamily: 'JetBrains Mono', fontSize: 12, fontWeight: 700, color: '#0066ff' }}>{config.alpha}</span>
            </div>
            <input type="range" min="0.01" max="0.5" step="0.01" value={config.alpha}
              disabled={isTraining}
              onChange={e => set('alpha', Number(e.target.value))} />
          </div>

          {/* Gamma */}
          <div>
            <div className="flex justify-between mb-1">
              <span style={{ fontSize: 12, fontWeight: 600, color: '#6b6b6b' }}>Discount (γ)</span>
              <span style={{ fontFamily: 'JetBrains Mono', fontSize: 12, fontWeight: 700, color: '#0066ff' }}>{config.gamma}</span>
            </div>
            <input type="range" min="0.1" max="0.99" step="0.05" value={config.gamma}
              disabled={isTraining}
              onChange={e => set('gamma', Number(e.target.value))} />
          </div>

          {/* Epsilon */}
          <div>
            <div className="flex justify-between mb-1">
              <span style={{ fontSize: 12, fontWeight: 600, color: '#6b6b6b' }}>Exploration (ε)</span>
              <span style={{ fontFamily: 'JetBrains Mono', fontSize: 12, fontWeight: 700, color: '#ff8f00' }}>{config.epsilon}</span>
            </div>
            <input type="range" min="0.05" max="0.9" step="0.05" value={config.epsilon}
              disabled={isTraining}
              onChange={e => set('epsilon', Number(e.target.value))} />
          </div>

          {/* Episodes */}
          <div>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#6b6b6b', marginBottom: 6 }}>Episodes</p>
            <select value={config.episodes} disabled={isTraining}
              onChange={e => set('episodes', Number(e.target.value))}>
              {[100, 250, 500, 1000, 2000].map(n => (
                <option key={n} value={n}>{n} Episodes</option>
              ))}
            </select>
          </div>
        </div>

        {/* Reward tuning */}
        <div className="grid grid-cols-2 gap-3" style={{ marginTop: 16 }}>
          <div>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#6b6b6b', marginBottom: 6 }}>Goal Reward</p>
            <input type="number" value={config.goal_reward} disabled={isTraining}
              onChange={e => set('goal_reward', Number(e.target.value))} />
          </div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#6b6b6b', marginBottom: 6 }}>Step Penalty</p>
            <input type="number" value={config.step_penalty} disabled={isTraining}
              onChange={e => set('step_penalty', Number(e.target.value))} />
          </div>
        </div>

        <button type="button" disabled={isTraining} onClick={onApply}
          className="btn btn-white" style={{ marginTop: 16, width: '100%', justifyContent: 'center', borderColor: '#0a0a0a', color: '#0a0a0a' }}>
          <RefreshCw size={13} />
          Apply Config & Re-initialize
        </button>
      </div>
    </div>
  );
}
