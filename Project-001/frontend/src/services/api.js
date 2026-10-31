import axios from 'axios';

const API_BASE = 'http://localhost:8000';
const WS_BASE = 'ws://localhost:8000';

export const createEnvironment = async (config) => {
  const response = await axios.post(`${API_BASE}/environment/create`, config);
  return response.data;
};

export const startTraining = async (sessionId) => {
  const response = await axios.post(`${API_BASE}/training/${sessionId}/start`);
  return response.data;
};

export const pauseTraining = async (sessionId) => {
  const response = await axios.post(`${API_BASE}/training/${sessionId}/pause`);
  return response.data;
};

export const resumeTraining = async (sessionId) => {
  const response = await axios.post(`${API_BASE}/training/${sessionId}/resume`);
  return response.data;
};

export const resetTraining = async (sessionId) => {
  const response = await axios.post(`${API_BASE}/training/${sessionId}/reset`);
  return response.data;
};

export const updateSpeed = async (sessionId, delayMs) => {
  const response = await axios.post(`${API_BASE}/training/${sessionId}/speed`, { delay_ms: delayMs });
  return response.data;
};

export const runPolicyDemo = async (sessionId, speedMs = 200) => {
  const response = await axios.post(`${API_BASE}/training/${sessionId}/demo`, { speed_ms: speedMs });
  return response.data;
};

export const getTrainingStatus = async (sessionId) => {
  const response = await axios.get(`${API_BASE}/training/${sessionId}/status`);
  return response.data;
};

export const getQTable = async (sessionId) => {
  const response = await axios.get(`${API_BASE}/training/${sessionId}/q-table`);
  return response.data;
};

export const getEpisodes = async (sessionId) => {
  const response = await axios.get(`${API_BASE}/training/${sessionId}/episodes`);
  return response.data;
};

export const getEpisodeDetail = async (sessionId, episodeNum) => {
  const response = await axios.get(`${API_BASE}/training/${sessionId}/episode/${episodeNum}`);
  return response.data;
};

export const connectWebSocket = (sessionId, onMessage, onError, onClose) => {
  const ws = new WebSocket(`${WS_BASE}/ws/training/${sessionId}`);

  ws.onopen = () => {
    console.log(`[WS] Connected to session ${sessionId}`);
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      onMessage(data);
    } catch (err) {
      console.error('[WS] Parse error', err);
    }
  };

  ws.onerror = (err) => {
    console.error('[WS] Error', err);
    if (onError) onError(err);
  };

  ws.onclose = (event) => {
    console.log(`[WS] Closed for session ${sessionId}`, event);
    if (onClose) onClose(event);
  };

  return ws;
};
