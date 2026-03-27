import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Camera, Dices, FolderOpen, Plus, QrCode, Rocket, Settings2, Users } from 'lucide-react';
import PhotoGrid from '../components/PhotoGrid';
import PlayerList from '../components/PlayerList';
import QRModal from '../components/QRModal';
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
  const [showQR, setShowQR] = useState(false);

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

  // Navigate if no session (only when restore is complete)
  useEffect(() => {
    if (!state.isRestoring && !state.gameCode) {
      navigate('/', { state: { error: state.error } });
    }
  }, [state.isRestoring, state.gameCode, state.error, navigate, code]);

  const isReady = state.players.find((p) => p.player_id === state.myPlayerId)?.is_ready ?? false;
  const allReady = state.players.length >= 2 && state.players.every((p) => p.is_ready);

  async function uploadFiles(files: FileList | File[] | null) {
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

  async function handleDelete(photoId: string) {
    try {
      const res = await fetch(`${API}/games/${code}/photos/${photoId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${state.myToken}` },
      });
      if (!res.ok) {
        const d = await res.json();
        setUploadError(d.detail ?? 'Delete failed');
        return;
      }
      const data = await res.json();
      dispatch({
        type: 'PHOTOS_UPDATED',
        selected: data.selected_photos,
        uploaded: state.myUploadedPhotos.filter((p) => p.photo_id !== photoId),
        hasSwapPool: data.has_swap_pool,
      });
    } catch {
      setUploadError('Network error during delete');
    }
  }

  function handleFolderChange(files: FileList | null) {
    if (!files || files.length === 0) return;
    const accepted = state.settings.videos_allowed ? /^(image|video)\// : /^image\//;
    const filtered = Array.from(files).filter((f) => accepted.test(f.type));
    // Shuffle and pick at most 16
    for (let i = filtered.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [filtered[i], filtered[j]] = [filtered[j], filtered[i]];
    }
    const sampled = filtered.slice(0, 16);
    uploadFiles(sampled);
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

  if (state.isRestoring) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <Dices className="w-16 h-16 text-white animate-bounce" />
        <h2 className="text-2xl font-extrabold text-white">Reconnecting…</h2>
        <p className="text-white/60 font-semibold">Restoring your session…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white">
      {showQR && code && (
        <QRModal gameCode={code} onClose={() => setShowQR(false)} />
      )}
      {/* Header card */}
      <header className="px-4 pt-5 pb-2">
        <div className="rounded-3xl bg-black/25 backdrop-blur-md border border-white/10 px-5 py-4 flex items-center justify-between">
          <div className="flex items-start gap-3">
            <span className="text-3xl font-extrabold text-white/40 leading-none mt-0.5">#</span>
            <div>
              <div className="text-xs text-white/50 uppercase tracking-widest font-bold">Game Code</div>
              <div className="flex items-center gap-2">
                <div className="text-3xl font-extrabold text-white tracking-widest font-mono">{code}</div>
                <button
                  onClick={() => setShowQR(true)}
                  className="text-white/50 hover:text-white transition-colors"
                  aria-label="Share QR code"
                >
                  <QrCode className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-white/70">
            <Users className="w-5 h-5" />
            <div className="text-right">
              <div className="text-2xl font-extrabold text-white leading-none">{state.players.length}</div>
              <div className="text-xs text-white/50 font-semibold">players</div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {/* Error banner */}
        {state.error && (
          <div className="bg-red-950/70 border border-red-400/30 text-red-200 rounded-2xl px-4 py-3 text-sm font-semibold flex justify-between">
            <span>{state.error}</span>
            <button onClick={() => dispatch({ type: 'SET_ERROR', message: null })} className="ml-2 text-white/60 hover:text-white">✕</button>
          </div>
        )}

        {/* Players */}
        <section>
          <h2 className="text-xs font-extrabold text-white/50 uppercase tracking-widest mb-2">Players</h2>
          <PlayerList players={state.players} myPlayerId={state.myPlayerId} />
        </section>

        {/* Host Settings */}
        {state.isHost && (
          <section className="rounded-3xl bg-black/20 backdrop-blur-md border border-white/10 p-4 space-y-4">
            <h2 className="font-extrabold text-white flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-white/60" />
              Game Settings
            </h2>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs text-white/50 font-bold uppercase tracking-wide">Rounds</span>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={settingsForm.rounds}
                  onChange={(e) => setSettingsForm((f) => ({ ...f, rounds: Number(e.target.value) }))}
                  onBlur={handleSaveSettings}
                  className="mt-1 w-full bg-white/10 border border-white/15 text-white rounded-xl px-3 py-2 font-semibold focus:outline-none focus:ring-2 focus:ring-white/25"
                />
              </label>
              <label className="block">
                <span className="text-xs text-white/50 font-bold uppercase tracking-wide">Vote timer (sec)</span>
                <input
                  type="number"
                  min={5}
                  max={60}
                  value={settingsForm.vote_timer_seconds}
                  onChange={(e) => setSettingsForm((f) => ({ ...f, vote_timer_seconds: Number(e.target.value) }))}
                  onBlur={handleSaveSettings}
                  className="mt-1 w-full bg-white/10 border border-white/15 text-white rounded-xl px-3 py-2 font-semibold focus:outline-none focus:ring-2 focus:ring-white/25"
                />
              </label>
              <label className="block">
                <span className="text-xs text-white/50 font-bold uppercase tracking-wide">Leaderboard time (sec)</span>
                <input
                  type="number"
                  min={3}
                  max={30}
                  value={settingsForm.leaderboard_time_seconds}
                  onChange={(e) => setSettingsForm((f) => ({ ...f, leaderboard_time_seconds: Number(e.target.value) }))}
                  onBlur={handleSaveSettings}
                  className="mt-1 w-full bg-white/10 border border-white/15 text-white rounded-xl px-3 py-2 font-semibold focus:outline-none focus:ring-2 focus:ring-white/25"
                />
              </label>
              <label className="flex items-center gap-2 cursor-pointer pt-5">
                <input
                  type="checkbox"
                  checked={settingsForm.videos_allowed}
                  onChange={(e) => {
                    setSettingsForm((f) => ({ ...f, videos_allowed: e.target.checked }));
                    setTimeout(handleSaveSettings, 50);
                  }}
                  className="w-5 h-5 accent-white rounded"
                />
                <span className="text-sm text-white/80 font-semibold">Allow videos</span>
              </label>
            </div>

            {allReady && state.players.length >= 2 && (
              <button
                onClick={handleStartGame}
                disabled={starting}
                className="w-full py-3 rounded-2xl bg-green-500 hover:bg-green-400 disabled:opacity-50 text-white font-extrabold text-lg transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <Rocket className="w-5 h-5" />
                {starting ? 'Starting…' : 'Start Game'}
              </button>
            )}
            {!allReady && (
              <p className="text-center text-sm text-white/40 font-semibold">Waiting for all players to be ready…</p>
            )}
          </section>
        )}

        {/* Photo upload section */}
        <section className="rounded-3xl bg-black/20 backdrop-blur-md border border-white/10 p-4 space-y-3">
          <h2 className="font-extrabold text-white flex items-center gap-2">
            <Camera className="w-4 h-4 text-white/60" />
            Your Gallery
            {state.mySelectedPhotos.length > 0 && (
              <span className="ml-1 text-white/50 text-sm font-semibold">
                {state.mySelectedPhotos.length}/16
              </span>
            )}
          </h2>

          {uploadError && (
            <div className="bg-red-950/70 border border-red-400/30 text-red-300 rounded-xl px-3 py-2 text-sm font-semibold">
              {uploadError}
            </div>
          )}

          <PhotoGrid
            selectedPhotos={state.mySelectedPhotos}
            onDelete={handleDelete}
            uploading={uploading}
          />

          {/* Upload buttons */}
          <div className="flex gap-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex-1 py-3 rounded-2xl bg-white text-red-700 font-extrabold transition-all hover:bg-white/90 disabled:opacity-50 active:scale-95 flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              {uploading ? 'Uploading…' : 'Add Photos'}
            </button>
            <button
              onClick={() => folderInputRef.current?.click()}
              disabled={uploading}
              className="flex-1 py-3 rounded-2xl bg-white/15 backdrop-blur-sm border border-white/20 text-white font-extrabold transition-all hover:bg-white/22 disabled:opacity-50 active:scale-95 flex items-center justify-center gap-2"
            >
              <FolderOpen className="w-5 h-5" />
              Select Album
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
            onChange={(e) => handleFolderChange(e.target.files)}
          />
        </section>

        {/* Ready button */}
        <button
          onClick={handleReadyToggle}
          disabled={state.mySelectedPhotos.length === 0}
          className={`w-full py-4 rounded-2xl font-extrabold text-lg transition-all disabled:opacity-40 active:scale-95 flex items-center justify-center gap-2 ${
            isReady
              ? 'bg-yellow-500 hover:bg-yellow-400 text-white'
              : 'bg-green-500 hover:bg-green-400 text-white'
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
