from __future__ import annotations

import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class GameStatus(str, Enum):
    LOBBY = "LOBBY"
    IN_ROUND = "IN_ROUND"
    ROUND_REVEAL = "ROUND_REVEAL"
    BETWEEN_ROUNDS = "BETWEEN_ROUNDS"
    GAME_OVER = "GAME_OVER"


@dataclass
class UploadedPhoto:
    photo_id: str
    filename: str
    media_type: str  # "image" or "video"
    url: str


@dataclass
class Player:
    player_id: str
    name: str
    token: str
    is_host: bool = False
    is_ready: bool = False
    uploaded_photos: list[UploadedPhoto] = field(default_factory=list)
    selected_photos: list[UploadedPhoto] = field(default_factory=list)
    score: int = 0
    streak: int = 0
    current_round_vote: Optional[str] = None        # player_id voted for
    current_round_vote_elapsed_ms: Optional[float] = None
    socket_id: Optional[str] = None


@dataclass
class GameSettings:
    rounds: int = 10
    vote_timer_seconds: int = 15
    leaderboard_time_seconds: int = 10
    videos_allowed: bool = True
    party_mode: bool = False


@dataclass
class RoundAsset:
    photo_id: str
    owner_player_id: str
    media_url: str
    media_type: str


@dataclass
class Game:
    code: str
    settings: GameSettings = field(default_factory=GameSettings)
    players: dict[str, Player] = field(default_factory=dict)
    round_pool: list[RoundAsset] = field(default_factory=list)
    current_round_idx: int = -1
    status: GameStatus = GameStatus.LOBBY
    last_activity: float = field(default_factory=time.time)
    round_start_time_ms: Optional[float] = None

    def update_activity(self) -> None:
        self.last_activity = time.time()
