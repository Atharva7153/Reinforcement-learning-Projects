import React from 'react';
import { motion } from 'framer-motion';
import { Loader2, TrendingUp, Trophy, Users, ShieldAlert } from 'lucide-react';

export default function TrainingStats({
  mode = 'single',
  trainingStatus, currentEpisode, totalEpisodes,
  currentStep, lastReward, avgReward, epsilon,
  wins1 = 0, wins2 = 0, ties = 0, coopSuccesses = 0,
  lastReward2 = 0, avgReward2 = 0, epsilon2 = 0.2,
}) {
  const isTraining = trainingStatus === 'training';
  const isPaused = trainingStatus === 'paused';
  const isFinished = trainingStatus === 'finished';
  const pct = totalEpisodes > 0 ? Math.min(100, (currentEpisode / totalEpisodes) * 100) : 0;

  const totalDecided = wins1 + wins2 + ties || 1;
  const winPct1 = Math.round((wins1 / totalDecided) * 100);
  const winPct2 = Math.round((wins2 / totalDecided) * 100);
  const coopPct = currentEpisode > 0 ? Math.round((coopSuccesses / currentEpisode) * 100) : 0;

  const statusColor = {
    training: { bg: '#0a0a0a', text: 'white' },
    paused: { bg: '#b35c00', text: 'white' },
    finished: { bg: '#00843d', text: 'white' },
    idle: { bg: '#f0eeeb', text: '#6b6b6b' },
  }[trainingStatus] || { bg: '#f0eeeb', text: '#6b6b6b' };

  const statusLabel = {
    training: 'Training', paused: 'Paused', finished: 'Finished', idle: 'Idle',
  }[trainingStatus] || 'Idle';

  return (
    <div className="card">
      {/* Top bar: status + progress */}
      <div className="card-section" style={{ borderBottom: '1.5px solid #e5e5e5' }}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px',
              borderRadius: 100, fontSize: 11, fontWeight: 700,
              background: statusColor.bg, color: statusColor.text
            }}>
              {isTraining && <Loader2 size={12} className="animate-spin" />}
              {isFinished && <TrendingUp size={12} />}
              <span style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>{statusLabel}</span>
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: mode === 'competitive' ? '#ea580c' : mode === 'cooperative' ? '#059669' : '#0066ff' }}>
              {mode === 'competitive' ? '🏁 Competitive Race' : mode === 'cooperative' ? '🤝 Cooperative Co-Op' : '👤 Solo Learner'}
            </span>
          </div>
          <span style={{ fontFamily: 'JetBrains Mono', fontSize: 12, fontWeight: 700, color: '#0a0a0a', whiteSpace: 'nowrap' }}>
            {currentEpisode} <span style={{ fontWeight: 400, color: '#bbb' }}>/ {totalEpisodes} ep</span>
          </span>
        </div>

        {/* Progress bar */}
        <div className="progress-bar-track" style={{ marginTop: 12 }}>
          <motion.div
            className="progress-bar-fill"
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Mode-Specific Telemetry */}
      {mode === 'competitive' ? (
        <div className="card-section" style={{ padding: '14px 16px' }}>
          {/* Dual Scoreboard */}
          <div className="grid grid-cols-3 gap-2 items-center text-center">
            {/* Agent 1 Card */}
            <div style={{ background: '#eff6ff', border: '1.5px solid #bfdbfe', borderRadius: 10, padding: '10px 8px' }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: '#1d4ed8', textTransform: 'uppercase' }}>
                🤖 Agent 1 (Blue)
              </span>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: 22, fontWeight: 800, color: '#1e40af', margin: '4px 0' }}>
                {wins1} <span style={{ fontSize: 11, fontWeight: 600 }}>Wins</span>
              </div>
              <div style={{ fontSize: 11, color: '#3b82f6', fontWeight: 600 }}>
                {winPct1}% Win Rate · Avg {avgReward}
              </div>
            </div>

            {/* VS Badge */}
            <div className="flex flex-col items-center justify-center">
              <span style={{
                fontFamily: 'JetBrains Mono', fontSize: 11, fontWeight: 800,
                background: '#f5f5f5', border: '1px solid #e5e5e5', borderRadius: 6,
                padding: '3px 8px', color: '#737373'
              }}>
                VS
              </span>
              <span style={{ fontSize: 10, color: '#999', marginTop: 4 }}>
                {ties} Ties / Step {currentStep}
              </span>
            </div>

            {/* Agent 2 Card */}
            <div style={{ background: '#fff7ed', border: '1.5px solid #fed7aa', borderRadius: 10, padding: '10px 8px' }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: '#c2410c', textTransform: 'uppercase' }}>
                🤖 Agent 2 (Orange)
              </span>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: 22, fontWeight: 800, color: '#9a3412', margin: '4px 0' }}>
                {wins2} <span style={{ fontSize: 11, fontWeight: 600 }}>Wins</span>
              </div>
              <div style={{ fontSize: 11, color: '#ea580c', fontWeight: 600 }}>
                {winPct2}% Win Rate · Avg {avgReward2}
              </div>
            </div>
          </div>

          {/* Win Rate Ratio Bar */}
          <div style={{ marginTop: 12, height: 6, width: '100%', borderRadius: 999, overflow: 'hidden', display: 'flex', background: '#e5e5e5' }}>
            <div style={{ width: `${winPct1}%`, background: '#0066ff', transition: 'width 0.3s ease' }} />
            <div style={{ width: `${winPct2}%`, background: '#ea580c', transition: 'width 0.3s ease' }} />
          </div>
        </div>
      ) : mode === 'cooperative' ? (
        <div className="card-section" style={{ padding: '14px 16px' }}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div style={{ background: '#ecfdf5', border: '1.5px solid #a7f3d0', borderRadius: 9, padding: '9px 12px' }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: '#047857', textTransform: 'uppercase' }}>Team Success</span>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: 18, fontWeight: 800, color: '#065f46', marginTop: 2 }}>
                {coopPct}%
              </div>
              <span style={{ fontSize: 10, color: '#10b981' }}>{coopSuccesses} / {currentEpisode} cleared</span>
            </div>

            <div style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 9, padding: '9px 12px' }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Combined Steps</span>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: 18, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>
                {currentStep}
              </div>
              <span style={{ fontSize: 10, color: '#94a3b8' }}>steps in episode</span>
            </div>

            <div style={{ background: '#eff6ff', border: '1.5px solid #bfdbfe', borderRadius: 9, padding: '9px 12px' }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: '#1d4ed8', textTransform: 'uppercase' }}>A1 Avg Reward</span>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: 18, fontWeight: 800, color: '#1e40af', marginTop: 2 }}>
                {avgReward}
              </div>
              <span style={{ fontSize: 10, color: '#3b82f6' }}>Last: {lastReward}</span>
            </div>

            <div style={{ background: '#fff7ed', border: '1.5px solid #fed7aa', borderRadius: 9, padding: '9px 12px' }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: '#c2410c', textTransform: 'uppercase' }}>A2 Avg Reward</span>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: 18, fontWeight: 800, color: '#9a3412', marginTop: 2 }}>
                {avgReward2}
              </div>
              <span style={{ fontSize: 10, color: '#ea580c' }}>Last: {lastReward2}</span>
            </div>
          </div>
        </div>
      ) : (
        /* Stat row for Single Agent */
        <div className="stats-grid-row">
          {[
            {
              label: 'Episode',
              value: currentEpisode,
              sub: `of ${totalEpisodes}`,
              color: 'default',
            },
            {
              label: 'Steps (current)',
              value: currentStep,
              sub: 'steps this run',
              color: 'default',
            },
            {
              label: 'Last Reward',
              value: lastReward > 0 ? `+${lastReward}` : lastReward,
              sub: `avg(20): ${avgReward}`,
              color: lastReward > 0 ? 'green' : lastReward < -1 ? 'red' : 'default',
            },
            {
              label: 'Exploration ε',
              value: epsilon.toFixed(3),
              sub: `${(epsilon * 100).toFixed(1)}% explore`,
              color: 'cyan',
            },
          ].map(({ label, value, sub, color }) => (
            <div key={label} className="stat-cell">
              <div className="stat-block">
                <span className="stat-label">{label}</span>
                <span className={`stat-value ${color}`}>{value}</span>
                <span className="stat-sub">{sub}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
