# ⚡ Reinforcement Learning Playground (Q-Learning GridWorld)

A high-performance interactive Reinforcement Learning Playground built with a **Python FastAPI** backend and a **React + Framer Motion** frontend.

---

## 🚀 Features

- **Dynamic CSS Grid Environment**: Configure grid sizes from 3×3 to 8×8 with customizable rows and columns.
- **Interactive Map Builder**:
  - Place the **Agent** (cyan glowing entity) anywhere.
  - Place the **Goal** (neon green beacon with +100 reward) anywhere.
  - Place / toggle **Obstacles / Walls** (vibrant red blocks) dynamically.
  - Erase or clear obstacles at will.
- **Real-Time Q-Learning Engine**:
  - Full Temporal Difference Q-learning running asynchronously in Python.
  - Hyperparameter controls: Learning rate ($\alpha$), Discount factor ($\gamma$), Exploration ($\epsilon$), Epsilon decay, Episodes, and step penalties.
  - **Live WebSocket Streaming**: Agent movements, episode transitions, and Q-values streamed live directly to the frontend.
  - **Hold On Banner**: Sleek animated pulse indicating that the agent is actively learning and optimizing its policy.
- **Visual Policy & Q-Value Analytics**:
  - **4-Directional Q-value overlays**: Live values for UP, DOWN, LEFT, RIGHT inside each cell.
  - **Optimal Policy Arrows**: Bright golden arrows showing the greedy policy decision for every grid state.
  - **State Inspector**: Click any cell to view real-time Q-values and optimal actions.
  - **Convergence Curve**: Live SVG learning curve plotting raw episode rewards and moving averages.
- **Greedy Policy Execution ("Run Policy")**:
  - Watch the trained agent follow its optimal policy from start to goal in real time.

---

## 🛠️ How to Run the Application

### 1. Start the Backend Server (FastAPI)

In a new terminal window:

```bash
cd Project-001/backend

# Activate the virtual environment
source venv/bin/activate

# Start FastAPI server on port 8000
uvicorn main:app --reload --port 8000
```

The backend API will be available at: `http://localhost:8000` (API documentation at `http://localhost:8000/docs`).

---

### 2. Start the Frontend Server (React + Vite)

In a second terminal window:

```bash
cd Project-001/frontend

# Start Vite dev server
npm run dev
```

The frontend will run at: `http://localhost:5173`. Open this URL in your web browser!
