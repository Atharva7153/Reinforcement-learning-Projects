import random
from typing import Dict, Tuple, Optional, List
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

        # Dynamic Q-Table initialization
        self.Q: Dict[Tuple[int, int], Dict[str, float]] = {
            (r, c): {action: 0.0 for action in self.actions}
            for r in range(self.rows)
            for c in range(self.cols)
        }

    def choose_action(self, state: Tuple[int, int], greedy: bool = False) -> str:
        if not greedy and random.random() < self.epsilon:
            return random.choice(self.actions)

        state_q = self.Q.get(state, {a: 0.0 for a in self.actions})
        max_q = max(state_q.values())
        # If all Q values are 0 or equal, pick a random action to break symmetry
        best_actions = [a for a, q in state_q.items() if abs(q - max_q) < 1e-6]
        return random.choice(best_actions)

    def update(
        self,
        state: Tuple[int, int],
        action: str,
        reward: float,
        next_state: Tuple[int, int],
        done: bool
    ) -> float:
        if done:
            best_next = 0.0
        else:
            best_next = max(self.Q[next_state].values())

        target = reward + (self.gamma * best_next)
        old_val = self.Q[state][action]
        new_val = old_val + (self.alpha * (target - old_val))
        self.Q[state][action] = round(new_val, 3)
        return self.Q[state][action]

    def decay_epsilon(self) -> float:
        self.epsilon = max(self.epsilon_min, round(self.epsilon * self.epsilon_decay, 4))
        return self.epsilon

    def get_q_table_serializable(self) -> Dict[str, Dict[str, float]]:
        return {
            f"{r},{c}": {a: round(q, 3) for a, q in actions_q.items()}
            for (r, c), actions_q in self.Q.items()
        }

    def get_best_actions(self) -> Dict[str, Optional[str]]:
        result = {}
        for (r, c), actions_q in self.Q.items():
            max_q = max(actions_q.values())
            # If all are zero, no preferred action yet
            if all(abs(v) < 1e-6 for v in actions_q.values()):
                result[f"{r},{c}"] = None
            else:
                best = max(actions_q, key=actions_q.get)
                result[f"{r},{c}"] = best
        return result
