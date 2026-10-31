import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flag, Bot, Ban, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, History, Flame, Waves, Snowflake, Orbit, Play, Pause, SkipBack, SkipForward, X, KeyRound, DoorClosed, DoorOpen, Trophy, Users } from 'lucide-react';

export default function GridEnvironment({
  mode = 'single',
  rows, cols, start, goal,
  start2 = null, goal2 = null,
  obstacles = [], cliffs = [], mud = [], ice = [], portals = [],
  doors = [], pendingDoor = null, currentKeyMask = 0,
  policyKeyView = 0, onTogglePolicyKeyView = null,
  pendingPortalEntry = null,
  agentPosition, agent2Position = null,
  qTable, bestActions, qTable2 = null, bestActions2 = null,
  stateValues = {}, visitCounts = {},
  activeTool, onCellClick, selectedCell,
  showQValues, showPolicyArrows, showValueHeatmap = false, showVisitHeatmap = false,
  isTraining, replayPath = [], replayPath2 = [], replayStepIndex = 0, isReplayMode = false,
  selectedReplayEpisode = null,
  isReplayPlaying = false,
  onToggleReplayPlay = null,
  onReplayStepChange = null,
  onExitReplay = null,
  lastCollision = false,
}) {
  const isMultiAgent = mode === 'competitive' || mode === 'cooperative';
  const [multiArrowView, setMultiArrowView] = useState('agent1'); // 'agent1' | 'agent2'

  const a1 = agentPosition || start;
  const a2 = agent2Position || (start2 || [rows - 1, 0]);

  const isAgent1 = (r, c) => a1[0] === r && a1[1] === c;
  const isAgent2 = (r, c) => isMultiAgent && a2[0] === r && a2[1] === c;
  const isGoal = (r, c) => goal[0] === r && goal[1] === c;
  const isGoal2 = (r, c) => mode === 'cooperative' && goal2 && goal2[0] === r && goal2[1] === c && !(goal[0] === r && goal[1] === c);
  const isStart = (r, c) => start[0] === r && start[1] === c;
  const isStart2 = (r, c) => isMultiAgent && start2 && start2[0] === r && start2[1] === c;
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

  const maxDim = Math.max(rows, cols);
  let baseCellSize = 64;
  if (maxDim <= 4) baseCellSize = 76;
  else if (maxDim <= 6) baseCellSize = 62;
  else if (maxDim <= 8) baseCellSize = 50;
  else if (maxDim <= 10) baseCellSize = 42;
  else if (maxDim <= 13) baseCellSize = 33;
  else if (maxDim <= 16) baseCellSize = 27;
  else baseCellSize = 23;

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

  const makeArrowMap = (color) => ({
    up: <ArrowUp size={arrowSize} color={color} strokeWidth={2.8} />,
    down: <ArrowDown size={arrowSize} color={color} strokeWidth={2.8} />,
    left: <ArrowLeft size={arrowSize} color={color} strokeWidth={2.8} />,
    right: <ArrowRight size={arrowSize} color={color} strokeWidth={2.8} />,
  });

  const ARROW_MAP_A1 = makeArrowMap('#0066ff');
  const ARROW_MAP_A2 = makeArrowMap('#ea580c');
  const ARROW_MAP_DEFAULT = makeArrowMap('#ff6d00');

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

      {/* Multi-Agent Arrow View Selector */}
      {isMultiAgent && !isReplayMode && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            maxWidth: 560,
            padding: '6px 12px',
            background: mode === 'competitive' ? '#fff7ed' : '#ecfdf5',
            border: `1.5px solid ${mode === 'competitive' ? '#ffedd5' : '#d1fae5'}`,
            borderRadius: 10,
          }}
        >
          <div className="flex items-center gap-2">
            {mode === 'competitive' ? <Trophy size={13} color="#ea580c" /> : <Users size={13} color="#059669" />}
            <span style={{ fontSize: 11, fontWeight: 700, color: mode === 'competitive' ? '#9a3412' : '#065f46' }}>
              {mode === 'competitive' ? 'Race Duel' : 'Co-Op Team'} Policy
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setMultiArrowView('agent1')}
              style={{
                fontSize: 10,
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: 6,
                border: '1px solid',
                borderColor: multiArrowView === 'agent1' ? '#0066ff' : '#d4d4d4',
                background: multiArrowView === 'agent1' ? '#0066ff' : 'white',
                color: multiArrowView === 'agent1' ? 'white' : '#0066ff',
                cursor: 'pointer'
              }}
            >
              🤖 A1 (Blue)
            </button>
            <button
              type="button"
              onClick={() => setMultiArrowView('agent2')}
              style={{
                fontSize: 10,
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: 6,
                border: '1px solid',
                borderColor: multiArrowView === 'agent2' ? '#ea580c' : '#d4d4d4',
                background: multiArrowView === 'agent2' ? '#ea580c' : 'white',
                color: multiArrowView === 'agent2' ? 'white' : '#ea580c',
                cursor: 'pointer'
              }}
            >
              🤖 A2 (Orange)
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
            const goal2Here = isGoal2(r, c);
            const startHere = isStart(r, c);
            const start2Here = isStart2(r, c);
            const agent1Here = isAgent1(r, c);
            const agent2Here = isAgent2(r, c);
            const sel = isSel(r, c);

            // Active Q and Best Action based on mode & arrow view
            const activeBestActions = (isMultiAgent && multiArrowView === 'agent2' && bestActions2)
              ? bestActions2
              : bestActions;
            const activeQTable = (isMultiAgent && multiArrowView === 'agent2' && qTable2)
              ? qTable2
              : qTable;

            const keyWithMask = `${r},${c},${policyKeyView}`;
            const cq = (doors.length > 0 && activeQTable?.[keyWithMask] !== undefined)
              ? activeQTable[keyWithMask]
              : activeQTable?.[key];
            const ba = (doors.length > 0 && activeBestActions?.[keyWithMask] !== undefined)
              ? activeBestActions[keyWithMask]
              : activeBestActions?.[key];

            const inReplay1 = isReplayMode && replayPath.some((p) => p[0] === r && p[1] === c);
            const inReplay2 = isReplayMode && replayPath2.some((p) => p[0] === r && p[1] === c);

            let heatBg = undefined;
            if (showValueHeatmap && !obs && !cliff && stateValues[key] !== undefined) {
              const norm = Math.max(0, Math.min(1, (stateValues[key] - minStateVal) / valRange));
              heatBg = `rgba(0, 200, 83, ${norm * 0.45})`;
            } else if (showVisitHeatmap && !obs && visitCounts[key]) {
              const norm = Math.min(1, visitCounts[key] / maxVisits);
              heatBg = `rgba(106, 27, 154, ${norm * 0.45})`;
            }

            const arrowMap = isMultiAgent
              ? (multiArrowView === 'agent2' ? ARROW_MAP_A2 : ARROW_MAP_A1)
              : ARROW_MAP_DEFAULT;

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
                  ${goal2Here && !obs ? 'is-goal2' : ''}
                  ${startHere && !obs && !goalHere ? 'is-start' : ''}
                  ${start2Here && !obs && !goalHere && !goal2Here ? 'is-start2' : ''}
                  ${(inReplay1 || inReplay2) && !obs ? 'ring-2 ring-amber-300' : ''}
                  ${lastCollision && agent1Here && agent2Here ? 'ring-4 ring-red-500' : ''}
                `}
                style={{
                  width: cellSize,
                  height: cellSize,
                  backgroundColor: heatBg || undefined,
                }}
              >
                {/* Coordinates */}
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

                {/* Cliff */}
                {cliff && !obs && (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                    className="flex flex-col items-center gap-0.5">
                    <Flame size={iconSize} color="#e65100" strokeWidth={2.4} />
                    {cellSize >= 54 && (
                      <span style={{ fontSize: 8, fontWeight: 800, color: '#e65100', textTransform: 'uppercase' }}>Cliff</span>
                    )}
                  </motion.div>
                )}

                {/* Mud */}
                {mudTile && !obs && !cliff && (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                    className="flex flex-col items-center gap-0.5">
                    <Waves size={iconSize} color="#8d6e63" strokeWidth={2.2} />
                    {cellSize >= 54 && (
                      <span style={{ fontSize: 8, fontWeight: 800, color: '#8d6e63', textTransform: 'uppercase' }}>Mud</span>
                    )}
                  </motion.div>
                )}

                {/* Ice */}
                {iceTile && !obs && !cliff && (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                    className="flex flex-col items-center gap-0.5">
                    <Snowflake size={iconSize} color="#00bcd4" strokeWidth={2.2} />
                    {cellSize >= 54 && (
                      <span style={{ fontSize: 8, fontWeight: 800, color: '#00838f', textTransform: 'uppercase' }}>Ice</span>
                    )}
                  </motion.div>
                )}

                {/* Portal */}
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
                  </motion.div>
                )}

                {/* Door */}
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
                          : (dInfo.isUnlocked || policyKeyView === 1) ? 'OPEN' : 'DOOR'}
                      </span>
                    )}
                  </motion.div>
                )}

                {/* Key */}
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
                        {dInfo.isCollected ? 'GOT KEY' : 'KEY'}
                      </span>
                    )}
                  </motion.div>
                )}

                {/* Goal 1 */}
                {goalHere && !obs && !cliff && (
                  <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 2 }}
                    className="flex flex-col items-center gap-0.5">
                    <Flag size={iconSize} color="#00c853" strokeWidth={2.4} />
                    {cellSize >= 54 && (
                      <span style={{ fontSize: 8, fontWeight: 800, color: '#00c853', textTransform: 'uppercase' }}>
                        {mode === 'cooperative' && goal2 ? 'G1 (+100)' : 'Goal (+100)'}
                      </span>
                    )}
                  </motion.div>
                )}

                {/* Goal 2 (in Co-op) */}
                {goal2Here && !obs && !cliff && (
                  <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 2 }}
                    className="flex flex-col items-center gap-0.5">
                    <Flag size={iconSize} color="#10b981" strokeWidth={2.4} />
                    {cellSize >= 54 && (
                      <span style={{ fontSize: 8, fontWeight: 800, color: '#10b981', textTransform: 'uppercase' }}>
                        G2 (+100)
                      </span>
                    )}
                  </motion.div>
                )}

                {/* Start 1 Label */}
                {startHere && !agent1Here && !obs && !goalHere && !cliff && (
                  <span style={{ fontSize: Math.max(8, cellSize * 0.16), fontWeight: 700, color: '#0066ff', opacity: 0.6, textTransform: 'uppercase' }}>
                    {isMultiAgent ? 'Start 1' : 'Start'}
                  </span>
                )}

                {/* Start 2 Label */}
                {start2Here && !agent2Here && !obs && !goalHere && !goal2Here && !cliff && (
                  <span style={{ fontSize: Math.max(8, cellSize * 0.16), fontWeight: 700, color: '#ea580c', opacity: 0.6, textTransform: 'uppercase' }}>
                    Start 2
                  </span>
                )}

                {/* Policy Arrow */}
                {showPolicyArrows && !isReplayMode && ba && !obs && !cliff && !goalHere && !goal2Here && !agent1Here && !agent2Here && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="policy-overlay">
                    {arrowMap[ba]}
                  </motion.div>
                )}

                {/* Q-value overlay */}
                {showQValues && !isReplayMode && cq && !obs && !cliff && !goalHere && !goal2Here && cellSize >= 52 && (
                  <div className="q-vals-overlay">
                    <div className={`q-val q-val-up ${ba === 'up' ? 'best' : ''}`}>{cq.up ?? 0}</div>
                    <div className={`q-val q-val-left ${ba === 'left' ? 'best' : ''}`}>{cq.left ?? 0}</div>
                    <div className={`q-val q-val-right ${ba === 'right' ? 'best' : ''}`}>{cq.right ?? 0}</div>
                    <div className={`q-val q-val-down ${ba === 'down' ? 'best' : ''}`}>{cq.down ?? 0}</div>
                  </div>
                )}

                {/* Agent 1 Token */}
                <AnimatePresence>
                  {agent1Here && (
                    <motion.div
                      layoutId="agent1"
                      transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                      className="agent-token"
                      style={{
                        inset: Math.max(2, Math.round(cellSize * 0.08)),
                        background: isReplayMode ? '#ff8f00' : '#0066ff',
                        boxShadow: '0 2px 10px rgba(0,102,255,0.5)',
                        zIndex: 10,
                        ...(isMultiAgent && agent2Here ? { width: '48%', left: '2px', right: 'auto' } : {})
                      }}
                    >
                      <Bot size={Math.max(10, Math.round(cellSize * (isMultiAgent && agent2Here ? 0.32 : 0.44)))} color="white" strokeWidth={2} />
                      {cellSize >= 44 && (
                        <span style={{ fontSize: 7, fontWeight: 800, color: 'white', textTransform: 'uppercase', marginTop: 1 }}>
                          {isMultiAgent ? 'A1' : isReplayMode ? `S${replayStepIndex}` : 'Agent'}
                        </span>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Agent 2 Token */}
                <AnimatePresence>
                  {agent2Here && (
                    <motion.div
                      layoutId="agent2"
                      transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                      className="agent-token"
                      style={{
                        inset: Math.max(2, Math.round(cellSize * 0.08)),
                        background: '#ea580c',
                        boxShadow: '0 2px 10px rgba(234,88,12,0.5)',
                        zIndex: 11,
                        ...(agent1Here ? { width: '48%', right: '2px', left: 'auto' } : {})
                      }}
                    >
                      <Bot size={Math.max(10, Math.round(cellSize * (agent1Here ? 0.32 : 0.44)))} color="white" strokeWidth={2} />
                      {cellSize >= 44 && (
                        <span style={{ fontSize: 7, fontWeight: 800, color: 'white', textTransform: 'uppercase', marginTop: 1 }}>
                          A2
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
      <div className="flex items-center gap-3.5 flex-wrap justify-center pt-1 text-xs">
        {[
          { color: '#0066ff', label: isMultiAgent ? 'Agent 1 (Blue)' : 'Agent', shadow: 'rgba(0,102,255,0.4)' },
          ...(isMultiAgent ? [{ color: '#ea580c', label: 'Agent 2 (Orange)', shadow: 'rgba(234,88,12,0.4)' }] : []),
          { color: '#00c853', label: 'Goal (+100)', shadow: 'rgba(0,200,83,0.4)' },
          ...(mode === 'cooperative' && goal2 ? [{ color: '#10b981', label: 'Goal 2', shadow: 'rgba(16,185,129,0.4)' }] : []),
          { color: '#ff1744', label: 'Wall', shadow: 'rgba(255,23,68,0.4)' },
          { color: '#d97706', label: 'Door', shadow: null },
          { color: '#eab308', label: 'Key', shadow: null },
          { color: '#e65100', label: 'Cliff (-50)', shadow: null },
          { color: '#00bcd4', label: 'Ice', shadow: null },
        ].map(({ color, label, shadow }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span style={{ width: 10, height: 10, background: color, borderRadius: 3, boxShadow: shadow ? `0 0 6px ${shadow}` : undefined, display: 'inline-block' }} />
            <span style={{ fontSize: 11, fontWeight: 500, color: '#6b6b6b' }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
