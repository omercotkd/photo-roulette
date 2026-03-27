import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Dices, Gamepad2, LogIn } from 'lucide-react';
import { useGame } from '../context/GameContext';

const API = '/api';

export default function HomePage() {
  const { initSession } = useGame();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState<'home' | 'create' | 'join'>('home');
  const [hostName, setHostName] = useState('');
  const [joinName, setJoinName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>(typeof location.state?.error === 'string' ? location.state.error : '');

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!hostName.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/games`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host_name: hostName.trim() }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.detail ?? 'Failed to create game');
      }
      const data = await res.json();
      initSession(data.game_code, data.player_id, data.token, hostName.trim());
      navigate(`/lobby/${data.game_code}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!joinName.trim() || joinCode.length !== 6) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/games/${joinCode}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: joinName.trim() }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.detail ?? 'Failed to join game');
      }
      const data = await res.json();
      initSession(data.game_code, data.player_id, data.token, joinName.trim());
      navigate(`/lobby/${data.game_code}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo / Title */}
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-20 h-20 rounded-3xl bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center">
              <Dices className="w-10 h-10 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-extrabold text-white tracking-tight">Photo Roulette</h1>
          <p className="text-white/60 mt-2 font-semibold">Guess whose photo it is!</p>
        </div>

        {error && (
          <div className="bg-red-950/70 border border-red-400/30 text-red-200 rounded-2xl px-4 py-3 text-sm font-semibold">
            {error}
          </div>
        )}

        {mode === 'home' && (
          <div className="flex flex-col gap-4">
            <button
              onClick={() => setMode('create')}
              className="w-full py-4 rounded-2xl bg-white text-red-700 font-extrabold text-lg transition-all hover:bg-white/90 active:scale-95 flex items-center justify-center gap-2"
            >
              <Gamepad2 className="w-5 h-5" />
              Create Game
            </button>
            <button
              onClick={() => setMode('join')}
              className="w-full py-4 rounded-2xl bg-white/15 backdrop-blur-sm border border-white/20 text-white font-extrabold text-lg transition-all hover:bg-white/22 active:scale-95 flex items-center justify-center gap-2"
            >
              <LogIn className="w-5 h-5" />
              Join Game
            </button>
          </div>
        )}

        {mode === 'create' && (
          <form onSubmit={handleCreate} className="space-y-4">
            <button
              type="button"
              onClick={() => { setMode('home'); setError(''); }}
              className="flex items-center gap-1 text-white/70 hover:text-white text-sm font-bold transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <div>
              <label className="block text-white/70 text-sm font-bold mb-1.5">Your name</label>
              <input
                className="w-full bg-white/10 backdrop-blur-sm border border-white/20 text-white rounded-2xl px-4 py-3 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-white/30 placeholder:text-white/30"
                placeholder="Enter your name"
                maxLength={30}
                value={hostName}
                onChange={(e) => setHostName(e.target.value)}
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={loading || !hostName.trim()}
              className="w-full py-4 rounded-2xl bg-white text-red-700 font-extrabold text-lg transition-all hover:bg-white/90 disabled:opacity-50 active:scale-95 flex items-center justify-center gap-2"
            >
              <Gamepad2 className="w-5 h-5" />
              {loading ? 'Creating…' : 'Create Game'}
            </button>
          </form>
        )}

        {mode === 'join' && (
          <form onSubmit={handleJoin} className="space-y-4">
            <button
              type="button"
              onClick={() => { setMode('home'); setError(''); }}
              className="flex items-center gap-1 text-white/70 hover:text-white text-sm font-bold transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <div>
              <label className="block text-white/70 text-sm font-bold mb-1.5">Game code</label>
              <input
                className="w-full bg-white/10 backdrop-blur-sm border border-white/20 text-white rounded-2xl px-4 py-3 text-2xl text-center tracking-widest font-mono font-bold focus:outline-none focus:ring-2 focus:ring-white/30 placeholder:text-white/30"
                placeholder="000000"
                maxLength={6}
                inputMode="numeric"
                pattern="[0-9]{6}"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                autoFocus
              />
            </div>
            <div>
              <label className="block text-white/70 text-sm font-bold mb-1.5">Your name</label>
              <input
                className="w-full bg-white/10 backdrop-blur-sm border border-white/20 text-white rounded-2xl px-4 py-3 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-white/30 placeholder:text-white/30"
                placeholder="Enter your name"
                maxLength={30}
                value={joinName}
                onChange={(e) => setJoinName(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={loading || !joinName.trim() || joinCode.length !== 6}
              className="w-full py-4 rounded-2xl bg-white text-red-700 font-extrabold text-lg transition-all hover:bg-white/90 disabled:opacity-50 active:scale-95 flex items-center justify-center gap-2"
            >
              <LogIn className="w-5 h-5" />
              {loading ? 'Joining…' : 'Join Game'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
