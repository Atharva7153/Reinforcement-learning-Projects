import React, { useState } from 'react';
import { Eye, HelpCircle, Layers } from 'lucide-react';

export default function PolicyHeatmap({ policy, currentBin }) {
  const [hoveredCell, setHoveredCell] = useState(null);

  if (!policy || !policy.grid || policy.grid.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm flex flex-col items-center justify-center min-h-[300px]">
        <Layers className="h-10 w-10 text-slate-300 mb-2 animate-pulse" />
        <p className="text-sm font-medium text-slate-500">Loading Policy Matrix...</p>
      </div>
    );
  }

  const { grid, dist_bins, vel_bins, total_episodes, epsilon } = policy;
  const currentDistBin = currentBin?.[0];
  const currentVelBin = currentBin?.[1];

  const numDist = grid.length;
  const numVel = grid[0].length;

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      {/* Heatmap Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-indigo-600" />
            <h3 className="font-semibold text-slate-900 text-sm">
              Learned Policy & Q-Table Heatmap
            </h3>
            <span className="rounded-full bg-indigo-50 text-indigo-700 px-2.5 py-0.5 text-xs font-semibold">
              {total_episodes} Episodes Trained
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Color encodes optimal policy action: argmax Q(s, a). Glowing cursor tracks car state live.
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-xs font-medium">
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded bg-rose-500 shadow-xs"></span>
            <span className="text-slate-700">🛑 Brake</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded bg-emerald-500 shadow-xs"></span>
            <span className="text-slate-700">⚡ Accelerate</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded bg-amber-400 shadow-xs"></span>
            <span className="text-slate-700">⏸️ Maintain</span>
          </div>
          <div className="text-slate-400 font-mono text-[11px] ml-2">
            ε: {epsilon}
          </div>
        </div>
      </div>

      {/* Grid container with Y-axis (Velocity) and X-axis (Distance) */}
      <div className="relative overflow-x-auto">
        <div className="min-w-[640px]">
          {/* Y-axis label */}
          <div className="text-[11px] font-semibold text-slate-500 mb-1 flex items-center justify-between">
            <span>↑ High Speed (26 m/s)</span>
            <span className="font-mono text-slate-400">Velocity (Y-axis) vs Distance to Wall (X-axis)</span>
            <span>0 m/s (Stopped) ↓</span>
          </div>

          <div className="flex flex-col gap-1">
            {/* Render rows from top (high velocity) to bottom (0 velocity) */}
            {Array.from({ length: numVel })
              .map((_, i) => numVel - 1 - i)
              .map(vIdx => {
                const vLow = vel_bins[vIdx];
                const vHigh = vel_bins[vIdx + 1];

                return (
                  <div key={vIdx} className="flex items-center gap-1">
                    {/* Y-axis label */}
                    <div className="w-16 text-right pr-2 font-mono text-[10px] text-slate-400 select-none">
                      {vLow.toFixed(1)}m/s
                    </div>

                    {/* Cells across distance bins (from 0 to 100m) */}
                    <div className="flex-1 grid gap-1" style={{ gridTemplateColumns: `repeat(${numDist}, minmax(0, 1fr))` }}>
                      {grid.map((distRow, dIdx) => {
                        const cell = distRow[vIdx];
                        const isCurrentState = currentDistBin === dIdx && currentVelBin === vIdx;
                        const action = cell.best_action;

                        let bgClass = 'bg-slate-100 hover:bg-slate-200';
                        if (action === 0) bgClass = 'bg-rose-500 hover:bg-rose-600';
                        else if (action === 1) bgClass = 'bg-emerald-500 hover:bg-emerald-600';
                        else if (action === 2) bgClass = 'bg-amber-400 hover:bg-amber-500';

                        return (
                          <div
                            key={dIdx}
                            onMouseEnter={() => setHoveredCell(cell)}
                            onMouseLeave={() => setHoveredCell(null)}
                            className={`relative h-6 rounded cursor-pointer transition-all ${bgClass} ${
                              isCurrentState
                                ? 'ring-3 ring-indigo-600 ring-offset-2 z-10 scale-110 shadow-lg'
                                : ''
                            }`}
                          >
                            {/* Live Car tracker indicator */}
                            {isCurrentState && (
                              <span className="absolute inset-0 flex items-center justify-center">
                                <span className="h-2 w-2 rounded-full bg-white shadow-xs animate-ping"></span>
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

            {/* X-axis labels (Distance) */}
            <div className="flex items-center gap-1 mt-1">
              <div className="w-16"></div>
              <div className="flex-1 grid" style={{ gridTemplateColumns: `repeat(${numDist}, minmax(0, 1fr))` }}>
                <span className="text-[10px] font-mono text-rose-600 font-bold">0m (Wall)</span>
                <div className="col-span-8"></div>
                <span className="text-[10px] font-mono text-center text-slate-400">~40m</span>
                <div className="col-span-7"></div>
                <span className="text-[10px] font-mono text-right text-slate-400 pr-1">100m</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Hover Info Tooltip Bar */}
      <div className="mt-3 min-h-[44px] rounded-xl bg-slate-50 border border-slate-100 px-4 py-2 flex items-center justify-between text-xs">
        {hoveredCell ? (
          <>
            <div className="flex items-center gap-3">
              <span className="font-semibold text-slate-800">
                State: <span className="font-mono text-indigo-600">[{hoveredCell.d_label}, {hoveredCell.v_label}]</span>
              </span>
              <span className="text-slate-400">•</span>
              <span className="font-semibold text-slate-800">
                Policy Action:{' '}
                <strong
                  className={
                    hoveredCell.best_action === 0
                      ? 'text-rose-600'
                      : hoveredCell.best_action === 1
                      ? 'text-emerald-600'
                      : 'text-amber-600'
                  }
                >
                  {hoveredCell.best_action_name}
                </strong>
              </span>
            </div>
            <div className="flex items-center gap-4 font-mono text-[11px]">
              <span className="text-rose-600">Q(Brake): {hoveredCell.q_brake}</span>
              <span className="text-emerald-600">Q(Accel): {hoveredCell.q_accel}</span>
              <span className="text-amber-600">Q(Maintain): {hoveredCell.q_maintain}</span>
            </div>
          </>
        ) : (
          <span className="text-slate-400 text-xs italic">
            Hover over any grid cell to inspect Q-values for Brake, Accelerate, and Maintain at that state.
          </span>
        )}
      </div>
    </div>
  );
}
