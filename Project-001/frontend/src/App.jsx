import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Cpu, Wifi, WifiOff, AlertCircle } from 'lucide-react';
import GridEnvironment from './components/GridEnvironment';
import ControlPanel from './components/ControlPanel';
import TrainingStats from './components/TrainingStats';
import LearningCurve from './components/LearningCurve';
import CellInspector from './components/CellInspector';
import ConfigPanel from './components/ConfigPanel';
import EpisodeHistory from './components/EpisodeHistory';
import {
  createEnvironment,
  startTraining, pauseTraining, resumeTraining, resetTraining,
  updateSpeed, runPolicyDemo, connectWebSocket, getTrainingStatus, getQTable,
} from './services/api';

const DEFAULT_CONFIG = {
  rows: 4, cols: 4,
  start: [0, 0], goal: [3, 3],
  obstacles: [[1, 1], [1, 2], [2, 1]],
  goal_reward: 100, step_penalty: -1, wall_penalty: -5,
  alpha: 0.1, gamma: 0.9,
  epsilon: 0.2, epsilon_decay: 0.995, epsilon_min: 0.01,
  episodes: 500, max_steps: 100, delay_ms: 30,
};

export default function App() {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [sessionId, setSessionId] = useState(null);
  const [trainingStatus, setTrainingStatus] = useState('idle');
  const [currentEpisode, setCurrentEpisode] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [lastReward, setLastReward] = useState(0);
  const [avgReward, setAvgReward] = useState(0);
  const [epsilon, setEpsilon] = useState(DEFAULT_CONFIG.epsilon);
  const [qTable, setQTable] = useState(null);
  const [bestActions, setBestActions] = useState(null);
  const [agentPosition, setAgentPosition] = useState(DEFAULT_CONFIG.start);
  const [selectedCell, setSelectedCell] = useState(null);
  const [history, setHistory] = useState([]);
  const [activeTool, setActiveTool] = useState('wall');
  const [showQValues, setShowQValues] = useState(true);
  const [showPolicyArrows, setShowPolicyArrows] = useState(true);
  const [delayMs, setDelayMs] = useState(30);
  const [isPolicyRunning, setIsPolicyRunning] = useState(false);
  const [connected, setConnected] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // Replay state
  const [isReplayMode, setIsReplayMode] = useState(false);
  const [replayPath, setReplayPath] = useState([]);
  const [replayStepIndex, setReplayStepIndex] = useState(0);

  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  const handleMsg = useCallback((msg) => {
    switch (msg.type) {
      case 'init':
        setTrainingStatus(msg.status || 'idle');
        setEpsilon(msg.epsilon ?? DEFAULT_CONFIG.epsilon);
        if (msg.q_table) setQTable(msg.q_table);
        if (msg.best_actions) setBestActions(msg.best_actions);
        break;
      case 'episode_start':
        setCurrentEpisode(msg.episode);
        setCurrentStep(0);
        setEpsilon(msg.epsilon);
        break;
      case 'step':
        setCurrentStep(msg.step);
        setLastReward(msg.reward);
        setEpsilon(msg.epsilon);
        setAgentPosition(msg.agent_position);
        break;
      case 'episode_end':
        setCurrentEpisode(msg.episode);
        setLastReward(msg.episode_reward);
        setAvgReward(msg.avg_reward);
        setEpsilon(msg.epsilon);
        if (msg.q_table) setQTable(msg.q_table);
        if (msg.best_actions) setBestActions(msg.best_actions);
        setHistory(prev => [...prev.slice(-100), { episode: msg.episode, reward: msg.episode_reward, avgReward: msg.avg_reward }]);
        break;
      case 'training_finished':
        setTrainingStatus('finished');
        if (msg.q_table) setQTable(msg.q_table);
        if (msg.best_actions) setBestActions(msg.best_actions);
        setEpsilon(msg.final_epsilon);
        break;
      case 'reset_ack':
        setAgentPosition(msg.agent_position);
        if (msg.q_table) setQTable(msg.q_table);
        if (msg.best_actions) setBestActions(msg.best_actions);
        setTrainingStatus('idle');
        setCurrentEpisode(0);
        setCurrentStep(0);
        setHistory([]);
        setIsReplayMode(false);
        break;
      case 'policy_demo_start':
        setIsPolicyRunning(true);
        setIsReplayMode(false);
        setAgentPosition(msg.start);
        break;
      case 'policy_demo_step':
        setAgentPosition(msg.agent_position);
        break;
      case 'policy_demo_finished':
        setIsPolicyRunning(false);
        break;
      default: break;
    }
  }, []);

  const setupWebSocket = useCallback((sid) => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    const ws = connectWebSocket(
      sid,
      handleMsg,
      () => setConnected(false),
      () => {
        setConnected(false);
        // Attempt reconnect if still in this session
        reconnectTimeoutRef.current = setTimeout(() => {
          if (sessionId === sid) {
            setupWebSocket(sid);
          }
        }, 3000);
      },
      () => setConnected(true),
    );
    wsRef.current = ws;
  }, [handleMsg, sessionId]);

  const initSession = async (cfg) => {
    try {
      if (wsRef.current) {
        wsRef.current.close();
      }
      clearTimeout(reconnectTimeoutRef.current);
      setIsReplayMode(false);
      setReplayPath([]);
      setReplayStepIndex(0);
      setErrorMessage(null);

      const data = await createEnvironment(cfg);
      setSessionId(data.session_id);
      setTrainingStatus('idle');
      setCurrentEpisode(0);
      setCurrentStep(0);
      setLastReward(0);
      setAvgReward(0);
      setEpsilon(cfg.epsilon);
      setAgentPosition(cfg.start);
      setSelectedCell(null);
      setHistory([]);

      setupWebSocket(data.session_id);
      return data.session_id;
    } catch (err) {
      console.error("Init session error:", err);
      setErrorMessage("Connecting to backend... If this is the first load, Render may take 20s to wake up.");
      return null;
    }
  };

  useEffect(() => {
    initSession(DEFAULT_CONFIG);
    return () => {
      wsRef.current?.close();
      clearTimeout(reconnectTimeoutRef.current);
    };
  }, []);

  // Background polling sync when training is active (bulletproof fallback if WS lags)
  useEffect(() => {
    if (trainingStatus !== 'training' || !sessionId) return;

    const interval = setInterval(async () => {
      try {
        const status = await getTrainingStatus(sessionId);
        setCurrentEpisode(status.current_episode);
        setCurrentStep(status.current_step);
        setLastReward(status.last_reward);
        setEpsilon(status.epsilon);
        if (status.status !== 'training') {
          setTrainingStatus(status.status);
          const qData = await getQTable(sessionId);
          setQTable(qData.q_table);
          setBestActions(qData.best_actions);
        }
      } catch (e) {
        // ignore polling error
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [trainingStatus, sessionId]);

  // Cell editor
  const handleCellClick = (r, c) => {
    setSelectedCell([r, c]);
    if (trainingStatus === 'training' || isReplayMode) return;

    if (activeTool === 'agent') {
      if (config.goal[0] === r && config.goal[1] === c) return;
      const nc = { ...config, start: [r, c], obstacles: config.obstacles.filter(([or, oc]) => !(or === r && oc === c)) };
      setConfig(nc); setAgentPosition([r, c]); initSession(nc);
    } else if (activeTool === 'goal') {
      if (config.start[0] === r && config.start[1] === c) return;
      const nc = { ...config, goal: [r, c], obstacles: config.obstacles.filter(([or, oc]) => !(or === r && oc === c)) };
      setConfig(nc); initSession(nc);
    } else if (activeTool === 'wall') {
      if ((config.start[0] === r && config.start[1] === c) || (config.goal[0] === r && config.goal[1] === c)) return;
      const exists = config.obstacles.some(([or, oc]) => or === r && oc === c);
      const obs = exists ? config.obstacles.filter(([or, oc]) => !(or === r && oc === c)) : [...config.obstacles, [r, c]];
      const nc = { ...config, obstacles: obs };
      setConfig(nc); initSession(nc);
    } else if (activeTool === 'erase') {
      const nc = { ...config, obstacles: config.obstacles.filter(([or, oc]) => !(or === r && oc === c)) };
      setConfig(nc); initSession(nc);
    }
  };

  const handleStart = async () => {
    setIsStarting(true);
    setErrorMessage(null);
    setIsReplayMode(false);

    try {
      let activeSid = sessionId;
      if (!activeSid) {
        activeSid = await initSession(config);
        if (!activeSid) {
          throw new Error("Could not initialize session with backend. Please check server status.");
        }
      }

      await startTraining(activeSid);
      setTrainingStatus('training');

      // Also trigger via WebSocket if open
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ action: "start" }));
      }
    } catch (err) {
      console.error("Failed to start training:", err);
      // Fallback: try starting directly via websocket
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ action: "start" }));
        setTrainingStatus('training');
      } else {
        setErrorMessage(err.response?.data?.detail || err.message || "Failed to start training");
      }
    } finally {
      setIsStarting(false);
    }
  };

  const handlePause = async () => {
    try {
      if (sessionId) await pauseTraining(sessionId);
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ action: "pause" }));
      }
      setTrainingStatus('paused');
    } catch (err) {
      console.error(err);
    }
  };

  const handleResume = async () => {
    try {
      if (sessionId) await resumeTraining(sessionId);
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ action: "resume" }));
      }
      setTrainingStatus('training');
    } catch (err) {
      console.error(err);
    }
  };

  const handleReset = async () => {
    try {
      if (sessionId) await resetTraining(sessionId);
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ action: "reset" }));
      }
      setTrainingStatus('idle');
      setCurrentEpisode(0);
      setCurrentStep(0);
      setLastReward(0);
      setAvgReward(0);
      setAgentPosition(config.start);
      setHistory([]);
      setIsReplayMode(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSpeedChange = async (ms) => {
    setDelayMs(ms);
    if (sessionId) {
      try {
        await updateSpeed(sessionId, ms);
      } catch (err) {
        console.error(err);
      }
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ action: "set_speed", delay_ms: ms }));
      }
    }
  };

  const handleRunPolicy = async () => {
    if (!sessionId) return;
    setIsReplayMode(false);
    setIsPolicyRunning(true);
    try {
      await runPolicyDemo(sessionId, 220);
    } catch (err) {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ action: "run_demo", speed_ms: 220 }));
      } else {
        setIsPolicyRunning(false);
      }
    }
  };

  const handlePreset = (type) => {
    const presets = {
      classic: { ...DEFAULT_CONFIG, rows: 3, cols: 3, start: [0,0], goal: [2,2], obstacles: [[1,0]], episodes: 300, max_steps: 50 },
      maze: { ...DEFAULT_CONFIG, rows: 5, cols: 5, start: [0,0], goal: [4,4], obstacles: [[0,2],[1,2],[2,2],[3,2],[3,4],[2,4]], episodes: 600, max_steps: 100 },
      complex: { ...DEFAULT_CONFIG, rows: 6, cols: 6, start: [0,0], goal: [5,5], obstacles: [[1,1],[1,2],[1,3],[3,2],[3,3],[3,4],[4,1],[4,2]], episodes: 1000, max_steps: 120 },
    };
    const nc = presets[type] || DEFAULT_CONFIG;
    setConfig(nc);
    initSession(nc);
  };

  const handleStartReplay = (path, trajectory) => {
    setIsReplayMode(true);
    setReplayPath(path || []);
    setReplayStepIndex(0);
    if (path?.length > 0) setAgentPosition(path[0]);
  };

  const handleStopReplay = () => {
    setIsReplayMode(false);
    setReplayPath([]);
    setReplayStepIndex(0);
    setAgentPosition(config.start);
  };

  const handleReplayStep = (valOrFn) => {
    setReplayStepIndex(prev => {
      const next = typeof valOrFn === 'function' ? valOrFn(prev) : valOrFn;
      if (replayPath?.[next]) setAgentPosition(replayPath[next]);
      return next;
    });
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f7f7f5', fontFamily: 'Inter, sans-serif' }}>
      {/* NAV BAR */}
      <header style={{
        background: 'white',
        borderBottom: '1.5px solid #e5e5e5',
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 32px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Cpu size={18} color="white" />
            </div>
            <div>
              <h1 style={{ fontSize: 16, fontWeight: 900, color: '#0a0a0a', letterSpacing: '-0.03em', lineHeight: 1 }}>
                RL Playground
              </h1>
              <p style={{ fontSize: 11, color: '#bbb', fontFamily: 'JetBrains Mono', fontWeight: 500, letterSpacing: '0.04em', marginTop: 1 }}>
                Q-Learning · GridWorld Visualizer
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Connection status */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '6px 14px', borderRadius: 100,
              background: connected ? '#edfff5' : '#fff0f0',
              border: `1.5px solid ${connected ? '#b3f0cf' : '#ffc0c0'}`,
              fontSize: 12, fontWeight: 700,
              color: connected ? '#00843d' : '#cc0000',
            }}>
              {connected
                ? <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#00c853', boxShadow: '0 0 6px rgba(0,200,83,0.6)' }} />
                : <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#ff1744' }} />
              }
              {connected ? 'Backend Live' : 'Connecting...'}
            </div>

            {sessionId && (
              <div style={{
                padding: '6px 14px', borderRadius: 100, border: '1.5px solid #e5e5e5',
                fontSize: 12, fontFamily: 'JetBrains Mono', fontWeight: 600, color: '#6b6b6b',
              }}>
                session: <span style={{ color: '#0a0a0a', fontWeight: 700 }}>{sessionId}</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Error alert banner if any */}
      {errorMessage && (
        <div style={{ maxWidth: 1400, margin: '16px auto 0', padding: '0 32px' }}>
          <div style={{
            background: '#fff0f0', border: '1.5px solid #ffc0c0', borderRadius: 12,
            padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            color: '#cc0000', fontSize: 13, fontWeight: 600
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <AlertCircle size={16} />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => initSession(config)}
              style={{
                background: '#cc0000', color: 'white', border: 'none', borderRadius: 6,
                padding: '4px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer'
              }}
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* MAIN LAYOUT */}
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '28px 32px', display: 'grid', gridTemplateColumns: '1fr 420px', gap: 24, alignItems: 'start' }}>

        {/* LEFT: Grid + Stats + Charts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Training Stats */}
          <TrainingStats
            trainingStatus={trainingStatus}
            currentEpisode={currentEpisode}
            totalEpisodes={config.episodes}
            currentStep={currentStep}
            lastReward={lastReward}
            avgReward={avgReward}
            epsilon={epsilon}
          />

          {/* Grid World Card */}
          <div className="card">
            <div className="card-section" style={{ borderBottom: '1.5px solid #e5e5e5', paddingBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: trainingStatus === 'training' ? '#00c853' : '#e5e5e5',
                    boxShadow: trainingStatus === 'training' ? '0 0 8px rgba(0,200,83,0.7)' : undefined,
                  }} />
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#0a0a0a', letterSpacing: '-0.02em' }}>
                    GridWorld {config.rows}×{config.cols}
                  </span>
                </div>
                <span style={{ fontSize: 12, color: '#bbb', fontWeight: 500 }}>
                  {isReplayMode ? 'Replay mode' : `Tool: ${activeTool}`}
                </span>
              </div>
            </div>

            <div className="card-section" style={{ display: 'flex', justifyContent: 'center', padding: '28px 24px' }}>
              <GridEnvironment
                rows={config.rows} cols={config.cols}
                start={config.start} goal={config.goal}
                obstacles={config.obstacles}
                agentPosition={agentPosition}
                qTable={qTable} bestActions={bestActions}
                activeTool={activeTool}
                onCellClick={handleCellClick}
                selectedCell={selectedCell}
                showQValues={showQValues}
                showPolicyArrows={showPolicyArrows}
                isTraining={trainingStatus === 'training'}
                replayPath={replayPath}
                replayStepIndex={replayStepIndex}
                isReplayMode={isReplayMode}
              />
            </div>
          </div>

          {/* Episode History */}
          <EpisodeHistory
            sessionId={sessionId}
            currentEpisode={currentEpisode}
            isTraining={trainingStatus === 'training'}
            onStartReplay={handleStartReplay}
            onStopReplay={handleStopReplay}
            isReplayMode={isReplayMode}
            replayStepIndex={replayStepIndex}
            onStepChange={handleReplayStep}
          />

          {/* Learning Curve */}
          <LearningCurve history={history} />
        </div>

        {/* RIGHT: Controls + Inspector + Config */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, position: 'sticky', top: 80 }}>
          <ControlPanel
            trainingStatus={trainingStatus}
            activeTool={activeTool}
            setActiveTool={setActiveTool}
            onStart={handleStart}
            onPause={handlePause}
            onResume={handleResume}
            onReset={handleReset}
            onRunPolicy={handleRunPolicy}
            delayMs={delayMs}
            onSpeedChange={handleSpeedChange}
            showQValues={showQValues}
            setShowQValues={setShowQValues}
            showPolicyArrows={showPolicyArrows}
            setShowPolicyArrows={setShowPolicyArrows}
            isPolicyRunning={isPolicyRunning}
            isStarting={isStarting}
          />

          <CellInspector
            selectedCell={selectedCell}
            qTable={qTable}
            bestActions={bestActions}
            start={config.start}
            goal={config.goal}
            obstacles={config.obstacles}
          />

          <ConfigPanel
            config={config}
            onChange={setConfig}
            onApply={() => initSession(config)}
            isTraining={trainingStatus === 'training'}
            onLoadPreset={handlePreset}
          />
        </div>
      </div>

      {/* Footer */}
      <footer style={{ borderTop: '1.5px solid #e5e5e5', background: 'white', padding: '16px 32px', marginTop: 32 }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#bbb', fontFamily: 'JetBrains Mono' }}>
            Q-Learning · Temporal Difference · FastAPI + React
          </span>
          <span style={{ fontSize: 12, color: '#bbb' }}>
            RL Playground — Atharva Sharna
          </span>
        </div>
      </footer>
    </div>
  );
}
