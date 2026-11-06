# Frontend — AutoStop RL Modern React Dashboard

Modern, light-themed interactive reinforcement learning dashboard built with **React 19**, **Tailwind CSS v4**, **HTML5 Canvas**, and **WebSockets**.

---

## 📁 Directory Structure

```
frontend/
├── index.html                   # HTML5 entry template with Plus Jakarta Sans & JetBrains Mono
├── package.json                 # React 19, Tailwind CSS v4, Lucide Icons, Canvas Confetti
├── vite.config.js               # Vite 6 configuration (Port 5174)
└── src/
    ├── main.jsx                 # React root bootstrap
    ├── App.jsx                  # Root state management, WebSocket connectivity & layout
    ├── index.css                # Tailwind v4 import, glassmorphic styles & glowing keyframes
    └── components/
        ├── CarSimulationCanvas.jsx  # High-DPI 2D physics track with dynamic car & LIDAR
        ├── TelemetryHUD.jsx         # Speedometer, distance proximity bar & action indicators
        ├── ControlPanel.jsx         # Drive cockpit, speed slider & turbo training actions
        ├── PolicyHeatmap.jsx        # 2D Q-Table & policy visualizer with live car cursor
        ├── AnalyticsCharts.jsx      # Reward curves & episode history log
        └── ConfigModal.jsx          # Physics & hyperparameter settings drawer
```

---

## 🎨 UI Architecture & Features

### 1. 2D Canvas Physics Track (`CarSimulationCanvas.jsx`)
- **Asphalt Track & Moving Dashes**: Dash lines animate backwards proportionally to forward speed ($v$).
- **Dynamic Headlights**: Forward illumination cone casting onto the road surface.
- **Dynamic Tail Brake Lights**: Glowing neon red flares whenever action is `Brake` ($a = 0$).
- **Particle System**:
  - Accelerate: Nitrous boost trails (cyan and emerald sparks).
  - Heavy Braking: Tire friction smoke clouds.
  - Collision: Explosion sparks and impact shake.
- **Dynamic LIDAR / Radar Cone**: Ray projecting from the car bumper directly to the barrier. Changes dynamically:
  - 🟢 Green (> 25m) — Safe zone
  - 🟡 Amber (10m – 25m) — Caution zone
  - 🔴 Crimson (< 10m) — Collision danger
- **Safe Zone Markings**: Neon striped zone between 1.0m and 4.0m with target indicator.
- **Cross-Browser Compatibility**: Polyfilled with `safeRoundRect` fallback for older Canvas contexts.

### 2. Real-Time Telemetry HUD (`TelemetryHUD.jsx`)
- Speedometer in both $\text{m/s}$ and $\text{km/h}$.
- Distance-to-wall bar with status pills (`SAFE ZONE`, `APPROACHING`, `COLLISION`).
- Active Action Badge (🛑 `Brake`, ⚡ `Accelerate`, ⏸️ `Maintain`) with real-time $Q(s, a)$ preview.
- Cumulative reward and step count.

### 3. Interactive Driver Cockpit (`ControlPanel.jsx`)
- **Keyboard Shortcuts**:
  - `Space` or `B`: 🛑 Brake
  - `Up Arrow` or `W`: ⚡ Accelerate
  - `Down Arrow` or `M`: ⏸️ Maintain
- **Turbo Training**:
  - `+200 Turbo`: Train 200 episodes in the background.
  - `+1,000 Turbo`: Train 1,000 episodes instantly to reach 100% safe stop accuracy.

### 4. Policy Heatmap & State Inspector (`PolicyHeatmap.jsx`)
- Matrix of Distance to Wall ($X$-axis) vs Forward Speed ($Y$-axis).
- Colored by winning action: Red (Brake), Green (Accelerate), Amber (Maintain).
- **Live Car Cursor**: Pulsing indicator highlighting the car's current discrete state $(i_d, i_v)$ in real time.
- Tooltip on hover displays exact numeric Q-values: $Q(\text{Brake})$, $Q(\text{Gas})$, $Q(\text{Coast})$.

---

## 💻 Local Development Setup

```bash
# From Project-002/frontend:
npm install

# Start Vite development server
npm run dev
```

Open **`http://localhost:5174`** in your browser.

> **Note**: The frontend connects to the backend at `http://localhost:8000` and `ws://localhost:8000`. Ensure the backend server is running.

---

## 📦 Production Build

```bash
npm run build
```
Build output lands in `dist/`. When deploying or testing locally as a unified server, copy `dist/` into `../backend/static/` so FastAPI serves it directly.
