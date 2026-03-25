import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PhotoGrid from '../components/PhotoGrid';
import PlayerList from '../components/PlayerList';
import { useGame } from '../context/GameContext';
import type { UploadedPhoto } from '../types/game';

const API = '/api';

export default function LobbyPage() {
  const { code } = useParams<{ code: string }>();
  const { state, dispatch, socket } = useGame();
  const navigate = useNavigate();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [starting, setStarting] = useState(false);

  // Settings form (host only)
  const [settingsForm, setSettingsForm] = useState({
    rounds: state.settings.rounds,
    vote_timer_seconds: state.settings.vote_timer_seconds,
    leaderboard_time_seconds: state.settings.leaderboard_time_seconds,
    videos_allowed: state.settings.videos_allowed,
  });

  // Sync settingsForm when settings_updated comes in from server
  useEffect(() => {
    setSettingsForm({
      rounds: state.settings.rounds,
      vote_timer_seconds: state.settings.vote_timer_seconds,
      leaderboard_time_seconds: state.settings.leaderboard_time_seconds,
      videos_allowed: state.settings.videos_allowed,
    });
  }, [state.settings]);

  // Navigate to game when started
  useEffect(() => {
    if (state.status === 'IN_ROUND') {
      navigate(`/game/${code}`);
    }
  }, [state.status, code, navigate]);

  // Navigate if game code is in session but not in URL (page refresh)
  useEffect(() => {
    if (!state.gameCode && code) {
      // Not authenticated — redirect home
      navigate('/');
    }
  }, [state.gameCode, code, navigate]);

  const isReady = state.players.find((p) => p.player_id === state.myPlayerId)?.is_ready ?? false;
  const allReady = state.players.length >= 2 && state.players.every((p) => p.is_ready);

  async function uploadFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploadError('');
    setUploading(true);

    const results: UploadedPhoto[] = [];
    let lastResponse: { selected_photos: UploadedPhoto[]; has_swap_pool: boolean } | null = null;

    for (const file of Array.from(files)) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch(`${API}/games/${code}/upload`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${state.myToken}` },
          body: formData,
        });
        if (!res.ok) {
          const d = await res.json();
          setUploadError(d.detail ?? 'Upload failed');
          break;
        }
        const data = await res.json();
        results.push({ photo_id: data.photo_id, filename: file.name, media_type: 'image', url: data.selected_photos.find((p: UploadedPhoto) => p.photo_id === data.photo_id)?.url ?? '' });
        lastResponse = data;
      } catch {
        setUploadError('Network error during upload');
        break;
      }
    }

    if (lastResponse) {
      // Reconstruct uploaded photos list from current + new
      const newUploaded = [...state.myUploadedPhotos, ...results];
      dispatch({
        type: 'PHOTOS_UPDATED',
        selected: lastResponse.selected_photos,
        uploaded: newUploaded,
        hasSwapPool: lastResponse.has_swap_pool,
      });
    }

    setUploading(false);
  }

  function handleSwap(photoId: string) {
    socket?.emit('swap_photo', { old_photo_id: photoId });
  }

  function handleReadyToggle() {
    socket?.emit('set_ready', { ready: !isReady });
  }

  async function handleSaveSettings() {
    try {
      await fetch(`${API}/games/${code}/settings`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${state.myToken}`,
        },
        body: JSON.stringify(settingsForm),
      });
    } catch {
      // ignore
    }
  }

  async function handleStartGame() {
    setStarting(true);
    try {
      const res = await fetch(`${API}/games/${code}/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${state.myToken}` },
      });
      if (!res.ok) {
        const d = await res.json();
        dispatch({ type: 'SET_ERROR', message: d.detail ?? 'Could not start game' });
      }
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex items-center justify-between">
        <div>
          <div className="text-xs text-gray-400 uppercase tracking-widest">Game Code</div>
          <div className="text-2xl font-mono font-bold text-indigo-400 tracking-widest">{code}</div>
        </div>
        <div className="text-sm text-gray-400">
          {state.players.length} player{state.players.length !== 1 ? 's' : ''}
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-5">
        {/* Error banner */}
        {state.error && (
          <div className="bg-red-900/50 border border-red-500 text-red-200 rounded-lg px-4 py-3 text-sm flex justify-between">
            <span>{state.error}</span>
            <button onClick={() => dispatch({ type: 'SET_ERROR', message: null })} className="ml-2">✕</button>
          </div>
        )}

        {/* Players */}
        <section>
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Players</h2>
          <PlayerList players={state.players} myPlayerId={state.myPlayerId} />
        </section>

        {/* Host Settings */}
        {state.isHost && (
          <section className="bg-gray-800 rounded-xl p-4 space-y-4">
            <h2 className="font-bold text-white">⚙️ Game Settings</h2>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs text-gray-400">Rounds</span>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={settingsForm.rounds}
                  onChange={(e) => setSettingsForm((f) => ({ ...f, rounds: Number(e.target.value) }))}
                  onBlur={handleSaveSettings}
                  className="mt-1 w-full bg-gray-700 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </label>
              <label className="block">
                <span className="text-xs text-gray-400">Vote timer (sec)</span>
                <input
                  type="number"
                  min={5}
                  max={60}
                  value={settingsForm.vote_timer_seconds}
                  onChange={(e) => setSettingsForm((f) => ({ ...f, vote_timer_seconds: Number(e.target.value) }))}
                  onBlur={handleSaveSettings}
                  className="mt-1 w-full bg-gray-700 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </label>
              <label className="block">
                <span className="text-xs text-gray-400">Leaderboard time (sec)</span>
                <input
                  type="number"
                  min={3}
                  max={30}
                  value={settingsForm.leaderboard_time_seconds}
                  onChange={(e) => setSettingsForm((f) => ({ ...f, leaderboard_time_seconds: Number(e.target.value) }))}
                  onBlur={handleSaveSettings}
                  className="mt-1 w-full bg-gray-700 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </label>
              <label className="flex items-center gap-2 cursor-pointer pt-4">
                <input
                  type="checkbox"
                  checked={settingsForm.videos_allowed}
                  onChange={(e) => {
                    setSettingsForm((f) => ({ ...f, videos_allowed: e.target.checked }));
                    setTimeout(handleSaveSettings, 50);
                  }}
                  className="w-5 h-5 accent-indigo-500"
                />
                <span className="text-sm text-gray-300">Allow videos</span>
              </label>
            </div>

            {allReady && state.players.length >= 2 && (
              <button
                onClick={handleStartGame}
                disabled={starting}
                className="w-full py-3 rounded-xl bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold text-lg transition-colors"
              >
                {starting ? 'Starting…' : '🚀 Start Game'}
              </button>
            )}
            {!allReady && (
              <p className="text-center text-sm text-gray-500">Waiting for all players to be ready…</p>
            )}
          </section>
        )}

        {/* Photo upload section */}
        <section className="bg-gray-800 rounded-xl p-4 space-y-4">
          <h2 className="font-bold text-white">
            📷 Your Photos
            {state.mySelectedPhotos.length > 0 && (
              <span className="ml-2 text-gray-400 text-sm font-normal">
                {state.mySelectedPhotos.length}/16 selected
                {state.hasSwapPool && ' · tap ✕ to swap'}
                {!state.hasSwapPool && state.mySelectedPhotos.length === 16 && (
                  <span className="text-yellow-500"> · upload more to enable swapping</span>
                )}
              </span>
            )}
          </h2>

          {uploadError && (
            <div className="bg-red-900/40 border border-red-600 text-red-300 rounded px-3 py-2 text-sm">
              {uploadError}
            </div>
          )}

          <PhotoGrid
            selectedPhotos={state.mySelectedPhotos}
            hasSwapPool={state.hasSwapPool}
            onSwap={handleSwap}
            uploading={uploading}
          />

          {/* Upload buttons */}
          <div className="flex gap-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold transition-colors"
            >
              {uploading ? 'Uploading…' : '+ Add Photos'}
            </button>
            <button
              onClick={() => folderInputRef.current?.click()}
              disabled={uploading}
              className="flex-1 py-3 rounded-xl bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white font-semibold transition-colors"
            >
              📁 Select Album
            </button>
          </div>

          {/* Hidden file inputs */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={state.settings.videos_allowed ? 'image/*,video/*' : 'image/*'}
            className="hidden"
            onChange={(e) => uploadFiles(e.target.files)}
          />
          <input
            ref={folderInputRef}
            type="file"
            // @ts-ignore webkitdirectory is not in standard TS types
            webkitdirectory=""
            multiple
            accept={state.settings.videos_allowed ? 'image/*,video/*' : 'image/*'}
            className="hidden"
            onChange={(e) => uploadFiles(e.target.files)}
          />
        </section>

        {/* Ready button */}
        <button
          onClick={handleReadyToggle}
          disabled={state.mySelectedPhotos.length === 0}
          className={`w-full py-4 rounded-xl font-bold text-lg transition-colors disabled:opacity-40 ${
            isReady
              ? 'bg-yellow-600 hover:bg-yellow-500 text-black'
              : 'bg-green-600 hover:bg-green-500 text-white'
          }`}
        >
          {isReady ? '⏸ Unready' : '✓ Ready'}
        </button>

        {!state.isHost && allReady && (
          <p className="text-center text-sm text-gray-400">All players ready — waiting for host to start…</p>
        )}
      </div>
    </div>
  );
}
