"""Socket.IO server and all real-time event handlers."""
from __future__ import annotations

import asyncio
import time
from typing import Any

import socketio

from game_logic import build_leaderboard, calculate_score, generate_round_pool
from game_state import Game, GameStatus, Player
from store import games

sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*",
    logger=False,
    engineio_logger=False,
)


# Mapping socket_id → (game_code, player_id)
socket_sessions: dict[str, tuple[str, str]] = {}

# Mapping game_code → active asyncio timer Task
round_timers: dict[str, asyncio.Task] = {}  # type: ignore[type-arg]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _player_to_dict(player: Player) -> dict:
    return {
        "player_id": player.player_id,
        "name": player.name,
        "is_host": player.is_host,
        "is_ready": player.is_ready,
        "photo_count": len(player.selected_photos),
        "score": player.score,
        "streak": player.streak,
    }


def _settings_to_dict(game: Game) -> dict:
    s = game.settings
    return {
        "rounds": s.rounds,
        "vote_timer_seconds": s.vote_timer_seconds,
        "leaderboard_time_seconds": s.leaderboard_time_seconds,
        "videos_allowed": s.videos_allowed,
    }


def _build_room_state(game: Game, player_id: str | None = None) -> dict:
    state: dict[str, Any] = {
        "game_code": game.code,
        "status": game.status.value,
        "settings": _settings_to_dict(game),
        "players": [_player_to_dict(p) for p in game.players.values()],
    }
    if game.status in (GameStatus.IN_ROUND, GameStatus.ROUND_REVEAL, GameStatus.BETWEEN_ROUNDS):
        idx = game.current_round_idx
        state["current_round_number"] = idx + 1
        state["total_rounds"] = game.settings.rounds
        if idx < len(game.round_pool):
            asset = game.round_pool[idx]
            state["current_media_url"] = asset.media_url
            state["current_media_type"] = asset.media_type
        if game.round_start_time_ms:
            state["round_elapsed_ms"] = int(time.time() * 1000 - game.round_start_time_ms)
    if player_id and player_id in game.players:
        player = game.players[player_id]
        state["my_vote"] = player.current_round_vote
        state["my_selected_photos"] = [
            {"photo_id": p.photo_id, "filename": p.filename, "media_type": p.media_type, "url": p.url}
            for p in player.selected_photos
        ]
        state["my_uploaded_photos"] = [
            {"photo_id": p.photo_id, "filename": p.filename, "media_type": p.media_type, "url": p.url}
            for p in player.uploaded_photos
        ]
        state["has_swap_pool"] = len(player.uploaded_photos) > len(player.selected_photos)
    return state


async def _start_round(game_code: str) -> None:
    game = games.get(game_code)
    if not game:
        return

    game.current_round_idx += 1
    game.status = GameStatus.IN_ROUND
    game.round_start_time_ms = time.time() * 1000
    game.update_activity()

    # Reset votes for all players
    for player in game.players.values():
        player.current_round_vote = None
        player.current_round_vote_elapsed_ms = None

    asset = game.round_pool[game.current_round_idx]
    await sio.emit(
        "round_start",
        {
            "round_idx": game.current_round_idx,
            "round_number": game.current_round_idx + 1,
            "total_rounds": game.settings.rounds,
            "media_url": asset.media_url,
            "media_type": asset.media_type,
        },
        room=game_code,
    )

    # Start the vote timer
    task = asyncio.create_task(_vote_timer(game_code))
    round_timers[game_code] = task


async def _vote_timer(game_code: str) -> None:
    game = games.get(game_code)
    if not game:
        return
    await asyncio.sleep(game.settings.vote_timer_seconds)
    if games.get(game_code) and games[game_code].status == GameStatus.IN_ROUND:
        await _end_round(game_code)


