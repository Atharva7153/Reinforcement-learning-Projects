import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flag, Bot, Ban, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, History, Flame, Waves, Snowflake, Orbit, Play, Pause, SkipBack, SkipForward, X, KeyRound, DoorClosed, DoorOpen } from 'lucide-react';

export default function GridEnvironment({
  rows, cols, start, goal,
  obstacles = [], cliffs = [], mud = [], ice = [], portals = [],
  doors = [], pendingDoor = null, currentKeyMask = 0,
  policyKeyView = 0, onTogglePolicyKeyView = null,
  pendingPortalEntry = null,
  agentPosition, qTable, bestActions, stateValues = {}, visitCounts = {},
  activeTool, onCellClick, selectedCell,
  showQValues, showPolicyArrows, showValueHeatmap = false, showVisitHeatmap = false,
  isTraining, replayPath = [], replayStepIndex = 0, isReplayMode = false,
  selectedReplayEpisode = null,
  isReplayPlaying = false,
  onToggleReplayPlay = null,
  onReplayStepChange = null,
  onExitReplay = null,
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

  const isPendingDoorCell = (r, c) =>
    pendingDoor && pendingDoor[0] === r && pendingDoor[1] === c;

  const getDoorInfo = (r, c) => {
    if (isPendingDoorCell(r, c)) {
      return { isDoor: true, isPending: true, isKey: false, index: -1 };
    }
    for (let i = 0; i < doors.length; i++) {
      const d = doors[i];
      if (d.length >= 4) {
        if (d[0] === r && d[1] === c) {
          const isUnlocked = Boolean(currentKeyMask & (1 << i));
          return { isDoor: true, isPending: false, isKey: false, index: i, target: [d[2], d[3]], isUnlocked };
        }
        if (d[2] === r && d[3] === c) {
          const isCollected = Boolean(currentKeyMask & (1 << i));
          return { isDoor: false, isPending: false, isKey: true, index: i, target: [d[0], d[1]], isCollected };
        }
      }
    }
    return { isDoor: false, isPending: false, isKey: false, index: -1 };
  };

  // Responsive measurement for mobile screens
  const [screenWidth, setScreenWidth] = React.useState(
    typeof window !== 'undefined' ? window.innerWidth : 800
  );

  React.useEffect(() => {
    const onResize = () => setScreenWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Responsive cell sizing for 3x3 up to 20x20
  const maxDim = Math.max(rows, cols);
  let baseCellSize = 64;
  if (maxDim <= 4) baseCellSize = 76;
  else if (maxDim <= 6) baseCellSize = 62;
  else if (maxDim <= 8) baseCellSize = 50;
  else if (maxDim <= 10) baseCellSize = 42;
  else if (maxDim <= 13) baseCellSize = 33;
  else if (maxDim <= 16) baseCellSize = 27;
  else baseCellSize = 23;

  // On small mobile screens, adapt cell size so grids up to 8x8 fit directly in the viewport
  const availWidth = Math.max(260, screenWidth - 64);
  const maxCellForScreen = Math.floor((availWidth - (cols - 1) * 5 - 12) / cols);
  const cellSize = Math.max(22, Math.min(baseCellSize, Math.max(24, maxCellForScreen)));

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
    <div className="flex flex-col items-center gap-3 w-full">
      {/* Replay Banner */}
      {isReplayMode && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '7px 14px',
            borderRadius: 10,
            background: 'white',
            border: '1.5px solid #ffd990',
            boxShadow: '0 2px 8px rgba(179,92,0,0.08)',
            width: '100%',
            maxWidth: 560,
          }}
        >
          {/* Episode Badge & Steps */}
          <div className="flex items-center gap-2">
            <span
              style={{
                fontFamily: 'JetBrains Mono',
                fontSize: 11,
                fontWeight: 800,
                color: '#b35c00',
                background: '#fff3e0',
                padding: '2px 8px',
                borderRadius: 6,
                border: '1px solid #ffd59e',
              }}
            >
              Ep {selectedReplayEpisode}
            </span>
            <span style={{ fontSize: 11, color: '#6b6b6b', fontWeight: 600 }}>
              Step {replayStepIndex} / {Math.max(0, replayPath.length - 1)}
            </span>
          </div>

          {/* Player controls */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onReplayStepChange && onReplayStepChange(Math.max(0, replayStepIndex - 1))}
              disabled={replayStepIndex <= 0}
              className="btn btn-white"
              style={{ padding: '3px 7px', minWidth: 'auto', opacity: replayStepIndex <= 0 ? 0.4 : 1 }}
              title="Previous Step"
            >
              <SkipBack size={12} />
            </button>

            <button
              type="button"
              onClick={onToggleReplayPlay}
              className="btn btn-amber"
              style={{ padding: '3px 9px', minWidth: 'auto' }}
              title={isReplayPlaying ? 'Pause Replay' : 'Play Replay'}
            >
              {isReplayPlaying ? <Pause size={12} fill="white" /> : <Play size={12} fill="white" />}
            </button>

            <button
              type="button"
              onClick={() => onReplayStepChange && onReplayStepChange(Math.min(replayPath.length - 1, replayStepIndex + 1))}
              disabled={replayStepIndex >= replayPath.length - 1}
              className="btn btn-white"
              style={{ padding: '3px 7px', minWidth: 'auto', opacity: replayStepIndex >= replayPath.length - 1 ? 0.4 : 1 }}
              title="Next Step"
            >
              <SkipForward size={12} />
            </button>

            <button
              type="button"
              onClick={onExitReplay}
              className="btn btn-white"
              style={{ padding: '3px 7px', minWidth: 'auto', color: '#888', marginLeft: 4 }}
              title="Exit Replay"
            >
              <X size={12} />
            </button>
          </div>
        </motion.div>
      )}

      {/* Door & Key Policy View Selector (if doors are configured) */}
      {doors.length > 0 && !isReplayMode && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            maxWidth: 560,
            padding: '6px 12px',
            background: '#fffbf0',
            border: '1.5px solid #fed7aa',
            borderRadius: 10,
          }}
        >
          <div className="flex items-center gap-2">
            <KeyRound size={13} color="#d97706" />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#92400e' }}>
              Policy View
            </span>
            <span style={{ fontSize: 10, color: '#b45309', opacity: 0.8 }}>
              {policyKeyView === 0 ? '(Targeting Key)' : '(Targeting Goal via Open Door)'}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onTogglePolicyKeyView && onTogglePolicyKeyView(0)}
              style={{
                fontSize: 10,
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: 6,
                border: '1px solid',
                borderColor: policyKeyView === 0 ? '#d97706' : '#fed7aa',
                background: policyKeyView === 0 ? '#d97706' : 'white',
                color: policyKeyView === 0 ? 'white' : '#92400e',
                cursor: 'pointer',
                transition: 'all 0.12s'
              }}
            >
              🗝️ Need Key (S₀)
            </button>
            <button
              type="button"
              onClick={() => onTogglePolicyKeyView && onTogglePolicyKeyView(1)}
              style={{
                fontSize: 10,
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: 6,
                border: '1px solid',
                borderColor: policyKeyView === 1 ? '#16a34a' : '#fed7aa',
                background: policyKeyView === 1 ? '#16a34a' : 'white',
                color: policyKeyView === 1 ? 'white' : '#166534',
                cursor: 'pointer',
                transition: 'all 0.12s'
              }}
            >
              🔓 Has Key (S₁)
            </button>
          </div>
        </div>
      )}

      {/* Grid Table */}
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
            const dInfo = getDoorInfo(r, c);
            const goalHere = isGoal(r, c);
            const startHere = isStart(r, c);
            const agentHere = isAgent(r, c);
            const sel = isSel(r, c);

            // Lookup Q-table and policy arrows with key mask slice if doors present
            const keyWithMask = `${r},${c},${policyKeyView}`;
            const cq = (doors.length > 0 && qTable?.[keyWithMask] !== undefined)
              ? qTable[keyWithMask]
              : qTable?.[key];
            const ba = (doors.length > 0 && bestActions?.[keyWithMask] !== undefined)
              ? bestActions[keyWithMask]
              : bestActions?.[key];

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
                  ${dInfo.isDoor ? (dInfo.isUnlocked || policyKeyView === 1 ? 'is-door is-door-unlocked' : 'is-door') : ''}
                  ${dInfo.isPending ? 'is-door-pending' : ''}
                  ${dInfo.isKey ? (dInfo.isCollected ? 'is-key is-key-collected' : 'is-key') : ''}
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

                {/* Door (Locked or Unlocked) */}
                {dInfo.isDoor && !obs && !cliff && (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                    className="flex flex-col items-center gap-0.5">
                    {dInfo.isPending ? (
                      <DoorClosed size={iconSize} color="#d97706" strokeWidth={2.4} className="animate-pulse" />
                    ) : (dInfo.isUnlocked || policyKeyView === 1) ? (
                      <DoorOpen size={iconSize} color="#16a34a" strokeWidth={2.4} />
                    ) : (
                      <DoorClosed size={iconSize} color="#d97706" strokeWidth={2.4} />
                    )}
                    {cellSize >= 54 && (
                      <span style={{
                        fontSize: 8, fontWeight: 800,
                        color: dInfo.isPending ? '#b45309' : (dInfo.isUnlocked || policyKeyView === 1) ? '#16a34a' : '#b45309',
                        textTransform: 'uppercase', letterSpacing: '-0.02em'
                      }}>
                        {dInfo.isPending
                          ? 'DOOR...'
                          : (dInfo.isUnlocked || policyKeyView === 1)
                            ? (doors.length > 1 ? `OPEN #${dInfo.index + 1}` : 'OPEN')
                            : (doors.length > 1 ? `DOOR #${dInfo.index + 1}` : 'DOOR')}
                      </span>
                    )}
                    {cellSize < 54 && cellSize >= 32 && (
                      <span style={{
                        fontSize: 7, fontWeight: 800,
                        color: (dInfo.isUnlocked || policyKeyView === 1) ? '#16a34a' : '#b45309',
                        textTransform: 'uppercase'
                      }}>
                        {(dInfo.isUnlocked || policyKeyView === 1) ? 'OPEN' : 'DOOR'}
                      </span>
                    )}
                  </motion.div>
                )}

                {/* Key (To Unlock Door) */}
                {dInfo.isKey && !obs && !cliff && (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                    className="flex flex-col items-center gap-0.5">
                    <KeyRound
                      size={iconSize}
                      color="#eab308"
                      strokeWidth={2.4}
                      style={{ opacity: dInfo.isCollected ? 0.45 : 1 }}
                    />
                    {cellSize >= 54 && (
                      <span style={{
                        fontSize: 8, fontWeight: 800,
                        color: dInfo.isCollected ? '#a16207' : '#ca8a04',
                        textTransform: 'uppercase', letterSpacing: '-0.02em',
                        opacity: dInfo.isCollected ? 0.6 : 1
                      }}>
                        {dInfo.isCollected
                          ? 'GOT KEY'
                          : (doors.length > 1 ? `KEY #${dInfo.index + 1}` : 'KEY')}
                      </span>
                    )}
                    {cellSize < 54 && cellSize >= 32 && (
                      <span style={{
                        fontSize: 7, fontWeight: 800,
                        color: '#ca8a04',
                        textTransform: 'uppercase',
                        opacity: dInfo.isCollected ? 0.6 : 1
                      }}>
                        KEY
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
          { color: '#d97706', label: 'Door (Locked)', shadow: 'rgba(217,119,6,0.3)' },
          { color: '#eab308', label: 'Key (Pick up)', shadow: 'rgba(234,179,8,0.4)' },
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
