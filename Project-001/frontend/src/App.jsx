import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Cpu, Sliders, LineChart, History, Crosshair, Settings, BookOpen,
  Volume2, VolumeX, Sparkles, Play, Pause, RotateCcw, Zap, X,
  AlertCircle, Wrench, Layers, Bot, Flag, Ban, Flame, Waves, Snowflake, Orbit, Eraser
} from 'lucide-react';

import GridEnvironment from './components/GridEnvironment';
import ControlPanel from './components/ControlPanel';
import TrainingStats from './components/TrainingStats';
import LearningCurve from './components/LearningCurve';
import CellInspector from './components/CellInspector';
import ConfigPanel from './components/ConfigPanel';
import EpisodeHistory from './components/EpisodeHistory';
import SplashScreen from './components/SplashScreen';
import TileGuideModal from './components/TileGuideModal';

import {
  createEnvironment,
  startTraining, pauseTraining, resumeTraining, resetTraining,
  updateSpeed, runPolicyDemo, connectWebSocket, getTrainingStatus, getQTable,
} from './services/api';

import {
  playClickSound,
  playStepSound,
  playGoalSound,
  playCliffSound,
  playSlipSound,
  playPortalSound,
  toggleMute,
  getMuteState,
} from './utils/sound';

const DEFAULT_CONFIG = {
  rows: 4, cols: 4,
  start: [0, 0], goal: [3, 3],
  obstacles: [[1, 1], [1, 2]],
  cliffs: [[2, 1]],
  mud: [[2, 2]],
  ice: [[0, 2]],
  portals: [],
  goal_reward: 100, step_penalty: -1, wall_penalty: -5,
  cliff_penalty: -50, mud_penalty: -5, slippery_prob: 0.3,
  alpha: 0.1, gamma: 0.9,
  epsilon: 0.2, epsilon_decay: 0.995, epsilon_min: 0.01,
  episodes: 500, max_steps: 150, delay_ms: 30,
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
  const [stateValues, setStateValues] = useState({});
  const [visitCounts, setVisitCounts] = useState({});
  const [agentPosition, setAgentPosition] = useState(DEFAULT_CONFIG.start);
  const [selectedCell, setSelectedCell] = useState(null);
  const [history, setHistory] = useState([]);
  const [activeTool, setActiveTool] = useState('wall');
  const [showQValues, setShowQValues] = useState(true);
  const [showPolicyArrows, setShowPolicyArrows] = useState(true);
  const [showValueHeatmap, setShowValueHeatmap] = useState(false);
  const [showVisitHeatmap, setShowVisitHeatmap] = useState(false);
  const [delayMs, setDelayMs] = useState(30);
  const [isPolicyRunning, setIsPolicyRunning] = useState(false);
  const [connected, setConnected] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // Active floating panel on right: 'tools' | 'analytics' | 'replay' | 'inspector' | 'config' | null
  const [activePanel, setActivePanel] = useState('tools');
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isSplashOpen, setIsSplashOpen] = useState(true);
  const [isMuted, setIsMuted] = useState(getMuteState());
  const [pendingPortalEntrance, setPendingPortalEntrance] = useState(null); // [r, c] or null

  // Replay state
  const [isReplayMode, setIsReplayMode] = useState(false);
  const [replayPath, setReplayPath] = useState([]);
  const [replayStepIndex, setReplayStepIndex] = useState(0);
  const [selectedReplayEpisode, setSelectedReplayEpisode] = useState(null);

  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const lastSoundTimeRef = useRef(0);

  // Throttled sound helper for training steps
  const triggerThrottledStepSound = () => {
    const now = Date.now();
    if (now - lastSoundTimeRef.current >= 60) {
      lastSoundTimeRef.current = now;
      playStepSound();
    }
  };

  const handleMsg = useCallback((msg) => {
    switch (msg.type) {
      case 'init':
        setTrainingStatus(msg.status || 'idle');
        setEpsilon(msg.epsilon ?? DEFAULT_CONFIG.epsilon);
        if (msg.q_table) setQTable(msg.q_table);
        if (msg.best_actions) setBestActions(msg.best_actions);
        if (msg.state_values) setStateValues(msg.state_values);
        if (msg.visit_counts) setVisitCounts(msg.visit_counts);
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
        triggerThrottledStepSound();
        break;
      case 'episode_end':
        setCurrentEpisode(msg.episode);
        setLastReward(msg.episode_reward);
        setAvgReward(msg.avg_reward);
        setEpsilon(msg.epsilon);
        if (msg.q_table) setQTable(msg.q_table);
        if (msg.best_actions) setBestActions(msg.best_actions);
        if (msg.state_values) setStateValues(msg.state_values);
        if (msg.visit_counts) setVisitCounts(msg.visit_counts);

        // Sound triggers based on outcome
        if (msg.episode_reward > 0) {
          playGoalSound();
        } else if (msg.episode_reward <= -40) {
          playCliffSound();
        }

        setHistory((prev) => [
          ...prev.slice(-200),
          {
            episode: msg.episode,
            reward: msg.episode_reward,
            avgReward: msg.avg_reward,
            steps: msg.steps,
            avg_td_error: msg.avg_td_error ?? 0,
          },
        ]);
        break;
      case 'training_finished':
        setTrainingStatus('finished');
        if (msg.q_table) setQTable(msg.q_table);
        if (msg.best_actions) setBestActions(msg.best_actions);
        if (msg.state_values) setStateValues(msg.state_values);
        if (msg.visit_counts) setVisitCounts(msg.visit_counts);
        setEpsilon(msg.final_epsilon);
        playGoalSound();
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
        playStepSound();
        break;
      case 'policy_demo_finished':
        setIsPolicyRunning(false);
        playGoalSound();
        break;
      default:
        break;
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
      setStateValues({});
      setVisitCounts({});

      setupWebSocket(data.session_id);
      return data.session_id;
    } catch (err) {
      console.error('Init session error:', err);
      setErrorMessage('Connecting to backend... If this is initial spin-up, server takes ~20s to wake up.');
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

  // Background polling sync fallback
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
          if (qData.state_values) setStateValues(qData.state_values);
          if (qData.visit_counts) setVisitCounts(qData.visit_counts);
        }
      } catch (e) {
        // Polling catch
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [trainingStatus, sessionId]);

  const handleSelectTool = (toolId) => {
    playClickSound();
    setActiveTool(toolId);
    if (toolId !== 'portal') {
      setPendingPortalEntrance(null);
    }
  };

  // Comprehensive cell editor for all tile types
  const handleCellClick = (r, c) => {
    setSelectedCell([r, c]);
    if (trainingStatus === 'training' || isReplayMode) return;

    const isStartOrGoal =
      (config.start[0] === r && config.start[1] === c) ||
      (config.goal[0] === r && config.goal[1] === c);

    const isMatch = (arr) => (arr || []).some(([ar, ac]) => ar === r && ac === c);
    const filterOut = (arr) => (arr || []).filter(([ar, ac]) => !(ar === r && ac === c));

    // Base cleanup: remove cell from standard tile arrays
    const cleanConfig = {
      ...config,
      obstacles: filterOut(config.obstacles),
      cliffs: filterOut(config.cliffs),
      mud: filterOut(config.mud),
      ice: filterOut(config.ice),
    };

    if (activeTool === 'agent') {
      if (config.goal[0] === r && config.goal[1] === c) return;
      setPendingPortalEntrance(null);
      const nc = { ...cleanConfig, start: [r, c] };
      setConfig(nc);
      setAgentPosition([r, c]);
      initSession(nc);
    } else if (activeTool === 'goal') {
      if (config.start[0] === r && config.start[1] === c) return;
      setPendingPortalEntrance(null);
      const nc = { ...cleanConfig, goal: [r, c] };
      setConfig(nc);
      initSession(nc);
    } else if (activeTool === 'wall') {
      if (isStartOrGoal) return;
      setPendingPortalEntrance(null);
      const exists = isMatch(config.obstacles);
      const updated = exists ? filterOut(config.obstacles) : [...filterOut(config.obstacles), [r, c]];
      const nc = { ...cleanConfig, obstacles: updated };
      setConfig(nc);
      initSession(nc);
    } else if (activeTool === 'cliff') {
      if (isStartOrGoal) return;
      setPendingPortalEntrance(null);
      const exists = isMatch(config.cliffs);
      const updated = exists ? filterOut(config.cliffs) : [...filterOut(config.cliffs), [r, c]];
      const nc = { ...cleanConfig, cliffs: updated };
      setConfig(nc);
      initSession(nc);
    } else if (activeTool === 'mud') {
      if (isStartOrGoal) return;
      setPendingPortalEntrance(null);
      const exists = isMatch(config.mud);
      const updated = exists ? filterOut(config.mud) : [...filterOut(config.mud), [r, c]];
      const nc = { ...cleanConfig, mud: updated };
      setConfig(nc);
      initSession(nc);
    } else if (activeTool === 'ice') {
      if (isStartOrGoal) return;
      setPendingPortalEntrance(null);
      const exists = isMatch(config.ice);
      const updated = exists ? filterOut(config.ice) : [...filterOut(config.ice), [r, c]];
      const nc = { ...cleanConfig, ice: updated };
      setConfig(nc);
      initSession(nc);
    } else if (activeTool === 'portal') {
      if (isStartOrGoal) return;

      const currentPortals = config.portals || [];
      const existingPortalIdx = currentPortals.findIndex(
        ([r1, c1, r2, c2]) => (r1 === r && c1 === c) || (r2 === r && c2 === c)
      );

      // If clicked on an existing portal and no pending entrance, remove that portal pair!
      if (existingPortalIdx !== -1 && !pendingPortalEntrance) {
        const remaining = currentPortals.filter((_, idx) => idx !== existingPortalIdx);
        const nc = { ...cleanConfig, portals: remaining };
        setConfig(nc);
        initSession(nc);
        playClickSound();
        return;
      }

      // Step 1: First click sets the ENTRANCE
      if (!pendingPortalEntrance) {
        setPendingPortalEntrance([r, c]);
        playPortalSound();
        return;
      }

      // Step 2: Second click sets the EXIT
      const [entR, entC] = pendingPortalEntrance;

      // Clicking the exact same cell cancels the pending entrance
      if (entR === r && entC === c) {
        setPendingPortalEntrance(null);
        playClickSound();
        return;
      }

      // Remove any existing portal pair that overlaps with the new entrance or exit
      const filteredPortals = currentPortals.filter(
        ([r1, c1, r2, c2]) =>
          !(r1 === entR && c1 === entC) &&
          !(r2 === entR && c2 === entC) &&
          !(r1 === r && c1 === c) &&
          !(r2 === r && c2 === c)
      );

      const newPortalPair = [entR, entC, r, c];
      const updatedPortals = [...filteredPortals, newPortalPair];

      // Remove any obstacles or hazards at either the entrance or exit cell
      const nc = {
        ...cleanConfig,
        obstacles: (cleanConfig.obstacles || []).filter(([or, oc]) => !(or === entR && oc === entC) && !(or === r && oc === c)),
        cliffs: (cleanConfig.cliffs || []).filter(([cr, cc]) => !(cr === entR && cc === entC) && !(cr === r && cc === c)),
        mud: (cleanConfig.mud || []).filter(([mr, mc]) => !(mr === entR && mc === entC) && !(mr === r && mc === c)),
        ice: (cleanConfig.ice || []).filter(([ir, ic]) => !(ir === entR && ic === entC) && !(ir === r && ic === c)),
        portals: updatedPortals,
      };

      setPendingPortalEntrance(null);
      playPortalSound();
      setConfig(nc);
      initSession(nc);
    } else if (activeTool === 'erase') {
      const filteredPortals = (config.portals || []).filter(
        ([r1, c1, r2, c2]) => !(r1 === r && c1 === c) && !(r2 === r && c2 === c)
      );
      if (pendingPortalEntrance && pendingPortalEntrance[0] === r && pendingPortalEntrance[1] === c) {
        setPendingPortalEntrance(null);
      }
      const nc = { ...cleanConfig, portals: filteredPortals };
      setConfig(nc);
      initSession(nc);
    }
  };

  const handleStart = async () => {
    playClickSound();
    setIsStarting(true);
    setErrorMessage(null);
    setIsReplayMode(false);

    try {
      let activeSid = sessionId;
      if (!activeSid) {
        activeSid = await initSession(config);
        if (!activeSid) throw new Error('Could not initialize session with backend.');
      }

      await startTraining(activeSid);
      setTrainingStatus('training');

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ action: 'start' }));
      }
    } catch (err) {
      console.error('Failed to start training:', err);
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ action: 'start' }));
        setTrainingStatus('training');
      } else {
        setErrorMessage(err.response?.data?.detail || err.message || 'Failed to start training');
      }
    } finally {
      setIsStarting(false);
    }
  };

  const handlePause = async () => {
    playClickSound();
    try {
      if (sessionId) await pauseTraining(sessionId);
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ action: 'pause' }));
      }
      setTrainingStatus('paused');
    } catch (err) {
      console.error(err);
    }
  };

  const handleResume = async () => {
    playClickSound();
    try {
      if (sessionId) await resumeTraining(sessionId);
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ action: 'resume' }));
      }
      setTrainingStatus('training');
    } catch (err) {
      console.error(err);
    }
  };

  const handleReset = async () => {
    playClickSound();
    try {
      if (sessionId) await resetTraining(sessionId);
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ action: 'reset' }));
      }
      setTrainingStatus('idle');
      setCurrentEpisode(0);
      setCurrentStep(0);
      setLastReward(0);
      setAvgReward(0);
      setAgentPosition(config.start);
      setHistory([]);
      setStateValues({});
      setVisitCounts({});
      setPendingPortalEntrance(null);
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
        wsRef.current.send(JSON.stringify({ action: 'set_speed', delay_ms: ms }));
      }
    }
  };

  const handleRunPolicy = async () => {
    playClickSound();
    if (!sessionId) return;
    setIsReplayMode(false);
    setIsPolicyRunning(true);
    try {
      await runPolicyDemo(sessionId, 180);
    } catch (err) {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ action: 'run_demo', speed_ms: 180 }));
      } else {
        setIsPolicyRunning(false);
      }
    }
  };

  // Rich Presets from 3x3 to 20x20
  const handlePreset = (type) => {
    playClickSound();
    setPendingPortalEntrance(null);
    let preset;
    if (type === 'classic') {
      preset = {
        ...DEFAULT_CONFIG,
        rows: 3, cols: 3,
        start: [0, 0], goal: [2, 2],
        obstacles: [[1, 0]],
        cliffs: [], mud: [], ice: [], portals: [],
        episodes: 300, max_steps: 50,
      };
    } else if (type === 'cliff') {
      preset = {
        ...DEFAULT_CONFIG,
        rows: 6, cols: 6,
        start: [5, 0], goal: [5, 5],
        obstacles: [],
        cliffs: [[5, 1], [5, 2], [5, 3], [5, 4]],
        mud: [[3, 2], [3, 3]],
        ice: [], portals: [],
        episodes: 600, max_steps: 120,
      };
    } else if (type === 'hazard') {
      preset = {
        ...DEFAULT_CONFIG,
        rows: 8, cols: 8,
        start: [0, 0], goal: [7, 7],
        obstacles: [[2, 2], [2, 3], [2, 4], [5, 4], [5, 5]],
        cliffs: [[6, 1], [6, 2], [6, 3]],
        mud: [[3, 5], [4, 5], [4, 6]],
        ice: [[1, 4], [1, 5], [1, 6]],
        portals: [[1, 1, 6, 6]],
        episodes: 800, max_steps: 200,
      };
    } else if (type === 'maze') {
      const walls = [];
      for (let i = 0; i < 10; i++) walls.push([3, i]);
      for (let i = 2; i < 12; i++) walls.push([7, i]);
      preset = {
        ...DEFAULT_CONFIG,
        rows: 12, cols: 12,
        start: [0, 0], goal: [11, 11],
        obstacles: walls,
        cliffs: [[4, 4], [4, 5], [8, 8]],
        mud: [[1, 8], [2, 8]],
        ice: [[5, 2], [5, 3], [6, 2]],
        portals: [[2, 2, 9, 9]],
        episodes: 1200, max_steps: 300,
      };
    } else if (type === 'mega') {
      const obs = [];
      for (let r = 2; r < 18; r += 4) {
        for (let c = 2; c < 18; c += 2) {
          obs.push([r, c]);
        }
      }
      preset = {
        ...DEFAULT_CONFIG,
        rows: 20, cols: 20,
        start: [0, 0], goal: [19, 19],
        obstacles: obs,
        cliffs: [[10, 5], [10, 6], [10, 7], [10, 8]],
        mud: [[15, 10], [15, 11], [16, 10], [16, 11]],
        ice: [[4, 12], [4, 13], [5, 12], [5, 13]],
        portals: [[3, 3, 17, 17]],
        episodes: 2000, max_steps: 500, delay_ms: 0,
      };
    }

    if (preset) {
      setConfig(preset);
      initSession(preset);
    }
  };

  const handleStartReplay = (path) => {
    setIsReplayMode(true);
    setReplayPath(path || []);
    setReplayStepIndex(0);
    if (path?.length > 0) setAgentPosition(path[0]);
  };

  const handleStopReplay = () => {
    setIsReplayMode(false);
    setReplayPath([]);
    setReplayStepIndex(0);
    setSelectedReplayEpisode(null);
    setAgentPosition(config.start);
  };

  const handleReplayStep = (valOrFn) => {
    setReplayStepIndex((prev) => {
      const next = typeof valOrFn === 'function' ? valOrFn(prev) : valOrFn;
      if (replayPath?.[next]) setAgentPosition(replayPath[next]);
      return next;
    });
  };

  const handleToggleSound = () => {
    const next = toggleMute();
    setIsMuted(next);
    if (!next) playClickSound();
  };

  const togglePanel = (panelId) => {
    playClickSound();
    setActivePanel((prev) => (prev === panelId ? null : panelId));
  };

  // Convert portal pairs [[r1, c1, r2, c2]] into flat list of coords for visual rendering
  const flatPortalCoords = [];
  (config.portals || []).forEach(([r1, c1, r2, c2]) => {
    flatPortalCoords.push([r1, c1]);
    flatPortalCoords.push([r2, c2]);
  });

  const isTraining = trainingStatus === 'training';
  const isPaused = trainingStatus === 'paused';

  const dockItems = [
    { id: 'tools', label: 'Editor & Tools', icon: Wrench },
    { id: 'controls', label: 'Speed & Controls', icon: Sliders },
    { id: 'analytics', label: 'Analytics Graphs', icon: LineChart },
    { id: 'replay', label: 'Episode Replay', icon: History },
    { id: 'inspector', label: 'Cell Inspector', icon: Crosshair },
    { id: 'config', label: 'Grid & Hyperparams', icon: Settings },
  ];

  return (
    <div className="relative min-h-screen w-full flex flex-col bg-[#f7f7f5] text-neutral-900 font-sans select-none overflow-x-hidden">
      {/* CINEMATIC SPLASH SCREEN */}
      <SplashScreen
        isOpen={isSplashOpen}
        onClose={() => setIsSplashOpen(false)}
        onOpenGuide={() => setIsGuideOpen(true)}
      />

      {/* TILE MECHANICS GUIDE MODAL */}
      <TileGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
      />

      {/* APP TOP NAVIGATION BAR */}
      <header className="sticky top-0 z-40 bg-white border-b border-neutral-200 shadow-2xs">
        <div className="w-full px-4 md:px-6 h-14 flex items-center justify-between gap-3">
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-black flex items-center justify-center text-white shadow-sm">
              <Cpu size={17} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-black tracking-tight leading-none text-black">
                  RL PLAYGROUND
                </h1>
                <span className="hidden sm:inline-block text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-600 border border-neutral-200">
                  v2.0
                </span>
              </div>
              <p className="text-[10px] text-neutral-500 font-mono hidden md:block">
                Dynamic GridWorld · Bellman Optimality · Real-Time MDP
              </p>
            </div>
          </div>

          {/* Quick Hero Actions: Start/Pause/Resume, Reset, Run Policy */}
          <div className="flex items-center gap-2">
            {!isTraining && !isPaused && (
              <button
                onClick={handleStart}
                disabled={isStarting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black text-white hover:bg-neutral-800 text-xs font-bold shadow-sm transition-all active:scale-95"
              >
                <Play size={13} fill="white" />
                <span>{isStarting ? 'Starting...' : 'Start Learning'}</span>
              </button>
            )}

            {isTraining && (
              <button
                onClick={handlePause}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 text-white hover:bg-amber-700 text-xs font-bold shadow-sm transition-all active:scale-95"
              >
                <Pause size={13} fill="white" />
                <span>Pause</span>
              </button>
            )}

            {isPaused && (
              <button
                onClick={handleResume}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-green-600 text-white hover:bg-green-700 text-xs font-bold shadow-sm transition-all active:scale-95"
              >
                <Play size={13} fill="white" />
                <span>Resume</span>
              </button>
            )}

            <button
              onClick={handleReset}
              title="Reset environment and Q-table"
              className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-neutral-200 hover:border-black bg-white text-neutral-700 hover:text-black text-xs font-bold transition-all active:scale-95"
            >
              <RotateCcw size={13} />
              <span>Reset</span>
            </button>

            <button
              onClick={handleRunPolicy}
              disabled={isTraining || isPolicyRunning}
              title="Watch agent execute greedy policy"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-orange-500 bg-orange-50 hover:bg-orange-100 text-orange-600 text-xs font-bold transition-all active:scale-95"
            >
              <Zap size={13} />
              <span className="hidden sm:inline">Run Policy</span>
            </button>
          </div>

          {/* Right Live Telemetry Bar */}
          <div className="flex items-center gap-2">
            {/* Live KPI Ribbon */}
            <div className="hidden lg:flex items-center gap-3 bg-neutral-50 px-3 py-1 rounded-xl border border-neutral-200 text-xs font-mono">
              <div>
                <span className="text-neutral-500 font-sans font-medium mr-1">Ep:</span>
                <strong className="text-black">{currentEpisode}</strong>
                <span className="text-neutral-500">/{config.episodes}</span>
              </div>
              <div className="w-px h-3 bg-neutral-200" />
              <div>
                <span className="text-neutral-500 font-sans font-medium mr-1">Steps:</span>
                <strong className="text-black">{currentStep}</strong>
              </div>
              <div className="w-px h-3 bg-neutral-200" />
              <div>
                <span className="text-neutral-500 font-sans font-medium mr-1">Reward:</span>
                <strong className={lastReward > 0 ? 'text-green-600' : lastReward < 0 ? 'text-red-600' : 'text-neutral-800'}>
                  {lastReward > 0 ? `+${lastReward}` : lastReward}
                </strong>
              </div>
              <div className="w-px h-3 bg-neutral-200" />
              <div>
                <span className="text-neutral-500 font-sans font-medium mr-1">ε:</span>
                <strong className="text-amber-600">{typeof epsilon === 'number' ? epsilon.toFixed(3) : epsilon}</strong>
              </div>
            </div>

            {/* Backend Connection status */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                connected
                  ? 'bg-green-50 text-green-700 border-green-200'
                  : 'bg-red-50 text-red-700 border-red-200'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 shadow-sm' : 'bg-red-500'}`} />
              <span className="hidden sm:inline">{connected ? 'Live' : 'Connecting'}</span>
            </div>

            {/* Sound Toggle */}
            <button
              onClick={handleToggleSound}
              title={isMuted ? 'Unmute Audio Effects' : 'Mute Audio Effects'}
              className="p-1.5 rounded-xl border border-neutral-200 hover:border-black bg-white text-neutral-700 transition-colors"
            >
              {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} className="text-blue-600" />}
            </button>

            {/* Guide Button */}
            <button
              onClick={() => {
                playClickSound();
                setIsGuideOpen(true);
              }}
              title="Open Tile & Mechanics Guide"
              className="p-1.5 rounded-xl border border-neutral-200 hover:border-black bg-white text-neutral-700 transition-colors"
            >
              <BookOpen size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* ERROR BANNER */}
      {errorMessage && (
        <div className="w-full px-4 pt-3">
          <div className="max-w-4xl mx-auto flex items-center justify-between p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => initSession(config)}
              className="px-2.5 py-1 rounded bg-red-600 text-white text-xs font-bold hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* HERO FULLSCREEN GRID & DOCK WORKSPACE */}
      <main className="relative flex-1 flex flex-col md:flex-row items-center justify-center p-3 md:p-6 overflow-hidden">
        {/* CENTER HERO GRID WORLD */}
        <div className="flex-1 w-full h-full flex flex-col items-center justify-center max-w-full overflow-hidden transition-all duration-300">
          <GridEnvironment
            rows={config.rows}
            cols={config.cols}
            start={config.start}
            goal={config.goal}
            obstacles={config.obstacles || []}
            cliffs={config.cliffs || []}
            mud={config.mud || []}
            ice={config.ice || []}
            portals={config.portals || []}
            portalPairs={config.portals || []}
            pendingPortalEntrance={pendingPortalEntrance}
            onCancelPendingPortal={() => setPendingPortalEntrance(null)}
            agentPosition={agentPosition}
            qTable={qTable}
            bestActions={bestActions}
            stateValues={stateValues}
            visitCounts={visitCounts}
            activeTool={activeTool}
            onCellClick={handleCellClick}
            selectedCell={selectedCell}
            showQValues={showQValues}
            showPolicyArrows={showPolicyArrows}
            showValueHeatmap={showValueHeatmap}
            showVisitHeatmap={showVisitHeatmap}
            isTraining={trainingStatus === 'training'}
            replayPath={replayPath}
            replayStepIndex={replayStepIndex}
            isReplayMode={isReplayMode}
          />
        </div>

        {/* RIGHT FLOATING DOCK (DESKTOP) */}
        <aside className="hidden md:flex fixed right-4 top-1/2 -translate-y-1/2 z-40 flex-col items-center gap-2 bg-white/95 backdrop-blur-md p-2 rounded-2xl border border-neutral-200 shadow-xl">
          {dockItems.map(({ id, label, icon: Icon }) => {
            const isActive = activePanel === id;
            return (
              <button
                key={id}
                onClick={() => togglePanel(id)}
                title={label}
                className={`relative group p-2.5 rounded-xl transition-all ${
                  isActive
                    ? 'bg-black text-white shadow-md scale-105'
                    : 'text-neutral-600 hover:text-black hover:bg-neutral-100'
                }`}
              >
                <Icon size={18} />
                {/* Micro Tooltip */}
                <span className="absolute right-full mr-2.5 top-1/2 -translate-y-1/2 px-2 py-1 rounded-md bg-neutral-900 text-white text-[11px] font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity shadow-lg">
                  {label}
                </span>
              </button>
            );
          })}

          <div className="w-6 h-px bg-neutral-200 my-1" />

          {/* Quick Tile Guide dock button */}
          <button
            onClick={() => {
              playClickSound();
              setIsGuideOpen(true);
            }}
            title="Tile & Mechanics Guide"
            className="group relative p-2.5 rounded-xl text-neutral-600 hover:text-black hover:bg-neutral-100 transition-all"
          >
            <BookOpen size={18} />
            <span className="absolute right-full mr-2.5 top-1/2 -translate-y-1/2 px-2 py-1 rounded-md bg-neutral-900 text-white text-[11px] font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity shadow-lg">
              Tile Guide
            </span>
          </button>

          {/* Cinematic Intro Splash dock button */}
          <button
            onClick={() => {
              playClickSound();
              setIsSplashOpen(true);
            }}
            title="Open Cinematic Splash"
            className="group relative p-2.5 rounded-xl text-cyan-600 hover:bg-cyan-50 transition-all"
          >
            <Sparkles size={18} />
            <span className="absolute right-full mr-2.5 top-1/2 -translate-y-1/2 px-2 py-1 rounded-md bg-neutral-900 text-white text-[11px] font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity shadow-lg">
              Cinematic Splash
            </span>
          </button>
        </aside>

        {/* MOBILE BOTTOM NAVIGATION DOCK */}
        <div className="flex md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-neutral-200 p-2 justify-around shadow-lg">
          {dockItems.map(({ id, label, icon: Icon }) => {
            const isActive = activePanel === id;
            return (
              <button
                key={id}
                onClick={() => togglePanel(id)}
                className={`p-2 rounded-xl flex flex-col items-center gap-0.5 ${
                  isActive ? 'bg-black text-white' : 'text-neutral-600'
                }`}
              >
                <Icon size={16} />
                <span className="text-[9px] font-bold">{label.split(' ')[0]}</span>
              </button>
            );
          })}
        </div>

        {/* TOGGLEABLE SLIDE-OUT PANEL (DESKTOP & MOBILE BOTTOM-SHEET) */}
        <AnimatePresence>
          {activePanel && (
            <motion.div
              initial={{ x: 60, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 60, opacity: 0 }}
              transition={{ type: 'spring', damping: 26, stiffness: 300 }}
              className={`
                fixed z-50 overflow-y-auto bg-white border border-neutral-200 shadow-2xl
                md:right-[72px] md:top-[68px] md:bottom-4 md:w-[440px] md:rounded-3xl
                inset-x-0 bottom-14 md:bottom-auto max-h-[80vh] md:max-h-none rounded-t-3xl md:rounded-b-3xl
              `}
            >
              {/* Panel Header */}
              <div className="sticky top-0 z-20 flex items-center justify-between p-4 bg-white/95 backdrop-blur-md border-b border-neutral-100">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-black" />
                  <h3 className="text-sm font-black uppercase tracking-wider text-black">
                    {activePanel === 'tools' && 'Editor Tools & Overlays'}
                    {activePanel === 'controls' && 'Training & Simulation Speed'}
                    {activePanel === 'analytics' && 'Analytics & Convergence'}
                    {activePanel === 'replay' && 'Episode Trajectory Replayer'}
                    {activePanel === 'inspector' && 'Selected State Inspector'}
                    {activePanel === 'config' && 'Grid & Hyperparameters'}
                  </h3>
                </div>

                <button
                  onClick={() => {
                    playClickSound();
                    setActivePanel(null);
                  }}
                  className="p-1.5 rounded-full hover:bg-neutral-100 text-neutral-500 hover:text-black transition-colors"
                >
                  <X size={17} />
                </button>
              </div>

              {/* Panel Content Body */}
              <div className="p-4 space-y-4">
                {activePanel === 'tools' && (
                  <div className="space-y-4">
                    {/* Tool Picker */}
                    <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                          Active Brush Tool
                        </span>
                        <span className="text-[11px] font-mono text-neutral-400">Click grid cell</span>
                      </div>

                      <div className="grid grid-cols-4 gap-2">
                        {[
                          { id: 'agent', label: 'Agent', icon: Bot, color: '#0066ff' },
                          { id: 'goal', label: 'Goal', icon: Flag, color: '#00c853' },
                          { id: 'wall', label: 'Wall', icon: Ban, color: '#ff1744' },
                          { id: 'cliff', label: 'Cliff', icon: Flame, color: '#e65100' },
                          { id: 'mud', label: 'Mud', icon: Waves, color: '#8d6e63' },
                          { id: 'ice', label: 'Ice', icon: Snowflake, color: '#00bcd4' },
                          { id: 'portal', label: 'Portal', icon: Orbit, color: '#ab47bc' },
                          { id: 'erase', label: 'Erase', icon: Eraser, color: '#6b6b6b' },
                        ].map(({ id, label, icon: ToolIcon, color }) => {
                          const isSel = activeTool === id;
                          return (
                            <button
                              key={id}
                              type="button"
                              disabled={isTraining}
                              onClick={() => handleSelectTool(id)}
                              className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-bold transition-all ${
                                isSel
                                  ? 'bg-black text-white border-black shadow-sm'
                                  : 'bg-white text-neutral-700 border-neutral-200 hover:border-black'
                              }`}
                            >
                              <ToolIcon size={16} color={isSel ? 'white' : color} />
                              <span className="mt-1 text-[11px]">
                                {id === 'portal' && pendingPortalEntrance ? 'Pick Exit...' : label}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {pendingPortalEntrance && (
                        <div className="mt-3 p-2.5 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-between text-xs text-purple-900">
                          <div className="flex items-center gap-2">
                            <Orbit size={14} className="animate-spin text-purple-600" style={{ animationDuration: '3s' }} />
                            <span>Entrance at <strong>[{pendingPortalEntrance[0]}, {pendingPortalEntrance[1]}]</strong>. Click exit cell!</span>
                          </div>
                          <button
                            onClick={() => setPendingPortalEntrance(null)}
                            className="px-2 py-0.5 rounded bg-purple-200 hover:bg-purple-300 text-purple-800 text-[10px] font-bold cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Visual Overlays & Heatmaps */}
                    <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200">
                      <span className="text-xs font-bold uppercase tracking-wider text-neutral-500 block mb-3">
                        Visual Overlays
                      </span>
                      <div className="grid grid-cols-2 gap-3">
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-neutral-700">
                          <input
                            type="checkbox"
                            checked={showQValues}
                            onChange={(e) => {
                              playClickSound();
                              setShowQValues(e.target.checked);
                            }}
                          />
                          <span>Q-Values</span>
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-neutral-700">
                          <input
                            type="checkbox"
                            checked={showPolicyArrows}
                            onChange={(e) => {
                              playClickSound();
                              setShowPolicyArrows(e.target.checked);
                            }}
                          />
                          <span>Policy Arrows</span>
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-neutral-700">
                          <input
                            type="checkbox"
                            checked={showValueHeatmap}
                            onChange={(e) => {
                              playClickSound();
                              setShowValueHeatmap(e.target.checked);
                              if (e.target.checked) setShowVisitHeatmap(false);
                            }}
                          />
                          <span>Value V(s) Heatmap</span>
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-neutral-700">
                          <input
                            type="checkbox"
                            checked={showVisitHeatmap}
                            onChange={(e) => {
                              playClickSound();
                              setShowVisitHeatmap(e.target.checked);
                              if (e.target.checked) setShowValueHeatmap(false);
                            }}
                          />
                          <span>State Visits Heatmap</span>
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {activePanel === 'controls' && (
                  <div className="space-y-4">
                    {/* Training Stats Block */}
                    <TrainingStats
                      trainingStatus={trainingStatus}
                      currentEpisode={currentEpisode}
                      totalEpisodes={config.episodes}
                      currentStep={currentStep}
                      lastReward={lastReward}
                      avgReward={avgReward}
                      epsilon={epsilon}
                    />

                    {/* Speed Slider */}
                    <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                          Simulation Speed
                        </span>
                        <span className="font-mono text-xs font-bold text-black">
                          {delayMs === 0 ? 'Turbo (0ms)' : `${delayMs}ms`}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={300}
                        step={10}
                        value={delayMs}
                        onChange={(e) => handleSpeedChange(Number(e.target.value))}
                      />
                      <div className="flex justify-between mt-2 text-[10px] text-neutral-500 font-mono">
                        <span>Turbo</span>
                        <span>Live (30ms)</span>
                        <span>Slow-mo (300ms)</span>
                      </div>
                    </div>
                  </div>
                )}

                {activePanel === 'analytics' && (
                  <LearningCurve
                    history={history}
                    onSelectEpisode={(ep) => setSelectedReplayEpisode(ep)}
                  />
                )}

                {activePanel === 'replay' && (
                  <EpisodeHistory
                    sessionId={sessionId}
                    currentEpisode={currentEpisode}
                    isTraining={isTraining}
                    onStartReplay={handleStartReplay}
                    onStopReplay={handleStopReplay}
                    isReplayMode={isReplayMode}
                    replayStepIndex={replayStepIndex}
                    onStepChange={handleReplayStep}
                    externalTargetEpisode={selectedReplayEpisode}
                  />
                )}

                {activePanel === 'inspector' && (
                  <CellInspector
                    selectedCell={selectedCell}
                    qTable={qTable}
                    bestActions={bestActions}
                    start={config.start}
                    goal={config.goal}
                    obstacles={config.obstacles || []}
                    cliffs={config.cliffs || []}
                    mud={config.mud || []}
                    ice={config.ice || []}
                    portals={config.portals || []}
                    portalPairs={config.portals || []}
                    pendingPortalEntrance={pendingPortalEntrance}
                    stateValues={stateValues}
                    visitCounts={visitCounts}
                  />
                )}

                {activePanel === 'config' && (
                  <ConfigPanel
                    config={config}
                    onChange={setConfig}
                    onApply={() => initSession(config)}
                    isTraining={isTraining}
                    onLoadPreset={handlePreset}
                  />
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
