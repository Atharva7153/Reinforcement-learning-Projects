import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, TrendingUp } from 'lucide-react';

export default function TrainingStats({
  trainingStatus, currentEpisode, totalEpisodes,
  currentStep, lastReward, avgReward, epsilon,
}) {
  const isTraining = trainingStatus === 'training';
  const isPaused = trainingStatus === 'paused';
  const isFinished = trainingStatus === 'finished';
  const pct = totalEpisodes > 0 ? Math.min(100, (currentEpisode / totalEpisodes) * 100) : 0;

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
            {isTraining && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-xs font-medium hidden sm:inline"
                style={{ color: '#6b6b6b' }}
              >
                Agent is learning
              </motion.span>
            )}
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

      {/* Stat row: 2 cols on mobile, 4 cols on desktop */}
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
    </div>
  );
}
