# Photo Roulette 🎰

A local-network multiplayer party game. Players upload photos, and everyone tries to guess who uploaded each one.

Entirely vibe-coded using github copilot, dont use in actual live server - just local host for a fun night with friends.

---

## Requirements

| Tool | Version |
|---|---|
| Python | 3.11+ |
| [uv](https://docs.astral.sh/uv/) | latest |
| Node.js | 18+ |
| npm | 9+ |

---

## Quick Start (LAN / Party Mode)

### 1 — Install backend dependencies

```bash
cd backend
uv sync
```

### 2 — Build the frontend

```bash
cd frontend
npm install
npm run build
```

### 3 — Run the server

```bash
cd backend
uv run uvicorn main:app --host 0.0.0.0 --port 8000
```

Open `http://<your-local-ip>:8000` on any device on the same Wi-Fi network.  
Find your local IP with `ipconfig` (Windows) or `ip a` (Linux/Mac).

---

## Development Mode (hot-reload)

Run both servers simultaneously in separate terminals:

**Terminal 1 — Backend:**
```bash
cd backend
uv run uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```

Frontend dev server runs on `http://localhost:5173` and proxies `/api` and `/uploads` to the backend.

---

## How to Play

1. **Host** opens the app, clicks **Create Game**, enters their name.
2. **Host** shares the 6-digit game code with other players.
3. **Players** click **Join Game**, enter the code + their name.
4. **Each player** uploads photos (or selects an album). The game picks 16.  
   - You can tap **✕** on any selected photo to swap it out (requires more than 16 uploaded).
5. **All players** tap **Ready** when done.
6. **Host** adjusts settings (rounds, vote timer, leaderboard time, videos) and clicks **Start Game**.
7. Each round displays a photo/video — vote for who you think uploaded it.
8. After the timer, the owner is revealed with a vote breakdown and score update.
9. After all rounds, a final leaderboard is shown. Host can click **Play Again** to reset.

---

## Scoring

- **Correct vote:** 1000 → 100 pts (linear decay over the vote window based on speed).
- **Wrong vote or no vote:** 0 pts.
- Voting faster = more points. Streaks are tracked and displayed 🔥 (no multiplier).
- Once you vote, your choice is **locked** — no changing your answer.

---

## Photo/Video Rules

- **Images:** JPEG, PNG, GIF, WebP, HEIC — any size up to 50 MB.
- **Videos:** MP4, MOV, WebM — up to 50 MB. Only the first 5 seconds are played (loops).
- Videos can be disabled by the host in settings.

---

## Project Structure

```
photo-roulette/
├── backend/
│   ├── main.py            # FastAPI entry point + static serving
│   ├── api.py             # REST routes
│   ├── socket_manager.py  # Socket.IO events + game flow
│   ├── game_state.py      # Dataclasses (Player, Game, …)
│   ├── game_logic.py      # Round pool gen, scoring, leaderboard
│   ├── cleanup.py         # APScheduler: auto-delete idle games
│   ├── store.py           # In-memory game store
│   ├── models.py          # Pydantic HTTP models
│   ├── uploads/           # {game_code}/{player_id}/{file} (auto-managed)
│   ├── pyproject.toml
│   └── uv.lock
└── frontend/
    ├── src/
    │   ├── context/GameContext.tsx  # Global state + Socket.IO
    │   ├── types/game.ts
    │   ├── pages/          # HomePage, LobbyPage, GamePage, …
    │   └── components/     # PhotoGrid, PlayerList, CountdownTimer, ScoreCard
    ├── vite.config.ts
    └── package.json
```

---

## Notes

- All data is **in-memory**. Restarting the server clears all games.
- Uploaded files are stored in `backend/uploads/` and auto-deleted 10 minutes after a game ends, or after 1 hour of inactivity.
- No accounts, no database — designed for spontaneous local play.
