from typing import List, Dict, Optional, Literal
from pydantic import BaseModel, Field

ActionType = Literal['left', 'right', 'up', 'down']

class EnvironmentConfig(BaseModel):
    rows: int = Field(default=4, ge=2, le=20)
    cols: int = Field(default=4, ge=2, le=20)
    start: List[int] = Field(default_factory=lambda: [0, 0])
    goal: List[int] = Field(default_factory=lambda: [3, 3])
    obstacles: List[List[int]] = Field(default_factory=list)
    cliffs: List[List[int]] = Field(default_factory=list)
    mud: List[List[int]] = Field(default_factory=list)
    ice: List[List[int]] = Field(default_factory=list)
    portals: List[List[int]] = Field(default_factory=list)  # [[r1, c1, r2, c2], ...]
    doors: List[List[int]] = Field(default_factory=list)    # [[door_r, door_c, key_r, key_c], ...]
    key_reward: float = 10.0
    door_penalty: float = -5.0
    goal_reward: float = 100.0
    step_penalty: float = -1.0
    wall_penalty: float = -5.0
    cliff_penalty: float = -50.0
    mud_penalty: float = -5.0
    slippery_prob: float = Field(default=0.3, ge=0.0, le=0.9)
    alpha: float = Field(default=0.1, ge=0.01, le=1.0)
    gamma: float = Field(default=0.9, ge=0.0, le=1.0)
    epsilon: float = Field(default=0.2, ge=0.0, le=1.0)
    epsilon_decay: float = Field(default=0.995, ge=0.8, le=1.0)
    epsilon_min: float = Field(default=0.01, ge=0.0, le=0.5)
    episodes: int = Field(default=500, ge=10, le=5000)
    max_steps: int = Field(default=150, ge=10, le=2000)
    delay_ms: int = Field(default=30, ge=0, le=1000)

class CreateEnvironmentResponse(BaseModel):
    session_id: str
    status: str
    config: EnvironmentConfig

class TrainingStartRequest(BaseModel):
    session_id: str

class TrainingStatusResponse(BaseModel):
    session_id: str
    status: str
    current_episode: int
    total_episodes: int
    current_step: int
    last_reward: float
    cumulative_reward: float
    epsilon: float

class QTableResponse(BaseModel):
    session_id: str
    q_table: Dict[str, Dict[str, float]]
    best_actions: Dict[str, Optional[str]]
    state_values: Dict[str, float] = Field(default_factory=dict)
    visit_counts: Dict[str, int] = Field(default_factory=dict)
