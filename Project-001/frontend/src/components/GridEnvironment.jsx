import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flag, Bot, Ban, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, History, Flame, Waves, Snowflake, Orbit } from 'lucide-react';

export default function GridEnvironment({
  rows, cols, start, goal,
  obstacles = [], cliffs = [], mud = [], ice = [], portals = [],
  pendingPortalEntry = null,
  agentPosition, qTable, bestActions, stateValues = {}, visitCounts = {},
  activeTool, onCellClick, selectedCell,
  showQValues, showPolicyArrows, showValueHeatmap = false, showVisitHeatmap = false,
  isTraining, replayPath = [], replayStepIndex = 0, isReplayMode = false,
}) {
  const agent = agentPosition || start;
  const isAgent = (r, c) => agent[0] === r && agent[1] === c;
  const isGoal = (r, c) => goal[0] === r && goal[1] === c;
  const isStart = (r, c) => start[0] === r && start[1] === c;
  const isObs = (r, c) => obstacles.some(([or, oc]) => or === r && oc === c);
  const isCliff = (r, c) => cliffs.some(([cr, cc]) => cr === r && cc === c);
  const isMud = (r, c) => mud.some(([mr, mc]) => mr === r && mc === c);
  const isIce = (r, c) => ice.some(([ir, ic]) => ir === r && ic === c);
  const isSel = (r, c) => selectedCell?.[0] === r && selectedCell?.[1] === c;

  const isPendingEntry = (r, c) =>
    pendingPortalEntry && pendingPortalEntry[0] === r && pendingPortalEntry[1] === c;

  const getPortalInfo = (r, c) => {
    if (isPendingEntry(r, c)) {
      return { isPortal: true, isPending: true, isEntry: true, isExit: false, index: -1 };
    }
    for (let i = 0; i < portals.length; i++) {
      const p = portals[i];
      if (p.length >= 4) {
        if (p[0] === r && p[1] === c) {
          return { isPortal: true, isPending: false, isEntry: true, isExit: false, index: i, target: [p[2], p[3]] };
        }
        if (p[2] === r && p[3] === c) {
          return { isPortal: true, isPending: false, isEntry: false, isExit: true, index: i, target: [p[0], p[1]] };
        }
      } else if (p.length === 2) {
        if (p[0] === r && p[1] === c) {
          return { isPortal: true, isPending: false, isEntry: true, isExit: false, index: i };
        }
      }
    }
    return { isPortal: false, isPending: false, isEntry: false, isExit: false, index: -1 };
  };

  // Responsive cell sizing for 3x3 up to 20x20
  const maxDim = Math.max(rows, cols);
  let cellSize = 64;
  if (maxDim <= 4) cellSize = 76;
  else if (maxDim <= 6) cellSize = 62;
  else if (maxDim <= 8) cellSize = 50;
  else if (maxDim <= 10) cellSize = 42;
  else if (maxDim <= 13) cellSize = 33;
  else if (maxDim <= 16) cellSize = 27;
  else cellSize = 23;

  // Heatmap min/max calculations
  const valuesArray = Object.values(stateValues || {});
  const maxStateVal = valuesArray.length ? Math.max(...valuesArray, 1) : 1;
  const minStateVal = valuesArray.length ? Math.min(...valuesArray, 0) : 0;
  const valRange = maxStateVal - minStateVal || 1;

  const visitsArray = Object.values(visitCounts || {});
  const maxVisits = visitsArray.length ? Math.max(...visitsArray, 1) : 1;

  const arrowSize = Math.max(10, Math.min(18, Math.round(cellSize * 0.32)));
  const iconSize = Math.max(11, Math.min(24, Math.round(cellSize * 0.42)));

  const ARROW_MAP = {
    up: <ArrowUp size={arrowSize} color="#ff6d00" strokeWidth={2.8} />,
    down: <ArrowDown size={arrowSize} color="#ff6d00" strokeWidth={2.8} />,
    left: <ArrowLeft size={arrowSize} color="#ff6d00" strokeWidth={2.8} />,
    right: <ArrowRight size={arrowSize} color="#ff6d00" strokeWidth={2.8} />,
  };

  return (
    <div className="flex flex-col items-center gap-4 w-full">
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
          maxWidth: '100%',
          overflowX: 'auto',
        }}
      >
        {Array.from({ length: rows }, (_, r) =>
          Array.from({ length: cols }, (_, c) => {
            const key = `${r},${c}`;
            const obs = isObs(r, c);
            const cliff = isCliff(r, c);
            const mudTile = isMud(r, c);
            const iceTile = isIce(r, c);
            const pInfo = getPortalInfo(r, c);
            const goalHere = isGoal(r, c);
            const startHere = isStart(r, c);
            const agentHere = isAgent(r, c);
            const sel = isSel(r, c);
            const cq = qTable?.[key];
            const ba = bestActions?.[key];
            const inReplay = isReplayMode && replayPath.some((p) => p[0] === r && p[1] === c);

            // Heatmap background calculation
            let heatBg = undefined;
            if (showValueHeatmap && !obs && !cliff && stateValues[key] !== undefined) {
              const norm = Math.max(0, Math.min(1, (stateValues[key] - minStateVal) / valRange));
              heatBg = `rgba(0, 200, 83, ${norm * 0.45})`;
            } else if (showVisitHeatmap && !obs && visitCounts[key]) {
              const norm = Math.min(1, visitCounts[key] / maxVisits);
              heatBg = `rgba(106, 27, 154, ${norm * 0.45})`;
            }

            return (
              <motion.div
                key={key}
                onClick={() => onCellClick(r, c)}
                whileHover={{ scale: isTraining ? 1 : 1.05 }}
                whileTap={{ scale: 0.96 }}
                className={`rl-cell
                  ${sel ? 'selected' : ''}
                  ${obs ? 'is-obstacle' : ''}
                  ${cliff ? 'is-cliff' : ''}
                  ${mudTile ? 'is-mud' : ''}
                  ${iceTile ? 'is-ice' : ''}
                  ${pInfo.isPortal ? 'is-portal' : ''}
                  ${pInfo.isPending ? 'is-portal-pending' : ''}
                  ${goalHere && !obs ? 'is-goal' : ''}
                  ${startHere && !obs && !goalHere ? 'is-start' : ''}
                  ${inReplay && !obs ? 'ring-2 ring-amber-300' : ''}
                `}
                style={{
                  width: cellSize,
                  height: cellSize,
                  backgroundColor: heatBg || undefined,
                }}
              >
                {/* Coordinates (only if cell is large enough) */}
                {cellSize >= 38 && (
                  <span style={{
                    position: 'absolute', top: 2, left: 4,
                    fontSize: 8, fontFamily: 'JetBrains Mono', fontWeight: 600, color: '#bbb',
                    zIndex: 1, userSelect: 'none'
                  }}>
                    {r},{c}
                  </span>
                )}

                {/* Wall */}
                {obs && (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                    className="flex flex-col items-center gap-0.5">
                    <Ban size={iconSize} color="#ff1744" strokeWidth={2.2} />
                    {cellSize >= 54 && (
                      <span style={{ fontSize: 8, fontWeight: 800, color: '#ff1744', textTransform: 'uppercase' }}>Wall</span>
                    )}
                  </motion.div>
                )}

                {/* Cliff / Lava */}
                {cliff && !obs && (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                    className="flex flex-col items-center gap-0.5">
                    <Flame size={iconSize} color="#e65100" strokeWidth={2.4} />
                    {cellSize >= 54 && (
                      <span style={{ fontSize: 8, fontWeight: 800, color: '#e65100', textTransform: 'uppercase' }}>Cliff</span>
                    )}
                  </motion.div>
                )}

                {/* Mud / Swamp */}
                {mudTile && !obs && !cliff && (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                    className="flex flex-col items-center gap-0.5">
                    <Waves size={iconSize} color="#8d6e63" strokeWidth={2.2} />
                    {cellSize >= 54 && (
                      <span style={{ fontSize: 8, fontWeight: 800, color: '#8d6e63', textTransform: 'uppercase' }}>Mud</span>
                    )}
                  </motion.div>
                )}

                {/* Ice / Slippery */}
                {iceTile && !obs && !cliff && (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                    className="flex flex-col items-center gap-0.5">
                    <Snowflake size={iconSize} color="#00bcd4" strokeWidth={2.2} />
                    {cellSize >= 54 && (
                      <span style={{ fontSize: 8, fontWeight: 800, color: '#00838f', textTransform: 'uppercase' }}>Ice</span>
                    )}
                  </motion.div>
                )}

                {/* Portal / Wormhole */}
                {pInfo.isPortal && !obs && !cliff && (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                    className="flex flex-col items-center gap-0.5">
                    <Orbit
                      size={iconSize}
                      color={pInfo.isPending ? '#8e24aa' : '#ab47bc'}
                      strokeWidth={2.2}
                      className={pInfo.isPending ? 'animate-spin' : ''}
                      style={pInfo.isPending ? { animationDuration: '3s' } : undefined}
                    />
                    {cellSize >= 54 && (
                      <span style={{ fontSize: 8, fontWeight: 800, color: '#6a1b9a', textTransform: 'uppercase', letterSpacing: '-0.02em' }}>
                        {pInfo.isPending
                          ? 'IN...'
                          : pInfo.isEntry
                            ? (portals.length > 1 ? `IN #${pInfo.index + 1}` : 'PORTAL IN')
                            : (portals.length > 1 ? `OUT #${pInfo.index + 1}` : 'PORTAL OUT')}
                      </span>
                    )}
                    {cellSize < 54 && cellSize >= 32 && (
                      <span style={{ fontSize: 7, fontWeight: 800, color: '#6a1b9a', textTransform: 'uppercase' }}>
                        {pInfo.isPending ? 'IN...' : pInfo.isEntry ? 'IN' : 'OUT'}
                      </span>
                    )}
                  </motion.div>
                )}

                {/* Goal */}
                {goalHere && !obs && !cliff && (
                  <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 2 }}
                    className="flex flex-col items-center gap-0.5">
                    <Flag size={iconSize} color="#00c853" strokeWidth={2.4} />
                    {cellSize >= 54 && (
                      <span style={{ fontSize: 8, fontWeight: 800, color: '#00c853', textTransform: 'uppercase' }}>Goal</span>
                    )}
                  </motion.div>
                )}

                {/* Start label when agent is elsewhere */}
                {startHere && !agentHere && !obs && !goalHere && !cliff && (
                  <span style={{ fontSize: Math.max(8, cellSize * 0.16), fontWeight: 700, color: '#0066ff', opacity: 0.6, textTransform: 'uppercase' }}>
                    Start
                  </span>
                )}

                {/* Policy Arrow */}
                {showPolicyArrows && !isReplayMode && ba && !obs && !cliff && !goalHere && !agentHere && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="policy-overlay">
                    {ARROW_MAP[ba]}
                  </motion.div>
                )}

                {/* Q-value overlay (only when cell size >= 52) */}
                {showQValues && !isReplayMode && cq && !obs && !cliff && !goalHere && cellSize >= 52 && (
                  <div className="q-vals-overlay">
                    <div className={`q-val q-val-up ${ba === 'up' ? 'best' : ''}`}>{cq.up ?? 0}</div>
                    <div className={`q-val q-val-left ${ba === 'left' ? 'best' : ''}`}>{cq.left ?? 0}</div>
                    <div className={`q-val q-val-right ${ba === 'right' ? 'best' : ''}`}>{cq.right ?? 0}</div>
                    <div className={`q-val q-val-down ${ba === 'down' ? 'best' : ''}`}>{cq.down ?? 0}</div>
                  </div>
                )}

                {/* Agent Token */}
                <AnimatePresence>
                  {agentHere && (
                    <motion.div
                      layoutId="agent"
                      transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                      className="agent-token"
                      style={{
                        inset: Math.max(2, Math.round(cellSize * 0.08)),
                        background: isReplayMode ? '#ff8f00' : '#0066ff',
                        boxShadow: isReplayMode ? '0 2px 10px rgba(255,143,0,0.5)' : '0 2px 10px rgba(0,102,255,0.5)'
                      }}
                    >
                      <Bot size={Math.max(10, Math.round(cellSize * 0.44))} color="white" strokeWidth={2} />
                      {cellSize >= 44 && (
                        <span style={{ fontSize: 7, fontWeight: 800, color: 'white', textTransform: 'uppercase', marginTop: 1 }}>
                          {isReplayMode ? `S${replayStepIndex}` : 'Agent'}
                        </span>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Grid Legend */}
      <div className="flex items-center gap-4 flex-wrap justify-center pt-1 text-xs">
        {[
          { color: '#0066ff', label: 'Agent', shadow: 'rgba(0,102,255,0.4)' },
          { color: '#00c853', label: 'Goal (+100)', shadow: 'rgba(0,200,83,0.4)' },
          { color: '#ff1744', label: 'Wall', shadow: 'rgba(255,23,68,0.4)' },
          { color: '#e65100', label: 'Cliff (-50)', shadow: 'rgba(230,81,0,0.4)' },
          { color: '#8d6e63', label: 'Mud (-5)', shadow: null },
          { color: '#00bcd4', label: 'Ice (Slip)', shadow: null },
          { color: '#ab47bc', label: 'Portal', shadow: null },
          { color: '#ff6d00', label: 'Policy', isArrow: true },
        ].map(({ color, label, shadow, isArrow }) => (
          <div key={label} className="flex items-center gap-1.5">
            {isArrow
              ? <span style={{ fontSize: 14, color, fontWeight: 900 }}>→</span>
              : <span style={{ width: 10, height: 10, background: color, borderRadius: 3, boxShadow: shadow ? `0 0 6px ${shadow}` : undefined, display: 'inline-block' }} />}
            <span style={{ fontSize: 11, fontWeight: 500, color: '#6b6b6b' }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
