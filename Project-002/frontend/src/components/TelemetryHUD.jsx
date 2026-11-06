import React from 'react';
import { Gauge, Milestone, Zap, Disc3, ShieldAlert, CheckCircle2, XCircle, Award } from 'lucide-react';

export default function TelemetryHUD({ telemetry, stats, config }) {
  const distance = telemetry?.distance ?? 85.0;
  const velocity = telemetry?.velocity ?? 12.0;
  const speedKmh = velocity * 3.6;
  const acceleration = telemetry?.acceleration ?? 0.0;
  const currentAction = telemetry?.action ?? 2; // 0=Brake, 1=Accel, 2=Maintain
  const reward = telemetry?.reward ?? 0.0;
  const cumulativeReward = telemetry?.cumulative_reward ?? 0.0;
  const stepCount = telemetry?.step_count ?? 0;
  const maxSteps = config?.max_steps ?? 150;
  const outcome = telemetry?.outcome ?? 'READY';

  // Distance bar percentage
  const trackLength = config?.track_length || 100.0;
  const distPercent = Math.min(100, Math.max(0, (distance / trackLength) * 100));

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {/* 1. Speedometer HUD Card */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm flex flex-col justify-between">
        <div className="flex items-center justify-between text-slate-500">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider">
            <Gauge className="h-4 w-4 text-indigo-500" />
            <span>Velocity</span>
          </div>
          <span className="font-mono text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
            {(speedKmh).toFixed(1)} km/h
          </span>
        </div>

        <div className="my-2 flex items-baseline gap-2">
          <span className="font-mono text-3xl font-extrabold text-slate-900 tracking-tight">
            {velocity.toFixed(1)}
          </span>
          <span className="text-sm font-semibold text-slate-400">m/s</span>
        </div>

        {/* Speed Bar Gauge */}
        <div className="w-full">
          <div className="flex justify-between text-[10px] font-mono text-slate-400 mb-1">
            <span>0</span>
            <span>12.5</span>
            <span>25 m/s</span>
          </div>
          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-rose-500 transition-all duration-100"
              style={{ width: `${Math.min(100, (velocity / 25.0) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* 2. Distance to Wall Proximity Card */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm flex flex-col justify-between">
        <div className="flex items-center justify-between text-slate-500">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider">
            <Milestone className="h-4 w-4 text-rose-500" />
            <span>Wall Distance</span>
          </div>
          <span
            className={`font-mono text-xs px-2 py-0.5 rounded-full font-semibold ${
              distance <= 4.0 && distance >= 1.0
                ? 'bg-emerald-100 text-emerald-700'
                : distance < 1.0
                ? 'bg-rose-100 text-rose-700'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            {distance <= 4.0 && distance >= 1.0 ? 'SAFE ZONE' : distance < 1.0 ? 'COLLISION' : 'APPROACHING'}
          </span>
        </div>

        <div className="my-2 flex items-baseline gap-2">
          <span
            className={`font-mono text-3xl font-extrabold tracking-tight ${
              distance <= 4.0 && distance >= 1.0
                ? 'text-emerald-600'
                : distance < 1.0
                ? 'text-rose-600'
                : 'text-slate-900'
            }`}
          >
            {distance.toFixed(1)}
          </span>
          <span className="text-sm font-semibold text-slate-400">meters</span>
        </div>

        {/* Distance Proximity Progress */}
        <div className="w-full">
          <div className="flex justify-between text-[10px] font-mono text-slate-400 mb-1">
            <span>Wall (0m)</span>
            <span className="text-emerald-600 font-bold">Target (2.5m)</span>
            <span>{trackLength}m</span>
          </div>
          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden relative">
            <div
              className={`h-full transition-all duration-100 ${
                distance <= 4.0 && distance >= 1.0
                  ? 'bg-emerald-500'
                  : distance <= 10.0
                  ? 'bg-rose-500'
                  : 'bg-indigo-500'
              }`}
              style={{ width: `${distPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* 3. Current RL Action Card */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm flex flex-col justify-between">
        <div className="flex items-center justify-between text-slate-500">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider">
            <Zap className="h-4 w-4 text-amber-500" />
            <span>Active Action</span>
          </div>
          <span className="font-mono text-xs text-slate-500">
            accel: {acceleration > 0 ? `+${acceleration}` : acceleration} m/s²
          </span>
        </div>

        {/* 3 Action Badges */}
        <div className="grid grid-cols-3 gap-1.5 my-2">
          {/* Action 0: BRAKE */}
          <div
            className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all ${
              currentAction === 0
                ? 'border-rose-400 bg-rose-500 text-white shadow-md shadow-rose-200 scale-102 glow-brake'
                : 'border-slate-200 bg-slate-50 text-slate-500 opacity-60'
            }`}
          >
            <span className="text-base font-bold">🛑</span>
            <span className="text-[11px] font-bold uppercase tracking-wider mt-0.5">Brake</span>
          </div>

          {/* Action 1: ACCELERATE */}
          <div
            className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all ${
              currentAction === 1
                ? 'border-emerald-400 bg-emerald-500 text-white shadow-md shadow-emerald-200 scale-102 glow-accel'
                : 'border-slate-200 bg-slate-50 text-slate-500 opacity-60'
            }`}
          >
            <span className="text-base font-bold">⚡</span>
            <span className="text-[11px] font-bold uppercase tracking-wider mt-0.5">Gas</span>
          </div>

          {/* Action 2: MAINTAIN */}
          <div
            className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all ${
              currentAction === 2
                ? 'border-amber-400 bg-amber-500 text-white shadow-md shadow-amber-200 scale-102 glow-maintain'
                : 'border-slate-200 bg-slate-50 text-slate-500 opacity-60'
            }`}
          >
            <span className="text-base font-bold">⏸️</span>
            <span className="text-[11px] font-bold uppercase tracking-wider mt-0.5">Coast</span>
          </div>
        </div>

        {/* Action Q-Value Preview */}
        <div className="flex items-center justify-between text-[11px] font-mono text-slate-500">
          <span>Q(B): <strong className="text-rose-600">{telemetry?.q_values?.[0] ?? 0}</strong></span>
          <span>Q(A): <strong className="text-emerald-600">{telemetry?.q_values?.[1] ?? 0}</strong></span>
          <span>Q(M): <strong className="text-amber-600">{telemetry?.q_values?.[2] ?? 0}</strong></span>
        </div>
      </div>

      {/* 4. Episode & Reward Analytics Card */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm flex flex-col justify-between">
        <div className="flex items-center justify-between text-slate-500">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider">
            <Award className="h-4 w-4 text-emerald-500" />
            <span>Cumulative Reward</span>
          </div>
          <span className="font-mono text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
            Step {stepCount}/{maxSteps}
          </span>
        </div>

        <div className="my-2 flex items-baseline gap-2">
          <span
            className={`font-mono text-3xl font-extrabold tracking-tight ${
              cumulativeReward > 0 ? 'text-emerald-600' : cumulativeReward < 0 ? 'text-rose-600' : 'text-slate-900'
            }`}
          >
            {cumulativeReward > 0 ? `+${cumulativeReward.toFixed(1)}` : cumulativeReward.toFixed(1)}
          </span>
          <span className="text-xs font-mono text-slate-400">
            (last: {reward > 0 ? `+${reward.toFixed(2)}` : reward.toFixed(2)})
          </span>
        </div>

        {/* Session Aggregate Rates */}
        <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-1 text-slate-600">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            <span>Success: <strong className="font-mono text-slate-900">{stats?.success_rate ?? 0}%</strong></span>
          </div>
          <div className="flex items-center gap-1 text-slate-600">
            <XCircle className="h-3.5 w-3.5 text-rose-500" />
            <span>Crash: <strong className="font-mono text-slate-900">{stats?.crash_rate ?? 0}%</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
}
