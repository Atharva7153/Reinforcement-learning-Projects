import React, { useState } from 'react';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Crosshair, KeyRound, DoorClosed, Bot } from 'lucide-react';

const ACTIONS = [
  { key: 'up', label: 'Up', Icon: ArrowUp },
  { key: 'down', label: 'Down', Icon: ArrowDown },
  { key: 'left', label: 'Left', Icon: ArrowLeft },
  { key: 'right', label: 'Right', Icon: ArrowRight },
];

export default function CellInspector({
  mode = 'single',
  selectedCell, qTable, bestActions, qTable2 = null, bestActions2 = null,
  start, goal, start2 = null, goal2 = null,
  obstacles = [], cliffs = [], mud = [], ice = [], portals = [], doors = [],
  stateValues = {}, visitCounts = {}
}) {
  const [inspectKeyMode, setInspectKeyMode] = useState(0);
  const [inspectAgentIndex, setInspectAgentIndex] = useState(1); // 1 for A1, 2 for A2
  const isMultiAgent = mode === 'competitive' || mode === 'cooperative';

  if (!selectedCell) {
    return (
      <div className="card">
        <div className="card-section flex flex-col items-center justify-center" style={{ minHeight: 120, gap: 8 }}>
          <Crosshair size={20} color="#ccc" />
          <span style={{ fontSize: 13, color: '#bbb' }}>Click any cell to inspect its Q-values</span>
        </div>
      </div>
    );
  }

  const [r, c] = selectedCell;
  const key = `${r},${c}`;
  const keyWithMask = `${r},${c},${inspectKeyMode}`;

  // Select target agent's Q-table
  const activeTable = (isMultiAgent && inspectAgentIndex === 2 && qTable2) ? qTable2 : qTable;
  const activeBest = (isMultiAgent && inspectAgentIndex === 2 && bestActions2) ? bestActions2 : bestActions;

  const cq = (doors.length > 0 && activeTable?.[keyWithMask] !== undefined)
    ? activeTable[keyWithMask]
    : activeTable?.[key];
  const ba = (doors.length > 0 && activeBest?.[keyWithMask] !== undefined)
    ? activeBest[keyWithMask]
    : activeBest?.[key];

  const isObs = obstacles.some(([or, oc]) => or === r && oc === c);
  const isCliff = cliffs.some(([cr, cc]) => cr === r && cc === c);
  const isMud = mud.some(([mr, mc]) => mr === r && mc === c);
  const isIce = ice.some(([ir, ic]) => ir === r && ic === c);
  const portalEntry = (portals || []).find((p) => p[0] === r && p[1] === c);
  const portalExit = (portals || []).find((p) => p.length >= 4 && p[2] === r && p[3] === c);
  const doorItem = (doors || []).find((d) => d[0] === r && d[1] === c);
  const keyItem = (doors || []).find((d) => d[2] === r && d[3] === c);
  const isGoal = goal[0] === r && goal[1] === c;
  const isGoal2 = mode === 'cooperative' && goal2 && goal2[0] === r && goal2[1] === c;
  const isStart = start[0] === r && start[1] === c;
  const isStart2 = isMultiAgent && start2 && start2[0] === r && start2[1] === c;

  const stateVal = (doors.length > 0 && stateValues?.[keyWithMask] !== undefined)
    ? stateValues[keyWithMask]
    : (stateValues?.[key] ?? (cq ? Math.max(...Object.values(cq)) : 0));
  const visits = visitCounts?.[key] ?? 0;

  let typeLabel = 'Empty State';
  let typePill = 'pill-black';
  if (isGoal) { typeLabel = isMultiAgent && goal2 ? 'Goal 1 (+100)' : 'Goal (+100)'; typePill = 'pill-green'; }
  else if (isGoal2) { typeLabel = 'Goal 2 (+100)'; typePill = 'pill-green'; }
  else if (isObs) { typeLabel = 'Wall'; typePill = 'pill-red'; }
  else if (doorItem) { typeLabel = `Door → Key at [${doorItem[2]}, ${doorItem[3]}]`; typePill = 'pill-orange'; }
  else if (keyItem) { typeLabel = `Key → Door at [${keyItem[0]}, ${keyItem[1]}]`; typePill = 'pill-yellow'; }
  else if (isCliff) { typeLabel = 'Cliff / Lava (-50)'; typePill = 'pill-orange'; }
  else if (isMud) { typeLabel = 'Mud Swamp (-5)'; typePill = 'pill-brown'; }
  else if (isIce) { typeLabel = 'Ice (Slippery)'; typePill = 'pill-cyan'; }
  else if (portalEntry && portalEntry.length >= 4) { typeLabel = `Portal Entry → [${portalEntry[2]}, ${portalEntry[3]}]`; typePill = 'pill-purple'; }
  else if (portalExit) { typeLabel = `Portal Exit ← [${portalExit[0]}, ${portalExit[1]}]`; typePill = 'pill-purple'; }
  else if (portalEntry) { typeLabel = 'Portal'; typePill = 'pill-purple'; }
  else if (isStart) { typeLabel = isMultiAgent ? 'Agent 1 Start' : 'Agent Start'; typePill = 'pill-blue'; }
  else if (isStart2) { typeLabel = 'Agent 2 Start'; typePill = 'pill-orange'; }

  return (
    <div className="card">
      <div className="card-section" style={{ borderBottom: '1.5px solid #e5e5e5', paddingBottom: 14 }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crosshair size={15} color="#6b6b6b" />
            <span style={{ fontFamily: 'JetBrains Mono', fontSize: 13, fontWeight: 700, color: '#0a0a0a' }}>
              State [{r}, {c}]
            </span>
          </div>
          <span className={`pill ${typePill}`}>{typeLabel}</span>
        </div>

        {/* Multi-Agent Selector Tabs */}
        {isMultiAgent && !isObs && (
          <div className="flex items-center gap-1.5 mt-3 pt-2.5 border-t border-neutral-100">
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#999' }}>Agent:</span>
            <button
              type="button"
              onClick={() => setInspectAgentIndex(1)}
              style={{
                fontSize: 10,
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 5,
                border: '1px solid',
                borderColor: inspectAgentIndex === 1 ? '#0066ff' : '#e5e5e5',
                background: inspectAgentIndex === 1 ? '#eff6ff' : 'white',
                color: inspectAgentIndex === 1 ? '#1d4ed8' : '#666',
                cursor: 'pointer'
              }}
            >
              🤖 A1 (Blue)
            </button>
            <button
              type="button"
              onClick={() => setInspectAgentIndex(2)}
              style={{
                fontSize: 10,
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 5,
                border: '1px solid',
                borderColor: inspectAgentIndex === 2 ? '#ea580c' : '#e5e5e5',
                background: inspectAgentIndex === 2 ? '#fff7ed' : 'white',
                color: inspectAgentIndex === 2 ? '#c2410c' : '#666',
                cursor: 'pointer'
              }}
            >
              🤖 A2 (Orange)
            </button>
          </div>
        )}

        {/* Door key slice tabs if doors exist */}
        {doors.length > 0 && !isObs && (
          <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-neutral-100">
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#999' }}>Slice:</span>
            <button
              type="button"
              onClick={() => setInspectKeyMode(0)}
              style={{
                fontSize: 10,
                fontWeight: 700,
                padding: '2px 7px',
                borderRadius: 5,
                border: '1px solid',
                borderColor: inspectKeyMode === 0 ? '#d97706' : '#e5e5e5',
                background: inspectKeyMode === 0 ? '#fffbeb' : 'white',
                color: inspectKeyMode === 0 ? '#b45309' : '#666',
                cursor: 'pointer'
              }}
            >
              Need Key (S₀)
            </button>
            <button
              type="button"
              onClick={() => setInspectKeyMode(1)}
              style={{
                fontSize: 10,
                fontWeight: 700,
                padding: '2px 7px',
                borderRadius: 5,
                border: '1px solid',
                borderColor: inspectKeyMode === 1 ? '#16a34a' : '#e5e5e5',
                background: inspectKeyMode === 1 ? '#f0fdf4' : 'white',
                color: inspectKeyMode === 1 ? '#15803d' : '#666',
                cursor: 'pointer'
              }}
            >
              Has Key (S₁)
            </button>
          </div>
        )}
      </div>

      <div className="card-section">
        {isObs ? (
          <p style={{ fontSize: 13, color: '#888', textAlign: 'center', padding: '8px 0' }}>
            Obstacle wall — Impassable state
          </p>
        ) : (
          <div>
            <div className="grid grid-cols-2 gap-2">
              {ACTIONS.map(({ key: a, label, Icon }) => {
                const val = cq?.[a] ?? 0;
                const isBest = ba === a;
                const highlightColor = (isMultiAgent && inspectAgentIndex === 2) ? '#ea580c' : '#00c853';
                const highlightBg = (isMultiAgent && inspectAgentIndex === 2) ? '#fff7ed' : '#edfff5';

                return (
                  <div key={a} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '9px 12px', borderRadius: 9,
                    background: isBest ? highlightBg : '#f7f7f5',
                    border: `1.5px solid ${isBest ? highlightColor : '#e5e5e5'}`,
                    transition: 'all 0.15s ease',
                  }}>
                    <div className="flex items-center gap-1.5">
                      <Icon size={13} color={isBest ? highlightColor : '#9b9b9b'} strokeWidth={2.5} />
                      <span style={{ fontSize: 11, fontWeight: 600, color: isBest ? highlightColor : '#6b6b6b' }}>
                        {label}
                      </span>
                    </div>
                    <span style={{
                      fontFamily: 'JetBrains Mono', fontSize: 12, fontWeight: 700,
                      color: isBest ? highlightColor : val > 0 ? '#0066ff' : val < 0 ? '#cc0000' : '#bbb',
                    }}>
                      {Number(val).toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between mt-3 pt-2 border-t border-neutral-100 text-xs font-mono text-neutral-500">
              <span>V(s): <strong className="text-neutral-900">{Number(stateVal).toFixed(2)}</strong></span>
              <span>Visits: <strong className="text-neutral-900">{visits}</strong></span>
              {ba && (
                <span>Best: <strong className="text-orange-600 uppercase">{ba}</strong></span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
