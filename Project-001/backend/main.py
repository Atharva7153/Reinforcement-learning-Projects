import json
import os
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional

from models.schemas import (
    EnvironmentConfig,
    CreateEnvironmentResponse,
    TrainingStartRequest,
    TrainingStatusResponse,
    QTableResponse
)
from sessions.manager import session_manager

app = FastAPI(title="RL Playground API", version="1.0.0", docs_url="/api/docs", redoc_url="/api/redoc")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class SpeedUpdate(BaseModel):
    delay_ms: int

class DemoRequest(BaseModel):
    speed_ms: Optional[int] = 250

# ── API Routes ────────────────────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}

@app.post("/environment/create", response_model=CreateEnvironmentResponse)
async def create_environment(config: EnvironmentConfig):
    session = session_manager.create_session(config)
    return CreateEnvironmentResponse(
        session_id=session.session_id,
        status="initialized",
        config=session.config
    )

@app.post("/training/start")
async def start_training_post(payload: TrainingStartRequest):
    success = session_manager.start_training(payload.session_id)
    if not success:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"status": "started", "session_id": payload.session_id}

@app.post("/training/{session_id}/start")
async def start_training_by_id(session_id: str):
    success = session_manager.start_training(session_id)
    if not success:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"status": "started", "session_id": session_id}

@app.post("/training/{session_id}/pause")
async def pause_training(session_id: str):
    success = session_manager.pause_training(session_id)
    if not success:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"status": "paused", "session_id": session_id}

@app.post("/training/{session_id}/resume")
async def resume_training(session_id: str):
    success = session_manager.resume_training(session_id)
    if not success:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"status": "resumed", "session_id": session_id}

@app.post("/training/{session_id}/reset")
async def reset_training(session_id: str):
    success = session_manager.reset_training(session_id)
    if not success:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"status": "reset", "session_id": session_id}

@app.post("/training/{session_id}/speed")
async def update_speed(session_id: str, payload: SpeedUpdate):
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    session.set_speed_delay(payload.delay_ms)
    return {"status": "speed_updated", "delay_ms": session.speed_delay_ms}

@app.post("/training/{session_id}/demo")
async def run_demo(session_id: str, payload: DemoRequest = DemoRequest()):
    success = session_manager.run_policy_demo(session_id, speed_ms=payload.speed_ms or 250)
    if not success:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"status": "demo_started", "session_id": session_id}

@app.get("/training/{session_id}/status", response_model=TrainingStatusResponse)
async def get_status(session_id: str):
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return TrainingStatusResponse(
        session_id=session.session_id,
        status=session.status,
        current_episode=session.current_episode,
        total_episodes=session.config.episodes,
        current_step=session.current_step,
        last_reward=session.last_reward,
        cumulative_reward=session.cumulative_reward,
        epsilon=session.agent.epsilon
    )

@app.get("/training/{session_id}/q-table", response_model=QTableResponse)
async def get_q_table(session_id: str):
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return QTableResponse(
        session_id=session.session_id,
        q_table=session.agent.get_q_table_serializable(),
        best_actions=session.agent.get_best_actions(),
        state_values=session.agent.get_state_values(),
        visit_counts=session.visit_counts
    )

@app.get("/training/{session_id}/episodes")
async def get_episodes(session_id: str):
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"session_id": session_id, "episodes": session.get_episodes_summary()}

@app.get("/training/{session_id}/episode/{episode_num}")
async def get_episode_detail(session_id: str, episode_num: int):
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    ep = session.get_episode_detail(episode_num)
    if not ep:
        raise HTTPException(status_code=404, detail=f"Episode {episode_num} not found")
    return ep

@app.websocket("/ws/training/{session_id}")
async def websocket_training(websocket: WebSocket, session_id: str):
    session = session_manager.get_session(session_id)
    if not session:
        await websocket.close(code=4004, reason="Session not found")
        return

    await websocket.accept()
    await session_manager.register_websocket(session_id, websocket)

    curr_st = session.env.current_state
    init_mask = curr_st[2] if len(curr_st) > 2 else 0
    await websocket.send_json({
        "type": "init",
        "session_id": session_id,
        "status": session.status,
        "current_episode": session.current_episode,
        "total_episodes": session.config.episodes,
        "agent_position": [curr_st[0], curr_st[1]],
        "key_mask": init_mask,
        "has_key": bool(init_mask & 1),
        "epsilon": session.agent.epsilon,
        "q_table": session.agent.get_q_table_serializable(),
        "best_actions": session.agent.get_best_actions(),
        "state_values": session.agent.get_state_values(),
        "visit_counts": session.visit_counts,
        "episode_rewards": session.episode_rewards[-50:]
    })

    try:
        while True:
            text = await websocket.receive_text()
            try:
                data = json.loads(text)
                cmd = data.get("action")
                if cmd == "start":
                    session_manager.start_training(session_id)
                elif cmd == "pause":
                    session_manager.pause_training(session_id)
                elif cmd == "resume":
                    session_manager.resume_training(session_id)
                elif cmd == "reset":
                    session_manager.reset_training(session_id)
                    await websocket.send_json({
                        "type": "reset_ack",
                        "agent_position": [session.env.start[0], session.env.start[1]],
                        "key_mask": 0,
                        "has_key": False,
                        "q_table": session.agent.get_q_table_serializable(),
                        "best_actions": session.agent.get_best_actions()
                    })
                elif cmd == "set_speed":
                    session.set_speed_delay(data.get("delay_ms", 30))
                elif cmd == "run_demo":
                    session_manager.run_policy_demo(session_id, data.get("speed_ms", 250))
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        session_manager.remove_websocket(session_id, websocket)
    except Exception:
        session_manager.remove_websocket(session_id, websocket)


# ── Static Frontend (production) ──────────────────────────────────────────────
# In Docker/Render the built React app is copied to ./static/
_STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")

if os.path.isdir(_STATIC_DIR):
    # Serve /assets/* directly (Vite output)
    _assets = os.path.join(_STATIC_DIR, "assets")
    if os.path.isdir(_assets):
        app.mount("/assets", StaticFiles(directory=_assets), name="assets")

    # SPA catch-all — serve index.html for any unmatched path
    _index = os.path.join(_STATIC_DIR, "index.html")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        return FileResponse(_index)
