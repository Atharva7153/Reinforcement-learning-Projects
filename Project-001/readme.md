# RL Playground — Q-Learning GridWorld Visualizer

An interactive **Reinforcement Learning Playground** that lets you build custom grid environments, configure Q-learning hyperparameters, and watch an agent learn in real time via a live WebSocket feed.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Framer Motion, Tailwind CSS v4, Vite |
| Backend | Python 3.12, FastAPI, WebSockets, Pydantic |
| Algorithm | Temporal Difference Q-Learning (ε-greedy) |
| Deployment | Docker (single container), Render |

---

## Project Structure

```
Project-001/
├── Dockerfile            ← Single-container build (frontend + backend)
├── .dockerignore
├── frontend/             ← React SPA
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/
│   │   └── services/api.js
│   ├── package.json
│   └── vite.config.js
└── backend/              ← FastAPI server
    ├── main.py           ← API routes + serves built frontend
    ├── requirements.txt
    ├── rl/
    │   ├── environment.py
    │   ├── q_learning.py
    │   └── trainer.py
    ├── models/
    │   └── schemas.py
    └── sessions/
        └── manager.py
```

---

## Running Locally (Development)

### Prerequisites
- Python 3.12+
- Node.js 20+

### 1 — Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

API is live at `http://localhost:8000`  
Interactive docs at `http://localhost:8000/api/docs`

### 2 — Frontend

```bash
cd frontend
npm install
npm run dev
```

App is live at `http://localhost:5173`

---

## Running with Docker (Production / Local test)

```bash
# Build the image (from Project-001/)
docker build -t rl-playground .

# Run it
docker run -p 8000:8000 rl-playground
```

Open `http://localhost:8000` — both API and UI served from one container.

---

## Deploying to Render

See **[Render Deployment Guide](#render-deployment-guide)** below.

---

## Render Deployment Guide

### Step 1 — Push to GitHub

Make sure your repository is on GitHub. The `Project-001/` folder must be in the repo root or you must set the root directory in Render.

```bash
git add .
git commit -m "feat: RL Playground with Dockerfile"
git push origin main
```

### Step 2 — Create a New Web Service on Render

1. Go to [render.com](https://render.com) → **New +** → **Web Service**
2. Connect your GitHub repo
3. Configure the service:

| Setting | Value |
|---|---|
| **Name** | `rl-playground` (or anything) |
| **Root Directory** | `Project-001` |
| **Environment** | `Docker` |
| **Dockerfile Path** | `./Dockerfile` |
| **Instance Type** | Free or Starter |

> **Important:** Set **Root Directory** to `Project-001` so Render finds the `Dockerfile`.

### Step 3 — Environment Variables (Optional)

No required environment variables. Render automatically injects `PORT`.

You can optionally set:

| Key | Value | Purpose |
|---|---|---|
| `PORT` | `8000` | Explicit port (Render sets this automatically) |

### Step 4 — Deploy

Click **Create Web Service**. Render will:
1. Pull your repo
2. Build the Docker image (installs Node deps, builds React, installs Python deps)
3. Start the container
4. Assign a public URL like `https://rl-playground-xxxx.onrender.com`

### Step 5 — Open the App

Visit your Render URL — the full app (React UI + FastAPI backend) runs on a single instance.

> **Note on Free Tier:** Render's free tier spins down after 15 minutes of inactivity. The first request after sleep takes ~30 seconds to wake up.

---

## How It Works

### Q-Learning Algorithm

The agent uses **ε-greedy Temporal Difference Q-Learning**:

$$Q(s, a) \leftarrow Q(s, a) + \alpha \left[ r + \gamma \max_{a'} Q(s', a') - Q(s, a) \right]$$

Where:
- α = learning rate
- γ = discount factor  
- ε = exploration probability (decays over episodes)

### WebSocket Real-Time Stream

```
Browser ──── WS /ws/training/{id} ────► FastAPI
                                          │
                                    Training loop
                                    (async task)
                                          │
Browser ◄─── JSON step/episode events ───┘
```

### API Reference

| Method | Path | Description |
|---|---|---|
| `POST` | `/environment/create` | Initialize environment + session |
| `POST` | `/training/{id}/start` | Start training loop |
| `POST` | `/training/{id}/pause` | Pause training |
| `POST` | `/training/{id}/resume` | Resume training |
| `POST` | `/training/{id}/reset` | Reset Q-table and state |
| `POST` | `/training/{id}/demo` | Run greedy policy demo |
| `GET` | `/training/{id}/status` | Get current training status |
| `GET` | `/training/{id}/q-table` | Fetch full Q-table |
| `GET` | `/training/{id}/episodes` | List all episode summaries |
| `GET` | `/training/{id}/episode/{n}` | Get trajectory for episode N |
| `WS` | `/ws/training/{id}` | Live training WebSocket |
