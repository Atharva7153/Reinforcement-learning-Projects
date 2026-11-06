from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

class CarConfig(BaseModel):
    track_length: float = Field(default=100.0, description="Total track length in meters")
    initial_distance: float = Field(default=85.0, description="Starting distance from wall in meters")
    initial_velocity: float = Field(default=14.0, description="Initial velocity in m/s (~50 km/h)")
    target_min_dist: float = Field(default=1.0, description="Minimum safe stopping distance from wall")
    target_max_dist: float = Field(default=4.0, description="Maximum safe stopping distance from wall")
    max_velocity: float = Field(default=25.0, description="Maximum car velocity in m/s")
    brake_accel: float = Field(default=-5.0, description="Deceleration under braking in m/s^2")
    accel_rate: float = Field(default=2.5, description="Acceleration under gas in m/s^2")
    drag_accel: float = Field(default=-0.3, description="Rolling resistance deceleration in m/s^2")
    dt: float = Field(default=0.1, description="Simulation delta time in seconds")
    max_steps: int = Field(default=150, description="Max steps per episode")
    randomize_init: bool = Field(default=True, description="Vary initial velocity and distance across episodes for generalizability")

class HyperParams(BaseModel):
    learning_rate: float = Field(default=0.15, ge=0.01, le=1.0)
    discount_factor: float = Field(default=0.98, ge=0.5, le=0.999)
    epsilon: float = Field(default=1.0, ge=0.0, le=1.0)
    epsilon_min: float = Field(default=0.05, ge=0.0, le=0.5)
    epsilon_decay: float = Field(default=0.996, ge=0.9, le=0.9999)

class StepActionRequest(BaseModel):
    action: int = Field(ge=0, le=2, description="0=Brake, 1=Accelerate, 2=Maintain")

class SpeedUpdate(BaseModel):
    delay_ms: int = Field(ge=0, le=1000)

class BatchTrainRequest(BaseModel):
    episodes: int = Field(default=200, ge=10, le=5000)

class CarTelemetry(BaseModel):
    distance: float
    velocity: float
    acceleration: float
    action: int
    action_name: str
    reward: float
    cumulative_reward: float
    step_count: int
    done: bool
    outcome: str
    radar_distance: float
    state_bin: List[int]
    q_values: List[float]

class EpisodeSummary(BaseModel):
    episode: int
    outcome: str
    reward: float
    steps: int
    final_distance: float
    final_velocity: float

class SessionStatusResponse(BaseModel):
    session_id: str
    is_training: bool
    mode: str
    speed_delay_ms: int
    current_episode: int
    success_rate: float
    crash_rate: float
    epsilon: float
    telemetry: CarTelemetry
    config: CarConfig
    hyperparams: HyperParams
