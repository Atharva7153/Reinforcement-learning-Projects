import asyncio
import uuid
from typing import Dict, Set, Optional, Any
from fastapi import WebSocket
from models.schemas import EnvironmentConfig
from rl.trainer import TrainingSession

class SessionManager:
    def __init__(self):
        self.sessions: Dict[str, TrainingSession] = {}
        self.connections: Dict[str, Set[WebSocket]] = {}

    def create_session(self, config: EnvironmentConfig) -> TrainingSession:
        session_id = str(uuid.uuid4())[:8]
        session = TrainingSession(session_id, config)
        self.sessions[session_id] = session
        self.connections[session_id] = set()
        return session

    def get_session(self, session_id: str) -> Optional[TrainingSession]:
        return self.sessions.get(session_id)

    async def register_websocket(self, session_id: str, websocket: WebSocket):
        if session_id not in self.connections:
            self.connections[session_id] = set()
        self.connections[session_id].add(websocket)

    def remove_websocket(self, session_id: str, websocket: WebSocket):
        if session_id in self.connections:
            self.connections[session_id].discard(websocket)

    async def broadcast(self, session_id: str, message: Dict[str, Any]):
        if session_id in self.connections:
            dead_sockets = set()
            for ws in self.connections[session_id]:
                try:
                    await ws.send_json(message)
                except Exception:
                    dead_sockets.add(ws)
            for dead in dead_sockets:
                self.connections[session_id].discard(dead)

    def start_training(self, session_id: str) -> bool:
        session = self.get_session(session_id)
        if not session:
            return False

        if session.status == "training":
            return True

        async def broadcast_wrapper(data):
            await self.broadcast(session_id, data)

        session._task = asyncio.create_task(session.start_training(broadcast_wrapper))
        return True

    def pause_training(self, session_id: str) -> bool:
        session = self.get_session(session_id)
        if not session:
            return False
        session.pause()
        return True

    def resume_training(self, session_id: str) -> bool:
        session = self.get_session(session_id)
        if not session:
            return False
        session.resume()
        return True

    def reset_training(self, session_id: str) -> bool:
        session = self.get_session(session_id)
        if not session:
            return False
        session.reset()
        return True

    def run_policy_demo(self, session_id: str, speed_ms: int = 250) -> bool:
        session = self.get_session(session_id)
        if not session:
            return False

        async def broadcast_wrapper(data):
            await self.broadcast(session_id, data)

        asyncio.create_task(session.run_policy_demo(broadcast_wrapper, speed_ms))
        return True

session_manager = SessionManager()
