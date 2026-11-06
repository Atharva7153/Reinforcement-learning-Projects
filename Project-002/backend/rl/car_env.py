import math
import random
from typing import Tuple, Dict, Any, List
from models.schemas import CarConfig

ACTION_NAMES = {
    0: "Brake",
    1: "Accelerate",
    2: "Maintain"
}

# Distance bin thresholds (non-linear, high resolution near stopping zone)
DIST_BINS = [
    0.0, 0.6, 1.2, 2.0, 3.0, 4.2, 5.8, 7.8, 10.2, 13.0,
    16.5, 20.5, 25.5, 31.5, 38.5, 47.0, 57.0, 68.0, 80.0, 105.0
]
NUM_DIST_BINS = len(DIST_BINS) - 1  # 19 bins

# Velocity bin thresholds
VEL_BINS = [
    0.0, 0.35, 1.2, 2.5, 4.2, 6.5, 9.2, 12.5, 16.5, 21.0, 28.0
]
NUM_VEL_BINS = len(VEL_BINS) - 1  # 10 bins


class CarStopEnv:
    """
    2D Physics Environment for Autonomous Emergency Braking & Stopping Task.
    State: (distance_to_wall, velocity)
    Actions:
      0: Brake (decelerate forcefully)
      1: Accelerate (press accelerator pedal)
      2: Maintain (coast with slight rolling resistance)
    """

    def __init__(self, config: CarConfig = None):
        self.config = config or CarConfig()
        self.distance = self.config.initial_distance
        self.velocity = self.config.initial_velocity
        self.acceleration = 0.0
        self.step_count = 0
        self.cumulative_reward = 0.0
        self.stopped_step_count = 0
        self.done = False
        self.outcome = "READY"
        self.last_action = 2

    def reset(self, initial_distance: float = None, initial_velocity: float = None) -> Tuple[int, int]:
        """
        Reset car environment to initial conditions.
        If randomize_init is True in config, add slight variation for generalization.
        """
        if initial_distance is not None:
            self.distance = initial_distance
        elif self.config.randomize_init:
            # Vary between 75m and 95m
            self.distance = round(random.uniform(75.0, 95.0), 1)
        else:
            self.distance = self.config.initial_distance

        if initial_velocity is not None:
            self.velocity = initial_velocity
        elif self.config.randomize_init:
            # Vary between 10.0 m/s (~36 km/h) and 18.0 m/s (~65 km/h)
            self.velocity = round(random.uniform(10.0, 18.0), 1)
        else:
            self.velocity = self.config.initial_velocity

        self.acceleration = 0.0
        self.step_count = 0
        self.cumulative_reward = 0.0
        self.stopped_step_count = 0
        self.done = False
        self.outcome = "RUNNING"
        self.last_action = 2

        return self.get_discrete_state()

    def get_discrete_state(self) -> Tuple[int, int]:
        """Convert continuous (distance, velocity) to discrete (dist_bin, vel_bin)."""
        d = max(0.0, min(self.distance, DIST_BINS[-1] - 0.001))
        v = max(0.0, min(self.velocity, VEL_BINS[-1] - 0.001))

        # Find distance bin index
        dist_bin = 0
        for i in range(len(DIST_BINS) - 1):
            if DIST_BINS[i] <= d < DIST_BINS[i + 1]:
                dist_bin = i
                break
        else:
            dist_bin = len(DIST_BINS) - 2

        # Find velocity bin index
        vel_bin = 0
        for j in range(len(VEL_BINS) - 1):
            if VEL_BINS[j] <= v < VEL_BINS[j + 1]:
                vel_bin = j
                break
        else:
            vel_bin = len(VEL_BINS) - 2

        return (dist_bin, vel_bin)

    def step(self, action: int) -> Tuple[Tuple[int, int], float, bool, Dict[str, Any]]:
        """
        Executes one physics simulation step with the selected action.
        Returns: (next_discrete_state, reward, done, info)
        """
        if self.done:
            return self.get_discrete_state(), 0.0, True, {"outcome": self.outcome}

        self.step_count += 1
        self.last_action = action
        dt = self.config.dt

        # Determine acceleration based on chosen action
        if action == 0:  # BRAKE
            target_accel = self.config.brake_accel
        elif action == 1:  # ACCELERATE
            target_accel = self.config.accel_rate
        else:  # MAINTAIN
            target_accel = self.config.drag_accel if self.velocity > 0.0 else 0.0

        self.acceleration = target_accel

        # Compute new velocity
        v_prev = self.velocity
        v_next = v_prev + self.acceleration * dt
        v_next = max(0.0, min(self.config.max_velocity, v_next))
        self.velocity = round(v_next, 3)

        # Distance traveled during this step
        v_avg = 0.5 * (v_prev + self.velocity)
        delta_x = v_avg * dt
        self.distance = round(self.distance - delta_x, 3)

        # Evaluate outcome & rewards
        reward = 0.0
        done = False
        outcome = "RUNNING"

        # Check for CRASH into wall
        if self.distance <= 0.0:
            self.distance = 0.0
            done = True
            outcome = "CRASH"
            # Severe penalty scaled with speed at impact
            reward = -120.0 - (2.5 * v_prev)

        # Check for SAFE STOP in the target stopping zone
        elif self.config.target_min_dist <= self.distance <= self.config.target_max_dist and self.velocity <= 0.35:
            done = True
            outcome = "SUCCESS"
            # Center of the safe zone
            target_center = 0.5 * (self.config.target_min_dist + self.config.target_max_dist)
            accuracy_bonus = max(0.0, 10.0 - 5.0 * abs(self.distance - target_center))
            reward = 150.0 + accuracy_bonus

        # Check if car stopped too far before the safe zone (STALLED)
        elif self.velocity <= 0.1 and self.distance > self.config.target_max_dist:
            self.stopped_step_count += 1
            if self.stopped_step_count >= 4:
                done = True
                outcome = "STALLED"
                reward = -35.0 - (0.4 * self.distance)
            else:
                # Warning penalty for stopping early
                reward = -2.0
        else:
            self.stopped_step_count = 0

            # Max steps exceeded (TIMEOUT)
            if self.step_count >= self.config.max_steps:
                done = True
                outcome = "TIMEOUT"
                reward = -30.0
            else:
                # Step reward shaping:
                # 1. Base time penalty to discourage pointless delay
                reward = -0.15

                # 2. Moving forward when safely far from wall is good
                if self.distance > 20.0 and self.velocity > 0:
                    reward += 0.12 * (self.velocity / self.config.max_velocity)

                # 3. Overspeed penalty close to wall:
                # Safe stopping distance formula: d_stop = v^2 / (2 * |a_brake|)
                min_stop_dist = (self.velocity ** 2) / (2.0 * abs(self.config.brake_accel) + 1e-5)
                if self.distance < min_stop_dist * 1.15 and action != 0:
                    # In imminent collision zone and NOT braking!
                    reward -= 1.5 * (1.0 + (min_stop_dist - self.distance) / 5.0)

                # 4. Reward braking gently as we close in on the safe zone
                if 2.0 <= self.distance <= 12.0 and action == 0 and self.velocity <= 8.0:
                    reward += 0.4

        self.done = done
        self.outcome = outcome
        self.cumulative_reward += reward

        info = {
            "distance": self.distance,
            "velocity": self.velocity,
            "acceleration": self.acceleration,
            "action": action,
            "action_name": ACTION_NAMES[action],
            "reward": round(reward, 3),
            "cumulative_reward": round(self.cumulative_reward, 3),
            "step_count": self.step_count,
            "done": self.done,
            "outcome": self.outcome,
            "radar_distance": max(0.0, self.distance),
            "state_bin": list(self.get_discrete_state())
        }

        return self.get_discrete_state(), reward, done, info

    def get_telemetry(self) -> Dict[str, Any]:
        """Snapshot of current car telemetry."""
        return {
            "distance": round(self.distance, 2),
            "velocity": round(self.velocity, 2),
            "acceleration": round(self.acceleration, 2),
            "action": self.last_action,
            "action_name": ACTION_NAMES.get(self.last_action, "Maintain"),
            "reward": 0.0,
            "cumulative_reward": round(self.cumulative_reward, 2),
            "step_count": self.step_count,
            "done": self.done,
            "outcome": self.outcome,
            "radar_distance": round(max(0.0, self.distance), 2),
            "state_bin": list(self.get_discrete_state()),
            "q_values": [0.0, 0.0, 0.0]
        }
