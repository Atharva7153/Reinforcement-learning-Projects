import axios from 'axios';

// In production (Docker/Render), the frontend is served by the same FastAPI server.
// In development, they run on different ports.
const isProd = import.meta.env.PROD;

const API_BASE = isProd ? '' : (import.meta.env.VITE_API_URL || 'http://localhost:8000');

const getWsBase = () => {
  if (isProd) {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    return `${proto}://${window.location.host}`;
  }
  return import.meta.env.VITE_WS_URL || 'ws://localhost:8000';
};

export const createEnvironment = async (config) => {
  const res = await axios.post(`${API_BASE}/environment/create`, config);
  return res.data;
};

export const startTraining = async (sessionId) => {
  const res = await axios.post(`${API_BASE}/training/${sessionId}/start`);
  return res.data;
};

export const pauseTraining = async (sessionId) => {
  const res = await axios.post(`${API_BASE}/training/${sessionId}/pause`);
  return res.data;
};

export const resumeTraining = async (sessionId) => {
  const res = await axios.post(`${API_BASE}/training/${sessionId}/resume`);
  return res.data;
};

export const resetTraining = async (sessionId) => {
  const res = await axios.post(`${API_BASE}/training/${sessionId}/reset`);
  return res.data;
};

export const updateSpeed = async (sessionId, delayMs) => {
  const res = await axios.post(`${API_BASE}/training/${sessionId}/speed`, { delay_ms: delayMs });
  return res.data;
};

export const runPolicyDemo = async (sessionId, speedMs = 200) => {
  const res = await axios.post(`${API_BASE}/training/${sessionId}/demo`, { speed_ms: speedMs });
  return res.data;
};

export const getTrainingStatus = async (sessionId) => {
  const res = await axios.get(`${API_BASE}/training/${sessionId}/status`);
  return res.data;
};

export const getQTable = async (sessionId) => {
  const res = await axios.get(`${API_BASE}/training/${sessionId}/q-table`);
  return res.data;
};

export const getEpisodes = async (sessionId) => {
  const res = await axios.get(`${API_BASE}/training/${sessionId}/episodes`);
  return res.data;
};

export const getEpisodeDetail = async (sessionId, episodeNum) => {
  const res = await axios.get(`${API_BASE}/training/${sessionId}/episode/${episodeNum}`);
  return res.data;
};

export const connectWebSocket = (sessionId, onMessage, onError, onClose) => {
  const ws = new WebSocket(`${getWsBase()}/ws/training/${sessionId}`);

  ws.onopen = () => console.log(`[WS] Connected to session ${sessionId}`);

  ws.onmessage = (event) => {
    try {
      onMessage(JSON.parse(event.data));
    } catch (err) {
      console.error('[WS] Parse error', err);
    }
  };

  ws.onerror = (err) => {
    console.error('[WS] Error', err);
    if (onError) onError(err);
  };

  ws.onclose = (event) => {
    console.log(`[WS] Closed for session ${sessionId}`);
    if (onClose) onClose(event);
  };

  return ws;
};
