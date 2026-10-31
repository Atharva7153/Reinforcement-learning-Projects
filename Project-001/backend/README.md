# Backend — FastAPI Q-Learning Engine

Python FastAPI server that runs the Q-learning algorithm, manages training sessions, and streams live updates over WebSocket.

---

## Structure

```
backend/
├── main.py               ← FastAPI app, all routes, WebSocket, static file serving
├── requirements.txt
├── rl/
│   ├── environment.py    ← GridWorld: movement, rewards, boundary/obstacle handling
│   ├── q_learning.py     ← Q-Table, ε-greedy action selection, Bellman update
│   └── trainer.py        ← Async training loop, episode history, policy demo
├── models/
│   └── schemas.py        ← Pydantic request/response models
└── sessions/
    └── manager.py        ← In-memory session store, WebSocket connection pool
```

---

## Local Development

```bash
# From backend/
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

- API docs: `http://localhost:8000/api/docs`
- Health check: `http://localhost:8000/api/health`

---

## Key Design Decisions

### Async Training Loop
Training runs inside an `asyncio.Task` so it never blocks the event loop. Pause/resume is managed via an `asyncio.Event`.

### In-Memory Episode History
Every episode trajectory (state, action, reward per step) is stored in a Python dict on the `TrainingSession` object. No database needed. Data is lost when the session is reset or the server restarts.

### Static File Serving (Production)
In Docker, the built React app lands at `./static/`. FastAPI mounts `/assets` as a `StaticFiles` route and uses a catch-all `/{full_path:path}` handler to return `index.html` for SPA routing.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8000` | Port the server listens on |

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Health check |
| `POST` | `/environment/create` | Create session |
| `POST` | `/training/{id}/start` | Start training |
| `POST` | `/training/{id}/pause` | Pause |
| `POST` | `/training/{id}/resume` | Resume |
| `POST` | `/training/{id}/reset` | Reset |
| `POST` | `/training/{id}/speed` | Update simulation delay |
| `POST` | `/training/{id}/demo` | Run greedy policy demo |
| `GET` | `/training/{id}/status` | Current status |
| `GET` | `/training/{id}/q-table` | Full Q-table + best actions |
| `GET` | `/training/{id}/episodes` | All episode summaries |
| `GET` | `/training/{id}/episode/{n}` | Episode N full trajectory |
| `WS` | `/ws/training/{id}` | Live training stream |

### WebSocket Message Types (server → client)

```jsonc
// Initial snapshot on connect
{ "type": "init", "status": "idle", "q_table": {...}, "epsilon": 0.2 }

// Each episode begins
{ "type": "episode_start", "episode": 42, "state": [0, 0] }

// Each step (only when delay_ms > 0)
{ "type": "step", "step": 3, "agent_position": [1, 2], "action": "right", "reward": -1 }

// End of episode
{ "type": "episode_end", "episode": 42, "episode_reward": -14, "avg_reward": -8.2, "q_table": {...} }

// Training complete
{ "type": "training_finished", "q_table": {...}, "best_actions": {...} }

// Policy demo
{ "type": "policy_demo_step", "agent_position": [2, 3], "action": "down" }
```
