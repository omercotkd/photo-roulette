"""REST API routes."""
from __future__ import annotations

import random
import string
import uuid
from pathlib import Path

import aiofiles
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from game_state import Game, GameSettings, GameStatus, Player, UploadedPhoto
from models import (
    CreateGameRequest,
    JoinGameRequest,
    UpdateSettingsRequest,
    UploadedPhotoResponse,
    UploadResponse,
)
from socket_manager import do_play_again, do_start_game, sio, _settings_to_dict, _player_to_dict
from store import games

router = APIRouter()
bearer = HTTPBearer(auto_error=False)

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB
UPLOAD_ROOT = Path(__file__).parent / "uploads"

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp", "image/heic", "image/heif"}
ALLOWED_VIDEO_TYPES = {"video/mp4", "video/quicktime", "video/webm", "video/x-msvideo", "video/mpeg"}


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------

def _get_token(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)) -> str:
    if not credentials:
        raise HTTPException(401, "Missing authorization token.")
    return credentials.credentials


def _get_game(code: str) -> Game:
    game = games.get(code)
    if not game:
        raise HTTPException(404, "Game not found.")
    return game


def _get_player_by_token(game: Game, token: str) -> Player:
    for player in game.players.values():
        if player.token == token:
            return player
    raise HTTPException(403, "Invalid token.")


def _require_host(game: Game, token: str) -> Player:
    player = _get_player_by_token(game, token)
    if not player.is_host:
        raise HTTPException(403, "Only the host can perform this action.")
    return player


# ---------------------------------------------------------------------------
# Game code generation
# ---------------------------------------------------------------------------

def _generate_game_code() -> str:
    for _ in range(20):
        code = "".join(random.choices(string.digits, k=6))
        if code not in games:
            return code
    raise HTTPException(503, "Could not generate a unique game code.")


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("/games")
async def create_game(body: CreateGameRequest):
    code = _generate_game_code()
    player_id = str(uuid.uuid4())
    token = str(uuid.uuid4())

    player = Player(
        player_id=player_id,
        name=body.host_name,
        token=token,
        is_host=True,
    )
    game = Game(code=code)
    game.players[player_id] = player

    games[code] = game

    return {"game_code": code, "player_id": player_id, "token": token}


@router.post("/games/{code}/join")
async def join_game(code: str, body: JoinGameRequest):
    game = _get_game(code)

    if game.status != GameStatus.LOBBY:
        raise HTTPException(400, "Game has already started.")

    # Prevent duplicate names
    existing_names = {p.name.lower() for p in game.players.values()}
    if body.name.lower() in existing_names:
        raise HTTPException(400, "That name is already taken.")

    player_id = str(uuid.uuid4())
    token = str(uuid.uuid4())
    player = Player(player_id=player_id, name=body.name, token=token)
    game.players[player_id] = player
    game.update_activity()

    return {"game_code": code, "player_id": player_id, "token": token}


@router.patch("/games/{code}/settings")
async def update_settings(code: str, body: UpdateSettingsRequest, token: str = Depends(_get_token)):
    game = _get_game(code)
    _require_host(game, token)

    if game.status != GameStatus.LOBBY:
        raise HTTPException(400, "Cannot change settings after game has started.")

    s = game.settings
    if body.rounds is not None:
        s.rounds = body.rounds
    if body.vote_timer_seconds is not None:
        s.vote_timer_seconds = body.vote_timer_seconds
    if body.leaderboard_time_seconds is not None:
        s.leaderboard_time_seconds = body.leaderboard_time_seconds
    if body.videos_allowed is not None:
        s.videos_allowed = body.videos_allowed

    game.update_activity()

    await sio.emit("settings_updated", _settings_to_dict(game), room=code)
    return _settings_to_dict(game)


@router.post("/games/{code}/upload")
async def upload_photo(code: str, file: UploadFile, token: str = Depends(_get_token)):
    game = _get_game(code)
    player = _get_player_by_token(game, token)

    if game.status != GameStatus.LOBBY:
        raise HTTPException(400, "Cannot upload photos after game has started.")

    content_type = (file.content_type or "").lower()
    is_video = content_type.startswith("video/")
    is_image = content_type.startswith("image/")

    if not is_image and not is_video:
        raise HTTPException(400, "Only image and video files are allowed.")
    if is_video and not game.settings.videos_allowed:
        raise HTTPException(400, "Videos are not allowed in this game.")
    if is_video and content_type not in ALLOWED_VIDEO_TYPES:
        raise HTTPException(400, f"Unsupported video type: {content_type}")
    if is_image and content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(400, f"Unsupported image type: {content_type}")

    # Read with size limit
    content = await file.read(MAX_FILE_SIZE + 1)
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(413, "File too large. Maximum size is 50 MB.")

    media_type = "video" if is_video else "image"

    # Save to disk
    player_upload_dir = UPLOAD_ROOT / code / player.player_id
    player_upload_dir.mkdir(parents=True, exist_ok=True)

    photo_id = str(uuid.uuid4())
    original_filename = file.filename or "upload"
    # Sanitize: keep only the extension
    suffix = Path(original_filename).suffix.lower()
    safe_filename = f"{photo_id}{suffix}"
    file_path = player_upload_dir / safe_filename

    async with aiofiles.open(file_path, "wb") as f:
        await f.write(content)

    url = f"/uploads/{code}/{player.player_id}/{safe_filename}"
    photo = UploadedPhoto(
        photo_id=photo_id,
        filename=safe_filename,
        media_type=media_type,
        url=url,
    )

    player.uploaded_photos.append(photo)
    if len(player.selected_photos) < 16:
        player.selected_photos.append(photo)

    game.update_activity()

    # Notify room of updated photo count (anonymous)
    await sio.emit(
        "photo_selected",
        {"player_id": player.player_id, "count": len(player.selected_photos)},
        room=code,
    )

    return UploadResponse(
        photo_id=photo_id,
        uploaded_count=len(player.uploaded_photos),
        selected_photos=[
            UploadedPhotoResponse(
                photo_id=p.photo_id,
                filename=p.filename,
                media_type=p.media_type,
                url=p.url,
            )
            for p in player.selected_photos
        ],
        has_swap_pool=len(player.uploaded_photos) > len(player.selected_photos),
    )


