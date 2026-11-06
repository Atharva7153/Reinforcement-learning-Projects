import random
from typing import Tuple, List, Dict, Any
from models.schemas import HyperParams
from rl.car_env import NUM_DIST_BINS, NUM_VEL_BINS, DIST_BINS, VEL_BINS, ACTION_NAMES

class QLearningAgent:
    """
    Tabular Q-Learning Agent for the Car Stopping Task.
    State representation: (dist_bin, vel_bin) where:
      dist_bin in [0, NUM_DIST_BINS - 1]
      vel_bin  in [0, NUM_VEL_BINS - 1]
    Actions: 0: Brake, 1: Accelerate, 2: Maintain
    """

    def __init__(self, hyperparams: HyperParams = None):
        self.hyperparams = hyperparams or HyperParams()
        self.num_actions = 3
        self.num_dist_bins = NUM_DIST_BINS
        self.num_vel_bins = NUM_VEL_BINS

        # Initialize Q-table with zeros: shape (num_dist_bins, num_vel_bins, 3)
        self.reset_q_table()
        self.epsilon = self.hyperparams.epsilon
        self.total_episodes_trained = 0

    def reset_q_table(self):
        """Reset Q-table to zeros."""
        self.q_table = [
            [[0.0 for _ in range(self.num_actions)] for _ in range(self.num_vel_bins)]
            for _ in range(self.num_dist_bins)
        ]
        self.epsilon = self.hyperparams.epsilon
        self.total_episodes_trained = 0

    def get_q_values(self, state: Tuple[int, int]) -> List[float]:
        """Return Q-values for all actions at state (d_bin, v_bin)."""
        d_bin, v_bin = state
        d_bin = max(0, min(self.num_dist_bins - 1, d_bin))
        v_bin = max(0, min(self.num_vel_bins - 1, v_bin))
        return [round(q, 3) for q in self.q_table[d_bin][v_bin]]

    def get_action(self, state: Tuple[int, int], greedy: bool = False) -> int:
        """
        Choose action using epsilon-greedy strategy.
        If greedy is True, always pick the best action according to Q-table.
        """
        d_bin, v_bin = state
        d_bin = max(0, min(self.num_dist_bins - 1, d_bin))
        v_bin = max(0, min(self.num_vel_bins - 1, v_bin))

        if not greedy and random.random() < self.epsilon:
            return random.randint(0, self.num_actions - 1)

        q_vals = self.q_table[d_bin][v_bin]
        max_q = max(q_vals)
        # Random tie-breaker among best actions
        best_actions = [a for a in range(self.num_actions) if abs(q_vals[a] - max_q) < 1e-6]
        return random.choice(best_actions)

    def update(
        self,
        state: Tuple[int, int],
        action: int,
        reward: float,
        next_state: Tuple[int, int],
        done: bool
    ) -> float:
        """
        Standard Q-learning update:
        Q(s, a) <- Q(s, a) + alpha * [ r + gamma * max_a' Q(s', a') - Q(s, a) ]
        """
        d_bin, v_bin = state
        d_bin = max(0, min(self.num_dist_bins - 1, d_bin))
        v_bin = max(0, min(self.num_vel_bins - 1, v_bin))

        current_q = self.q_table[d_bin][v_bin][action]

        if done:
            target = reward
        else:
            nd_bin, nv_bin = next_state
            nd_bin = max(0, min(self.num_dist_bins - 1, nd_bin))
            nv_bin = max(0, min(self.num_vel_bins - 1, nv_bin))
            max_next_q = max(self.q_table[nd_bin][nv_bin])
            target = reward + self.hyperparams.discount_factor * max_next_q

        td_error = target - current_q
        self.q_table[d_bin][v_bin][action] += self.hyperparams.learning_rate * td_error
        return td_error

    def decay_epsilon(self):
        """Decay exploration rate after each episode."""
        self.epsilon = max(
            self.hyperparams.epsilon_min,
            self.epsilon * self.hyperparams.epsilon_decay
        )

    def get_policy_matrix(self) -> Dict[str, Any]:
        """
        Export complete 2D policy matrix & Q-table for visualization.
        """
        grid = []
        for d in range(self.num_dist_bins):
            row = []
            d_label = f"{DIST_BINS[d]:.1f}-{DIST_BINS[d+1]:.1f}m"
            for v in range(self.num_vel_bins):
                v_label = f"{VEL_BINS[v]:.1f}-{VEL_BINS[v+1]:.1f}m/s"
                q_vals = self.q_table[d][v]
                max_q = max(q_vals)
                best_action = q_vals.index(max_q)
                row.append({
                    "d_bin": d,
                    "v_bin": v,
                    "d_label": d_label,
                    "v_label": v_label,
                    "best_action": best_action,
                    "best_action_name": ACTION_NAMES[best_action],
                    "q_brake": round(q_vals[0], 2),
                    "q_accel": round(q_vals[1], 2),
                    "q_maintain": round(q_vals[2], 2),
                })
            grid.append(row)

        return {
            "dist_bins": DIST_BINS,
            "vel_bins": VEL_BINS,
            "grid": grid,
            "total_episodes": self.total_episodes_trained,
            "epsilon": round(self.epsilon, 4)
        }
