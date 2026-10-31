import random
from typing import Tuple, List, Set, Dict, Optional
from models.schemas import EnvironmentConfig

ACTIONS = ['up', 'down', 'left', 'right']

class GridEnvironment:
    def __init__(self, config: EnvironmentConfig):
        self.rows = config.rows
        self.cols = config.cols
        self.start = (config.start[0], config.start[1])
        self.goal = (config.goal[0], config.goal[1])

        # Tiles
        self.obstacles: Set[Tuple[int, int]] = {
            (obs[0], obs[1]) for obs in config.obstacles
            if (obs[0], obs[1]) != self.start and (obs[0], obs[1]) != self.goal
        }
        self.cliffs: Set[Tuple[int, int]] = {
            (c[0], c[1]) for c in config.cliffs
            if (c[0], c[1]) != self.start and (c[0], c[1]) != self.goal and (c[0], c[1]) not in self.obstacles
        }
        self.mud: Set[Tuple[int, int]] = {
            (m[0], m[1]) for m in config.mud
            if (m[0], m[1]) != self.start and (m[0], m[1]) != self.goal and (m[0], m[1]) not in self.obstacles
        }
        self.ice: Set[Tuple[int, int]] = {
            (i[0], i[1]) for i in config.ice
            if (i[0], i[1]) != self.start and (i[0], i[1]) != self.goal and (i[0], i[1]) not in self.obstacles
        }

        # Portals mapping: bidirectional teleportation between pair (r1, c1) <-> (r2, c2)
        self.portal_map: Dict[Tuple[int, int], Tuple[int, int]] = {}
        for p in config.portals:
            if len(p) >= 4:
                p1 = (p[0], p[1])
                p2 = (p[2], p[3])
                self.portal_map[p1] = p2
                self.portal_map[p2] = p1

        self.goal_reward = config.goal_reward
        self.step_penalty = config.step_penalty
        self.wall_penalty = config.wall_penalty
        self.cliff_penalty = config.cliff_penalty
        self.mud_penalty = config.mud_penalty
        self.slippery_prob = config.slippery_prob
        self.current_state = self.start

    def reset(self) -> Tuple[int, int]:
        self.current_state = self.start
        return self.current_state

    def is_valid_cell(self, state: Tuple[int, int]) -> bool:
        r, c = state
        return 0 <= r < self.rows and 0 <= c < self.cols

    def get_actual_action(self, state: Tuple[int, int], action: str) -> str:
        """If currently standing on Ice, with probability slippery_prob, slips perpendicular."""
        if state in self.ice and random.random() < self.slippery_prob:
            if action in ('up', 'down'):
                return random.choice(['left', 'right'])
            else:
                return random.choice(['up', 'down'])
        return action

    def step(self, state: Tuple[int, int], action: str) -> Tuple[Tuple[int, int], float, bool]:
        actual_action = self.get_actual_action(state, action)
        r, c = state

        if actual_action == 'up':
            next_state = (r - 1, c)
        elif actual_action == 'down':
            next_state = (r + 1, c)
        elif actual_action == 'left':
            next_state = (r, c - 1)
        elif actual_action == 'right':
            next_state = (r, c + 1)
        else:
            next_state = state

        # Check boundary collision
        if not self.is_valid_cell(next_state):
            return state, self.wall_penalty, False

        # Check obstacle collision
        if next_state in self.obstacles:
            return state, self.wall_penalty, False

        # Check cliff / lava tile (fatal fall, episode ends)
        if next_state in self.cliffs:
            return next_state, self.cliff_penalty, True

        # Check goal reached
        if next_state == self.goal:
            return next_state, self.goal_reward, True

        # Check portal warp
        if next_state in self.portal_map:
            dest = self.portal_map[next_state]
            if dest != self.goal and dest not in self.obstacles:
                next_state = dest

        # Check mud tile (higher movement penalty)
        if next_state in self.mud:
            return next_state, self.mud_penalty, False

        # Normal valid step
        return next_state, self.step_penalty, False
