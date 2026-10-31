import asyncio
from typing import Callable, Optional, Dict, Any, List
from models.schemas import EnvironmentConfig
from rl.environment import GridEnvironment
from rl.q_learning import QLearningAgent

class TrainingSession:
    def __init__(self, session_id: str, config: EnvironmentConfig):
        self.session_id = session_id
        self.config = config
        self.env = GridEnvironment(config)
        self.agent = QLearningAgent(config)
        
        self.status: str = "idle"  # "idle", "training", "paused", "finished", "stopped"
        self.current_episode: int = 0
        self.current_step: int = 0
        self.last_reward: float = 0.0
        self.cumulative_reward: float = 0.0
        self.episode_rewards: List[float] = []
        self.episode_steps: List[int] = []
        self.episode_td_errors: List[float] = []
        self.visit_counts: Dict[str, int] = {}
        self.episode_history: Dict[int, Dict[str, Any]] = {}

        self._task: Optional[asyncio.Task] = None
        self._pause_event = asyncio.Event()
        self._pause_event.set()  # Unpaused initially
        self._stop_requested: bool = False
        self.speed_delay_ms: int = config.delay_ms

    def set_speed_delay(self, delay_ms: int):
        self.speed_delay_ms = max(0, min(delay_ms, 1000))

    def pause(self):
        if self.status == "training":
            self.status = "paused"
            self._pause_event.clear()

    def resume(self):
        if self.status == "paused":
            self.status = "training"
            self._pause_event.set()

    def reset(self):
        self.stop()
        self.env = GridEnvironment(self.config)
        self.agent = QLearningAgent(self.config)
        self.status = "idle"
        self.current_episode = 0
        self.current_step = 0
        self.last_reward = 0.0
        self.cumulative_reward = 0.0
        self.episode_rewards = []
        self.episode_steps = []
        self.episode_td_errors = []
        self.visit_counts = {}
        self.episode_history = {}
        self._stop_requested = False
        self._pause_event.set()

    def stop(self):
        self._stop_requested = True
        self._pause_event.set()
        if self._task and not self._task.done():
            self._task.cancel()
        self.status = "stopped"

    async def start_training(self, broadcast_fn: Callable[[Dict[str, Any]], Any]):
        if self.status == "training":
            return

        self._stop_requested = False
        self._pause_event.set()
        self.status = "training"

        try:
            for ep in range(self.current_episode, self.config.episodes):
                if self._stop_requested:
                    break

                self.current_episode = ep + 1
                state = self.env.reset()
                done = False
                ep_reward = 0.0
                step_count = 0
                trajectory: List[Dict[str, Any]] = []
                td_errors_in_episode: List[float] = []

                # Track start state visit
                st_key = f"{state[0]},{state[1]}"
                self.visit_counts[st_key] = self.visit_counts.get(st_key, 0) + 1

                # Send episode start
                await broadcast_fn({
                    "type": "episode_start",
                    "episode": self.current_episode,
                    "total_episodes": self.config.episodes,
                    "state": list(state),
                    "epsilon": self.agent.epsilon
                })

                while not done and step_count < self.config.max_steps:
                    if self._stop_requested:
                        break

                    # Check pause
                    await self._pause_event.wait()

                    step_count += 1
                    self.current_step = step_count

                    action = self.agent.choose_action(state, greedy=False)
                    next_state, reward, done = self.env.step(state, action)
                    _, td_err = self.agent.update(state, action, reward, next_state, done)
                    td_errors_in_episode.append(td_err)

                    # Track visit count
                    nxt_key = f"{next_state[0]},{next_state[1]}"
                    self.visit_counts[nxt_key] = self.visit_counts.get(nxt_key, 0) + 1

                    ep_reward += reward
                    self.last_reward = reward
                    self.cumulative_reward += reward

                    trajectory.append({
                        "step": step_count,
                        "state": list(state),
                        "action": action,
                        "reward": reward,
                        "next_state": list(next_state),
                        "done": done
                    })

                    # Send step update if speed delay > 0 or at notable checkpoints
                    if self.speed_delay_ms > 0:
                        await broadcast_fn({
                            "type": "step",
                            "episode": self.current_episode,
                            "step": step_count,
                            "agent_position": list(next_state),
                            "action": action,
                            "reward": reward,
                            "done": done,
                            "epsilon": self.agent.epsilon,
                            "q_values": self.agent.Q[state],
                            "state": list(state),
                            "next_state": list(next_state)
                        })
                        await asyncio.sleep(self.speed_delay_ms / 1000.0)

                    state = next_state

                self.agent.decay_epsilon()
                self.episode_rewards.append(round(ep_reward, 2))
                self.episode_steps.append(step_count)
                avg_td = round(sum(td_errors_in_episode) / len(td_errors_in_episode), 4) if td_errors_in_episode else 0.0
                self.episode_td_errors.append(avg_td)

                # Record episode history in temporary memory
                last_pos = trajectory[-1]["next_state"] if trajectory else list(self.env.start)
                self.episode_history[self.current_episode] = {
                    "episode": self.current_episode,
                    "steps": step_count,
                    "total_reward": round(ep_reward, 2),
                    "epsilon": round(self.agent.epsilon, 4),
                    "avg_td_error": avg_td,
                    "reached_goal": bool(done and last_pos == list(self.env.goal)),
                    "path": [list(self.env.start)] + [s["next_state"] for s in trajectory],
                    "trajectory": trajectory
                }

                # Calculate moving average reward over last 20 episodes
                recent = self.episode_rewards[-20:]
                avg_recent = round(sum(recent) / len(recent), 2) if recent else 0.0

                should_broadcast_q = (
                    self.current_episode <= 10 or 
                    self.current_episode % 5 == 0 or 
                    self.current_episode == self.config.episodes or
                    self.speed_delay_ms > 0
                )

                await broadcast_fn({
                    "type": "episode_end",
                    "episode": self.current_episode,
                    "total_episodes": self.config.episodes,
                    "steps": step_count,
                    "episode_reward": round(ep_reward, 2),
                    "avg_reward": avg_recent,
                    "avg_td_error": avg_td,
                    "epsilon": self.agent.epsilon,
                    "q_table": self.agent.get_q_table_serializable() if should_broadcast_q else None,
                    "best_actions": self.agent.get_best_actions() if should_broadcast_q else None,
                    "state_values": self.agent.get_state_values() if should_broadcast_q else None,
                    "visit_counts": self.visit_counts if should_broadcast_q else None
                })

                # Yield to event loop even when delay_ms == 0 to allow WebSocket ping/pongs & UI responsiveness
                if self.speed_delay_ms == 0 and self.current_episode % 10 == 0:
                    await asyncio.sleep(0.005)

            if not self._stop_requested:
                self.status = "finished"
                await broadcast_fn({
                    "type": "training_finished",
                    "total_episodes": self.config.episodes,
                    "q_table": self.agent.get_q_table_serializable(),
                    "best_actions": self.agent.get_best_actions(),
                    "state_values": self.agent.get_state_values(),
                    "visit_counts": self.visit_counts,
                    "final_epsilon": self.agent.epsilon
                })
        except asyncio.CancelledError:
            self.status = "stopped"
        except Exception as e:
            self.status = "error"
            await broadcast_fn({
                "type": "error",
                "message": str(e)
            })

    async def run_policy_demo(self, broadcast_fn: Callable[[Dict[str, Any]], Any], step_delay_ms: int = 250):
        """Runs the learned policy from start state to goal in greedy mode so the user can watch it."""
        state = self.env.reset()
        done = False
        steps = 0
        max_demo_steps = max(80, self.config.rows * self.config.cols * 2)

        await broadcast_fn({
            "type": "policy_demo_start",
            "start": list(state),
            "goal": list(self.env.goal)
        })

        await asyncio.sleep(step_delay_ms / 1000.0)

        path = [list(state)]
        total_reward = 0.0

        while not done and steps < max_demo_steps:
            steps += 1
            action = self.agent.choose_action(state, greedy=True)
            next_state, reward, done = self.env.step(state, action)
            total_reward += reward
            path.append(list(next_state))

            await broadcast_fn({
                "type": "policy_demo_step",
                "step": steps,
                "agent_position": list(next_state),
                "from_state": list(state),
                "action": action,
                "reward": reward,
                "done": done,
                "q_values": self.agent.Q.get(state, {})
            })

            state = next_state
            await asyncio.sleep(step_delay_ms / 1000.0)

        await broadcast_fn({
            "type": "policy_demo_finished",
            "success": done and state == self.env.goal,
            "total_steps": steps,
            "total_reward": round(total_reward, 2),
            "path": path
        })

    def get_episodes_summary(self) -> List[Dict[str, Any]]:
        return [
            {
                "episode": ep["episode"],
                "steps": ep["steps"],
                "total_reward": ep["total_reward"],
                "reached_goal": ep["reached_goal"],
                "epsilon": ep["epsilon"],
                "avg_td_error": ep.get("avg_td_error", 0.0)
            }
            for ep in self.episode_history.values()
        ]

    def get_episode_detail(self, episode_num: int) -> Optional[Dict[str, Any]]:
        return self.episode_history.get(episode_num)