@router.post("/games/{code}/start")
async def start_game(code: str, token: str = Depends(_get_token)):
    game = _get_game(code)
    _require_host(game, token)

    if game.status != GameStatus.LOBBY:
        raise HTTPException(400, "Game has already started.")
    if len(game.players) < 2:
        raise HTTPException(400, "Need at least 2 players to start.")

    not_ready = [p.name for p in game.players.values() if not p.is_ready]
    if not_ready:
        raise HTTPException(400, f"Players not ready: {', '.join(not_ready)}")

    total_photos = sum(len(p.selected_photos) for p in game.players.values())
    if total_photos < game.settings.rounds:
        raise HTTPException(
            400,
            f"Not enough photos: need {game.settings.rounds} for {game.settings.rounds} rounds, "
            f"but only {total_photos} selected across all players.",
        )

    await do_start_game(code, game)
    return {"status": "started"}


@router.delete("/games/{code}/photos/{photo_id}")
async def delete_photo(code: str, photo_id: str, token: str = Depends(_get_token)):
    game = _get_game(code)
    player = _get_player_by_token(game, token)

    if game.status != GameStatus.LOBBY:
        raise HTTPException(400, "Cannot delete photos after game has started.")

    # Find the photo in uploaded list
    photo = next((p for p in player.uploaded_photos if p.photo_id == photo_id), None)
    if not photo:
        raise HTTPException(404, "Photo not found.")

    # Remove from both lists
    player.uploaded_photos = [p for p in player.uploaded_photos if p.photo_id != photo_id]
    player.selected_photos = [p for p in player.selected_photos if p.photo_id != photo_id]

    # Delete file from disk
    player_upload_dir = UPLOAD_ROOT / code / player.player_id
    file_path = player_upload_dir / photo.filename
    try:
        file_path.unlink(missing_ok=True)
    except OSError:
        pass  # Ignore filesystem errors — state is already updated

    game.update_activity()

    await sio.emit(
        "photo_selected",
        {"player_id": player.player_id, "count": len(player.selected_photos)},
        room=code,
    )

    return {
        "selected_photos": [
            UploadedPhotoResponse(
                photo_id=p.photo_id,
                filename=p.filename,
                media_type=p.media_type,
                url=p.url,
            )
            for p in player.selected_photos
        ],
        "has_swap_pool": len(player.uploaded_photos) > len(player.selected_photos),
    }


@router.post("/games/{code}/play-again")
async def play_again(code: str, token: str = Depends(_get_token)):
    game = _get_game(code)
    _require_host(game, token)

    await do_play_again(code, game)
    return {"status": "reset"}


@router.post("/games/{code}/kick/{player_id}")
async def kick_player(code: str, player_id: str, token: str = Depends(_get_token)):
    game = _get_game(code)
    host = _require_host(game, token)

    if game.status != GameStatus.LOBBY:
        raise HTTPException(400, "Can only kick players in the lobby.")

    target = game.players.get(player_id)
    if not target:
        raise HTTPException(404, "Player not found.")

    if target.player_id == host.player_id:
        raise HTTPException(400, "Cannot kick yourself.")

    del game.players[player_id]
    game.update_activity()

    await sio.emit(
        "player_kicked",
        {"player_id": player_id, "players": [_player_to_dict(p) for p in game.players.values()]},
        room=code,
    )

    return {"success": True}


@router.get("/games/{code}/state")
async def get_game_state(code: str, token: str = Depends(_get_token)):
    """Lightweight state poll for reconnect (supplements Socket.IO room_state)."""
    game = _get_game(code)
    player = _get_player_by_token(game, token)

    return {
        "game_code": game.code,
        "status": game.status.value,
        "players": [_player_to_dict(p) for p in game.players.values()],
        "settings": _settings_to_dict(game),
    }
