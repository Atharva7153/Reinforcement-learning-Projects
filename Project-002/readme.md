# 🚗 AutoStop RL — Autonomous 2D Car Braking & Stopping Playground

An interactive, modern light-themed Reinforcement Learning playground where an autonomous 2D car learns to come to an optimal emergency stop right in front of a rigid barrier.

Built with **FastAPI** (Python), **React 19**, **Tailwind CSS v4**, **HTML5 Canvas physics**, and **WebSockets** for high-frequency telemetry streaming.

---

## 🌟 Key Features

1. **2D Physics Engine & Dynamic Simulation**:
   - Realistic kinematics: forward speed, braking deceleration, engine throttle, and rolling drag.
   - **Dynamic Headlights & Brake Lights**: Red tail lights dynamically flare up when the car applies brakes.
   - **Exhaust Boost Particles**: Cyan and emerald nitrous particles emit when accelerating; tire smoke emits under heavy braking.
   - **Forward LIDAR / Radar Ray**: Dynamically projects from the bumper to the barrier with color-coded safety zones (Green > 25m, Amber 10-25m, Crimson < 10m).
   - **Safe Stopping Zone**: Visual neon target strip between $1.0\text{m}$ and $4.0\text{m}$ in front of the wall.

2. **3 Discrete Actions**:
   - `0. Brake`: Deceleration ($a = -5.0\text{ m/s}^2$)
   - `1. Accelerate`: Gas / Acceleration ($a = +2.5\text{ m/s}^2$)
   - `2. Maintain`: Coasting with rolling resistance ($a = -0.3\text{ m/s}^2$)

3. **Interactive Control Modes**:
   - **⚡ AI Autopilot**: The trained Q-learning policy takes over and autonomously brakes at the exact optimal millisecond.
   - **🏋️ Live Training**: Step-by-step or episode-by-episode training with real-time state visualization and $\epsilon$-greedy exploration decay.
   - **🎮 Manual Driver Cockpit**: Drive the car yourself using keyboard shortcuts (`Space` or `B` to Brake, `Up Arrow` or `W` to Accelerate, `Down Arrow` or `M` to Maintain) and see if you can beat the AI!
   - **🚀 Turbo Training**: Train 200 or 1,000 episodes instantly in the background and watch convergence jump to ~100% success.

4. **2D Policy Heatmap & Q-Table Inspector**:
   - Interactive matrix of Distance to Wall ($0\text{m} \to 100\text{m}$) vs Velocity ($0\text{m/s} \to 26\text{m/s}$).
   - Color-coded by optimal action: 🛑 Crimson for Brake, ⚡ Emerald for Accelerate, ⏸️ Amber for Maintain.
   - **Live Car Cursor**: A pulsing radar cursor tracks the car's exact state bin live as it drives.
   - Hover over any cell to inspect exact Q-values: $Q(\text{Brake})$, $Q(\text{Accelerate})$, $Q(\text{Maintain})$.

5. **Modern Light Theme Design**:
   - Clean, light aesthetics (slate-50 canvas, crisp white cards, refined borders, no outdated retro UI).
   - Live speedometer, proximity progress bar, reward sparkline curve, and episode logs.

---

## 🧠 Reinforcement Learning Formulation

- **State Space**: Continuous pair $(d, v)$ where $d$ is distance to the barrier ($0 \le d \le 100\text{ m}$) and $v$ is velocity ($0 \le v \le 25\text{ m/s}$).
- **State Discretization**:
  - Distance: 19 non-linear bins (high resolution near the wall: $0.6\text{m}, 1.2\text{m}, 2.0\text{m}, 3.0\text{m}, \dots$).
  - Velocity: 10 bins ($0.0 \to 26.0\text{ m/s}$).
  - Total States: $19 \times 10 = 190$ discrete states.
