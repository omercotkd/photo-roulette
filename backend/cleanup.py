"""APScheduler-based cleanup for inactive or finished games."""
from __future__ import annotations

import shutil
import time
from pathlib import Path

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from game_state import GameStatus
from store import games

INACTIVITY_TIMEOUT_SECONDS = 3600  # 1 hour
GAME_OVER_CLEANUP_SECONDS = 600    # 10 minutes after GAME_OVER

scheduler = AsyncIOScheduler()


def _delete_game(code: str) -> None:
    upload_dir = Path(__file__).parent / "uploads" / code
    if upload_dir.exists():
        shutil.rmtree(upload_dir, ignore_errors=True)
    games.pop(code, None)


async def cleanup_inactive_games() -> None:
    now = time.time()
    to_delete = [
        code
        for code, game in list(games.items())
        if (
            (game.status != GameStatus.GAME_OVER and now - game.last_activity > INACTIVITY_TIMEOUT_SECONDS)
            or (game.status == GameStatus.GAME_OVER and now - game.last_activity > GAME_OVER_CLEANUP_SECONDS)
        )
    ]
    for code in to_delete:
        _delete_game(code)


def start_scheduler() -> None:
    scheduler.add_job(cleanup_inactive_games, "interval", minutes=5)
    scheduler.start()


def stop_scheduler() -> None:
    scheduler.shutdown(wait=False)
