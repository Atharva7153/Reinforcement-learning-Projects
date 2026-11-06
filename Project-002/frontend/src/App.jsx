import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import {
  Car,
  Wifi,
  WifiOff,
  Cpu,
  Zap,
  Sliders,
  Play,
  RotateCcw,
  Sparkles,
  BookOpen,
  Info
} from 'lucide-react';

import CarSimulationCanvas from './components/CarSimulationCanvas';
import TelemetryHUD from './components/TelemetryHUD';
import ControlPanel from './components/ControlPanel';
import PolicyHeatmap from './components/PolicyHeatmap';
import AnalyticsCharts from './components/AnalyticsCharts';
import ConfigModal from './components/ConfigModal';

// Determine backend API and WS URLs
const getApiBase = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (window.location.port === '5174' || window.location.port === '5173') {
    return 'http://localhost:8000';
  }
  return window.location.origin;
};

const getWsBase = () => {
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL;
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  if (window.location.port === '5174' || window.location.port === '5173') {
    return 'ws://localhost:8000';
  }
  return `${protocol}//${window.location.host}`;
};

export default function App() {
  const [sessionId] = useState(() => {
    let id = sessionStorage.getItem('auto_stop_session_id');
    if (!id) {
      id = 'session-' + Math.random().toString(36).substring(2, 9);
      sessionStorage.setItem('auto_stop_session_id', id);
    }
    return id;
  });

  const [connected, setConnected] = useState(false);
  const [mode, setMode] = useState('PAUSED'); // 'AUTOPILOT', 'TRAINING', 'MANUAL', 'PAUSED'
  const [speedDelay, setSpeedDelay] = useState(40);
  const [telemetry, setTelemetry] = useState(null);
  const [stats, setStats] = useState(null);
  const [policy, setPolicy] = useState(null);
  const [config, setConfig] = useState(null);
  const [hyperparams, setHyperparams] = useState(null);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isTrainingBatch, setIsTrainingBatch] = useState(false);

  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const apiBase = getApiBase();
  const wsBase = getWsBase();

  // Connect WebSocket
  const connectWebSocket = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;

    const wsUrl = `${wsBase}/ws/${sessionId}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'init') {
          if (msg.stats) {
            setStats(msg.stats);
            setTelemetry(msg.stats.telemetry);
            setMode(msg.stats.mode);
            setSpeedDelay(msg.stats.speed_delay_ms);
          }
          if (msg.policy) setPolicy(msg.policy);
          if (msg.config) setConfig(msg.config);
          if (msg.hyperparams) setHyperparams(msg.hyperparams);
        } else if (msg.type === 'step') {
          if (msg.telemetry) setTelemetry(msg.telemetry);
          if (msg.stats) setStats(msg.stats);
          if (msg.policy) setPolicy(msg.policy);
        } else if (msg.type === 'episode_start') {
          if (msg.telemetry) setTelemetry(msg.telemetry);
          if (msg.stats) setStats(msg.stats);
        } else if (msg.type === 'batch_train_done') {
          if (msg.stats) setStats(msg.stats);
          if (msg.policy) setPolicy(msg.policy);
          if (msg.stats?.telemetry) setTelemetry(msg.stats.telemetry);
          setIsTrainingBatch(false);
        } else if (msg.type === 'reset_env' || msg.type === 'reset_all') {
          if (msg.telemetry) setTelemetry(msg.telemetry);
          if (msg.stats) setStats(msg.stats);
          if (msg.policy) setPolicy(msg.policy);
        }
      } catch (e) {
        console.error('Error parsing WS message:', e);
      }
    };

    ws.onclose = () => {
      setConnected(false);
      reconnectTimeoutRef.current = setTimeout(connectWebSocket, 2000);
    };

    ws.onerror = (err) => {
      console.warn('WS error, fallback to REST if needed', err);
      ws.close();
    };
  }, [wsBase, sessionId]);

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, [connectWebSocket]);

  // Send message helper
  const sendWs = useCallback((payload) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    }
  }, []);

  // Mode change handler
  const handleSetMode = async (newMode) => {
    setMode(newMode);
    sendWs({ command: 'mode', mode: newMode });
    try {
      await axios.post(`${apiBase}/api/session/${sessionId}/mode`, { mode: newMode });
    } catch (e) {
      console.error('Error setting mode via REST:', e);
    }
  };

  // Speed change handler
  const handleSetSpeed = async (delayMs) => {
    setSpeedDelay(delayMs);
    sendWs({ command: 'speed', delay_ms: delayMs });
    try {
      await axios.post(`${apiBase}/api/session/${sessionId}/speed`, { delay_ms: delayMs });
    } catch (e) {
      console.error('Error setting speed:', e);
    }
  };

  // Manual step handler
  const handleStepManual = async (action) => {
    sendWs({ command: 'step', action });
    try {
      const res = await axios.post(`${apiBase}/api/session/${sessionId}/step`, { action });
      setTelemetry(res.data);
    } catch (e) {
      console.error('Error stepping manual:', e);
    }
  };

  // Turbo Batch Train handler
  const handleBatchTrain = async (episodes) => {
    setIsTrainingBatch(true);
    sendWs({ command: 'batch_train', episodes });
    try {
      const res = await axios.post(`${apiBase}/api/session/${sessionId}/batch_train`, { episodes });
      if (res.data?.stats) setStats(res.data.stats);
      if (res.data?.policy) setPolicy(res.data.policy);
      if (res.data?.stats?.telemetry) setTelemetry(res.data.stats.telemetry);
    } catch (e) {
      console.error('Error running batch train:', e);
    } finally {
      setIsTrainingBatch(false);
    }
  };

  // Reset Environment position
  const handleResetEnv = async () => {
    sendWs({ command: 'reset_env' });
    try {
      const res = await axios.post(`${apiBase}/api/session/${sessionId}/reset_env`);
      if (res.data?.telemetry) setTelemetry(res.data.telemetry);
    } catch (e) {
      console.error('Error resetting env:', e);
    }
  };

  // Reset Agent Memory & Q-table
  const handleResetAll = async () => {
    if (!window.confirm('Reset the agent Q-Table memory and training statistics?')) return;
    sendWs({ command: 'reset_all' });
    try {
      const res = await axios.post(`${apiBase}/api/session/${sessionId}/reset_all`);
      if (res.data?.telemetry) setTelemetry(res.data.telemetry);
    } catch (e) {
      console.error('Error resetting all:', e);
    }
  };

  // Apply new config & hyperparams
  const handleSaveConfig = async ({ config: newConfig, hyperparams: newHp }) => {
    try {
      await axios.post(`${apiBase}/api/session/${sessionId}/config`, newConfig);
      await axios.post(`${apiBase}/api/session/${sessionId}/hyperparams`, newHp);
      setConfig(newConfig);
      setHyperparams(newHp);
      handleResetEnv();
    } catch (e) {
      console.error('Error updating config:', e);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 pb-16">
      {/* ── Top Navigation Bar ────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-500 text-white shadow-md shadow-indigo-200">
              <Car className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-base sm:text-lg tracking-tight text-slate-900">
                  AutoStop RL
                </h1>
                <span className="hidden sm:inline-block rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-600">
                  Playground 2.0
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                Autonomous 2D Car Emergency Braking with Tabular Q-Learning
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Live Status Indicator */}
            <div
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                connected
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/70'
                  : 'bg-rose-50 text-rose-700 border border-rose-200/70'
              }`}
            >
              {connected ? (
                <>
                  <Wifi className="h-3.5 w-3.5 animate-pulse text-emerald-600" />
                  <span className="hidden sm:inline">Live Engine Connected</span>
                  <span className="sm:hidden">Live</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-3.5 w-3.5 text-rose-600" />
                  <span>Connecting...</span>
                </>
              )}
            </div>

            {/* Config Button */}
            <button
              onClick={() => setIsConfigOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-all shadow-xs"
            >
              <Sliders className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Physics Config</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Content Area ─────────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* 1. 2D Car Track Simulation Canvas */}
        <section>
          <CarSimulationCanvas
            telemetry={telemetry}
            config={config}
            stats={stats}
            isTraining={mode === 'TRAINING'}
            mode={mode}
          />
        </section>

        {/* 2. Real-Time Telemetry HUD */}
        <section>
          <TelemetryHUD
            telemetry={telemetry}
            stats={stats}
            config={config}
          />
        </section>

        {/* 3. Interactive Control Panel */}
        <section>
          <ControlPanel
            mode={mode}
            setMode={handleSetMode}
            speedDelay={speedDelay}
            setSpeedDelay={handleSetSpeed}
            onStepManual={handleStepManual}
            onBatchTrain={handleBatchTrain}
            onResetEnv={handleResetEnv}
            onResetAll={handleResetAll}
            onOpenConfig={() => setIsConfigOpen(true)}
            isTrainingBatch={isTrainingBatch}
          />
        </section>

        {/* 4. Policy Heatmap & Q-Table Matrix */}
        <section>
          <PolicyHeatmap
            policy={policy}
            currentBin={telemetry?.state_bin}
          />
        </section>

        {/* 5. Performance Analytics & Reward Trends */}
        <section>
          <AnalyticsCharts stats={stats} />
        </section>

        {/* 6. Educational Primer / How It Works */}
        <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="h-5 w-5 text-indigo-600" />
            <h3 className="font-bold text-slate-900 text-sm">
              Reinforcement Learning Formulation & Mechanics
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-slate-600 leading-relaxed">
            <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 border border-slate-100">
              <h4 className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                <span>🎯 Objective & Safe Stop Zone</span>
              </h4>
              <p>
                The car starts with forward velocity (10 – 18 m/s) approaching a rigid barrier at d = 0m.
                The goal is to bring the car to a complete stop (velocity ≤ 0.35 m/s) inside the target buffer zone
                between <strong>1.0m and 4.0m</strong> from the wall.
              </p>
            </div>

            <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 border border-slate-100">
              <h4 className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                <span>⚡ 3 Discrete Actions</span>
              </h4>
              <p>
                <strong>0. Brake:</strong> Applies maximum brake force (a = -5.0 m/s²).<br />
                <strong>1. Accelerate:</strong> Applies throttle (a = +2.5 m/s²).<br />
                <strong>2. Maintain:</strong> Coasts with slight aerodynamic drag (a = -0.3 m/s²).
              </p>
            </div>

            <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 border border-slate-100">
              <h4 className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                <span>📐 Bellman Q-Learning Equation</span>
              </h4>
              <p className="font-mono text-[11px] text-slate-800 bg-white p-2 rounded-lg border border-slate-200">
                Q(s, a) ← Q(s, a) + α [r + γ maxₐ' Q(s', a') - Q(s, a)]
              </p>
              <p>
                The state space (distance, velocity) is discretized into a 2D matrix (19 × 10 bins). The agent learns when to coast and when to initiate emergency braking.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Configuration Modal */}
      <ConfigModal
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        config={config}
        hyperparams={hyperparams}
        onSave={handleSaveConfig}
      />
    </div>
  );
}
