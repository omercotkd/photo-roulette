import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
} from 'react';
import { io, Socket } from 'socket.io-client';
import type {
  GameSettings,
  GameStatus,
  LeaderboardEntry,
  PhotoSwappedData,
  PlayerInfo,
  RoomState,
  RoundEndData,
  RoundStartData,
  UploadedPhoto,
} from '../types/game';

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

export interface GameState {
  // My identity
  gameCode: string | null;
  myPlayerId: string | null;
  myToken: string | null;
  myName: string | null;
  isHost: boolean;

  // Lobby
  status: GameStatus;
  settings: GameSettings;
  players: PlayerInfo[];

  // My photos (lobby)
  myUploadedPhotos: UploadedPhoto[];
  mySelectedPhotos: UploadedPhoto[];
  hasSwapPool: boolean;

  // Current round (IN_ROUND)
  currentRound: RoundStartData | null;
  votesCast: number;
  totalPlayers: number;
  myVote: string | null; // player_id I voted for

  // After round (ROUND_REVEAL / BETWEEN_ROUNDS)
  roundEndData: RoundEndData | null;
  leaderboardStartedAtMs: number | null;
  leaderboard: LeaderboardEntry[];

  // Final
  finalLeaderboard: LeaderboardEntry[];

  // UI state
  connected: boolean;
  error: string | null;
  isRestoring: boolean;
  wasKicked: boolean;
}

const defaultSettings: GameSettings = {
  rounds: 10,
  vote_timer_seconds: 15,
  leaderboard_time_seconds: 10,
  videos_allowed: true,
};

const initialState: GameState = {
  gameCode: null,
  myPlayerId: null,
  myToken: null,
  myName: null,
  isHost: false,
  status: 'LOBBY',
  settings: defaultSettings,
  players: [],
  myUploadedPhotos: [],
  mySelectedPhotos: [],
  hasSwapPool: false,
  currentRound: null,
  votesCast: 0,
  totalPlayers: 0,
  myVote: null,
  roundEndData: null,
  leaderboardStartedAtMs: null,
  leaderboard: [],
  finalLeaderboard: [],
  connected: false,
  error: null,
  isRestoring: false,
  wasKicked: false,
};

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

