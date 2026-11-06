import os
import json
import logging
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

from models.schemas import (
    CarConfig,
    HyperParams,
    StepActionRequest,
    SpeedUpdate,
    BatchTrainRequest
)
from rl.session_manager import session_manager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("main")

app = FastAPI(
    title="RL Playground - Autonomous Car Stopping",
    description="Reinforcement Learning Playground where a 2D car learns when to Brake, Accelerate, or Maintain speed to stop precisely before a wall.",
    version="1.0.0"
)

# Enable CORS for local Vite dev server and remote hosts
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "app": "RL Car Stopping Playground",
        "version": "1.0.0"
    }


@app.get("/api/session/{session_id}/status")
async def get_session_status(session_id: str):
    session = session_manager.get_or_create(session_id)
    return session.get_stats()


@app.post("/api/session/{session_id}/config")
async def update_config(session_id: str, config: CarConfig):
    session = session_manager.get_or_create(session_id)
    session.config = config
    session.env.config = config
    session.reset_env()
    return {"status": "config_updated", "config": config}


@app.post("/api/session/{session_id}/hyperparams")
async def update_hyperparams(session_id: str, hyperparams: HyperParams):
    session = session_manager.get_or_create(session_id)
    session.hyperparams = hyperparams
    session.agent.hyperparams = hyperparams
    session.agent.epsilon = hyperparams.epsilon
    return {"status": "hyperparams_updated", "hyperparams": hyperparams}


class ModeRequest(BaseModel):
    mode: str  # "TRAINING", "AUTOPILOT", "MANUAL", "PAUSED"


@app.post("/api/session/{session_id}/mode")
async def set_session_mode(session_id: str, req: ModeRequest):
    session = session_manager.get_or_create(session_id)
    mode = req.mode.upper()
    if mode == "TRAINING":
        session.start_live_training()
    elif mode == "AUTOPILOT":
        session.start_autopilot()
    elif mode == "PAUSED":
        session.pause()
    elif mode == "MANUAL":
        session.pause()
        session.mode = "MANUAL"
    else:
        raise HTTPException(status_code=400, detail="Invalid mode")

    return {"status": "mode_set", "mode": session.mode}


@app.post("/api/session/{session_id}/speed")
async def set_speed(session_id: str, req: SpeedUpdate):
    session = session_manager.get_or_create(session_id)
    session.speed_delay_ms = req.delay_ms
    return {"status": "speed_updated", "delay_ms": session.speed_delay_ms}


@app.post("/api/session/{session_id}/step")
async def step_simulation(session_id: str, req: StepActionRequest):
    session = session_manager.get_or_create(session_id)
    telemetry = session.step_manual(req.action)
    await session.broadcast({
        "type": "step",
        "telemetry": telemetry,
        "stats": session.get_stats()
    })
    return telemetry


@app.post("/api/session/{session_id}/batch_train")
async def batch_train(session_id: str, req: BatchTrainRequest):
    session = session_manager.get_or_create(session_id)
    stats = session.run_turbo_train(req.episodes)
    policy = session.agent.get_policy_matrix()
    await session.broadcast({
        "type": "batch_train_done",
        "stats": stats,
        "policy": policy
    })
    return {"status": "batch_train_completed", "stats": stats, "policy": policy}


@app.post("/api/session/{session_id}/reset_env")
async def reset_env(session_id: str):
    session = session_manager.get_or_create(session_id)
    session.reset_env()
    telemetry = session.get_telemetry()
    await session.broadcast({
        "type": "reset_env",
        "telemetry": telemetry,
        "stats": session.get_stats()
    })
    return {"status": "env_reset", "telemetry": telemetry}


@app.post("/api/session/{session_id}/reset_all")
async def reset_all(session_id: str):
    session = session_manager.get_or_create(session_id)
    session.reset_agent()
    telemetry = session.get_telemetry()
    policy = session.agent.get_policy_matrix()
    await session.broadcast({
        "type": "reset_all",
        "telemetry": telemetry,
        "stats": session.get_stats(),
        "policy": policy
    })
    return {"status": "all_reset", "telemetry": telemetry}


@app.get("/api/session/{session_id}/policy")
async def get_policy(session_id: str):
    session = session_manager.get_or_create(session_id)
    return session.agent.get_policy_matrix()


@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    await websocket.accept()
    session = session_manager.get_or_create(session_id)
    session.websockets.add(websocket)

    # Send initial state immediately
    await websocket.send_json({
        "type": "init",
        "stats": session.get_stats(),
        "policy": session.agent.get_policy_matrix(),
        "config": session.config.model_dump(),
        "hyperparams": session.hyperparams.model_dump()
    })

    try:
        while True:
            raw_text = await websocket.receive_text()
            try:
                data = json.loads(raw_text)
                cmd = data.get("command")

                if cmd == "mode":
                    mode = data.get("mode", "PAUSED").upper()
                    if mode == "TRAINING":
                        session.start_live_training()
                    elif mode == "AUTOPILOT":
                        session.start_autopilot()
                    elif mode == "PAUSED":
                        session.pause()
                    elif mode == "MANUAL":
                        session.pause()
                        session.mode = "MANUAL"

                elif cmd == "speed":
                    session.speed_delay_ms = int(data.get("delay_ms", 40))

                elif cmd == "step":
                    action = int(data.get("action", 2))
                    telemetry = session.step_manual(action)
                    await session.broadcast({
                        "type": "step",
                        "telemetry": telemetry,
                        "stats": session.get_stats()
                    })

                elif cmd == "batch_train":
                    episodes = int(data.get("episodes", 200))
                    stats = session.run_turbo_train(episodes)
                    policy = session.agent.get_policy_matrix()
                    await session.broadcast({
                        "type": "batch_train_done",
                        "stats": stats,
                        "policy": policy
                    })

                elif cmd == "reset_env":
                    session.reset_env()
                    await session.broadcast({
                        "type": "reset_env",
                        "telemetry": session.get_telemetry(),
                        "stats": session.get_stats()
                    })

                elif cmd == "reset_all":
                    session.reset_agent()
                    await session.broadcast({
                        "type": "reset_all",
                        "telemetry": session.get_telemetry(),
                        "stats": session.get_stats(),
                        "policy": session.agent.get_policy_matrix()
                    })

            except json.JSONDecodeError:
                pass

    except WebSocketDisconnect:
        session.websockets.discard(websocket)
    except Exception as e:
        logger.warning(f"WebSocket error in {session_id}: {e}")
        session.websockets.discard(websocket)


# ── Static SPA Serving (for Production & Docker) ─────────────────────────────
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")

if os.path.isdir(STATIC_DIR):
    assets_dir = os.path.join(STATIC_DIR, "assets")
    if os.path.isdir(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    index_html = os.path.join(STATIC_DIR, "index.html")

    @app.api_route("/{full_path:path}", methods=["GET", "HEAD"], include_in_schema=False)
    async def serve_frontend_spa(full_path: str):
        file_path = os.path.join(STATIC_DIR, full_path)
        if full_path and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(index_html)
