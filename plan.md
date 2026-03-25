# Plan: Photo-Roulette Game

## Decisions
- **Backend**: Python FastAPI + python-socketio (Socket.IO rooms for per-game broadcast)
- **Frontend**: React + TypeScript + Vite + Tailwind CSS + socket.io-client
- **Real-time**: Socket.IO (python-socketio on server, socket.io-client on frontend)
- **Deployment**: Backend on port 8000 listens on 0.0.0.0; serves built frontend static files; players on same LAN access via host's IP
- **Game code**: 6-digit numeric (e.g. 482910)
- **Game master**: also a player
- **Voting**: all players shown as options (including self)
- **Disconnect**: 0 pts that round; can rejoin and resume
- **Videos**: no duration limit shown; only first 5s played; 50 MB max
- **Photos**: 16 per player; folder upload supported; can unselect→swap if pool > 16
- **Scoring**: linear decay 1000→100 pts over vote window, correct only; wrong = 0
- **Streaks**: tracked + displayed per player (display only, no multiplier)
- **No repeats**: never show same asset twice per game
- **Round pool**: pre-shuffle algorithm (quota slots first, then extras, then shuffle)
- **Reveal**: round ends → show photo owner name + who voted for whom (✓/✗) + points earned, then leaderboard 10s
- **Cleanup**: delete uploads + game state after 1 hour of inactivity or game ends
- **Play Again**: host resets same game (clear photos, back to lobby, same players re-select)
- **Defaults**: 10 rounds, 15s vote timer, 10s leaderboard display, videos allowed

## Directory Structure
```
photo-roulette/
├── backend/
│   ├── main.py              # FastAPI app + static file serving
│   ├── socket_manager.py    # python-socketio server + all event handlers
│   ├── game_state.py        # Game dataclasses + state machine
│   ├── game_logic.py        # Round pool generation, scoring, streak calc
│   ├── cleanup.py           # APScheduler-based cleanup task
│   ├── models.py            # Pydantic request/response models
│   ├── uploads/             # {game_code}/{player_id}/{filename}
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── types/game.ts        # All shared TS types
    │   ├── context/GameContext.tsx  # Global socket + game state
    │   ├── hooks/useSocket.ts   # Socket.IO connection hook
    │   ├── pages/
    │   │   ├── HomePage.tsx        # Create / Join UI
    │   │   ├── LobbyPage.tsx       # Player list, settings (host), photo selection, ready
    │   │   ├── GamePage.tsx        # Router between game sub-screens
    │   │   ├── VotingScreen.tsx    # Photo/video display + voting + countdown
    │   │   ├── RevealScreen.tsx    # Owner reveal, vote breakdown, points earned
    │   │   ├── LeaderboardScreen.tsx  # Between-round leaderboard + streak
    │   │   └── GameOverScreen.tsx  # Final leaderboard + play again
    │   ├── components/
    │   │   ├── PhotoGrid.tsx       # 16-photo selection grid with swap
    │   │   ├── PlayerList.tsx      # Lobby player list with ready badges
    │   │   ├── CountdownTimer.tsx  # Animated countdown ring
    │   │   └── ScoreCard.tsx       # Per-player score row
    │   ├── App.tsx
    │   └── main.tsx
    ├── package.json
    └── vite.config.ts
```

---

## Phase 0: Project Scaffolding
1. Create `backend/` folder; initialize with `uv init`; add deps via `uv add` (fastapi, uvicorn[standard], python-socketio, python-multipart, aiofiles, apscheduler); this produces `pyproject.toml` + `uv.lock` (no requirements.txt)
2. Scaffold `frontend/` with `npm create vite@latest -- --template react-ts`; install deps (socket.io-client, react-router-dom, tailwindcss + config, clsx)
3. Configure Tailwind; set up `vite.config.ts` with dev proxy to backend at port 8000

## Phase 1: Backend — Data Models & State Machine
1. `game_state.py`: define dataclasses for `Player`, `GameSettings`, `Round`, `Game`
   - Game statuses: `LOBBY` → `IN_ROUND` → `ROUND_REVEAL` → `BETWEEN_ROUNDS` → `GAME_OVER`
   - Player fields: id (uuid), name, is_host, is_ready, uploaded_photos[], selected_photos[], score, streak, votes{}
   - Game fields: code, settings, players{}, rounds[], current_round_idx, status, last_activity
2. `game_logic.py`:
   - `generate_round_pool(players, rounds)`: quota-fill + extras + shuffle; validates rounds ≤ 16 × player_count
   - `calculate_score(elapsed_ms, vote_window_ms)`: `max(100, round(1000 - 900 * elapsed / window))`
   - `update_streak(player)`: increment on correct, reset on wrong
3. `models.py`: Pydantic models for HTTP request/response

## Phase 2: Backend — REST API (main.py)
- `POST /api/games` → create game (host joins immediately), returns `{game_code, player_id, token}`
- `POST /api/games/{code}/join` body `{name}` → returns `{player_id, token}`
- `PATCH /api/games/{code}/settings` (host only) → update rounds, timer, videos_allowed, leaderboard_time
- `POST /api/games/{code}/upload` (multipart) → save files to `uploads/{code}/{player_id}/`; enforce 50 MB/file; reject non-image/video if videos disabled
- `GET /uploads/{code}/{player_id}/{filename}` → serve media file (static)
- `POST /api/games/{code}/start` (host only, all players ready) → begins game, calls `generate_round_pool`
- `POST /api/games/{code}/play-again` (host only) → resets game to LOBBY, clears photos, notifies all players
- Auth: simple bearer token (uuid per player) checked in host-only routes

