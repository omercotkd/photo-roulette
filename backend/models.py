"""Pydantic models for HTTP request/response bodies."""
from pydantic import BaseModel, Field


class CreateGameRequest(BaseModel):
    host_name: str = Field(..., min_length=1, max_length=30)


class JoinGameRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=30)


class UpdateSettingsRequest(BaseModel):
    rounds: int | None = Field(None, ge=1, le=100)
    vote_timer_seconds: int | None = Field(None, ge=5, le=60)
    leaderboard_time_seconds: int | None = Field(None, ge=3, le=30)
    videos_allowed: bool | None = None


class PlayerResponse(BaseModel):
    player_id: str
    name: str
    is_host: bool
    is_ready: bool
    photo_count: int
    score: int
    streak: int


class UploadedPhotoResponse(BaseModel):
    photo_id: str
    filename: str
    media_type: str
    url: str


class UploadResponse(BaseModel):
    photo_id: str
    uploaded_count: int
    selected_photos: list[UploadedPhotoResponse]
    has_swap_pool: bool