type Action =
  | { type: 'SET_IDENTITY'; gameCode: string; playerId: string; token: string; name: string; isHost: boolean }
  | { type: 'CONNECTED'; connected: boolean }
  | { type: 'ROOM_STATE'; payload: RoomState }
  | { type: 'PLAYER_JOINED'; players: PlayerInfo[] }
  | { type: 'PLAYER_LEFT'; players: PlayerInfo[] }
  | { type: 'PLAYER_READY_CHANGED'; playerId: string; isReady: boolean }
  | { type: 'PHOTO_SELECTED'; playerId: string; count: number }
  | { type: 'SETTINGS_UPDATED'; settings: GameSettings }
  | { type: 'GAME_STARTING' }
  | { type: 'ROUND_START'; data: RoundStartData }
  | { type: 'VOTE_PROGRESS'; votesCast: number; totalPlayers: number }
  | { type: 'ROUND_END'; data: RoundEndData }
  | { type: 'GAME_OVER'; finalLeaderboard: LeaderboardEntry[] }
  | { type: 'PLAY_AGAIN' }
  | { type: 'MY_VOTE_CAST'; votedForId: string }
  | { type: 'PHOTOS_UPDATED'; selected: UploadedPhoto[]; uploaded: UploadedPhoto[]; hasSwapPool: boolean }
  | { type: 'PHOTO_SWAPPED'; data: PhotoSwappedData }
  | { type: 'SET_ERROR'; message: string | null }
  | { type: 'RESTORE_FAILED'; message: string }
  | { type: 'KICKED' }
  | { type: 'RESET' };

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'SET_IDENTITY':
      return {
        ...state,
        gameCode: action.gameCode,
        myPlayerId: action.playerId,
        myToken: action.token,
        myName: action.name,
        isHost: action.isHost,
      };
    case 'CONNECTED':
      return { ...state, connected: action.connected };
    case 'ROOM_STATE': {
      const p = action.payload;
      const me = p.players.find((pl) => pl.player_id === state.myPlayerId);
      return {
        ...state,
        status: p.status,
        settings: p.settings,
        players: p.players,
        isHost: me?.is_host ?? state.isHost,
        totalPlayers: p.players.length,
        myVote: p.my_vote ?? null,
        mySelectedPhotos: p.my_selected_photos ?? state.mySelectedPhotos,
        myUploadedPhotos: p.my_uploaded_photos ?? state.myUploadedPhotos,
        hasSwapPool: p.has_swap_pool ?? state.hasSwapPool,
        isRestoring: false,
        currentRound:
          p.status === 'IN_ROUND' && p.current_media_url
            ? {
                round_idx: (p.current_round_number ?? 1) - 1,
                round_number: p.current_round_number ?? 1,
                total_rounds: p.total_rounds ?? state.settings.rounds,
                media_url: p.current_media_url,
                media_type: p.current_media_type ?? 'image',
              }
            : state.currentRound,
        finalLeaderboard:
          p.status === 'GAME_OVER'
            ? [...p.players]
                .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
                .map((pl) => ({ player_id: pl.player_id, name: pl.name, score: pl.score ?? 0, streak: pl.streak ?? 0, delta: 0 }))
            : state.finalLeaderboard,
      };
    }
    case 'PLAYER_JOINED':
    case 'PLAYER_LEFT':
      return { ...state, players: action.players, totalPlayers: action.players.length };
    case 'PLAYER_READY_CHANGED':
      return {
        ...state,
        players: state.players.map((p) =>
          p.player_id === action.playerId ? { ...p, is_ready: action.isReady } : p
        ),
      };
    case 'PHOTO_SELECTED':
      return {
        ...state,
        players: state.players.map((p) =>
          p.player_id === action.playerId ? { ...p, photo_count: action.count } : p
        ),
      };
    case 'SETTINGS_UPDATED':
      return { ...state, settings: action.settings };
    case 'GAME_STARTING':
      return { ...state, status: 'LOBBY' }; // countdown before first round_start
    case 'ROUND_START':
      return {
        ...state,
        status: 'IN_ROUND',
        currentRound: action.data,
        votesCast: 0,
        totalPlayers: state.players.length,
        myVote: null,
        roundEndData: null,
        leaderboardStartedAtMs: null,
      };
    case 'VOTE_PROGRESS':
      return { ...state, votesCast: action.votesCast, totalPlayers: action.totalPlayers };
    case 'ROUND_END':
      return {
        ...state,
        status: 'ROUND_REVEAL',
        roundEndData: action.data,
        leaderboardStartedAtMs: Date.now(),
        leaderboard: action.data.leaderboard,
        players: state.players.map((p) => {
          const entry = action.data.leaderboard.find((e) => e.player_id === p.player_id);
          return entry ? { ...p, score: entry.score, streak: entry.streak } : p;
        }),
      };
    case 'GAME_OVER':
      return { ...state, status: 'GAME_OVER', finalLeaderboard: action.finalLeaderboard };
    case 'PLAY_AGAIN':
      return {
        ...initialState,
        gameCode: state.gameCode,
        myPlayerId: state.myPlayerId,
        myToken: state.myToken,
        myName: state.myName,
        isHost: state.isHost,
        connected: state.connected,
        players: state.players.map((p) => ({
          ...p,
          is_ready: false,
          photo_count: 0,
          score: 0,
          streak: 0,
        })),
      };
    case 'MY_VOTE_CAST':
      return { ...state, myVote: action.votedForId };
    case 'PHOTOS_UPDATED':
      return {
        ...state,
        mySelectedPhotos: action.selected,
        myUploadedPhotos: action.uploaded,
        hasSwapPool: action.hasSwapPool,
      };
    case 'PHOTO_SWAPPED':
      return {
        ...state,
        mySelectedPhotos: action.data.selected_photos,
        hasSwapPool: action.data.has_swap_pool,
      };
    case 'RESTORE_FAILED':
      return { ...initialState, error: action.message };
    case 'SET_ERROR':
      return { ...state, error: action.message };
    case 'KICKED':
      return { ...initialState, wasKicked: true };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface GameContextValue {
  state: GameState;
  dispatch: React.Dispatch<Action>;
  socket: Socket | null;
  initSession: (gameCode: string, playerId: string, token: string, name: string) => void;
}

const GameContext = createContext<GameContextValue>({
  state: initialState,
  dispatch: () => {},
  socket: null,
  initSession: () => {},
});

function getInitialState(): GameState {
  const gameCode = sessionStorage.getItem('pr_game_code');
  const myPlayerId = sessionStorage.getItem('pr_player_id');
  const myToken = sessionStorage.getItem('pr_token');
  const myName = sessionStorage.getItem('pr_name');
  if (gameCode && myPlayerId && myToken && myName) {
    return { ...initialState, gameCode, myPlayerId, myToken, myName, isRestoring: true };
  }
  return initialState;
}

