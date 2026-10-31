import json
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
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

app = FastAPI(title="RL Playground API", version="1.0.0")

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

@app.get("/")
def read_root():
    return {"message": "RL Playground API is running", "version": "1.0.0"}

@app.post("/environment/create", response_model=CreateEnvironmentResponse)
def create_environment(config: EnvironmentConfig):
    session = session_manager.create_session(config)
    return CreateEnvironmentResponse(
        session_id=session.session_id,
        status="initialized",
        config=session.config
    )

@app.post("/training/start")
def start_training_post(payload: TrainingStartRequest):
    success = session_manager.start_training(payload.session_id)
    if not success:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"status": "started", "session_id": payload.session_id}

@app.post("/training/{session_id}/start")
def start_training_by_id(session_id: str):
    success = session_manager.start_training(session_id)
    if not success:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"status": "started", "session_id": session_id}

@app.post("/training/{session_id}/pause")
def pause_training(session_id: str):
    success = session_manager.pause_training(session_id)
    if not success:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"status": "paused", "session_id": session_id}

@app.post("/training/{session_id}/resume")
def resume_training(session_id: str):
    success = session_manager.resume_training(session_id)
    if not success:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"status": "resumed", "session_id": session_id}

@app.post("/training/{session_id}/reset")
def reset_training(session_id: str):
    success = session_manager.reset_training(session_id)
    if not success:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"status": "reset", "session_id": session_id}

@app.post("/training/{session_id}/speed")
def update_speed(session_id: str, payload: SpeedUpdate):
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    session.set_speed_delay(payload.delay_ms)
    return {"status": "speed_updated", "delay_ms": session.speed_delay_ms}

@app.post("/training/{session_id}/demo")
def run_demo(session_id: str, payload: DemoRequest = DemoRequest()):
    success = session_manager.run_policy_demo(session_id, speed_ms=payload.speed_ms or 250)
    if not success:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"status": "demo_started", "session_id": session_id}

@app.get("/training/{session_id}/status", response_model=TrainingStatusResponse)
def get_status(session_id: str):
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
def get_q_table(session_id: str):
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return QTableResponse(
        session_id=session.session_id,
        q_table=session.agent.get_q_table_serializable(),
        best_actions=session.agent.get_best_actions()
    )

@app.get("/training/{session_id}/episodes")
def get_episodes(session_id: str):
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return {
        "session_id": session_id,
        "episodes": session.get_episodes_summary()
    }

@app.get("/training/{session_id}/episode/{episode_num}")
def get_episode_detail(session_id: str, episode_num: int):
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

    # Send initial state snapshot
    await websocket.send_json({
        "type": "init",
        "session_id": session_id,
        "status": session.status,
        "current_episode": session.current_episode,
        "total_episodes": session.config.episodes,
        "agent_position": list(session.env.current_state),
        "epsilon": session.agent.epsilon,
        "q_table": session.agent.get_q_table_serializable(),
        "best_actions": session.agent.get_best_actions(),
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
                        "agent_position": list(session.env.start),
                        "q_table": session.agent.get_q_table_serializable(),
                        "best_actions": session.agent.get_best_actions()
                    })
                elif cmd == "set_speed":
                    delay = data.get("delay_ms", 30)
                    session.set_speed_delay(delay)
                elif cmd == "run_demo":
                    speed = data.get("speed_ms", 250)
                    session_manager.run_policy_demo(session_id, speed)
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        session_manager.remove_websocket(session_id, websocket)
    except Exception:
        session_manager.remove_websocket(session_id, websocket)