## Phase 3: Backend — Socket.IO Events (socket_manager.py)
**Client → Server:**
- `join_room {game_code, player_id, token}` → Socket.IO room join; emit `room_state` back
- `set_ready {ready: bool}` → emit `player_ready_changed` to room
- `cast_vote {round_idx, voted_for_player_id, timestamp_ms}` → record vote + score; **vote is immediately locked — server silently ignores any subsequent cast_vote from the same player in the same round**; if all voted → trigger `end_round`
- `swap_photo {old_photo_id}` → pick random from unselected pool; emit `photo_swapped` back to player
- `request_start` (host) → validates all ready, calls round start logic

**Server → Client:**
- `room_state` — full current game snapshot (on join/reconnect)
- `player_joined / player_left` — name + player list
- `player_ready_changed` — player id + ready status
- `settings_updated` — new settings object
- `photo_selected` — player id + count of selected photos (not the photos themselves)
- `game_starting` — countdown (3s) before first round
- `round_start {round_idx, media_url, media_type, round_number, total_rounds}` — sent to all
- `vote_progress {votes_cast, total_players}` — anonymous vote count update
- `round_end {owner_id, owner_name, votes: [{voter_id, voted_for_id, correct}], scores_delta, leaderboard}` — full reveal
- `leaderboard_update {leaderboard, next_round_in_ms}` — between-round display
- `game_over {final_leaderboard}` — end state
- `play_again` — tells all clients to reset to lobby

## Phase 4: Backend — Cleanup (cleanup.py)
- APScheduler job runs every 5 minutes
- Checks `game.last_activity`; if > 1 hour ago AND not GAME_OVER → delete `uploads/{code}/` + remove from in-memory store
- On GAME_OVER: schedule cleanup after 10 minutes (photos no longer needed)
- Update `last_activity` on every socket event

## Phase 5: Frontend — Types & Context
1. `types/game.ts`: mirror backend types (Game, Player, GameSettings, RoundResult, LeaderboardEntry)
2. `context/GameContext.tsx`: holds socket instance + game state + dispatch; provides `useGame()` hook
3. `hooks/useSocket.ts`: connects to `ws://{window.location.hostname}:8000`; registers all server event listeners; dispatches to context

## Phase 6: Frontend — Pages & Screens

### HomePage
- Two large buttons: "Create Game" / "Join Game"
- Create: name input → POST /api/games → navigate to /lobby/{code}
- Join: code input + name input → POST /api/games/{code}/join → navigate to /lobby/{code}

### LobbyPage
- **Left panel**: PlayerList component (name, ready badge, photo-count badge)
- **Right panel (host only)**: settings form (rounds, vote timer, leaderboard time, videos toggle); "Start Game" button (enabled when all ready)
- **Bottom**: PhotoGrid component (16-slot grid); "Ready" toggle button below grid
- PhotoGrid: shows 16 thumbnails with an X button; clicking X calls `swap_photo` if pool > 16; shows upload progress

### VotingScreen (inside GamePage)
- Large photo/video display (videos auto-play, stop at 5s, loop)
- CountdownTimer ring overlay
- Vote buttons: grid of player name cards; clicking emits `cast_vote`; disabled after voting
- Visual: voted button highlights, others dim; "Waiting for others…" after voting

### RevealScreen
- Banner: "Uploaded by {owner_name}"
- Player list with: name | their vote (→ voted-for name) | ✓ or ✗ | +pts earned this round
- Own vote highlighted
- Auto-advances after leaderboard_time ms

### LeaderboardScreen
- Title: "Round N of M"
- Ranked list: rank | name | total score | streak 🔥
- Delta (+N pts) shown next to each score (animated)
- Auto-advances to next round after leaderboard_time ms

### GameOverScreen
- "Game Over!" header
- Final ranked leaderboard with medal icons (🥇🥈🥉)
- "Play Again" button (host only) → POST /api/games/{code}/play-again

## Phase 7: Frontend — Video Handling
- `<video>` element with `ref`
- On `loadeddata` event: call `videoRef.current.play()`
- At `timeupdate`: if `currentTime >= 5` → `videoRef.current.pause(); videoRef.current.currentTime = 0; videoRef.current.play()`
- This creates a seamless 5s loop

## Phase 8: Integration & Polish
1. `vite.config.ts` proxy: in dev, `/api` and `/uploads` proxy to `localhost:8000`
2. Backend `main.py`: serve built frontend `dist/` as StaticFiles at mount `/`; catch-all returns `index.html`
3. Socket.IO CORS: allow all origins in development
4. Mobile-first Tailwind: use `flex-col` layouts, large touch targets (min 44px), full-width buttons on small screen
5. Error states: invalid game code toast, game already started, disconnection banner with reconnect spinner
6. README: setup instructions (python venv, npm install, build, run)

---

## Verification
1. Create game → join from 2nd browser tab → both see each other in lobby
2. Upload 20+ photos → see 16 selected, swap one → new photo replaces it
3. All players ready → host starts → round starts with countdown
4. Vote before timer expires → correct vote → score decreases with later votes
5. All vote → reveal shows owner, check/cross, correct scoreboard
6. After all rounds → game over screen shown → play again resets lobby
7. Kill one browser tab mid-game → other player can continue + rejoin works
8. Upload 60 MB file → rejected with error message
9. Host changes settings → other player sees updated settings live
10. Leave game idle 1hr → uploads folder auto-cleaned (test with short timeout override)

---

## Scope Boundaries (Excluded)
- No user accounts or persistent profiles
- No chat/emoji reactions
- No spectator mode
- No kicking players from lobby
- No mid-game settings changes (settings locked once game starts)
- No PWA / offline support
- No video thumbnail previews (just play the video)
- Max rounds validation: alert if rounds > 16 × player_count
