import React from 'react';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Crosshair } from 'lucide-react';

const ACTIONS = [
  { key: 'up', label: 'Up', Icon: ArrowUp },
  { key: 'down', label: 'Down', Icon: ArrowDown },
  { key: 'left', label: 'Left', Icon: ArrowLeft },
  { key: 'right', label: 'Right', Icon: ArrowRight },
];

export default function CellInspector({ selectedCell, qTable, bestActions, start, goal, obstacles }) {
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
  const isGoal = goal[0] === r && goal[1] === c;
  const isStart = start[0] === r && start[1] === c;

  let typeLabel = 'Empty State';
  let typePill = 'pill-black';
  if (isGoal) { typeLabel = 'Goal'; typePill = 'pill-green'; }
  else if (isObs) { typeLabel = 'Obstacle'; typePill = 'pill-red'; }
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
            Obstacle — Q-values not tracked
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
                    padding: '10px 14px', borderRadius: 10,
                    background: isBest ? '#edfff5' : '#f7f7f5',
                    border: `1.5px solid ${isBest ? '#00c853' : '#e5e5e5'}`,
                    transition: 'all 0.15s ease',
                  }}>
                    <div className="flex items-center gap-2">
                      <Icon size={14} color={isBest ? '#00843d' : '#9b9b9b'} strokeWidth={2.5} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: isBest ? '#00843d' : '#6b6b6b' }}>
                        {label}
                      </span>
                    </div>
                    <span style={{
                      fontFamily: 'JetBrains Mono', fontSize: 13, fontWeight: 700,
                      color: isBest ? '#00843d' : val > 0 ? '#0066ff' : val < 0 ? '#cc0000' : '#bbb',
                    }}>
                      {Number(val).toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>

            {ba && (
              <div style={{ marginTop: 12, fontSize: 12, color: '#6b6b6b', textAlign: 'right' }}>
                Optimal policy: <span style={{ fontWeight: 700, color: '#ff6d00', textTransform: 'uppercase' }}>{ba}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