async def _end_round(game_code: str) -> None:
    game = games.get(game_code)
    if not game or game.status != GameStatus.IN_ROUND:
        return

    game.status = GameStatus.ROUND_REVEAL
    game.update_activity()

    # Cancel still-running vote timer, but never cancel ourselves
    # (when the timer expires naturally, _end_round is called *from* the timer task,
    # so task is asyncio.current_task() — cancelling it would abort _end_round mid-execution)
    task = round_timers.pop(game_code, None)
    if task and not task.done() and task is not asyncio.current_task():
        task.cancel()

    asset = game.round_pool[game.current_round_idx]
    owner = game.players.get(asset.owner_player_id)
    owner_name = owner.name if owner else "Unknown"

    window_ms = game.settings.vote_timer_seconds * 1000

    votes = []
    deltas: dict[str, int] = {}
    for player in game.players.values():
        voted_for_id = player.current_round_vote
        correct = voted_for_id == asset.owner_player_id
        points = 0
        if voted_for_id is not None and correct:
            elapsed = player.current_round_vote_elapsed_ms or window_ms
            points = calculate_score(elapsed, window_ms)

        player.score += points
        deltas[player.player_id] = points

        if voted_for_id is not None:
            if correct:
                player.streak += 1
            else:
                player.streak = 0
        else:
            # Did not vote → streak broken
            player.streak = 0

        voted_for_name = (
            game.players[voted_for_id].name if voted_for_id and voted_for_id in game.players else None
        )
        votes.append(
            {
                "voter_id": player.player_id,
                "voter_name": player.name,
                "voted_for_id": voted_for_id,
                "voted_for_name": voted_for_name,
                "correct": correct,
                "points_earned": points,
                "elapsed_ms": round(player.current_round_vote_elapsed_ms) if player.current_round_vote_elapsed_ms is not None else None,
            }
        )

    leaderboard = build_leaderboard(game, deltas)

    await sio.emit(
        "round_end",
        {
            "round_number": game.current_round_idx + 1,
            "owner_id": asset.owner_player_id,
            "owner_name": owner_name,
            "media_url": asset.media_url,
            "media_type": asset.media_type,
            "votes": votes,
            "scores_delta": deltas,
            "leaderboard": leaderboard,
        },
        room=game_code,
    )

    # Wait leaderboard display time, then proceed
    leaderboard_secs = game.settings.leaderboard_time_seconds
    await asyncio.sleep(leaderboard_secs)

    game = games.get(game_code)
    if not game:
        return

    is_last_round = game.current_round_idx >= game.settings.rounds - 1
    if is_last_round:
        game.status = GameStatus.GAME_OVER
        game.update_activity()
        await sio.emit(
            "game_over",
            {"final_leaderboard": build_leaderboard(game, {})},
            room=game_code,
        )
    else:
        game.status = GameStatus.BETWEEN_ROUNDS
        await _start_round(game_code)


# ---------------------------------------------------------------------------
# Connection lifecycle
# ---------------------------------------------------------------------------

@sio.event
async def connect(sid: str, environ: dict, auth: dict | None = None) -> None:
    pass  # Client must emit join_room to associate


@sio.event
async def disconnect(sid: str) -> None:
    session = socket_sessions.pop(sid, None)
    if not session:
        return
    game_code, player_id = session
    game = games.get(game_code)
    if not game:
        return
    player = game.players.get(player_id)
    if player and player.socket_id == sid:
        player.socket_id = None
    game.update_activity()
    await sio.emit(
        "player_left",
        {"player_id": player_id, "players": [_player_to_dict(p) for p in game.players.values()]},
        room=game_code,
    )


# ---------------------------------------------------------------------------
# Client → Server events
# ---------------------------------------------------------------------------

@sio.on("join_room") # type: ignore
async def on_join_room(sid: str, data: dict) -> None:
    game_code = str(data.get("game_code", ""))
    player_id = str(data.get("player_id", ""))
    token = str(data.get("token", ""))

    game = games.get(game_code)
    if not game:
        await sio.emit("error", {"message": "Game not found."}, to=sid)
        return

    player = game.players.get(player_id)
    if not player or player.token != token:
        await sio.emit("error", {"message": "Authentication failed."}, to=sid)
        return

    # Remove old session mapping if reconnecting
    old_sid = player.socket_id
    if old_sid and old_sid != sid:
        socket_sessions.pop(old_sid, None)

    player.socket_id = sid
    socket_sessions[sid] = (game_code, player_id)
    await sio.enter_room(sid, game_code)
    game.update_activity()

    await sio.emit("room_state", _build_room_state(game, player_id), to=sid)
    await sio.emit(
        "player_joined",
        {"player_id": player_id, "players": [_player_to_dict(p) for p in game.players.values()]},
        room=game_code,
        skip_sid=sid,
    )


@sio.on("set_ready") # type: ignore
async def on_set_ready(sid: str, data: dict) -> None:
    session = socket_sessions.get(sid)
    if not session:
        return
    game_code, player_id = session
    game = games.get(game_code)
    if not game or game.status != GameStatus.LOBBY:
        return

    player = game.players.get(player_id)
    if not player:
        return

    # Cannot be ready without at least 1 selected photo
    if data.get("ready") and len(player.selected_photos) == 0:
        await sio.emit("error", {"message": "Upload at least one photo before readying up."}, to=sid)
        return

    player.is_ready = bool(data.get("ready", False))
    game.update_activity()

    await sio.emit(
        "player_ready_changed",
        {"player_id": player_id, "is_ready": player.is_ready},
        room=game_code,
    )