- **Bellman Q-Learning Update Rule**:
  $$Q(s, a) \leftarrow Q(s, a) + \alpha \left[ r + \gamma \max_{a'} Q(s', a') - Q(s, a) \right]$$
- **Reward Function**:
  - **Safe Stop**: $+150.0 + \text{accuracy bonus}$ (when stopping with $v \le 0.35\text{ m/s}$ in $1.0\text{m} - 4.0\text{m}$).
  - **Crash**: $-120.0 - 2.5 \cdot v$ (heavy penalty scaling with collision speed).
  - **Stall**: $-35.0 - 0.4 \cdot d$ (stopping prematurely far from the barrier).
  - **Step shaping**: $-0.15$ time penalty per step + speed hazard penalties when dangerously close to the barrier.

---

## 🛠️ Local Development & Testing

### Option A: Run Unified Server (Frontend + Backend on Port 8000)
FastAPI serves both the backend APIs, WebSockets, and the compiled React frontend:

1. **Build frontend assets**:
   ```bash
   cd Project-002/frontend
   npm install
   npm run build
   ```

2. **Copy built assets to backend static**:
   ```bash
   rm -rf ../backend/static
   cp -r dist ../backend/static
   ```

3. **Start FastAPI backend**:
   ```bash
   cd ../backend
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   uvicorn main:app --host 0.0.0.0 --port 8000 --reload
   ```

4. Open your browser at:
   👉 **`http://localhost:8000`**

---

### Option B: Run Separate Dev Servers with Hot-Reload

**Terminal 1 — Backend (FastAPI)**:
```bash
cd Project-002/backend
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

**Terminal 2 — Frontend (Vite Dev)**:
```bash
cd Project-002/frontend
npm run dev
```
Open **`http://localhost:5174`** for live Vite HMR development.

---

## 🐳 Docker & 1-Click Deployment on Render

This project contains a production-ready, multi-stage `Dockerfile`:
- **Stage 1 (node:20-alpine)**: Installs npm dependencies and compiles the React application into static assets.
- **Stage 2 (python:3.12-slim)**: Installs Python dependencies, copies backend code and static assets, runs as a secure non-root user, and binds `uvicorn` to `$PORT`.

### 1. Test Docker Locally
```bash
cd Project-002
docker build -t autostop-rl .
docker run -p 8000:8000 -e PORT=8000 autostop-rl
```
Then visit `http://localhost:8000`.

### 2. Deploy on Render
1. Push this repository to GitHub.
2. Go to [Render Dashboard](https://dashboard.render.com/) and click **New → Web Service**.
3. Connect your repository.
4. Set the following configuration:
   - **Root Directory**: `Project-002`
   - **Environment**: `Docker`
   - **Dockerfile Path**: `Dockerfile`
   - **Plan**: Free or Starter
5. Click **Deploy Web Service**! Render will automatically build the frontend, build the Python runtime, inject the dynamic `$PORT`, and launch the app in one go.

---

## 📁 Project Directory Structure

```
Project-002/
├── Dockerfile                   # Multi-stage Docker build for Render
├── .dockerignore                # Clean build exclusions
├── readme.md                    # Project documentation
├── backend/
│   ├── main.py                  # FastAPI server with WebSockets & REST APIs
│   ├── requirements.txt         # Python dependencies
│   ├── models/
│   │   └── schemas.py           # Pydantic models for configs & telemetry
│   ├── rl/
│   │   ├── car_env.py           # 2D Car physics & reward environment
│   │   ├── q_learning.py        # Tabular Q-learning agent & policy matrix
│   │   └── session_manager.py   # Multi-session trainer & WebSocket manager
│   └── static/                  # Production build of the React frontend
└── frontend/
    ├── index.html               # HTML entry point with modern typography
    ├── package.json             # React 19, Tailwind CSS v4, Lucide, Confetti
    ├── vite.config.js           # Vite configuration
    └── src/
        ├── App.jsx              # Main dashboard application
        ├── index.css            # Tailwind styling & animations
        ├── main.jsx             # React DOM root
        └── components/
            ├── CarSimulationCanvas.jsx  # 2D Canvas physics & particle animation
            ├── TelemetryHUD.jsx         # Speedometer, distance bar, action badge
            ├── ControlPanel.jsx         # Driving cockpit & turbo training buttons
            ├── PolicyHeatmap.jsx        # 2D Q-Table & policy visualizer
            ├── AnalyticsCharts.jsx      # Reward curves & episode logs
            └── ConfigModal.jsx          # Physics & hyperparameter settings
```
