import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Cpu, Wifi, AlertCircle, Volume2, VolumeX } from 'lucide-react';
import GridEnvironment from './components/GridEnvironment';
import ControlPanel from './components/ControlPanel';
import TrainingStats from './components/TrainingStats';
import LearningCurve from './components/LearningCurve';
import CellInspector from './components/CellInspector';
import ConfigPanel from './components/ConfigPanel';
import EpisodeHistory from './components/EpisodeHistory';
import {
  isSoundEnabled,
  toggleSound,
  playStepSound,
  playGoalSound,
  playCliffSound,
  playPortalSound,
  playMudSound,
  playIceSound,
  playClickSound,
  playKeySound,
  playDoorOpenSound,
  playDoorLockedSound,
} from './utils/sound';
import {
  createEnvironment,
  startTraining, pauseTraining, resumeTraining, resetTraining,
  updateSpeed, runPolicyDemo, connectWebSocket, getTrainingStatus, getQTable,
} from './services/api';

const DEFAULT_CONFIG = {
  rows: 4, cols: 4,
  start: [0, 0], goal: [3, 3],
  obstacles: [[1, 1], [1, 2]],
  cliffs: [[2, 1]],
  mud: [[2, 2]],
  ice: [[0, 2]],
  portals: [],
  doors: [],
  key_reward: 10,
  door_penalty: -5,
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
  const [pendingPortalEntry, setPendingPortalEntry] = useState(null);
  const [pendingDoor, setPendingDoor] = useState(null);
  const [currentKeyMask, setCurrentKeyMask] = useState(0);
  const [policyKeyView, setPolicyKeyView] = useState(0);
  const [soundOn, setSoundOn] = useState(isSoundEnabled());

  const handleSelectTool = (tool) => {
    setActiveTool(tool);
    if (tool !== 'portal') {
      setPendingPortalEntry(null);
    }
    if (tool !== 'door') {
      setPendingDoor(null);
    }
  };
  const [showQValues, setShowQValues] = useState(true);
  const [showPolicyArrows, setShowPolicyArrows] = useState(true);
  const [showValueHeatmap, setShowValueHeatmap] = useState(false);
  const [showVisitHeatmap, setShowVisitHeatmap] = useState(false);
  const [delayMs, setDelayMs] = useState(30);
  const [isPolicyRunning, setIsPolicyRunning] = useState(false);
  const [connected, setConnected] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // Replay state
  const [isReplayMode, setIsReplayMode] = useState(false);
  const [replayPath, setReplayPath] = useState([]);
  const [replayTrajectory, setReplayTrajectory] = useState([]);
  const [replayStepIndex, setReplayStepIndex] = useState(0);
  const [selectedReplayEpisode, setSelectedReplayEpisode] = useState(null);
  const [isReplayPlaying, setIsReplayPlaying] = useState(false);
  const [replaySpeed, setReplaySpeed] = useState(200);

  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  const playTileSound = useCallback((r, c) => {
    if (!isSoundEnabled()) return;
    if (config.goal[0] === r && config.goal[1] === c) {
      playGoalSound();
      return;
    }
    if ((config.doors || []).some(([dr, dc, kr, kc]) => kr === r && kc === c)) {
      playKeySound();
      return;
    }
    if ((config.doors || []).some(([dr, dc, kr, kc]) => dr === r && dc === c)) {
      playDoorOpenSound();
      return;
    }
    if ((config.cliffs || []).some(([cr, cc]) => cr === r && cc === c)) {
      playCliffSound();
      return;
    }
    if (
      (config.portals || []).some(
        ([r1, c1, r2, c2]) => (r1 === r && c1 === c) || (r2 === r && c2 === c)
      )
    ) {
      playPortalSound();
      return;
    }
    if ((config.mud || []).some(([mr, mc]) => mr === r && mc === c)) {
      playMudSound();
      return;
    }
    if ((config.ice || []).some(([ir, ic]) => ir === r && ic === c)) {
      playIceSound();
      return;
    }
    playStepSound();
  }, [config]);

  const handleMsg = useCallback((msg) => {
    switch (msg.type) {
      case 'init':
        setTrainingStatus(msg.status || 'idle');
        setEpsilon(msg.epsilon ?? DEFAULT_CONFIG.epsilon);
        if (msg.key_mask !== undefined) setCurrentKeyMask(msg.key_mask);
        if (msg.q_table) setQTable(msg.q_table);
        if (msg.best_actions) setBestActions(msg.best_actions);
        if (msg.state_values) setStateValues(msg.state_values);
        if (msg.visit_counts) setVisitCounts(msg.visit_counts);
        break;
      case 'episode_start':
        setCurrentEpisode(msg.episode);
        setCurrentStep(0);
        setEpsilon(msg.epsilon);
        if (msg.key_mask !== undefined) setCurrentKeyMask(msg.key_mask);
        break;
      case 'step':
        setCurrentStep(msg.step);
        setLastReward(msg.reward);
        setEpsilon(msg.epsilon);
        setAgentPosition(msg.agent_position);
        if (msg.key_mask !== undefined) setCurrentKeyMask(msg.key_mask);
        if (delayMs >= 20) {
          playTileSound(msg.agent_position[0], msg.agent_position[1]);
        }
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
        if (msg.episode_reward >= (config.goal_reward * 0.8)) {
          playGoalSound(0.25);
        }
        setHistory((prev) => [
          ...prev.slice(-150),
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
        break;
      case 'reset_ack':
        setAgentPosition(msg.agent_position);
        if (msg.q_table) setQTable(msg.q_table);
        if (msg.best_actions) setBestActions(msg.best_actions);
        setTrainingStatus('idle');
        setCurrentEpisode(0);
        setCurrentStep(0);
        setCurrentKeyMask(0);
        setPolicyKeyView(0);
        setHistory([]);
        setIsReplayMode(false);
        setIsReplayPlaying(false);
        break;
      case 'policy_demo_start':
        setIsPolicyRunning(true);
        setIsReplayMode(false);
        setAgentPosition(msg.start);
        setCurrentKeyMask(0);
        setPolicyKeyView(0);
        playStepSound(0.2);
        break;
      case 'policy_demo_step':
        setAgentPosition(msg.agent_position);
        if (msg.key_mask !== undefined) {
          setCurrentKeyMask(msg.key_mask);
          if (msg.has_key) setPolicyKeyView(1);
        }
        playTileSound(msg.agent_position[0], msg.agent_position[1]);
        break;
      case 'policy_demo_finished':
        setIsPolicyRunning(false);
        if (msg.reached_goal) playGoalSound();
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
      setPendingPortalEntry(null);
      setHistory([]);
      setStateValues({});
      setVisitCounts({});

      setupWebSocket(data.session_id);
      return data.session_id;
    } catch (err) {
      console.error('Init session error:', err);
      setErrorMessage('Connecting to backend... If this is the first load, Render may take 20s to wake up.');
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
        // ignore polling error
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [trainingStatus, sessionId]);

  // Comprehensive cell editor for all tile types
  const handleCellClick = (r, c) => {
    setSelectedCell([r, c]);
    if (trainingStatus === 'training' || isReplayMode) return;

    const isMatch = (arr) => arr.some(([ar, ac]) => ar === r && ac === c);
    const filterOut = (arr) => arr.filter(([ar, ac]) => !(ar === r && ac === c));

    // Base cleanup: remove cell from all tile arrays
    const cleanConfig = {
      ...config,
      obstacles: filterOut(config.obstacles || []),
      cliffs: filterOut(config.cliffs || []),
      mud: filterOut(config.mud || []),
      ice: filterOut(config.ice || []),
      portals: (config.portals || []).filter(([r1, c1, r2, c2]) => !(r1 === r && c1 === c) && !(r2 === r && c2 === c)),
      doors: (config.doors || []).filter(([dr, dc, kr, kc]) => !(dr === r && dc === c) && !(kr === r && kc === c)),
    };

    if (activeTool === 'agent') {
      setPendingPortalEntry(null);
      setPendingDoor(null);
      if (config.goal[0] === r && config.goal[1] === c) return;
      const nc = { ...cleanConfig, start: [r, c] };
      setConfig(nc);
      setAgentPosition([r, c]);
      initSession(nc);
    } else if (activeTool === 'goal') {
      setPendingPortalEntry(null);
      setPendingDoor(null);
      if (config.start[0] === r && config.start[1] === c) return;
      const nc = { ...cleanConfig, goal: [r, c] };
      setConfig(nc);
      initSession(nc);
    } else if (activeTool === 'wall') {
      setPendingPortalEntry(null);
      setPendingDoor(null);
      if ((config.start[0] === r && config.start[1] === c) || (config.goal[0] === r && config.goal[1] === c)) return;
      const exists = isMatch(config.obstacles || []);
      const updated = exists ? filterOut(config.obstacles) : [...filterOut(config.obstacles), [r, c]];
      const nc = { ...cleanConfig, obstacles: updated };
      setConfig(nc);
      initSession(nc);
    } else if (activeTool === 'cliff') {
      setPendingPortalEntry(null);
      setPendingDoor(null);
      if ((config.start[0] === r && config.start[1] === c) || (config.goal[0] === r && config.goal[1] === c)) return;
      const exists = isMatch(config.cliffs || []);
      const updated = exists ? filterOut(config.cliffs) : [...filterOut(config.cliffs), [r, c]];
      const nc = { ...cleanConfig, cliffs: updated };
      setConfig(nc);
      initSession(nc);
    } else if (activeTool === 'mud') {
      setPendingPortalEntry(null);
      setPendingDoor(null);
      if ((config.start[0] === r && config.start[1] === c) || (config.goal[0] === r && config.goal[1] === c)) return;
      const exists = isMatch(config.mud || []);
      const updated = exists ? filterOut(config.mud) : [...filterOut(config.mud), [r, c]];
      const nc = { ...cleanConfig, mud: updated };
      setConfig(nc);
      initSession(nc);
    } else if (activeTool === 'ice') {
      setPendingPortalEntry(null);
      setPendingDoor(null);
      if ((config.start[0] === r && config.start[1] === c) || (config.goal[0] === r && config.goal[1] === c)) return;
      const exists = isMatch(config.ice || []);
      const updated = exists ? filterOut(config.ice) : [...filterOut(config.ice), [r, c]];
      const nc = { ...cleanConfig, ice: updated };
      setConfig(nc);
      initSession(nc);
    } else if (activeTool === 'door') {
      setPendingPortalEntry(null);
      if ((config.start[0] === r && config.start[1] === c) || (config.goal[0] === r && config.goal[1] === c)) return;

      if (!pendingDoor) {
        // --- CLICK 1: DROP DOOR ---
        const existingDoorIdx = (config.doors || []).findIndex(
          ([dr, dc, kr, kc]) => (dr === r && dc === c) || (kr === r && kc === c)
        );

        if (existingDoorIdx !== -1) {
          const updatedDoors = (config.doors || []).filter((_, idx) => idx !== existingDoorIdx);
          const nc = { ...config, doors: updatedDoors };
          setConfig(nc);
          initSession(nc);
          return;
        }

        setPendingDoor([r, c]);
        const nc = {
          ...cleanConfig,
          doors: config.doors || [],
        };
        setConfig(nc);
      } else {
        // --- CLICK 2: DROP KEY ---
        const [doorR, doorC] = pendingDoor;

        if (doorR === r && doorC === c) {
          setPendingDoor(null);
          return;
        }

        const cleanDoors = (config.doors || []).filter(
          ([dr, dc, kr, kc]) =>
            !(dr === doorR && dc === doorC) &&
            !(kr === doorR && kc === doorC) &&
            !(dr === r && dc === c) &&
            !(kr === r && kc === c)
        );

        const newDoors = [...cleanDoors, [doorR, doorC, r, c]];
        const nc = {
          ...config,
          obstacles: (config.obstacles || []).filter(([or, oc]) => !(or === doorR && oc === doorC) && !(or === r && oc === c)),
          cliffs: (config.cliffs || []).filter(([cr, cc]) => !(cr === doorR && cc === doorC) && !(cr === r && cc === c)),
          mud: (config.mud || []).filter(([mr, mc]) => !(mr === doorR && mc === doorC) && !(mr === r && mc === c)),
          ice: (config.ice || []).filter(([ir, ic]) => !(ir === doorR && ic === doorC) && !(ir === r && ic === c)),
          portals: (config.portals || []).filter(([pr1, pc1, pr2, pc2]) => !(pr1 === doorR && pc1 === doorC) && !(pr2 === doorR && pc2 === doorC) && !(pr1 === r && pc1 === c) && !(pr2 === r && pc2 === c)),
          doors: newDoors,
        };

        setPendingDoor(null);
        setConfig(nc);
        initSession(nc);
      }
    } else if (activeTool === 'portal') {
      setPendingDoor(null);
      if ((config.start[0] === r && config.start[1] === c) || (config.goal[0] === r && config.goal[1] === c)) return;

      if (!pendingPortalEntry) {
        // --- CLICK 1: DROP ENTRY ---
        const existingPortalIdx = (config.portals || []).findIndex(
          ([r1, c1, r2, c2]) => (r1 === r && c1 === c) || (r2 === r && c2 === c)
        );

        if (existingPortalIdx !== -1) {
          const updatedPortals = (config.portals || []).filter((_, idx) => idx !== existingPortalIdx);
          const nc = { ...config, portals: updatedPortals };
          setConfig(nc);
          initSession(nc);
          return;
        }

        setPendingPortalEntry([r, c]);
        const nc = {
          ...cleanConfig,
          portals: config.portals || [],
        };
        setConfig(nc);
      } else {
        // --- CLICK 2: DROP EXIT ---
        const [entryR, entryC] = pendingPortalEntry;

        if (entryR === r && entryC === c) {
          setPendingPortalEntry(null);
          return;
        }

        const cleanPortals = (config.portals || []).filter(
          ([r1, c1, r2, c2]) =>
            !(r1 === entryR && c1 === entryC) &&
            !(r2 === entryR && c2 === entryC) &&
            !(r1 === r && c1 === c) &&
            !(r2 === r && c2 === c)
        );

        const newPortals = [...cleanPortals, [entryR, entryC, r, c]];
        const nc = {
          ...config,
          obstacles: (config.obstacles || []).filter(([or, oc]) => !(or === entryR && oc === entryC) && !(or === r && oc === c)),
          cliffs: (config.cliffs || []).filter(([cr, cc]) => !(cr === entryR && cc === entryC) && !(cr === r && cc === c)),
          mud: (config.mud || []).filter(([mr, mc]) => !(mr === entryR && mc === entryC) && !(mr === r && mc === c)),
          ice: (config.ice || []).filter(([ir, ic]) => !(ir === entryR && ic === entryC) && !(ir === r && ic === c)),
          portals: newPortals,
        };

        setPendingPortalEntry(null);
        setConfig(nc);
        initSession(nc);
      }
    } else if (activeTool === 'erase') {
      if (pendingPortalEntry && pendingPortalEntry[0] === r && pendingPortalEntry[1] === c) {
        setPendingPortalEntry(null);
      }
      if (pendingDoor && pendingDoor[0] === r && pendingDoor[1] === c) {
        setPendingDoor(null);
      }
      setConfig(cleanConfig);
      initSession(cleanConfig);
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
      setPendingPortalEntry(null);
      setHistory([]);
      setStateValues({});
      setVisitCounts({});
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
    if (!sessionId) return;
    setIsReplayMode(false);
    setIsPolicyRunning(true);
    try {
      await runPolicyDemo(sessionId, 200);
    } catch (err) {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ action: 'run_demo', speed_ms: 200 }));
      } else {
        setIsPolicyRunning(false);
      }
    }
  };

  // Rich Presets: from 3x3 to 20x20
  const handlePreset = (type) => {
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
    } else if (type === 'doorKey') {
      // 6x6 Door & Key MDP: Goal behind wall, Door at [3, 3], Key at [4, 0]
      preset = {
        ...DEFAULT_CONFIG,
        rows: 6, cols: 6,
        start: [0, 0], goal: [5, 5],
        obstacles: [[0, 3], [1, 3], [2, 3], [4, 3], [5, 3]],
        doors: [[3, 3, 4, 0]],
        cliffs: [[3, 1], [3, 2]],
        mud: [[1, 4]],
        ice: [], portals: [],
        episodes: 800, max_steps: 120, delay_ms: 25,
      };
    } else if (type === 'cliff') {
      // Sutton & Barto Classic Cliff Walking
      preset = {
        ...DEFAULT_CONFIG,
        rows: 6, cols: 6,
        start: [5, 0], goal: [5, 5],
        obstacles: [],
        doors: [],
        cliffs: [[5, 1], [5, 2], [5, 3], [5, 4]],
        mud: [[3, 2], [3, 3]],
        ice: [], portals: [],
        episodes: 600, max_steps: 120,
      };
    } else if (type === 'hazard') {
      // 8x8 Hazard Course with mud, ice, and cliffs
      preset = {
        ...DEFAULT_CONFIG,
        rows: 8, cols: 8,
        start: [0, 0], goal: [7, 7],
        obstacles: [[2, 2], [2, 3], [2, 4], [5, 4], [5, 5]],
        doors: [],
        cliffs: [[6, 1], [6, 2], [6, 3]],
        mud: [[3, 5], [4, 5], [4, 6]],
        ice: [[1, 4], [1, 5], [1, 6]],
        portals: [[1, 1, 6, 6]],
        episodes: 800, max_steps: 200,
      };
    } else if (type === 'maze') {
      // 12x12 Labyrinth with teleporters
      const walls = [];
      for (let i = 0; i < 10; i++) walls.push([3, i]);
      for (let i = 2; i < 12; i++) walls.push([7, i]);
      preset = {
        ...DEFAULT_CONFIG,
        rows: 12, cols: 12,
        start: [0, 0], goal: [11, 11],
        obstacles: walls,
        doors: [],
        cliffs: [[4, 4], [4, 5], [8, 8]],
        mud: [[1, 8], [2, 8]],
        ice: [[5, 2], [5, 3], [6, 2]],
        portals: [[2, 2, 9, 9]],
        episodes: 1200, max_steps: 300,
      };
    } else if (type === 'mega') {
      // 20x20 Mega Grid World
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
        doors: [],
        cliffs: [[10, 5], [10, 6], [10, 7], [10, 8]],
        mud: [[15, 10], [15, 11], [16, 10], [16, 11]],
        ice: [[4, 12], [4, 13], [5, 12], [5, 13]],
        portals: [[3, 3, 17, 17]],
        episodes: 2000, max_steps: 500, delay_ms: 0,
      };
    }

    if (preset) {
      setPendingPortalEntry(null);
      setPendingDoor(null);
      setCurrentKeyMask(0);
      setPolicyKeyView(0);
      setConfig(preset);
      initSession(preset);
    }
  };

  const handleStartReplay = (path, trajectory, epNumber) => {
    setIsReplayMode(true);
    setIsReplayPlaying(false);
    setReplayPath(path || []);
    setReplayTrajectory(trajectory || []);
    setReplayStepIndex(0);
    setCurrentKeyMask(0);
    setPolicyKeyView(0);
    if (epNumber) setSelectedReplayEpisode(epNumber);
    if (path?.length > 0) setAgentPosition(path[0]);
  };

  const handleStopReplay = () => {
    setIsReplayMode(false);
    setIsReplayPlaying(false);
    setReplayPath([]);
    setReplayTrajectory([]);
    setReplayStepIndex(0);
    setCurrentKeyMask(0);
    setPolicyKeyView(0);
    setSelectedReplayEpisode(null);
    setAgentPosition(config.start);
  };

  const handleReplayStep = useCallback((valOrFn) => {
    setReplayStepIndex((prev) => {
      const next = typeof valOrFn === 'function' ? valOrFn(prev) : valOrFn;
      if (replayPath?.[next]) {
        const [r, c] = replayPath[next];
        setAgentPosition([r, c]);
        if (next === 0) {
          setCurrentKeyMask(0);
          setPolicyKeyView(0);
        } else if (replayTrajectory?.[next - 1]?.next_key_mask !== undefined) {
          const km = replayTrajectory[next - 1].next_key_mask;
          setCurrentKeyMask(km);
          setPolicyKeyView(km > 0 ? 1 : 0);
        }
        if (next > 0 && next !== prev) {
          playTileSound(r, c);
        }
      }
      return next;
    });
  }, [replayPath, replayTrajectory, playTileSound]);

  const handleToggleReplayPlay = useCallback((withScrollDelay = false) => {
    if (isReplayPlaying) {
      setIsReplayPlaying(false);
      return;
    }

    // Auto-scroll to top grid
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (replayPath && replayStepIndex >= replayPath.length - 1) {
      handleReplayStep(0);
    }

    if (withScrollDelay) {
      setTimeout(() => {
        setIsReplayPlaying(true);
      }, 400);
    } else {
      setIsReplayPlaying(true);
    }
  }, [isReplayPlaying, replayPath, replayStepIndex, handleReplayStep]);

  useEffect(() => {
    if (!isReplayPlaying || !replayPath || replayPath.length === 0) return;

    const max = replayPath.length - 1;
    const interval = setInterval(() => {
      handleReplayStep((prev) => {
        if (prev >= max) {
          setIsReplayPlaying(false);
          return max;
        }
        return prev + 1;
      });
    }, replaySpeed);

    return () => clearInterval(interval);
  }, [isReplayPlaying, replayPath, replaySpeed, handleReplayStep]);

  return (
    <div style={{ minHeight: '100vh', background: '#f7f7f5', fontFamily: 'Inter, sans-serif' }}>
      {/* NAV BAR */}
      <header
        style={{
          background: 'white',
          borderBottom: '1.5px solid #e5e5e5',
          position: 'sticky',
          top: 0,
          zIndex: 50,
        }}
      >
        <div className="nav-container">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 9,
                background: '#0a0a0a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Cpu size={17} color="white" />
            </div>
            <div>
              <h1 style={{ fontSize: 15, fontWeight: 900, color: '#0a0a0a', letterSpacing: '-0.03em', lineHeight: 1.1 }}>
                RL Playground
              </h1>
              <p className="hidden sm:block" style={{ fontSize: 10, color: '#bbb', fontFamily: 'JetBrains Mono', fontWeight: 500, letterSpacing: '0.04em', marginTop: 1 }}>
                Q-Learning · Stochastic Tiles · Multi-Graph Analytics
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              onClick={() => setSoundOn(toggleSound())}
              title={soundOn ? 'Sound Effects: ON (Click to mute)' : 'Sound Effects: MUTED (Click to enable)'}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '5px 10px',
                borderRadius: 100,
                background: soundOn ? '#f5f5f5' : '#fff0f0',
                border: `1.5px solid ${soundOn ? '#e5e5e5' : '#ffc0c0'}`,
                fontSize: 11,
                fontWeight: 700,
                color: soundOn ? '#0a0a0a' : '#cc0000',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {soundOn ? <Volume2 size={13} color="#0a0a0a" /> : <VolumeX size={13} color="#cc0000" />}
              <span>{soundOn ? 'SFX' : 'MUTED'}</span>
            </button>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 10px',
                borderRadius: 100,
                background: connected ? '#edfff5' : '#fff0f0',
                border: `1.5px solid ${connected ? '#b3f0cf' : '#ffc0c0'}`,
                fontSize: 11,
                fontWeight: 700,
                color: connected ? '#00843d' : '#cc0000',
              }}
            >
              {connected ? (
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#00c853', boxShadow: '0 0 6px rgba(0,200,83,0.6)' }} />
              ) : (
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ff1744' }} />
              )}
              <span>{connected ? 'Live' : '...'}</span>
            </div>

            {sessionId && (
              <div
                className="hidden md:flex"
                style={{
                  padding: '5px 12px',
                  borderRadius: 100,
                  border: '1.5px solid #e5e5e5',
                  fontSize: 11,
                  fontFamily: 'JetBrains Mono',
                  fontWeight: 600,
                  color: '#6b6b6b',
                }}
              >
                session: <span style={{ color: '#0a0a0a', fontWeight: 700, marginLeft: 4 }}>{sessionId}</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Error alert banner */}
      {errorMessage && (
        <div style={{ maxWidth: 1440, margin: '14px auto 0', padding: '0 16px' }}>
          <div
            style={{
              background: '#fff0f0',
              border: '1.5px solid #ffc0c0',
              borderRadius: 12,
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              color: '#cc0000',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertCircle size={15} />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => initSession(config)}
              style={{
                background: '#cc0000',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                padding: '3px 8px',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* MAIN WORKSPACE */}
      <div className="main-workspace-container">
        {/* LEFT COLUMN: Stats + Grid + Interactive Analytics + Replayer */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
            <div className="card-section" style={{ borderBottom: '1.5px solid #e5e5e5', paddingBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: trainingStatus === 'training' ? '#00c853' : '#e5e5e5',
                      boxShadow: trainingStatus === 'training' ? '0 0 8px rgba(0,200,83,0.7)' : undefined,
                    }}
                  />
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#0a0a0a', letterSpacing: '-0.02em' }}>
                    GridWorld {config.rows}×{config.cols} ({config.rows * config.cols} States)
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#bbb', fontWeight: 500 }}>
                  <span>Tool: <strong className="text-neutral-800 uppercase">{activeTool}</strong></span>
                </div>
              </div>
            </div>

            <div className="rl-grid-container">
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
                pendingPortalEntry={pendingPortalEntry}
                doors={config.doors || []}
                pendingDoor={pendingDoor}
                currentKeyMask={currentKeyMask}
                policyKeyView={policyKeyView}
                onTogglePolicyKeyView={setPolicyKeyView}
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
                selectedReplayEpisode={selectedReplayEpisode}
                isReplayPlaying={isReplayPlaying}
                onToggleReplayPlay={() => handleToggleReplayPlay(false)}
                onReplayStepChange={handleReplayStep}
                onExitReplay={handleStopReplay}
              />
            </div>
          </div>

          {/* Multi-Graph Interactive Analytics */}
          <LearningCurve
            history={history}
            onSelectEpisode={(ep) => {
              setSelectedReplayEpisode(ep);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />

          {/* Episode History & Replayer */}
          <EpisodeHistory
            sessionId={sessionId}
            currentEpisode={currentEpisode}
            isTraining={trainingStatus === 'training'}
            onStartReplay={handleStartReplay}
            onStopReplay={handleStopReplay}
            isReplayMode={isReplayMode}
            replayStepIndex={replayStepIndex}
            onStepChange={handleReplayStep}
            isReplayPlaying={isReplayPlaying}
            onTogglePlay={handleToggleReplayPlay}
            replaySpeed={replaySpeed}
            onSpeedChange={setReplaySpeed}
            externalTargetEpisode={selectedReplayEpisode}
          />
        </div>

        {/* RIGHT COLUMN: Controls + Inspector + Configuration */}
        <div className="right-column-container">
          <ControlPanel
            trainingStatus={trainingStatus}
            activeTool={activeTool}
            setActiveTool={handleSelectTool}
            pendingPortalEntry={pendingPortalEntry}
            pendingDoor={pendingDoor}
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
            showValueHeatmap={showValueHeatmap}
            setShowValueHeatmap={setShowValueHeatmap}
            showVisitHeatmap={showVisitHeatmap}
            setShowVisitHeatmap={setShowVisitHeatmap}
            isPolicyRunning={isPolicyRunning}
            isStarting={isStarting}
          />

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
            doors={config.doors || []}
            stateValues={stateValues}
            visitCounts={visitCounts}
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

      {/* FOOTER */}
      <footer style={{ borderTop: '1.5px solid #e5e5e5', background: 'white', padding: '16px 20px', marginTop: 28 }}>
        <div style={{ maxWidth: 1440, margin: '0 auto', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: '#bbb', fontFamily: 'JetBrains Mono' }}>
            Q-Learning · Stochastic MDPs · Dynamic GridWorld (Up to 20×20)
          </span>
          <span style={{ fontSize: 11, color: '#bbb' }}>
            RL Playground
          </span>
        </div>
      </footer>
    </div>
  );
}