const SOCKET_URL = `http://${window.location.hostname}:8000`;

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, getInitialState);
  const socketRef = useRef<Socket | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Create the socket once
  useEffect(() => {
    const socket = io(SOCKET_URL, { autoConnect: false, reconnection: true });
    socketRef.current = socket;

    socket.on('connect', () => dispatch({ type: 'CONNECTED', connected: true }));
    socket.on('disconnect', () => dispatch({ type: 'CONNECTED', connected: false }));

    socket.on('room_state', (payload: RoomState) => dispatch({ type: 'ROOM_STATE', payload }));
    socket.on('player_joined', (d: { players: PlayerInfo[] }) => dispatch({ type: 'PLAYER_JOINED', players: d.players }));
    socket.on('player_left', (d: { players: PlayerInfo[] }) => dispatch({ type: 'PLAYER_LEFT', players: d.players }));
    socket.on('player_kicked', (d: { player_id: string; players: PlayerInfo[] }) => {
      if (d.player_id === stateRef.current.myPlayerId) {
        sessionStorage.removeItem('pr_game_code');
        sessionStorage.removeItem('pr_player_id');
        sessionStorage.removeItem('pr_token');
        sessionStorage.removeItem('pr_name');
        dispatch({ type: 'KICKED' });
      } else {
        dispatch({ type: 'PLAYER_LEFT', players: d.players });
      }
    });
    socket.on('player_ready_changed', (d: { player_id: string; is_ready: boolean }) =>
      dispatch({ type: 'PLAYER_READY_CHANGED', playerId: d.player_id, isReady: d.is_ready })
    );
    socket.on('photo_selected', (d: { player_id: string; count: number }) =>
      dispatch({ type: 'PHOTO_SELECTED', playerId: d.player_id, count: d.count })
    );
    socket.on('settings_updated', (settings: GameSettings) =>
      dispatch({ type: 'SETTINGS_UPDATED', settings })
    );
    socket.on('game_starting', () => dispatch({ type: 'GAME_STARTING' }));
    socket.on('round_start', (data: RoundStartData) => dispatch({ type: 'ROUND_START', data }));
    socket.on('vote_progress', (d: { votes_cast: number; total_players: number }) =>
      dispatch({ type: 'VOTE_PROGRESS', votesCast: d.votes_cast, totalPlayers: d.total_players })
    );
    socket.on('round_end', (data: RoundEndData) => dispatch({ type: 'ROUND_END', data }));
    socket.on('game_over', (d: { final_leaderboard: LeaderboardEntry[] }) =>
      dispatch({ type: 'GAME_OVER', finalLeaderboard: d.final_leaderboard })
    );
    socket.on('play_again', () => dispatch({ type: 'PLAY_AGAIN' }));
    socket.on('photo_swapped', (data: PhotoSwappedData) => dispatch({ type: 'PHOTO_SWAPPED', data }));
    socket.on('error', (d: { message: string }) => {
      if (stateRef.current.isRestoring) {
        sessionStorage.removeItem('pr_game_code');
        sessionStorage.removeItem('pr_player_id');
        sessionStorage.removeItem('pr_token');
        sessionStorage.removeItem('pr_name');
        dispatch({ type: 'RESTORE_FAILED', message: 'Your game session has expired.' });
      } else {
        dispatch({ type: 'SET_ERROR', message: d.message });
      }
    });

    // On reconnect, re-join the room if we have an active session
    socket.on('connect', () => {
      const s = stateRef.current;
      if (s.gameCode && s.myPlayerId && s.myToken) {
        socket.emit('join_room', {
          game_code: s.gameCode,
          player_id: s.myPlayerId,
          token: s.myToken,
        });
      }
    });

    socket.connect();

    return () => {
      socket.disconnect();
    };
  }, []);

  const initSession = useCallback(
    (gameCode: string, playerId: string, token: string, name: string) => {
      // Persist in sessionStorage for page refreshes
      sessionStorage.setItem('pr_game_code', gameCode);
      sessionStorage.setItem('pr_player_id', playerId);
      sessionStorage.setItem('pr_token', token);
      sessionStorage.setItem('pr_name', name);

      dispatch({ type: 'SET_IDENTITY', gameCode, playerId, token, name, isHost: false });

      socketRef.current?.emit('join_room', { game_code: gameCode, player_id: playerId, token });
    },
    []
  );

  return (
    <GameContext.Provider value={{ state, dispatch, socket: socketRef.current, initSession }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  return useContext(GameContext);
}
