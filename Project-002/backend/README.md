# Backend — Autonomous Car Q-Learning Engine (FastAPI)

FastAPI asynchronous server powering the AutoStop RL simulation. Manages the 2D car physics environment, state discretization, tabular Q-learning agent, and real-time bidirectional WebSocket telemetry streaming.

---

## 📁 Directory Structure

```
backend/
├── main.py                  # FastAPI application, route controllers, WebSocket endpoints & static SPA server
├── requirements.txt         # Core dependencies (FastAPI, Uvicorn, WebSockets, Pydantic, NumPy)
├── models/
│   └── schemas.py           # Pydantic schemas for physics configs, hyperparameters & telemetry
├── rl/
│   ├── car_env.py           # 2D Kinematics physics simulation, sensor ray, rewards & boundaries
│   ├── q_learning.py        # Tabular Q-learning algorithm, state discretization & policy matrix
│   └── session_manager.py   # Multi-client session manager & non-blocking background async loop
└── static/                  # Bundled production React SPA (built from frontend/dist)
```

---

## ⚙️ Mathematical & Physics Formulation

### 1. State Space & Discretization
The car operates in a continuous 2D state space:
- Distance to Wall: $d \in [0.0, 100.0\text{ m}]$
- Forward Speed: $v \in [0.0, 25.0\text{ m/s}]$

For tabular Q-learning, continuous states are partitioned into a $19 \times 10$ discrete matrix:
- **Distance Bins (19 bins)**: Non-linear resolution focusing on the stopping area:
  `[0.0, 0.6, 1.2, 2.0, 3.0, 4.2, 5.8, 7.8, 10.2, 13.0, 16.5, 20.5, 25.5, 31.5, 38.5, 47.0, 57.0, 68.0, 80.0, 105.0]`
- **Velocity Bins (10 bins)**:
  `[0.0, 0.35, 1.2, 2.5, 4.2, 6.5, 9.2, 12.5, 16.5, 21.0, 28.0]`
- Total State Count: $19 \times 10 = 190$ states.

### 2. Action Dynamics
Every time step ($\Delta t = 0.1\text{s}$):
- `0 (Brake)`: Deceleration $a = -5.0\text{ m/s}^2$
- `1 (Accelerate)`: Engine throttle $a = +2.5\text{ m/s}^2$
- `2 (Maintain)`: Rolling air drag $a = -0.3\text{ m/s}^2$ if $v > 0$, else $0$

Kinematics update:
$$v_{t+1} = \max(0.0, \min(v_{max}, v_t + a \cdot \Delta t))$$
$$d_{t+1} = d_t - \left(\frac{v_t + v_{t+1}}{2}\right) \cdot \Delta t$$

### 3. Reward Function
- **Safe Stop**: $+150.0 + \max(0.0, 10.0 - 5.0 \cdot |d - 2.5|)$ when $d \in [1.0, 4.0\text{ m}]$ and $v \le 0.35\text{ m/s}$.
- **Barrier Crash**: $-120.0 - 2.5 \cdot v$ when $d \le 0.0\text{ m}$.
- **Stalled Early**: $-35.0 - 0.4 \cdot d$ if stopped with $v \le 0.1\text{ m/s}$ far before the target zone.
- **Time Penalty**: $-0.15$ per step to encourage prompt solutions.
- **Speed Hazard**: Negative penalty when approaching the barrier at excessive speed without braking.

---

## 🔌 API Reference

### REST Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Health check & service metadata |
| `GET` | `/api/session/{id}/status` | Get current session telemetry and training statistics |
| `POST` | `/api/session/{id}/mode` | Set simulation mode (`AUTOPILOT`, `TRAINING`, `MANUAL`, `PAUSED`) |
| `POST` | `/api/session/{id}/speed` | Update simulation step delay (`delay_ms`) |
| `POST` | `/api/session/{id}/step` | Execute a manual action (`0=Brake`, `1=Accel`, `2=Maintain`) |
| `POST` | `/api/session/{id}/batch_train` | Turbo train $N$ episodes synchronously in background |
| `POST` | `/api/session/{id}/config` | Update physics configuration (track length, braking force, etc.) |
| `POST` | `/api/session/{id}/hyperparams` | Update learning rate $\alpha$, discount $\gamma$, and decay |
| `POST` | `/api/session/{id}/reset_env` | Reset car to initial starting position |
| `POST` | `/api/session/{id}/reset_all` | Wipe agent Q-table and reset all statistics |
| `GET` | `/api/session/{id}/policy` | Export complete $19 \times 10$ policy matrix & Q-values |

### WebSocket Protocol (`/ws/{session_id}`)

#### Inbound Commands (Client → Server)
```json
// Switch operational mode
{ "command": "mode", "mode": "AUTOPILOT" }

// Adjust playback speed
{ "command": "speed", "delay_ms": 20 }

// Manual step
{ "command": "step", "action": 0 }

// Turbo batch train
{ "command": "batch_train", "episodes": 500 }

// Reset environment position
{ "command": "reset_env" }

// Wipe Q-table
{ "command": "reset_all" }
```

#### Outbound Messages (Server → Client)
- `init`: Full initial state, config, hyperparameters, and policy matrix.
- `step`: Telemetry snapshot per tick (`distance`, `velocity`, `acceleration`, `action`, `reward`, `q_values`, `radar_distance`).
- `episode_start`: Notifies client of new episode reset.
- `batch_train_done`: Broadcasts updated training statistics and new policy heatmap.

---

## 💻 Local Development Setup

```bash
# From Project-002/backend:
python3 -m venv venv
source venv/bin/activate       # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# Start uvicorn development server
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

- API Docs: `http://localhost:8000/docs`
- Health check: `http://localhost:8000/api/health`
