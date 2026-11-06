import asyncio
import json
import logging
from typing import Dict, Set, Optional, Any, List
from fastapi import WebSocket

from models.schemas import CarConfig, HyperParams
from rl.car_env import CarStopEnv, ACTION_NAMES
from rl.q_learning import QLearningAgent

logger = logging.getLogger("session_manager")


class CarSession:
    def __init__(self, session_id: str, config: CarConfig = None, hyperparams: HyperParams = None):
        self.session_id = session_id
        self.config = config or CarConfig()
        self.hyperparams = hyperparams or HyperParams()
        self.env = CarStopEnv(self.config)
        self.agent = QLearningAgent(self.hyperparams)

        self.mode = "PAUSED"  # "TRAINING", "AUTOPILOT", "MANUAL", "PAUSED"
        self.speed_delay_ms = 40  # Milliseconds delay per step during live playback
        self.websockets: Set[WebSocket] = set()
        self.task: Optional[asyncio.Task] = None

        # Statistics
        self.current_episode = 0
        self.total_steps = 0
        self.success_count = 0
        self.crash_count = 0
        self.stall_count = 0
        self.recent_history: List[Dict[str, Any]] = []

        # Initialize environment state
        self.current_state = self.env.reset()

    def get_telemetry(self) -> Dict[str, Any]:
        telemetry = self.env.get_telemetry()
        q_vals = self.agent.get_q_values(self.env.get_discrete_state())
        telemetry["q_values"] = q_vals
        return telemetry

    def get_stats(self) -> Dict[str, Any]:
        total_finished = self.success_count + self.crash_count + self.stall_count
        success_rate = (self.success_count / total_finished * 100.0) if total_finished > 0 else 0.0
        crash_rate = (self.crash_count / total_finished * 100.0) if total_finished > 0 else 0.0

        return {
            "session_id": self.session_id,
            "mode": self.mode,
            "speed_delay_ms": self.speed_delay_ms,
            "current_episode": self.current_episode,
            "total_steps": self.total_steps,
            "success_count": self.success_count,
            "crash_count": self.crash_count,
            "stall_count": self.stall_count,
            "success_rate": round(success_rate, 1),
            "crash_rate": round(crash_rate, 1),
            "epsilon": round(self.agent.epsilon, 4),
            "recent_history": self.recent_history[-40:],
            "telemetry": self.get_telemetry()
        }

    async def broadcast(self, message: Dict[str, Any]):
        """Send message to all connected websockets for this session."""
        if not self.websockets:
            return
        dead_sockets = set()
        data_str = json.dumps(message)
        for ws in self.websockets:
            try:
                await ws.send_text(data_str)
            except Exception:
                dead_sockets.add(ws)
        self.websockets -= dead_sockets

    def step_manual(self, action: int) -> Dict[str, Any]:
        """User executes manual action."""
        if self.env.done:
            self.current_state = self.env.reset()

        state = self.current_state
        next_state, reward, done, info = self.env.step(action)
        self.current_state = next_state
        self.total_steps += 1

        info["q_values"] = self.agent.get_q_values(state)

        if done:
            self._record_episode_finish(info["outcome"], info["cumulative_reward"], info["step_count"])

        return info

    def step_agent(self, greedy: bool = True) -> Dict[str, Any]:
        """Step using the RL agent."""
        if self.env.done:
            self.current_state = self.env.reset()

        state = self.current_state
        action = self.agent.get_action(state, greedy=greedy)
        next_state, reward, done, info = self.env.step(action)

        if not greedy:
            self.agent.update(state, action, reward, next_state, done)

        self.current_state = next_state
        self.total_steps += 1

        info["q_values"] = self.agent.get_q_values(state)

        if done:
            if not greedy:
                self.agent.decay_epsilon()
            self._record_episode_finish(info["outcome"], info["cumulative_reward"], info["step_count"])

        return info

    def _record_episode_finish(self, outcome: str, cumulative_reward: float, steps: int):
        self.current_episode += 1
        if outcome == "SUCCESS":
            self.success_count += 1
        elif outcome == "CRASH":
            self.crash_count += 1
        elif outcome == "STALLED":
            self.stall_count += 1

        self.recent_history.append({
            "episode": self.current_episode,
            "outcome": outcome,
            "reward": round(cumulative_reward, 1),
            "steps": steps,
            "final_distance": round(self.env.distance, 2),
            "final_velocity": round(self.env.velocity, 2)
        })

    def run_turbo_train(self, num_episodes: int) -> Dict[str, Any]:
        """
        Train N episodes in fast synchronous loop without animation delay.
        """
        self.mode = "PAUSED"
        for _ in range(num_episodes):
            state = self.env.reset()
            done = False
            while not done:
                action = self.agent.get_action(state, greedy=False)
                next_state, reward, done, info = self.env.step(action)
                self.agent.update(state, action, reward, next_state, done)
                state = next_state
                self.total_steps += 1

            self.agent.decay_epsilon()
            self._record_episode_finish(info["outcome"], info["cumulative_reward"], info["step_count"])

        # Reset environment ready for test/demo
        self.current_state = self.env.reset()
        return self.get_stats()

    async def _live_loop(self):
        """Asynchronous loop for live streaming training or autopilot demo."""
        try:
            while self.mode in ("TRAINING", "AUTOPILOT"):
                greedy = (self.mode == "AUTOPILOT")

                # If episode is finished, reset environment with a brief pause
                if self.env.done:
                    await asyncio.sleep(0.4)
                    self.current_state = self.env.reset()
                    await self.broadcast({
                        "type": "episode_start",
                        "episode": self.current_episode + 1,
                        "telemetry": self.get_telemetry(),
                        "stats": self.get_stats()
                    })

                # Step simulation
                state = self.current_state
                action = self.agent.get_action(state, greedy=greedy)
                next_state, reward, done, info = self.env.step(action)

                if not greedy:
                    self.agent.update(state, action, reward, next_state, done)

                self.current_state = next_state
                self.total_steps += 1
                info["q_values"] = self.agent.get_q_values(state)

                if done:
                    if not greedy:
                        self.agent.decay_epsilon()
                    self._record_episode_finish(info["outcome"], info["cumulative_reward"], info["step_count"])

                # Broadcast step
                await self.broadcast({
                    "type": "step",
                    "telemetry": info,
                    "stats": self.get_stats(),
                    "policy": self.agent.get_policy_matrix() if done else None
                })

                # Sleep according to speed delay
                delay = max(0.005, self.speed_delay_ms / 1000.0)
                await asyncio.sleep(delay)

        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"Error in session {self.session_id} live loop: {e}")

    def start_live_training(self):
        if self.task and not self.task.done():
            self.task.cancel()
        self.mode = "TRAINING"
        self.task = asyncio.create_task(self._live_loop())

    def start_autopilot(self):
        if self.task and not self.task.done():
            self.task.cancel()
        self.mode = "AUTOPILOT"
        self.task = asyncio.create_task(self._live_loop())

    def pause(self):
        self.mode = "PAUSED"
        if self.task and not self.task.done():
            self.task.cancel()

    def reset_env(self):
        self.current_state = self.env.reset()

    def reset_agent(self):
        self.pause()
        self.agent.reset_q_table()
        self.current_episode = 0
        self.total_steps = 0
        self.success_count = 0
        self.crash_count = 0
        self.stall_count = 0
        self.recent_history.clear()
        self.current_state = self.env.reset()


class SessionManager:
    def __init__(self):
        self.sessions: Dict[str, CarSession] = {}

    def get_or_create(self, session_id: str, config: CarConfig = None, hyperparams: HyperParams = None) -> CarSession:
        if session_id not in self.sessions:
            self.sessions[session_id] = CarSession(session_id, config, hyperparams)
        return self.sessions[session_id]

    def remove_session(self, session_id: str):
        if session_id in self.sessions:
            self.sessions[session_id].pause()
            del self.sessions[session_id]


session_manager = SessionManager()
