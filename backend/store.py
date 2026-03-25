"""In-memory game store shared across all modules."""
from game_state import Game

games: dict[str, Game] = {}
