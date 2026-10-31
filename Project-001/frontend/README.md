# Frontend — React Q-Learning Visualizer

React 19 single-page app built with Vite and Tailwind CSS v4. Communicates with the FastAPI backend via Axios (REST) and a native WebSocket for live training updates.

---

## Structure

```
frontend/
├── index.html
├── vite.config.js
├── package.json
└── src/
    ├── main.jsx
    ├── App.jsx                     ← Root component, all state
    ├── index.css                   ← Tailwind + custom CSS (white/black premium theme)
    ├── services/
    │   └── api.js                  ← Axios REST + WebSocket factory
    └── components/
        ├── GridEnvironment.jsx     ← Interactive CSS grid, agent/goal/obstacle rendering
        ├── TrainingStats.jsx       ← Progress bar + 4-stat header row
        ├── ControlPanel.jsx        ← Editor tools, training buttons, speed, overlays
        ├── CellInspector.jsx       ← Per-cell Q-value breakdown
        ├── LearningCurve.jsx       ← SVG reward convergence chart
        ├── ConfigPanel.jsx         ← Hyperparameter sliders, presets
        └── EpisodeHistory.jsx      ← Episode inspector + step-by-step replay
```

---

## Local Development

```bash
npm install
npm run dev        # http://localhost:5173
```

The dev server proxies nothing — it talks directly to `http://localhost:8000`. Make sure the backend is running first.

---

## Production Build

```bash
npm run build      # outputs to dist/
```

In Docker, the `dist/` folder is copied into `backend/static/` so FastAPI serves it.

---

## Environment Variables

Create a `.env.local` file to override API targets in development:

```env
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000
```

In production (`npm run build`), `import.meta.env.PROD` is `true` and the app automatically uses relative URLs (same origin as the FastAPI server).

---

## Key Components

### `GridEnvironment`
Renders the grid as an inline-grid of `div` cells. Agent uses Framer Motion `layoutId` for smooth position transitions. Q-value overlays and policy arrows are conditionally rendered on top.

**Replay Mode:** When `isReplayMode=true`, the agent token turns amber and a trajectory trail is shown. Step scrubber updates `agentPosition` via `replayPath[stepIndex]`.

### `EpisodeHistory`
Fetches episode data from `GET /training/{id}/episode/{n}`. Stores the trajectory locally (no extra state in the parent). Supports:
- Manual step input
- Quick-jump pills (`#1`, `#10`, `#50` …)
- Play/Pause/Scrub with configurable playback speed

### `api.js` — URL Resolution

```js
const isProd = import.meta.env.PROD;
// HTTP: '' (relative) in prod, 'http://localhost:8000' in dev
// WS:  wss://your-host in prod, ws://localhost:8000 in dev
```
