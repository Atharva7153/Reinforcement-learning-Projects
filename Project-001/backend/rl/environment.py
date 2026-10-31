import random
from typing import Tuple, List, Set, Dict, Optional, Any
from models.schemas import EnvironmentConfig

ACTIONS = ['up', 'down', 'left', 'right']

class GridEnvironment:
    def __init__(self, config: EnvironmentConfig):
        self.rows = config.rows
        self.cols = config.cols
        self.mode = config.mode
        self.start = (config.start[0], config.start[1])
        self.goal = (config.goal[0], config.goal[1])

        # Agent 2 positions for multi-agent modes
        start2_coords = config.start2 if config.start2 and len(config.start2) >= 2 else [config.rows - 1, 0]
        self.start2 = (start2_coords[0], start2_coords[1])

        if config.goal2 and len(config.goal2) >= 2:
            self.goal2 = (config.goal2[0], config.goal2[1])
        else:
            self.goal2 = self.goal  # Default to shared goal

        self.collision_penalty = getattr(config, 'collision_penalty', -5.0)
        self.coop_team_reward = getattr(config, 'coop_team_reward', 100.0)

        # Tiles
        self.obstacles: Set[Tuple[int, int]] = {
            (obs[0], obs[1]) for obs in config.obstacles
            if (obs[0], obs[1]) != self.start and (obs[0], obs[1]) != self.start2 and (obs[0], obs[1]) != self.goal
        }
        self.cliffs: Set[Tuple[int, int]] = {
            (c[0], c[1]) for c in config.cliffs
            if (c[0], c[1]) not in (self.start, self.start2, self.goal, self.goal2) and (c[0], c[1]) not in self.obstacles
        }
        self.mud: Set[Tuple[int, int]] = {
            (m[0], m[1]) for m in config.mud
            if (m[0], m[1]) not in (self.start, self.start2, self.goal, self.goal2) and (m[0], m[1]) not in self.obstacles
        }
        self.ice: Set[Tuple[int, int]] = {
            (i[0], i[1]) for i in config.ice
            if (i[0], i[1]) not in (self.start, self.start2, self.goal, self.goal2) and (i[0], i[1]) not in self.obstacles
        }

        # Portals mapping
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
        
        self.current_state = self.get_initial_state(self.start)
        self.current_state2 = self.get_initial_state(self.start2)

    def get_initial_state(self, start_pos: Tuple[int, int]) -> Tuple:
        if self.num_doors > 0:
            return (start_pos[0], start_pos[1], 0)
        return (start_pos[0], start_pos[1])

    def reset(self) -> Any:
        self.current_state = self.get_initial_state(self.start)
        self.current_state2 = self.get_initial_state(self.start2)
        if self.mode in ('competitive', 'cooperative'):
            return self.current_state, self.current_state2
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

    def _step_agent(self, state: Tuple, action: str, target_goal: Tuple[int, int]) -> Tuple[Tuple, float, bool, bool, bool]:
        """Internal helper for stepping a single agent.
        Returns: (next_state, reward, is_wall_or_locked, is_cliff, is_goal)
        """
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

        # 1. Boundary collision
        if not self.is_valid_cell((next_r, next_c)):
            return state, self.wall_penalty, True, False, False

        # 2. Obstacle collision
        if (next_r, next_c) in self.obstacles:
            return state, self.wall_penalty, True, False, False

        # 3. Locked door collision
        if (next_r, next_c) in self.door_map:
            door_idx = self.door_map[(next_r, next_c)]
            has_key = bool(key_mask & (1 << door_idx))
            if not has_key:
                return state, self.door_penalty, True, False, False

        # Move to (next_r, next_c)
        next_key_mask = key_mask
        earned_key_reward = 0.0

        # Key collection
        if (next_r, next_c) in self.key_map:
            key_idx = self.key_map[(next_r, next_c)]
            if not bool(key_mask & (1 << key_idx)):
                next_key_mask = key_mask | (1 << key_idx)
                earned_key_reward = self.key_reward

        # Portal warp
        if (next_r, next_c) in self.portal_map:
            dest = self.portal_map[(next_r, next_c)]
            if dest not in self.obstacles:
                next_r, next_c = dest
                if (next_r, next_c) in self.key_map:
                    k_idx = self.key_map[(next_r, next_c)]
                    if not bool(next_key_mask & (1 << k_idx)):
                        next_key_mask = next_key_mask | (1 << k_idx)
                        earned_key_reward += self.key_reward

        if self.num_doors > 0:
            next_state = (next_r, next_c, next_key_mask)
        else:
            next_state = (next_r, next_c)

        # Cliff check
        if (next_r, next_c) in self.cliffs:
            return next_state, self.cliff_penalty, False, True, False

        # Goal check
        if (next_r, next_c) == target_goal:
            return next_state, self.goal_reward + earned_key_reward, False, False, True

        # Mud check
        if (next_r, next_c) in self.mud:
            return next_state, self.mud_penalty + earned_key_reward, False, False, False

        # Regular step
        return next_state, self.step_penalty + earned_key_reward, False, False, False

    def step(self, state: Tuple, action: str) -> Tuple[Tuple, float, bool]:
        """Standard single-agent step."""
        next_st, reward, is_wall, is_cliff, is_goal = self._step_agent(state, action, self.goal)
        done = is_cliff or is_goal
        return next_st, reward, done

    def step_multi(
        self,
        state1: Tuple,
        action1: str,
        state2: Tuple,
        action2: str,
        agent1_done_already: bool = False,
        agent2_done_already: bool = False,
    ) -> Tuple[Tuple, float, bool, Tuple, float, bool, bool, Dict[str, Any]]:
        """Multi-agent step resolving simultaneous actions, agent-agent collisions, and mode win conditions.
        Returns:
            next_state1, reward1, done1,
            next_state2, reward2, done2,
            episode_done, info_dict
        """
        # Step Agent 1 if not already finished
        if agent1_done_already:
            next1, r1, is_wall1, is_cliff1, is_goal1 = state1, 0.0, False, False, True
        else:
            next1, r1, is_wall1, is_cliff1, is_goal1 = self._step_agent(state1, action1, self.goal)

        # Step Agent 2 if not already finished
        if agent2_done_already:
            next2, r2, is_wall2, is_cliff2, is_goal2 = state2, 0.0, False, False, True
        else:
            target2 = self.goal2 if self.mode == 'cooperative' else self.goal
            next2, r2, is_wall2, is_cliff2, is_goal2 = self._step_agent(state2, action2, target2)

        pos1 = (next1[0], next1[1])
        pos2 = (next2[0], next2[1])
        prev_pos1 = (state1[0], state1[1])
        prev_pos2 = (state2[0], state2[1])

        collision = False
        # Agent-agent collision check if neither is parked in a finished goal
        if not agent1_done_already and not agent2_done_already:
            # Case A: Same destination collision (except if it's the goal in competitive race)
            same_dest = pos1 == pos2
            # Case B: Cross / swap collision
            swap_dest = (pos1 == prev_pos2) and (pos2 == prev_pos1)

            if same_dest or swap_dest:
                if self.mode == 'competitive' and pos1 == self.goal and same_dest:
                    # Rare tie: both reached the goal on the exact same step!
                    pass
                else:
                    collision = True
                    # Both bounce back to their current positions
                    next1 = state1
                    next2 = state2
                    r1 = self.collision_penalty
                    r2 = self.collision_penalty
                    is_goal1 = False
                    is_goal2 = False
                    is_cliff1 = False
                    is_cliff2 = False

        info = {
            "collision": collision,
            "winner": None,
            "team_success": False
        }

        # Mode outcome resolution
        if self.mode == 'competitive':
            # Winner takes all race
            if is_goal1 and is_goal2:
                # Simultaneous tie
                r1 = self.goal_reward * 0.5
                r2 = self.goal_reward * 0.5
                info["winner"] = 0  # Tie
                return next1, r1, True, next2, r2, True, True, info
            elif is_goal1:
                r1 = self.goal_reward
                r2 = -10.0  # Loser penalty
                info["winner"] = 1
                return next1, r1, True, next2, r2, True, True, info
            elif is_goal2:
                r2 = self.goal_reward
                r1 = -10.0  # Loser penalty
                info["winner"] = 2
                return next1, r1, True, next2, r2, True, True, info
            elif is_cliff1 and is_cliff2:
                return next1, r1, True, next2, r2, True, True, info
            elif is_cliff1:
                # Agent 1 dies, Agent 2 wins by default
                info["winner"] = 2
                return next1, r1, True, next2, self.goal_reward * 0.8, True, True, info
            elif is_cliff2:
                # Agent 2 dies, Agent 1 wins by default
                info["winner"] = 1
                return next1, self.goal_reward * 0.8, True, next2, r2, True, True, info
            else:
                return next1, r1, False, next2, r2, False, False, info

        elif self.mode == 'cooperative':
            # Both agents must reach their goals
            done1 = is_goal1 or agent1_done_already
            done2 = is_goal2 or agent2_done_already

            if is_cliff1 or is_cliff2:
                # Fatal fall terminates team
                return next1, r1, True, next2, r2, True, True, info

            if done1 and done2:
                # TEAM SUCCESS!
                r1 += self.coop_team_reward
                r2 += self.coop_team_reward
                info["team_success"] = True
                return next1, r1, True, next2, r2, True, True, info
            else:
                return next1, r1, done1, next2, r2, done2, False, info

        # Single agent fallback
        done = is_cliff1 or is_goal1
        return next1, r1, done, next2, 0.0, True, done, info
