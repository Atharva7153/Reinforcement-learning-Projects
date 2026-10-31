from typing import Tuple, List, Set
from models.schemas import EnvironmentConfig

ACTIONS = ['up', 'down', 'left', 'right']

class GridEnvironment:
    def __init__(self, config: EnvironmentConfig):
        self.rows = config.rows
        self.cols = config.cols
        self.start = (config.start[0], config.start[1])
        self.goal = (config.goal[0], config.goal[1])
        self.obstacles: Set[Tuple[int, int]] = {
            (obs[0], obs[1]) for obs in config.obstacles
            if (obs[0], obs[1]) != self.start and (obs[0], obs[1]) != self.goal
        }
        self.goal_reward = config.goal_reward
        self.step_penalty = config.step_penalty
        self.wall_penalty = config.wall_penalty
        self.current_state = self.start

    def reset(self) -> Tuple[int, int]:
        self.current_state = self.start
        return self.current_state

    def is_valid_cell(self, state: Tuple[int, int]) -> bool:
        r, c = state
        return 0 <= r < self.rows and 0 <= c < self.cols

    def step(self, state: Tuple[int, int], action: str) -> Tuple[Tuple[int, int], float, bool]:
        r, c = state

        if action == 'up':
            next_state = (r - 1, c)
        elif action == 'down':
            next_state = (r + 1, c)
        elif action == 'left':
            next_state = (r, c - 1)
        elif action == 'right':
            next_state = (r, c + 1)
        else:
            next_state = state

        # Check boundary collision
        if not self.is_valid_cell(next_state):
            return state, self.wall_penalty, False

        # Check obstacle collision
        if next_state in self.obstacles:
            return state, self.wall_penalty, False

        # Check goal reached
        if next_state == self.goal:
            return next_state, self.goal_reward, True

        # Normal valid step
        return next_state, self.step_penalty, False