@sio.on("cast_vote") # type: ignore
async def on_cast_vote(sid: str, data: dict) -> None:
    session = socket_sessions.get(sid)
    if not session:
        return
    game_code, player_id = session
    game = games.get(game_code)
    if not game or game.status != GameStatus.IN_ROUND:
        return

    player = game.players.get(player_id)
    if not player:
        return

    # Vote is immediately locked — ignore any duplicate votes
    if player.current_round_vote is not None:
        return

    voted_for_player_id = str(data.get("voted_for_player_id", ""))
    if voted_for_player_id not in game.players:
        return

    # Validate round_idx matches current round
    if data.get("round_idx") != game.current_round_idx:
        return

    elapsed_ms = time.time() * 1000 - (game.round_start_time_ms or 0)
    player.current_round_vote = voted_for_player_id
    player.current_round_vote_elapsed_ms = elapsed_ms
    game.update_activity()

    votes_cast = sum(1 for p in game.players.values() if p.current_round_vote is not None)
    await sio.emit(
        "vote_progress",
        {"votes_cast": votes_cast, "total_players": len(game.players)},
        room=game_code,
    )

    # If all players voted, end round immediately
    if votes_cast == len(game.players):
        await _end_round(game_code)


@sio.on("swap_photo") # type: ignore
async def on_swap_photo(sid: str, data: dict) -> None:
    session = socket_sessions.get(sid)
    if not session:
        return
    game_code, player_id = session
    game = games.get(game_code)
    if not game or game.status != GameStatus.LOBBY:
        return

    player = game.players.get(player_id)
    if not player:
        return

    old_photo_id = str(data.get("old_photo_id", ""))

    # Find the photo to remove from selected
    old_photo = next((p for p in player.selected_photos if p.photo_id == old_photo_id), None)
    if not old_photo:
        return

    # Build swap pool: uploaded but not currently selected
    selected_ids = {p.photo_id for p in player.selected_photos}
    swap_pool = [p for p in player.uploaded_photos if p.photo_id not in selected_ids]
    if not swap_pool:
        await sio.emit("error", {"message": "No photos left to swap in."}, to=sid)
        return

    import random
    new_photo = random.choice(swap_pool)

    # Replace in selected list
    player.selected_photos = [new_photo if p.photo_id == old_photo_id else p for p in player.selected_photos]
    game.update_activity()

    await sio.emit(
        "photo_swapped",
        {
            "old_photo_id": old_photo_id,
            "new_photo": {
                "photo_id": new_photo.photo_id,
                "filename": new_photo.filename,
                "media_type": new_photo.media_type,
                "url": new_photo.url,
            },
            "selected_photos": [
                {"photo_id": p.photo_id, "filename": p.filename, "media_type": p.media_type, "url": p.url}
                for p in player.selected_photos
            ],
            "has_swap_pool": len(player.uploaded_photos) - len(player.selected_photos) > 0,
        },
        to=sid,
    )
    await sio.emit(
        "photo_selected",
        {"player_id": player_id, "count": len(player.selected_photos)},
        room=game_code,
        skip_sid=sid,
    )


async def do_start_game(game_code: str, game: Game) -> None:
    """Called by the REST start endpoint after validation."""
    try:
        pool = generate_round_pool(game)
    except ValueError as exc:
        await sio.emit("error", {"message": str(exc)}, room=game_code)
        return

    game.round_pool = pool
    game.current_round_idx = -1
    game.status = GameStatus.LOBBY  # will be changed immediately in _start_round
    game.update_activity()

    await sio.emit("game_starting", {}, room=game_code)
    await asyncio.sleep(3)  # 3-second countdown
    await _start_round(game_code)


async def do_play_again(game_code: str, game: Game) -> None:
    """Called by the REST play-again endpoint after validation."""
    import shutil
    from pathlib import Path

    # Cancel any running timers
    task = round_timers.pop(game_code, None)
    if task and not task.done():
        task.cancel()

    # Delete uploaded files
    upload_dir = Path(__file__).parent / "uploads" / game_code
    if upload_dir.exists():
        shutil.rmtree(upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)

    # Reset player state
    for player in game.players.values():
        player.is_ready = False
        player.uploaded_photos = []
        player.selected_photos = []
        player.score = 0
        player.streak = 0
        player.current_round_vote = None
        player.current_round_vote_elapsed_ms = None

    # Reset game state
    game.round_pool = []
    game.current_round_idx = -1
    game.status = GameStatus.LOBBY
    game.update_activity()

    await sio.emit("play_again", {}, room=game_code)
