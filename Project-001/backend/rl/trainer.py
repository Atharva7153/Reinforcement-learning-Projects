import asyncio
from typing import Callable, Optional, Dict, Any, List
from models.schemas import EnvironmentConfig
from rl.environment import GridEnvironment
from rl.q_learning import QLearningAgent

class TrainingSession:
    def __init__(self, session_id: str, config: EnvironmentConfig):
        self.session_id = session_id
        self.config = config
        self.mode = config.mode
        self.env = GridEnvironment(config)
        self.agent = QLearningAgent(config)
        self.agent2 = QLearningAgent(config) if config.mode in ('competitive', 'cooperative') else None
        
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

        # Multi-Agent Telemetry
        self.wins_agent1: int = 0
        self.wins_agent2: int = 0
        self.ties: int = 0
        self.coop_successes: int = 0
        self.last_reward2: float = 0.0
        self.cumulative_reward2: float = 0.0
        self.episode_rewards2: List[float] = []
        self.visit_counts2: Dict[str, int] = {}

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
        self.agent2 = QLearningAgent(self.config) if self.config.mode in ('competitive', 'cooperative') else None
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

        self.wins_agent1 = 0
        self.wins_agent2 = 0
        self.ties = 0
        self.coop_successes = 0
        self.last_reward2 = 0.0
        self.cumulative_reward2 = 0.0
        self.episode_rewards2 = []
        self.visit_counts2 = {}

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
            if self.mode in ('competitive', 'cooperative'):
                await self._train_multi_agent(broadcast_fn)
            else:
                await self._train_single_agent(broadcast_fn)
        except asyncio.CancelledError:
            self.status = "stopped"
        except Exception as e:
            self.status = "error"
            await broadcast_fn({
                "type": "error",
                "message": str(e)
            })

    async def _train_single_agent(self, broadcast_fn: Callable[[Dict[str, Any]], Any]):
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

            st_key = f"{state[0]},{state[1]}"
            self.visit_counts[st_key] = self.visit_counts.get(st_key, 0) + 1

            curr_mask = state[2] if len(state) > 2 else 0
            await broadcast_fn({
                "type": "episode_start",
                "episode": self.current_episode,
                "total_episodes": self.config.episodes,
                "state": [state[0], state[1]],
                "key_mask": curr_mask,
                "has_key": bool(curr_mask & 1),
                "epsilon": self.agent.epsilon
            })

            while not done and step_count < self.config.max_steps:
                if self._stop_requested:
                    break

                await self._pause_event.wait()
                step_count += 1
                self.current_step = step_count

                action = self.agent.choose_action(state, greedy=False)
                next_state, reward, done = self.env.step(state, action)
                _, td_err = self.agent.update(state, action, reward, next_state, done)
                td_errors_in_episode.append(td_err)

                nxt_key = f"{next_state[0]},{next_state[1]}"
                self.visit_counts[nxt_key] = self.visit_counts.get(nxt_key, 0) + 1

                ep_reward += reward
                self.last_reward = reward
                self.cumulative_reward += reward

                step_curr_mask = state[2] if len(state) > 2 else 0
                step_next_mask = next_state[2] if len(next_state) > 2 else 0

                trajectory.append({
                    "step": step_count,
                    "state": [state[0], state[1]],
                    "key_mask": step_curr_mask,
                    "action": action,
                    "reward": reward,
                    "next_state": [next_state[0], next_state[1]],
                    "next_key_mask": step_next_mask,
                    "done": done
                })

                if self.speed_delay_ms > 0:
                    await broadcast_fn({
                        "type": "step",
                        "episode": self.current_episode,
                        "step": step_count,
                        "agent_position": [next_state[0], next_state[1]],
                        "key_mask": step_next_mask,
                        "has_key": bool(step_next_mask & 1),
                        "action": action,
                        "reward": reward,
                        "done": done,
                        "epsilon": self.agent.epsilon,
                        "q_values": self.agent.Q.get(state, {}),
                        "state": [state[0], state[1]],
                        "next_state": [next_state[0], next_state[1]]
                    })
                    await asyncio.sleep(self.speed_delay_ms / 1000.0)

                state = next_state

            self.agent.decay_epsilon()
            self.episode_rewards.append(round(ep_reward, 2))
            self.episode_steps.append(step_count)
            avg_td = round(sum(td_errors_in_episode) / len(td_errors_in_episode), 4) if td_errors_in_episode else 0.0
            self.episode_td_errors.append(avg_td)

            last_pos = trajectory[-1]["next_state"] if trajectory else list(self.env.start)
            self.episode_history[self.current_episode] = {
                "episode": self.current_episode,
                "steps": step_count,
                "total_reward": round(ep_reward, 2),
                "epsilon": round(self.agent.epsilon, 4),
                "avg_td_error": avg_td,
                "reached_goal": bool(done and last_pos == list(self.env.goal)),
                "path": [[self.env.start[0], self.env.start[1]]] + [s["next_state"] for s in trajectory],
                "trajectory": trajectory
            }

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

    async def _train_multi_agent(self, broadcast_fn: Callable[[Dict[str, Any]], Any]):
        for ep in range(self.current_episode, self.config.episodes):
            if self._stop_requested:
                break

            self.current_episode = ep + 1
            state1, state2 = self.env.reset()
            done = False
            agent1_done = False
            agent2_done = False
            ep_reward1 = 0.0
            ep_reward2 = 0.0
            step_count = 0
            trajectory: List[Dict[str, Any]] = []

            st_key1 = f"{state1[0]},{state1[1]}"
            st_key2 = f"{state2[0]},{state2[1]}"
            self.visit_counts[st_key1] = self.visit_counts.get(st_key1, 0) + 1
            self.visit_counts2[st_key2] = self.visit_counts2.get(st_key2, 0) + 1

            await broadcast_fn({
                "type": "episode_start",
                "mode": self.mode,
                "episode": self.current_episode,
                "total_episodes": self.config.episodes,
                "state1": [state1[0], state1[1]],
                "state2": [state2[0], state2[1]],
                "wins1": self.wins_agent1,
                "wins2": self.wins_agent2,
                "ties": self.ties,
                "epsilon1": self.agent.epsilon,
                "epsilon2": self.agent2.epsilon
            })

            last_info = {}
            while not done and step_count < self.config.max_steps:
                if self._stop_requested:
                    break

                await self._pause_event.wait()
                step_count += 1
                self.current_step = step_count

                action1 = self.agent.choose_action(state1, greedy=False) if not agent1_done else "up"
                action2 = self.agent2.choose_action(state2, greedy=False) if not agent2_done else "up"

                next1, r1, d1, next2, r2, d2, done, info = self.env.step_multi(
                    state1, action1, state2, action2, agent1_done, agent2_done
                )
                last_info = info

                if not agent1_done:
                    self.agent.update(state1, action1, r1, next1, d1)
                    ep_reward1 += r1
                    self.last_reward = r1
                    self.cumulative_reward += r1
                    nxt_key1 = f"{next1[0]},{next1[1]}"
                    self.visit_counts[nxt_key1] = self.visit_counts.get(nxt_key1, 0) + 1
                    if d1:
                        agent1_done = True

                if not agent2_done:
                    self.agent2.update(state2, action2, r2, next2, d2)
                    ep_reward2 += r2
                    self.last_reward2 = r2
                    self.cumulative_reward2 += r2
                    nxt_key2 = f"{next2[0]},{next2[1]}"
                    self.visit_counts2[nxt_key2] = self.visit_counts2.get(nxt_key2, 0) + 1
                    if d2:
                        agent2_done = True

                trajectory.append({
                    "step": step_count,
                    "agent1_position": [next1[0], next1[1]],
                    "agent2_position": [next2[0], next2[1]],
                    "action1": action1,
                    "action2": action2,
                    "reward1": r1,
                    "reward2": r2,
                    "collision": info.get("collision", False),
                    "done": done
                })

                if self.speed_delay_ms > 0:
                    await broadcast_fn({
                        "type": "step",
                        "mode": self.mode,
                        "episode": self.current_episode,
                        "step": step_count,
                        "agent_position": [next1[0], next1[1]],
                        "agent1_position": [next1[0], next1[1]],
                        "agent2_position": [next2[0], next2[1]],
                        "action1": action1,
                        "action2": action2,
                        "reward": r1,
                        "reward1": r1,
                        "reward2": r2,
                        "collision": info.get("collision", False),
                        "winner": info.get("winner"),
                        "done": done,
                        "epsilon": self.agent.epsilon,
                        "epsilon1": self.agent.epsilon,
                        "epsilon2": self.agent2.epsilon,
                    })
                    await asyncio.sleep(self.speed_delay_ms / 1000.0)

                state1 = next1
                state2 = next2

            self.agent.decay_epsilon()
            self.agent2.decay_epsilon()
            self.episode_rewards.append(round(ep_reward1, 2))
            self.episode_rewards2.append(round(ep_reward2, 2))
            self.episode_steps.append(step_count)

            # Record wins / outcomes
            winner = last_info.get("winner")
            if winner == 1:
                self.wins_agent1 += 1
            elif winner == 2:
                self.wins_agent2 += 1
            elif winner == 0:
                self.ties += 1

            if last_info.get("team_success"):
                self.coop_successes += 1

            self.episode_history[self.current_episode] = {
                "episode": self.current_episode,
                "steps": step_count,
                "total_reward": round(ep_reward1, 2),
                "total_reward2": round(ep_reward2, 2),
                "winner": winner,
                "team_success": bool(last_info.get("team_success")),
                "path": [[self.env.start[0], self.env.start[1]]] + [s["agent1_position"] for s in trajectory],
                "path1": [[self.env.start[0], self.env.start[1]]] + [s["agent1_position"] for s in trajectory],
                "path2": [[self.env.start2[0], self.env.start2[1]]] + [s["agent2_position"] for s in trajectory],
                "trajectory": trajectory
            }

            recent1 = self.episode_rewards[-20:]
            avg_recent1 = round(sum(recent1) / len(recent1), 2) if recent1 else 0.0
            recent2 = self.episode_rewards2[-20:]
            avg_recent2 = round(sum(recent2) / len(recent2), 2) if recent2 else 0.0

            should_broadcast_q = (
                self.current_episode <= 10 or 
                self.current_episode % 5 == 0 or 
                self.current_episode == self.config.episodes or
                self.speed_delay_ms > 0
            )

            await broadcast_fn({
                "type": "episode_end",
                "mode": self.mode,
                "episode": self.current_episode,
                "total_episodes": self.config.episodes,
                "steps": step_count,
                "episode_reward": round(ep_reward1, 2),
                "episode_reward2": round(ep_reward2, 2),
                "avg_reward": avg_recent1,
                "avg_reward2": avg_recent2,
                "wins1": self.wins_agent1,
                "wins2": self.wins_agent2,
                "ties": self.ties,
                "coop_successes": self.coop_successes,
                "winner": winner,
                "epsilon": self.agent.epsilon,
                "epsilon2": self.agent2.epsilon,
                "q_table": self.agent.get_q_table_serializable() if should_broadcast_q else None,
                "best_actions": self.agent.get_best_actions() if should_broadcast_q else None,
                "q_table2": self.agent2.get_q_table_serializable() if should_broadcast_q else None,
                "best_actions2": self.agent2.get_best_actions() if should_broadcast_q else None,
            })

            if self.speed_delay_ms == 0 and self.current_episode % 10 == 0:
                await asyncio.sleep(0.005)

        if not self._stop_requested:
            self.status = "finished"
            await broadcast_fn({
                "type": "training_finished",
                "mode": self.mode,
                "total_episodes": self.config.episodes,
                "wins1": self.wins_agent1,
                "wins2": self.wins_agent2,
                "ties": self.ties,
                "coop_successes": self.coop_successes,
                "q_table": self.agent.get_q_table_serializable(),
                "best_actions": self.agent.get_best_actions(),
                "q_table2": self.agent2.get_q_table_serializable(),
                "best_actions2": self.agent2.get_best_actions(),
            })

    async def run_policy_demo(self, broadcast_fn: Callable[[Dict[str, Any]], Any], step_delay_ms: int = 250):
        if self.mode in ('competitive', 'cooperative'):
            await self._run_demo_multi(broadcast_fn, step_delay_ms)
        else:
            await self._run_demo_single(broadcast_fn, step_delay_ms)

    async def _run_demo_single(self, broadcast_fn: Callable[[Dict[str, Any]], Any], step_delay_ms: int = 250):
        state = self.env.reset()
        done = False
        steps = 0
        max_demo_steps = max(80, self.config.rows * self.config.cols * 2)

        start_mask = state[2] if len(state) > 2 else 0
        await broadcast_fn({
            "type": "policy_demo_start",
            "start": [self.env.start[0], self.env.start[1]],
            "goal": [self.env.goal[0], self.env.goal[1]],
            "key_mask": start_mask,
            "has_key": bool(start_mask & 1)
        })

        await asyncio.sleep(step_delay_ms / 1000.0)

        path = [[state[0], state[1]]]
        total_reward = 0.0

        while not done and steps < max_demo_steps:
            steps += 1
            action = self.agent.choose_action(state, greedy=True)
            next_state, reward, done = self.env.step(state, action)
            total_reward += reward
            path.append([next_state[0], next_state[1]])

            next_mask = next_state[2] if len(next_state) > 2 else 0

            await broadcast_fn({
                "type": "policy_demo_step",
                "step": steps,
                "agent_position": [next_state[0], next_state[1]],
                "key_mask": next_mask,
                "has_key": bool(next_mask & 1),
                "from_state": [state[0], state[1]],
                "action": action,
                "reward": reward,
                "done": done,
                "q_values": self.agent.Q.get(state, {})
            })

            state = next_state
            await asyncio.sleep(step_delay_ms / 1000.0)

        is_goal_reached = done and (state[0] == self.env.goal[0] and state[1] == self.env.goal[1])
        await broadcast_fn({
            "type": "policy_demo_finished",
            "success": is_goal_reached,
            "total_steps": steps,
            "total_reward": round(total_reward, 2),
            "path": path
        })

    async def _run_demo_multi(self, broadcast_fn: Callable[[Dict[str, Any]], Any], step_delay_ms: int = 250):
        state1, state2 = self.env.reset()
        done = False
        agent1_done = False
        agent2_done = False
        steps = 0
        max_demo_steps = max(80, self.config.rows * self.config.cols * 2)

        await broadcast_fn({
            "type": "policy_demo_start",
            "mode": self.mode,
            "start1": [self.env.start[0], self.env.start[1]],
            "start2": [self.env.start2[0], self.env.start2[1]],
            "goal": [self.env.goal[0], self.env.goal[1]],
        })

        await asyncio.sleep(step_delay_ms / 1000.0)

        path1 = [[state1[0], state1[1]]]
        path2 = [[state2[0], state2[1]]]
        r1_tot = 0.0
        r2_tot = 0.0
        last_info = {}

        while not done and steps < max_demo_steps:
            steps += 1
            action1 = self.agent.choose_action(state1, greedy=True) if not agent1_done else "up"
            action2 = self.agent2.choose_action(state2, greedy=True) if not agent2_done else "up"

            next1, r1, d1, next2, r2, d2, done, info = self.env.step_multi(
                state1, action1, state2, action2, agent1_done, agent2_done
            )
            last_info = info
            r1_tot += r1
            r2_tot += r2
            path1.append([next1[0], next1[1]])
            path2.append([next2[0], next2[1]])

            if d1:
                agent1_done = True
            if d2:
                agent2_done = True

            await broadcast_fn({
                "type": "policy_demo_step",
                "mode": self.mode,
                "step": steps,
                "agent1_position": [next1[0], next1[1]],
                "agent2_position": [next2[0], next2[1]],
                "agent_position": [next1[0], next1[1]],
                "action1": action1,
                "action2": action2,
                "reward1": r1,
                "reward2": r2,
                "collision": info.get("collision", False),
                "winner": info.get("winner"),
                "done": done
            })

            state1 = next1
            state2 = next2
            await asyncio.sleep(step_delay_ms / 1000.0)

        await broadcast_fn({
            "type": "policy_demo_finished",
            "mode": self.mode,
            "success": bool(last_info.get("team_success") or last_info.get("winner") is not None),
            "winner": last_info.get("winner"),
            "team_success": bool(last_info.get("team_success")),
            "total_steps": steps,
            "total_reward1": round(r1_tot, 2),
            "total_reward2": round(r2_tot, 2),
            "path1": path1,
            "path2": path2
        })

    def get_episodes_summary(self) -> List[Dict[str, Any]]:
        return [
            {
                "episode": ep["episode"],
                "steps": ep["steps"],
                "total_reward": ep["total_reward"],
                "total_reward2": ep.get("total_reward2"),
                "reached_goal": ep.get("reached_goal"),
                "winner": ep.get("winner"),
                "team_success": ep.get("team_success"),
                "epsilon": ep.get("epsilon"),
            }
            for ep in self.episode_history.values()
        ]

    def get_episode_detail(self, episode_num: int) -> Optional[Dict[str, Any]]:
        return self.episode_history.get(episode_num)
