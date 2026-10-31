import React from 'react';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Crosshair, Eye } from 'lucide-react';

const ACTIONS = [
  { key: 'up', label: 'Up', Icon: ArrowUp },
  { key: 'down', label: 'Down', Icon: ArrowDown },
  { key: 'left', label: 'Left', Icon: ArrowLeft },
  { key: 'right', label: 'Right', Icon: ArrowRight },
];

export default function CellInspector({
  selectedCell, qTable, bestActions, start, goal,
  obstacles = [], cliffs = [], mud = [], ice = [], portals = [],
  stateValues = {}, visitCounts = {}
}) {
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
  const cq = qTable?.[key];
  const ba = bestActions?.[key];
  const isObs = obstacles.some(([or, oc]) => or === r && oc === c);
  const isCliff = cliffs.some(([cr, cc]) => cr === r && cc === c);
  const isMud = mud.some(([mr, mc]) => mr === r && mc === c);
  const isIce = ice.some(([ir, ic]) => ir === r && ic === c);
  const portalEntry = (portals || []).find((p) => p[0] === r && p[1] === c);
  const portalExit = (portals || []).find((p) => p.length >= 4 && p[2] === r && p[3] === c);
  const isGoal = goal[0] === r && goal[1] === c;
  const isStart = start[0] === r && start[1] === c;

  const stateVal = stateValues?.[key] ?? (cq ? Math.max(...Object.values(cq)) : 0);
  const visits = visitCounts?.[key] ?? 0;

  let typeLabel = 'Empty State';
  let typePill = 'pill-black';
  if (isGoal) { typeLabel = 'Goal (+100)'; typePill = 'pill-green'; }
  else if (isObs) { typeLabel = 'Wall'; typePill = 'pill-red'; }
  else if (isCliff) { typeLabel = 'Cliff / Lava (-50)'; typePill = 'pill-orange'; }
  else if (isMud) { typeLabel = 'Mud Swamp (-5)'; typePill = 'pill-brown'; }
  else if (isIce) { typeLabel = 'Ice (Slippery)'; typePill = 'pill-cyan'; }
  else if (portalEntry && portalEntry.length >= 4) { typeLabel = `Portal Entry → [${portalEntry[2]}, ${portalEntry[3]}]`; typePill = 'pill-purple'; }
  else if (portalExit) { typeLabel = `Portal Exit ← [${portalExit[0]}, ${portalExit[1]}]`; typePill = 'pill-purple'; }
  else if (portalEntry) { typeLabel = 'Portal'; typePill = 'pill-purple'; }
  else if (isStart) { typeLabel = 'Agent Start'; typePill = 'pill-blue'; }

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
                return (
                  <div key={a} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '9px 12px', borderRadius: 9,
                    background: isBest ? '#edfff5' : '#f7f7f5',
                    border: `1.5px solid ${isBest ? '#00c853' : '#e5e5e5'}`,
                    transition: 'all 0.15s ease',
                  }}>
                    <div className="flex items-center gap-1.5">
                      <Icon size={13} color={isBest ? '#00843d' : '#9b9b9b'} strokeWidth={2.5} />
                      <span style={{ fontSize: 11, fontWeight: 600, color: isBest ? '#00843d' : '#6b6b6b' }}>
                        {label}
                      </span>
                    </div>
                    <span style={{
                      fontFamily: 'JetBrains Mono', fontSize: 12, fontWeight: 700,
                      color: isBest ? '#00843d' : val > 0 ? '#0066ff' : val < 0 ? '#cc0000' : '#bbb',
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
