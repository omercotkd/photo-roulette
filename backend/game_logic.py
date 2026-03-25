"""Pure game logic: round pool generation, scoring, leaderboard."""
from __future__ import annotations

import math
import random

from game_state import Game, Player, RoundAsset, UploadedPhoto


def generate_round_pool(game: Game) -> list[RoundAsset]:
    """
    Pre-shuffle algorithm:
      1. Every player contributes floor(rounds / player_count) photos (quota).
      2. Remaining (rounds % player_count) slots filled randomly from leftover photos.
      3. Final pool is shuffled.

    Raises ValueError if total selected photos < rounds required.
    """
    players = list(game.players.values())
    rounds = game.settings.rounds
    player_count = len(players)

    if player_count == 0:
        raise ValueError("No players in game.")

    total_available = sum(len(p.selected_photos) for p in players)
    if total_available < rounds:
        raise ValueError(
            f"Not enough photos: need {rounds}, have {total_available} selected total."
        )

    quota = math.floor(rounds / player_count)
    remainder = rounds % player_count

    pool: list[RoundAsset] = []
    leftover: list[tuple[str, UploadedPhoto]] = []

    for player in players:
        photos = list(player.selected_photos)
        random.shuffle(photos)
        # Guaranteed quota photos
        for photo in photos[:quota]:
            pool.append(
                RoundAsset(
                    photo_id=photo.photo_id,
                    owner_player_id=player.player_id,
                    media_url=photo.url,
                    media_type=photo.media_type,
                )
            )
        # Remaining go to leftover pool for extra slots
        for photo in photos[quota:]:
            leftover.append((player.player_id, photo))

    # Fill remainder slots from leftover
    random.shuffle(leftover)
    for player_id, photo in leftover[:remainder]:
        pool.append(
            RoundAsset(
                photo_id=photo.photo_id,
                owner_player_id=player_id,
                media_url=photo.url,
                media_type=photo.media_type,
            )
        )

    random.shuffle(pool)
    return pool


def calculate_score(elapsed_ms: float, window_ms: float) -> int:
    """Linear decay from 1000 → 100 pts based on how quickly the player voted."""
    if elapsed_ms <= 0:
        return 1000
    ratio = min(elapsed_ms / window_ms, 1.0)
    return max(100, round(1000 - 900 * ratio))


def build_leaderboard(game: Game, deltas: dict[str, int]) -> list[dict]:
    """Return sorted leaderboard list for a game."""
    entries = []
    for player in game.players.values():
        entries.append(
            {
                "player_id": player.player_id,
                "name": player.name,
                "score": player.score,
                "streak": player.streak,
                "delta": deltas.get(player.player_id, 0),
            }
        )
    entries.sort(key=lambda e: e["score"], reverse=True)
    return entries
