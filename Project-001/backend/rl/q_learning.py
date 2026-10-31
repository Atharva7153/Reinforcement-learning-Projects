import random
from typing import Dict, Tuple, Optional, List, Any
from models.schemas import EnvironmentConfig
from rl.environment import ACTIONS

class QLearningAgent:
    def __init__(self, config: EnvironmentConfig):
        self.rows = config.rows
        self.cols = config.cols
        self.alpha = config.alpha
        self.gamma = config.gamma
        self.epsilon = config.epsilon
        self.epsilon_decay = config.epsilon_decay
        self.epsilon_min = config.epsilon_min
        self.actions = ACTIONS

        self.doors = [d for d in (config.doors or []) if len(d) >= 4]
        self.num_doors = len(self.doors)

        # Dynamic Q-Table initialization with augmented state space if doors exist
        if self.num_doors > 0:
            max_mask = 1 << self.num_doors
            self.Q: Dict[Tuple, Dict[str, float]] = {
                (r, c, mask): {action: 0.0 for action in self.actions}
                for r in range(self.rows)
                for c in range(self.cols)
                for mask in range(max_mask)
            }
        else:
            self.Q: Dict[Tuple, Dict[str, float]] = {
                (r, c): {action: 0.0 for action in self.actions}
                for r in range(self.rows)
                for c in range(self.cols)
            }

    def choose_action(self, state: Tuple, greedy: bool = False) -> str:
        if not greedy and random.random() < self.epsilon:
            return random.choice(self.actions)

        state_q = self.Q.get(state, {a: 0.0 for a in self.actions})
        max_q = max(state_q.values())
        # If all Q values are 0 or equal, pick a random action to break symmetry
        best_actions = [a for a, q in state_q.items() if abs(q - max_q) < 1e-6]
        return random.choice(best_actions)

    def update(
        self,
        state: Tuple,
        action: str,
        reward: float,
        next_state: Tuple,
        done: bool
    ) -> Tuple[float, float]:
        """Returns (new_q_value, td_error)"""
        if done:
            best_next = 0.0
        else:
            next_q = self.Q.get(next_state, {a: 0.0 for a in self.actions})
            best_next = max(next_q.values())

        target = reward + (self.gamma * best_next)
        if state not in self.Q:
            self.Q[state] = {a: 0.0 for a in self.actions}
        old_val = self.Q[state][action]
        td_error = abs(target - old_val)
        new_val = old_val + (self.alpha * (target - old_val))
        self.Q[state][action] = round(new_val, 3)
        return self.Q[state][action], round(td_error, 4)

    def decay_epsilon(self) -> float:
        self.epsilon = max(self.epsilon_min, round(self.epsilon * self.epsilon_decay, 4))
        return self.epsilon

    def get_q_table_serializable(self) -> Dict[str, Dict[str, float]]:
        result = {}
        for st, actions_q in self.Q.items():
            if len(st) >= 3:
                key = f"{st[0]},{st[1]},{st[2]}"
            else:
                key = f"{st[0]},{st[1]}"
            result[key] = {a: round(q, 3) for a, q in actions_q.items()}
            
            # Fallback alias for base (r, c) when mask=0
            if len(st) >= 3 and st[2] == 0:
                base_key = f"{st[0]},{st[1]}"
                if base_key not in result:
                    result[base_key] = result[key]
        return result

    def get_best_actions(self) -> Dict[str, Optional[str]]:
        result = {}
        for st, actions_q in self.Q.items():
            if len(st) >= 3:
                key = f"{st[0]},{st[1]},{st[2]}"
            else:
                key = f"{st[0]},{st[1]}"

            if all(abs(v) < 1e-6 for v in actions_q.values()):
                best = None
            else:
                best = max(actions_q, key=actions_q.get)
            result[key] = best

            if len(st) >= 3 and st[2] == 0:
                base_key = f"{st[0]},{st[1]}"
                if base_key not in result:
                    result[base_key] = best
        return result

    def get_state_values(self) -> Dict[str, float]:
        result = {}
        for st, actions_q in self.Q.items():
            if len(st) >= 3:
                key = f"{st[0]},{st[1]},{st[2]}"
            else:
                key = f"{st[0]},{st[1]}"
            val = round(max(actions_q.values()), 3)
            result[key] = val

            if len(st) >= 3 and st[2] == 0:
                base_key = f"{st[0]},{st[1]}"
                if base_key not in result:
                    result[base_key] = val
        return result
