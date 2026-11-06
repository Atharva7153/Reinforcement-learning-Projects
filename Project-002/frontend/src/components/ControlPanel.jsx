import React, { useEffect } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  FastForward,
  Zap,
  Sliders,
  Keyboard,
  Compass,
  Cpu,
  UserCheck
} from 'lucide-react';

export default function ControlPanel({
  mode,
  setMode,
  speedDelay,
  setSpeedDelay,
  onStepManual,
  onBatchTrain,
  onResetEnv,
  onResetAll,
  onOpenConfig,
  isTrainingBatch
}) {
  // Global Keyboard Shortcuts for Manual Drive Mode
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't intercept if user is typing in an input field
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;

      if (e.code === 'Space' || e.key.toLowerCase() === 'b') {
        e.preventDefault();
        onStepManual(0); // Brake
      } else if (e.key === 'ArrowUp' || e.key.toLowerCase() === 'w') {
        e.preventDefault();
        onStepManual(1); // Accelerate
      } else if (e.key === 'ArrowDown' || e.key.toLowerCase() === 's' || e.key.toLowerCase() === 'm') {
        e.preventDefault();
        onStepManual(2); // Maintain
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onStepManual]);

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm space-y-4">
      {/* 1. Mode Selector Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Control Mode
          </span>
          <div className="mt-1 flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
            <button
              onClick={() => setMode('AUTOPILOT')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                mode === 'AUTOPILOT'
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Cpu className="h-3.5 w-3.5" />
              <span>AI Autopilot</span>
            </button>

            <button
              onClick={() => setMode('TRAINING')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                mode === 'TRAINING'
                  ? 'bg-white text-emerald-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Zap className="h-3.5 w-3.5" />
              <span>Live Training</span>
            </button>

            <button
              onClick={() => setMode('MANUAL')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                mode === 'MANUAL'
                  ? 'bg-white text-amber-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserCheck className="h-3.5 w-3.5" />
              <span>Manual Drive</span>
            </button>
          </div>
        </div>

        {/* Live Simulation Speed Slider */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-xs font-semibold text-slate-700">Playback Speed</div>
            <div className="text-[11px] font-mono text-slate-400">
              {speedDelay <= 10 ? 'Ultra Fast (10ms)' : speedDelay <= 40 ? 'Normal (40ms)' : 'Slow-mo (100ms)'}
            </div>
          </div>
          <input
            type="range"
            min="5"
            max="120"
            step="5"
            value={speedDelay}
            onChange={(e) => setSpeedDelay(Number(e.target.value))}
            className="w-28 accent-indigo-600 cursor-pointer"
          />
        </div>
      </div>

      {/* 2. Interactive Drive Pad (When in MANUAL mode) */}
      {mode === 'MANUAL' ? (
        <div className="rounded-xl bg-amber-50/60 border border-amber-200/60 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Keyboard className="h-4 w-4 text-amber-600" />
              <span className="font-semibold text-amber-900 text-xs">
                Manual Driver Cockpit — Press Buttons or Use Keyboard
              </span>
            </div>
            <span className="text-[11px] font-mono text-amber-700">
              Can you stop inside 1.0m - 4.0m without crashing?
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {/* BRAKE BUTTON */}
            <button
              onClick={() => onStepManual(0)}
              className="flex flex-col items-center justify-center p-3.5 rounded-xl border-2 border-rose-500 bg-rose-50 hover:bg-rose-100 active:scale-95 transition-all shadow-sm group"
            >
              <span className="text-2xl group-hover:scale-110 transition-transform">🛑</span>
              <span className="font-bold text-rose-700 text-sm mt-1">BRAKE</span>
              <span className="font-mono text-[10px] text-rose-500 mt-0.5">[Space / B]</span>
            </button>

            {/* ACCELERATE BUTTON */}
            <button
              onClick={() => onStepManual(1)}
              className="flex flex-col items-center justify-center p-3.5 rounded-xl border-2 border-emerald-500 bg-emerald-50 hover:bg-emerald-100 active:scale-95 transition-all shadow-sm group"
            >
              <span className="text-2xl group-hover:scale-110 transition-transform">⚡</span>
              <span className="font-bold text-emerald-700 text-sm mt-1">ACCELERATE</span>
              <span className="font-mono text-[10px] text-emerald-500 mt-0.5">[Up Arrow / W]</span>
            </button>

            {/* MAINTAIN BUTTON */}
            <button
              onClick={() => onStepManual(2)}
              className="flex flex-col items-center justify-center p-3.5 rounded-xl border-2 border-amber-500 bg-amber-50 hover:bg-amber-100 active:scale-95 transition-all shadow-sm group"
            >
              <span className="text-2xl group-hover:scale-110 transition-transform">⏸️</span>
              <span className="font-bold text-amber-700 text-sm mt-1">MAINTAIN</span>
              <span className="font-mono text-[10px] text-amber-500 mt-0.5">[Down Arrow / M]</span>
            </button>
          </div>
        </div>
      ) : null}

      {/* 3. Action Toolbar Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-2">
          {/* Pause / Play */}
          {mode !== 'PAUSED' ? (
            <button
              onClick={() => setMode('PAUSED')}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all shadow-xs"
            >
              <Pause className="h-4 w-4" />
              <span>Pause</span>
            </button>
          ) : (
            <button
              onClick={() => setMode('AUTOPILOT')}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-all shadow-sm shadow-indigo-200"
            >
              <Play className="h-4 w-4" />
              <span>Resume</span>
            </button>
          )}

          {/* Reset Environment */}
          <button
            onClick={onResetEnv}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all shadow-xs"
            title="Reset car to start position"
          >
            <RotateCcw className="h-4 w-4 text-slate-500" />
            <span>Reset Position</span>
          </button>

          {/* Reset Agent Q-table */}
          <button
            onClick={onResetAll}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold transition-all"
            title="Wipe Q-Table & restart learning from zero"
          >
            <span>Wipe Memory</span>
          </button>
        </div>

        {/* Turbo Training Fast Actions */}
        <div className="flex items-center gap-2">
          <button
            disabled={isTrainingBatch}
            onClick={() => onBatchTrain(200)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-all shadow-xs disabled:opacity-50"
          >
            <FastForward className="h-4 w-4 text-indigo-400" />
            <span>+200 Turbo</span>
          </button>

          <button
            disabled={isTrainingBatch}
            onClick={() => onBatchTrain(1000)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-all shadow-sm shadow-indigo-200 disabled:opacity-50"
          >
            <Zap className="h-4 w-4 text-yellow-300" />
            <span>+1,000 Turbo (Learn 100%)</span>
          </button>

          <button
            onClick={onOpenConfig}
            className="flex items-center gap-1.5 p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-all"
            title="Physics & Hyperparameters Configuration"
          >
            <Sliders className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
