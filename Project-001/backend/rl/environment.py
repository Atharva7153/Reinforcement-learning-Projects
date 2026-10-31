import random
from typing import Tuple, List, Set, Dict, Optional, Any
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

        # Portals mapping: directional teleportation from entry (r1, c1) -> exit (r2, c2)
        self.portal_map: Dict[Tuple[int, int], Tuple[int, int]] = {}
        for p in (config.portals or []):
            if len(p) >= 4:
                p_entry = (p[0], p[1])
                p_exit = (p[2], p[3])
                self.portal_map[p_entry] = p_exit

        # Doors & Keys mapping: [door_r, door_c, key_r, key_c]
        self.doors = [d for d in (config.doors or []) if len(d) >= 4]
        self.num_doors = len(self.doors)
        self.door_map: Dict[Tuple[int, int], int] = {}
        self.key_map: Dict[Tuple[int, int], int] = {}
        for idx, d in enumerate(self.doors):
            self.door_map[(d[0], d[1])] = idx
            self.key_map[(d[2], d[3])] = idx

        self.goal_reward = config.goal_reward
        self.step_penalty = config.step_penalty
        self.wall_penalty = config.wall_penalty
        self.cliff_penalty = config.cliff_penalty
        self.mud_penalty = config.mud_penalty
        self.door_penalty = getattr(config, 'door_penalty', -5.0)
        self.key_reward = getattr(config, 'key_reward', 10.0)
        self.slippery_prob = config.slippery_prob
        
        self.current_state = self.get_initial_state()

    def get_initial_state(self) -> Tuple:
        if self.num_doors > 0:
            return (self.start[0], self.start[1], 0)
        return (self.start[0], self.start[1])

    def reset(self) -> Tuple:
        self.current_state = self.get_initial_state()
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

    def step(self, state: Tuple, action: str) -> Tuple[Tuple, float, bool]:
        r = state[0]
        c = state[1]
        key_mask = state[2] if len(state) > 2 else 0

        actual_action = self.get_actual_action((r, c), action)

        if actual_action == 'up':
            next_r, next_c = r - 1, c
        elif actual_action == 'down':
            next_r, next_c = r + 1, c
        elif actual_action == 'left':
            next_r, next_c = r, c - 1
        elif actual_action == 'right':
            next_r, next_c = r, c + 1
        else:
            next_r, next_c = r, c

        # 1. Check boundary collision
        if not self.is_valid_cell((next_r, next_c)):
            return state, self.wall_penalty, False

        # 2. Check obstacle collision
        if (next_r, next_c) in self.obstacles:
            return state, self.wall_penalty, False

        # 3. Check locked door collision: cannot enter door cell without corresponding key
        if (next_r, next_c) in self.door_map:
            door_idx = self.door_map[(next_r, next_c)]
            has_key = bool(key_mask & (1 << door_idx))
            if not has_key:
                # Locked door collision: agent bounces back
                return state, self.door_penalty, False

        # Agent moves into (next_r, next_c)
        next_key_mask = key_mask
        earned_key_reward = 0.0

        # Check key collection
        if (next_r, next_c) in self.key_map:
            key_idx = self.key_map[(next_r, next_c)]
            if not bool(key_mask & (1 << key_idx)):
                next_key_mask = key_mask | (1 << key_idx)
                earned_key_reward = self.key_reward

        # Check portal warp: stepping on an entry immediately warps agent to exit
        if (next_r, next_c) in self.portal_map:
            dest = self.portal_map[(next_r, next_c)]
            if dest not in self.obstacles:
                next_r, next_c = dest
                # If portal destination is also a key
                if (next_r, next_c) in self.key_map:
                    k_idx = self.key_map[(next_r, next_c)]
                    if not bool(next_key_mask & (1 << k_idx)):
                        next_key_mask = next_key_mask | (1 << k_idx)
                        earned_key_reward += self.key_reward

        if self.num_doors > 0:
            next_state = (next_r, next_c, next_key_mask)
        else:
            next_state = (next_r, next_c)

        # Check cliff / lava tile (fatal fall, episode ends)
        if (next_r, next_c) in self.cliffs:
            return next_state, self.cliff_penalty, True

        # Check goal reached
        if (next_r, next_c) == self.goal:
            return next_state, self.goal_reward + earned_key_reward, True

        # Check mud tile (higher movement penalty)
        if (next_r, next_c) in self.mud:
            return next_state, self.mud_penalty + earned_key_reward, False

        # Normal valid step
        return next_state, self.step_penalty + earned_key_reward, False
