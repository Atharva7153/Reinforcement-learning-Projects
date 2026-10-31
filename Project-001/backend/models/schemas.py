from typing import List, Dict, Optional, Literal
from pydantic import BaseModel, Field

ActionType = Literal['left', 'right', 'up', 'down']
GameMode = Literal['single', 'competitive', 'cooperative']

class EnvironmentConfig(BaseModel):
    mode: GameMode = Field(default='single')
    rows: int = Field(default=4, ge=2, le=20)
    cols: int = Field(default=4, ge=2, le=20)
    start: List[int] = Field(default_factory=lambda: [0, 0])
    goal: List[int] = Field(default_factory=lambda: [3, 3])
    # Multi-agent 2nd positions
    start2: List[int] = Field(default_factory=lambda: [3, 0])
    goal2: Optional[List[int]] = None  # In co-op, separate goal for Agent 2 if set
    collision_penalty: float = -5.0
    coop_team_reward: float = 100.0
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
    mode: str = "single"
    current_episode: int
    total_episodes: int
    current_step: int
    last_reward: float
    cumulative_reward: float
    epsilon: float
    # Multi-agent stats
    wins_agent1: int = 0
    wins_agent2: int = 0
    ties: int = 0
    last_reward2: Optional[float] = None
    cumulative_reward2: Optional[float] = None

class QTableResponse(BaseModel):
    session_id: str
    q_table: Dict[str, Dict[str, float]]
    best_actions: Dict[str, Optional[str]]
    state_values: Dict[str, float] = Field(default_factory=dict)
    visit_counts: Dict[str, int] = Field(default_factory=dict)
    # Multi-agent 2nd agent Q-table
    q_table2: Optional[Dict[str, Dict[str, float]]] = None
    best_actions2: Optional[Dict[str, Optional[str]]] = None
    state_values2: Optional[Dict[str, float]] = None
    visit_counts2: Optional[Dict[str, int]] = None
