import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flag, Bot, Ban, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, History } from 'lucide-react';

const ARROW_MAP = {
  up: <ArrowUp size={18} color="#ff6d00" strokeWidth={2.5} />,
  down: <ArrowDown size={18} color="#ff6d00" strokeWidth={2.5} />,
  left: <ArrowLeft size={18} color="#ff6d00" strokeWidth={2.5} />,
  right: <ArrowRight size={18} color="#ff6d00" strokeWidth={2.5} />,
};

export default function GridEnvironment({
  rows, cols, start, goal, obstacles,
  agentPosition, qTable, bestActions,
  activeTool, onCellClick, selectedCell,
  showQValues, showPolicyArrows, isTraining,
  replayPath = [], replayStepIndex = 0, isReplayMode = false,
}) {
  const agent = agentPosition || start;
  const isAgent = (r, c) => agent[0] === r && agent[1] === c;
  const isGoal = (r, c) => goal[0] === r && goal[1] === c;
  const isStart = (r, c) => start[0] === r && start[1] === c;
  const isObs = (r, c) => obstacles.some(([or, oc]) => or === r && oc === c);
  const isSel = (r, c) => selectedCell?.[0] === r && selectedCell?.[1] === c;

  // Cell size adapts to grid size
  const cellSize = rows > 6 ? 54 : rows > 4 ? 66 : 76;

  return (
    <div className="flex flex-col items-center gap-4">
      {isReplayMode && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold"
          style={{ background: '#fff8e8', color: '#b35c00', border: '1.5px solid #ffd990' }}
        >
          <History size={12} />
          Replay Mode — Viewing historical trajectory
        </motion.div>
      )}

      <div
        className="rl-grid"
        style={{
          gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`,
          gridTemplateRows: `repeat(${rows}, ${cellSize}px)`,
        }}
      >
        {Array.from({ length: rows }, (_, r) =>
          Array.from({ length: cols }, (_, c) => {
            const key = `${r},${c}`;
            const obs = isObs(r, c);
            const goalHere = isGoal(r, c);
            const startHere = isStart(r, c);
            const agentHere = isAgent(r, c);
            const sel = isSel(r, c);
            const cq = qTable?.[key];
            const ba = bestActions?.[key];
            const inReplay = isReplayMode && replayPath.some((p, i) => p[0] === r && p[1] === c);

            return (
              <motion.div
                key={key}
                onClick={() => onCellClick(r, c)}
                whileHover={{ scale: isTraining ? 1 : 1.04 }}
                whileTap={{ scale: 0.97 }}
                className={`rl-cell
                  ${sel ? 'selected' : ''}
                  ${obs ? 'is-obstacle' : ''}
                  ${goalHere && !obs ? 'is-goal' : ''}
                  ${startHere && !obs && !goalHere ? 'is-start' : ''}
                  ${inReplay && !obs ? 'ring-2 ring-amber-300' : ''}
                `}
                style={{ width: cellSize, height: cellSize }}
              >
                {/* Coord tag */}
                <span style={{
                  position: 'absolute', top: 3, left: 5,
                  fontSize: 9, fontFamily: 'JetBrains Mono', fontWeight: 600, color: '#ccc',
                  zIndex: 1, userSelect: 'none'
                }}>
                  {r},{c}
                </span>

                {/* Obstacle */}
                {obs && (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                    className="flex flex-col items-center gap-0.5">
                    <Ban size={cellSize > 64 ? 24 : 18} color="#ff1744" strokeWidth={2} />
                    <span style={{ fontSize: 9, fontWeight: 800, color: '#ff1744', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Wall</span>
                  </motion.div>
                )}

                {/* Goal */}
                {goalHere && !obs && (
                  <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 2 }}
                    className="flex flex-col items-center gap-0.5">
                    <Flag size={cellSize > 64 ? 26 : 18} color="#00c853" strokeWidth={2} />
                    <span style={{ fontSize: 9, fontWeight: 800, color: '#00c853', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Goal</span>
                  </motion.div>
                )}

                {/* Start label when agent is elsewhere */}
                {startHere && !agentHere && !obs && !goalHere && (
                  <span style={{ fontSize: 9, fontWeight: 700, color: '#0066ff', opacity: 0.5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Start
                  </span>
                )}

                {/* Policy Arrow */}
                {showPolicyArrows && !isReplayMode && ba && !obs && !goalHere && !agentHere && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="policy-overlay">
                    {ARROW_MAP[ba]}
                  </motion.div>
                )}

                {/* Q-value overlay */}
                {showQValues && !isReplayMode && cq && !obs && !goalHere && (
                  <div className="q-vals-overlay">
                    <div className={`q-val q-val-up ${ba === 'up' ? 'best' : ''}`}>{cq.up ?? 0}</div>
                    <div className={`q-val q-val-left ${ba === 'left' ? 'best' : ''}`}>{cq.left ?? 0}</div>
                    <div className={`q-val q-val-right ${ba === 'right' ? 'best' : ''}`}>{cq.right ?? 0}</div>
                    <div className={`q-val q-val-down ${ba === 'down' ? 'best' : ''}`}>{cq.down ?? 0}</div>
                  </div>
                )}

                {/* Agent */}
                <AnimatePresence>
                  {agentHere && (
                    <motion.div
                      layoutId="agent"
                      transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                      className="agent-token"
                      style={{
                        background: isReplayMode ? '#ff8f00' : '#0066ff',
                        boxShadow: isReplayMode ? '0 4px 16px rgba(255,143,0,0.5)' : '0 4px 16px rgba(0,102,255,0.5)'
                      }}
                    >
                      <Bot size={cellSize > 64 ? 22 : 16} color="white" strokeWidth={2} />
                      <span style={{ fontSize: 8, fontWeight: 800, color: 'white', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>
                        {isReplayMode ? `S${replayStepIndex}` : 'Agent'}
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-5 flex-wrap justify-center">
        {[
          { color: '#0066ff', label: 'Agent', shadow: 'rgba(0,102,255,0.4)' },
          { color: '#00c853', label: 'Goal  +100', shadow: 'rgba(0,200,83,0.4)' },
          { color: '#ff1744', label: 'Obstacle', shadow: 'rgba(255,23,68,0.4)' },
          { color: '#ff6d00', label: 'Policy', shadow: null, isArrow: true },
        ].map(({ color, label, shadow, isArrow }) => (
          <div key={label} className="flex items-center gap-2">
            {isArrow
              ? <span style={{ fontSize: 16, color, fontWeight: 900 }}>→</span>
              : <span style={{ width: 12, height: 12, background: color, borderRadius: 4, boxShadow: shadow ? `0 0 8px ${shadow}` : undefined, display: 'inline-block' }} />}
            <span style={{ fontSize: 12, fontWeight: 500, color: '#6b6b6b' }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
