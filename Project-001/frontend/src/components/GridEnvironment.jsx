import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Flag, Bot, Ban, Flame, Waves, Snowflake, Orbit, History,
  ZoomIn, ZoomOut, RotateCcw, Maximize2, X
} from 'lucide-react';
import { playClickSound } from '../utils/sound';

// Clean Scalable SVG Directional Arrow
function PolicyArrowSvg({ direction, size, color = '#ff6d00' }) {
  const rotation = {
    up: 0,
    right: 90,
    down: 180,
    left: 270,
  }[direction] ?? 0;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        transform: `rotate(${rotation}deg)`,
        transformOrigin: 'center center',
        filter: 'drop-shadow(0px 1px 2px rgba(0,0,0,0.25))',
        display: 'block',
      }}
    >
      <path
        d="M12 2.5L20 11.5H14.5V21.5H9.5V11.5H4L12 2.5Z"
        fill={color}
      />
    </svg>
  );
}

export default function GridEnvironment({
  rows,
  cols,
  start,
  goal,
  obstacles = [],
  cliffs = [],
  mud = [],
  ice = [],
  portals = [],
  portalPairs = [],
  pendingPortalEntrance = null,
  onCancelPendingPortal,
  agentPosition,
  qTable,
  bestActions,
  stateValues = {},
  visitCounts = {},
  activeTool,
  onCellClick,
  selectedCell,
  showQValues,
  showPolicyArrows,
  showValueHeatmap = false,
  showVisitHeatmap = false,
  isTraining,
  replayPath = [],
  replayStepIndex = 0,
  isReplayMode = false,
}) {
  const [zoomScale, setZoomScale] = useState(1);
  const [hoveredCell, setHoveredCell] = useState(null);

  // Normalize portal pairs: each item is [r1, c1, r2, c2]
  const effectivePortalPairs = portalPairs.length > 0
    ? portalPairs
    : (Array.isArray(portals) && portals.length > 0 && Array.isArray(portals[0]) && portals[0].length >= 4
        ? portals
        : []);

  const agent = agentPosition || start;
  const isAgent = (r, c) => agent[0] === r && agent[1] === c;
  const isGoal = (r, c) => goal[0] === r && goal[1] === c;
  const isStart = (r, c) => start[0] === r && start[1] === c;
  const isObs = (r, c) => obstacles.some(([or, oc]) => or === r && oc === c);
  const isCliff = (r, c) => cliffs.some(([cr, cc]) => cr === r && cc === c);
  const isMud = (r, c) => mud.some(([mr, mc]) => mr === r && mc === c);
  const isIce = (r, c) => ice.some(([ir, ic]) => ir === r && ic === c);
  const isSel = (r, c) => selectedCell?.[0] === r && selectedCell?.[1] === c;

  // Adaptive base cell size for grids up to 20x20
  const maxDim = Math.max(rows, cols);
  let baseCellSize = 64;
  if (maxDim <= 4) baseCellSize = 74;
  else if (maxDim <= 6) baseCellSize = 60;
  else if (maxDim <= 8) baseCellSize = 50;
  else if (maxDim <= 10) baseCellSize = 44;
  else if (maxDim <= 13) baseCellSize = 36;
  else if (maxDim <= 16) baseCellSize = 31;
  else baseCellSize = 27; // for 17-20

  const effectiveCellSize = Math.round(baseCellSize * zoomScale);

  // Proportional icon and arrow sizing
  const arrowSize = Math.max(10, Math.min(26, Math.round(effectiveCellSize * 0.42)));
  const iconSize = Math.max(12, Math.min(26, Math.round(effectiveCellSize * 0.46)));

  // Heatmap min/max calculations
  const valuesArray = Object.values(stateValues || {});
  const maxStateVal = valuesArray.length ? Math.max(...valuesArray, 1) : 1;
  const minStateVal = valuesArray.length ? Math.min(...valuesArray, 0) : 0;
  const valRange = maxStateVal - minStateVal || 1;

  const visitsArray = Object.values(visitCounts || {});
  const maxVisits = visitsArray.length ? Math.max(...visitsArray, 1) : 1;

  const handleZoom = (delta) => {
    playClickSound();
    setZoomScale((prev) => Math.max(0.6, Math.min(2.5, +(prev + delta).toFixed(2))));
  };

  const handleResetZoom = () => {
    playClickSound();
    setZoomScale(1);
  };

  return (
    <div className="flex flex-col items-center gap-3 w-full max-w-full select-none">
      {/* Top Grid Toolbar: Replay Badge + Zoom Controls */}
      <div className="flex items-center justify-between w-full max-w-4xl px-2">
        <div className="flex items-center gap-2">
          {isReplayMode ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200"
            >
              <History size={13} className="text-amber-600 animate-spin" style={{ animationDuration: '6s' }} />
              <span>Replay: Step {replayStepIndex} / {Math.max(0, replayPath.length - 1)}</span>
            </motion.div>
          ) : (
            <div className="text-xs font-mono text-neutral-500 font-medium">
              Grid: <strong className="text-neutral-800">{rows}×{cols}</strong> ({rows * cols} states)
            </div>
          )}
        </div>

        {/* Zoom & Fit Controller */}
        <div className="flex items-center gap-1.5 bg-white border border-neutral-200 rounded-xl p-1 shadow-sm text-xs">
          <button
            onClick={() => handleZoom(-0.15)}
            title="Zoom Out"
            className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-600 hover:text-black transition-colors cursor-pointer"
          >
            <ZoomOut size={14} />
          </button>
          <button
            onClick={handleResetZoom}
            title="Reset Zoom"
            className="px-2 py-0.5 rounded-lg font-mono text-[11px] font-semibold text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer"
          >
            {Math.round(zoomScale * 100)}%
          </button>
          <button
            onClick={() => handleZoom(0.15)}
            title="Zoom In"
            className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-600 hover:text-black transition-colors cursor-pointer"
          >
            <ZoomIn size={14} />
          </button>
        </div>
      </div>

      {/* PENDING PORTAL INSTRUCTION BANNER */}
      {pendingPortalEntrance && (
        <motion.div
          initial={{ opacity: 0, y: -6, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-purple-600 text-white shadow-lg text-xs font-semibold"
        >
          <Orbit size={16} className="animate-spin text-purple-200" style={{ animationDuration: '3s' }} />
          <span>
            Portal Entrance set at <strong>[{pendingPortalEntrance[0]}, {pendingPortalEntrance[1]}]</strong>. Click any cell to place the <strong>EXIT</strong> portal!
          </span>
          {onCancelPendingPortal && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCancelPendingPortal();
              }}
              className="ml-2 px-2.5 py-0.5 rounded-lg bg-white/20 hover:bg-white/30 text-white text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1"
            >
              <X size={12} />
              <span>Cancel</span>
            </button>
          )}
        </motion.div>
      )}

      {/* Main Grid Scroll Area */}
      <div
        className="w-full flex justify-center items-center overflow-auto p-4 md:p-6 rounded-2xl bg-white border border-neutral-200 shadow-inner"
        style={{
          maxHeight: 'calc(100vh - 240px)',
          minHeight: '340px',
        }}
      >
        <div
          className="rl-grid relative transition-transform duration-100"
          style={{
            gridTemplateColumns: `repeat(${cols}, ${effectiveCellSize}px)`,
            gridTemplateRows: `repeat(${rows}, ${effectiveCellSize}px)`,
            gap: Math.max(3, Math.min(6, Math.round(effectiveCellSize * 0.08))),
            padding: Math.max(4, Math.round(effectiveCellSize * 0.08)),
          }}
        >
          {Array.from({ length: rows }, (_, r) =>
            Array.from({ length: cols }, (_, c) => {
              const key = `${r},${c}`;
              const obs = isObs(r, c);
              const cliff = isCliff(r, c);
              const mudTile = isMud(r, c);
              const iceTile = isIce(r, c);

              // Portal detection
              const entIdx = effectivePortalPairs.findIndex(([r1, c1]) => r1 === r && c1 === c);
              const exitIdx = effectivePortalPairs.findIndex(([, , r2, c2]) => r2 === r && c2 === c);
              const isPending = Boolean(pendingPortalEntrance && pendingPortalEntrance[0] === r && pendingPortalEntrance[1] === c);
              const isPortalTile = entIdx !== -1 || exitIdx !== -1 || isPending;

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

              // Determine best Q-value for compact display
              let maxQVal = null;
              if (cq) {
                const vals = [cq.up, cq.down, cq.left, cq.right].filter((v) => typeof v === 'number');
                if (vals.length > 0) maxQVal = Math.max(...vals);
              }

              return (
                <div
                  key={key}
                  onClick={() => {
                    playClickSound();
                    onCellClick(r, c);
                  }}
                  onMouseEnter={() =>
                    setHoveredCell({
                      r, c, q: cq, ba, obs, cliff, mudTile, iceTile,
                      entIdx, exitIdx, isPending,
                      dest: entIdx !== -1 ? [effectivePortalPairs[entIdx][2], effectivePortalPairs[entIdx][3]] : null,
                      origin: exitIdx !== -1 ? [effectivePortalPairs[exitIdx][0], effectivePortalPairs[exitIdx][1]] : null,
                      goalHere, startHere,
                    })
                  }
                  onMouseLeave={() => setHoveredCell(null)}
                  className={`rl-cell relative select-none
                    ${sel ? 'selected' : ''}
                    ${obs ? 'is-obstacle' : ''}
                    ${cliff ? 'is-cliff' : ''}
                    ${mudTile ? 'is-mud' : ''}
                    ${iceTile ? 'is-ice' : ''}
                    ${isPending ? 'ring-4 ring-purple-500 bg-purple-100 shadow-lg' : ''}
                    ${entIdx !== -1 ? 'is-portal' : ''}
                    ${exitIdx !== -1 ? 'is-portal-exit' : ''}
                    ${goalHere && !obs ? 'is-goal' : ''}
                    ${startHere && !obs && !goalHere ? 'is-start' : ''}
                    ${inReplay && !obs ? 'ring-2 ring-amber-300' : ''}
                  `}
                  style={{
                    width: effectiveCellSize,
                    height: effectiveCellSize,
                    backgroundColor: heatBg || undefined,
                  }}
                >
                  {/* Coordinate tag (shows whenever cell is at least 34px) */}
                  {effectiveCellSize >= 34 && (
                    <span
                      style={{
                        position: 'absolute',
                        top: 2,
                        left: 3,
                        fontSize: Math.max(7, Math.round(effectiveCellSize * 0.16)),
                        fontFamily: 'JetBrains Mono',
                        fontWeight: 600,
                        color: '#999',
                        zIndex: 1,
                        lineHeight: 1,
                      }}
                    >
                      {r},{c}
                    </span>
                  )}

                  {/* Wall */}
                  {obs && (
                    <div className="flex flex-col items-center justify-center">
                      <Ban size={iconSize} color="#ff1744" strokeWidth={2.4} />
                      {effectiveCellSize >= 50 && (
                        <span style={{ fontSize: 7, fontWeight: 800, color: '#ff1744', textTransform: 'uppercase', marginTop: 1 }}>
                          Wall
                        </span>
                      )}
                    </div>
                  )}

                  {/* Cliff */}
                  {cliff && !obs && (
                    <div className="flex flex-col items-center justify-center">
                      <Flame size={iconSize} color="#e65100" strokeWidth={2.4} />
                      {effectiveCellSize >= 50 && (
                        <span style={{ fontSize: 7, fontWeight: 800, color: '#e65100', textTransform: 'uppercase', marginTop: 1 }}>
                          Cliff
                        </span>
                      )}
                    </div>
                  )}

                  {/* Mud */}
                  {mudTile && !obs && !cliff && (
                    <div className="flex flex-col items-center justify-center">
                      <Waves size={iconSize} color="#8d6e63" strokeWidth={2.2} />
                      {effectiveCellSize >= 50 && (
                        <span style={{ fontSize: 7, fontWeight: 800, color: '#8d6e63', textTransform: 'uppercase', marginTop: 1 }}>
                          Mud
                        </span>
                      )}
                    </div>
                  )}

                  {/* Ice */}
                  {iceTile && !obs && !cliff && (
                    <div className="flex flex-col items-center justify-center">
                      <Snowflake size={iconSize} color="#00838f" strokeWidth={2.2} />
                      {effectiveCellSize >= 50 && (
                        <span style={{ fontSize: 7, fontWeight: 800, color: '#00838f', textTransform: 'uppercase', marginTop: 1 }}>
                          Ice
                        </span>
                      )}
                    </div>
                  )}

                  {/* PENDING PORTAL ENTRANCE (Pulsing wait) */}
                  {isPending && !obs && !cliff && (
                    <div className="flex flex-col items-center justify-center animate-pulse">
                      <Orbit size={iconSize} color="#9c27b0" className="animate-spin" style={{ animationDuration: '3s' }} />
                      <span style={{ fontSize: Math.max(7, Math.round(effectiveCellSize * 0.17)), fontWeight: 900, color: '#9c27b0', textTransform: 'uppercase', marginTop: 1 }}>
                        IN (Pick Exit)
                      </span>
                    </div>
                  )}

                  {/* PORTAL ENTRANCE */}
                  {entIdx !== -1 && !isPending && !obs && !cliff && (
                    <div className="flex flex-col items-center justify-center">
                      <Orbit size={iconSize} color="#6a1b9a" strokeWidth={2.4} />
                      <span style={{ fontSize: Math.max(7, Math.round(effectiveCellSize * 0.17)), fontWeight: 800, color: '#6a1b9a', textTransform: 'uppercase', marginTop: 1 }}>
                        {effectiveCellSize >= 48 ? `IN #${entIdx + 1}` : 'IN'}
                      </span>
                    </div>
                  )}

                  {/* PORTAL EXIT */}
                  {exitIdx !== -1 && !isPending && !obs && !cliff && (
                    <div className="flex flex-col items-center justify-center">
                      <Orbit size={iconSize} color="#8e24aa" strokeWidth={2.2} />
                      <span style={{ fontSize: Math.max(7, Math.round(effectiveCellSize * 0.17)), fontWeight: 800, color: '#8e24aa', textTransform: 'uppercase', marginTop: 1 }}>
                        {effectiveCellSize >= 48 ? `OUT #${exitIdx + 1}` : 'OUT'}
                      </span>
                    </div>
                  )}

                  {/* Goal */}
                  {goalHere && !obs && !cliff && (
                    <div className="flex flex-col items-center justify-center">
                      <Flag size={iconSize} color="#00c853" strokeWidth={2.4} />
                      {effectiveCellSize >= 50 && (
                        <span style={{ fontSize: 7, fontWeight: 800, color: '#00c853', textTransform: 'uppercase', marginTop: 1 }}>
                          Goal
                        </span>
                      )}
                    </div>
                  )}

                  {/* Start tag */}
                  {startHere && !agentHere && !obs && !goalHere && !cliff && (
                    <span
                      style={{
                        fontSize: Math.max(7, Math.round(effectiveCellSize * 0.18)),
                        fontWeight: 800,
                        color: '#0066ff',
                        opacity: 0.7,
                        textTransform: 'uppercase',
                      }}
                    >
                      Start
                    </span>
                  )}

                  {/* Scalable Policy Vector Arrow */}
                  {showPolicyArrows && !isReplayMode && ba && !obs && !cliff && !goalHere && !agentHere && (
                    <div className="policy-overlay pointer-events-none">
                      <PolicyArrowSvg direction={ba} size={arrowSize} color="#ff6d00" />
                    </div>
                  )}

                  {/* Q-Values Layout 1: 4-Way Directions (When cell size >= 48px) */}
                  {showQValues && !isReplayMode && cq && !obs && !cliff && !goalHere && effectiveCellSize >= 48 && (
                    <div className="q-vals-overlay">
                      <div className={`q-val q-val-up ${ba === 'up' ? 'best' : ''}`}>{cq.up ?? 0}</div>
                      <div className={`q-val q-val-left ${ba === 'left' ? 'best' : ''}`}>{cq.left ?? 0}</div>
                      <div className={`q-val q-val-right ${ba === 'right' ? 'best' : ''}`}>{cq.right ?? 0}</div>
                      <div className={`q-val q-val-down ${ba === 'down' ? 'best' : ''}`}>{cq.down ?? 0}</div>
                    </div>
                  )}

                  {/* Q-Values Layout 2: Center Max Q (When 24px <= cell size < 48px, when arrows are off) */}
                  {showQValues && !showPolicyArrows && !isReplayMode && maxQVal !== null && !obs && !cliff && !goalHere && effectiveCellSize < 48 && effectiveCellSize >= 24 && (
                    <div
                      className="absolute inset-0 flex items-center justify-center font-mono font-bold pointer-events-none"
                      style={{
                        fontSize: Math.max(7, Math.round(effectiveCellSize * 0.24)),
                        color: maxQVal > 0 ? '#00a844' : maxQVal < 0 ? '#cc0000' : '#888',
                      }}
                    >
                      {maxQVal > 0 ? `+${maxQVal}` : maxQVal}
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
                          inset: Math.max(2, Math.round(effectiveCellSize * 0.08)),
                          background: isReplayMode ? '#ff8f00' : '#0066ff',
                          boxShadow: isReplayMode ? '0 2px 10px rgba(255,143,0,0.5)' : '0 2px 10px rgba(0,102,255,0.5)',
                        }}
                      >
                        <Bot size={Math.max(10, Math.round(effectiveCellSize * 0.44))} color="white" strokeWidth={2} />
                        {effectiveCellSize >= 44 && (
                          <span style={{ fontSize: 7, fontWeight: 800, color: 'white', textTransform: 'uppercase', marginTop: 1 }}>
                            {isReplayMode ? `S${replayStepIndex}` : 'Agent'}
                          </span>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Floating Magnified Cell Tooltip (Shows full 4 Q-values & cell info regardless of grid size) */}
      {hoveredCell && (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4 px-4 py-2 bg-neutral-900 text-white rounded-xl shadow-xl text-xs font-mono border border-neutral-700 flex-wrap"
        >
          <div className="flex items-center gap-2 border-r border-neutral-700 pr-3">
            <span className="text-neutral-400 font-sans font-bold">Cell:</span>
            <span className="text-white font-bold">[{hoveredCell.r}, {hoveredCell.c}]</span>
          </div>

          {hoveredCell.q && !hoveredCell.obs && (
            <div className="flex items-center gap-3">
              <span className={hoveredCell.ba === 'up' ? 'text-green-400 font-bold' : 'text-neutral-400'}>
                ↑ {hoveredCell.q.up ?? 0}
              </span>
              <span className={hoveredCell.ba === 'down' ? 'text-green-400 font-bold' : 'text-neutral-400'}>
                ↓ {hoveredCell.q.down ?? 0}
              </span>
              <span className={hoveredCell.ba === 'left' ? 'text-green-400 font-bold' : 'text-neutral-400'}>
                ← {hoveredCell.q.left ?? 0}
              </span>
              <span className={hoveredCell.ba === 'right' ? 'text-green-400 font-bold' : 'text-neutral-400'}>
                → {hoveredCell.q.right ?? 0}
              </span>
            </div>
          )}

          {/* Portal Information in Tooltip */}
          {hoveredCell.entIdx !== -1 && hoveredCell.dest && (
            <div className="border-l border-neutral-700 pl-3 text-purple-400 font-sans font-bold">
              🌀 Portal #{hoveredCell.entIdx + 1} ENTRANCE → Warps to [{hoveredCell.dest[0]}, {hoveredCell.dest[1]}]
            </div>
          )}

          {hoveredCell.exitIdx !== -1 && hoveredCell.origin && (
            <div className="border-l border-neutral-700 pl-3 text-purple-300 font-sans font-bold">
              🌀 Portal #{hoveredCell.exitIdx + 1} EXIT (from [{hoveredCell.origin[0]}, {hoveredCell.origin[1]}])
            </div>
          )}

          {hoveredCell.isPending && (
            <div className="border-l border-neutral-700 pl-3 text-purple-300 font-sans font-bold animate-pulse">
              🌀 Entrance Chosen (Click another cell to set EXIT)
            </div>
          )}

          {hoveredCell.ba && !hoveredCell.obs && (
            <div className="border-l border-neutral-700 pl-3 flex items-center gap-1.5 text-amber-400 font-sans font-bold">
              <span>Best:</span>
              <span className="uppercase text-white font-mono bg-amber-500/20 px-1.5 py-0.5 rounded">
                {hoveredCell.ba}
              </span>
            </div>
          )}
        </motion.div>
      )}

      {/* Grid Legend Bar */}
      <div className="flex items-center gap-3 flex-wrap justify-center pt-1 text-xs">
        {[
          { color: '#0066ff', label: 'Agent', shadow: 'rgba(0,102,255,0.4)' },
          { color: '#00c853', label: 'Goal (+100)', shadow: 'rgba(0,200,83,0.4)' },
          { color: '#ff1744', label: 'Wall', shadow: 'rgba(255,23,68,0.4)' },
          { color: '#e65100', label: 'Cliff (-50)', shadow: 'rgba(230,81,0,0.4)' },
          { color: '#8d6e63', label: 'Mud (-5)', shadow: null },
          { color: '#00bcd4', label: 'Ice (Slip)', shadow: null },
          { color: '#6a1b9a', label: 'Portal IN', shadow: 'rgba(106,27,154,0.3)' },
          { color: '#8e24aa', label: 'Portal OUT', shadow: null },
          { color: '#ff6d00', label: 'Policy Vector', isArrow: true },
        ].map(({ color, label, shadow, isArrow }) => (
          <div key={label} className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-lg border border-neutral-200 shadow-2xs">
            {isArrow ? (
              <span style={{ fontSize: 13, color, fontWeight: 900, lineHeight: 1 }}>→</span>
            ) : (
              <span
                style={{
                  width: 9,
                  height: 9,
                  background: color,
                  borderRadius: 3,
                  boxShadow: shadow ? `0 0 5px ${shadow}` : undefined,
                  display: 'inline-block',
                }}
              />
            )}
            <span style={{ fontSize: 11, fontWeight: 600, color: '#444' }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
