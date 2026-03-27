import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo / Title */}
        <div className="text-center">
          <div className="text-6xl mb-3">🎰</div>
          <h1 className="text-4xl font-extrabold text-white tracking-tight">Photo Roulette</h1>
          <p className="text-gray-400 mt-2">Guess whose photo it is!</p>
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-500 text-red-200 rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {mode === 'home' && (
          <div className="flex flex-col gap-4">
            <button
              onClick={() => setMode('create')}
              className="w-full py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-lg transition-colors"
            >
              🎮 Create Game
            </button>
            <button
              onClick={() => setMode('join')}
              className="w-full py-4 rounded-xl bg-gray-700 hover:bg-gray-600 text-white font-bold text-lg transition-colors"
            >
              🚪 Join Game
            </button>
          </div>
        )}

        {mode === 'create' && (
          <form onSubmit={handleCreate} className="space-y-4">
            <button
              type="button"
              onClick={() => { setMode('home'); setError(''); }}
              className="text-gray-400 hover:text-white text-sm"
            >
              ← Back
            </button>
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-1">Your name</label>
              <input
                className="w-full bg-gray-700 text-white rounded-lg px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
              className="w-full py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-lg transition-colors"
            >
              {loading ? 'Creating…' : '🎮 Create Game'}
            </button>
          </form>
        )}

        {mode === 'join' && (
          <form onSubmit={handleJoin} className="space-y-4">
            <button
              type="button"
              onClick={() => { setMode('home'); setError(''); }}
              className="text-gray-400 hover:text-white text-sm"
            >
              ← Back
            </button>
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-1">Game code</label>
              <input
                className="w-full bg-gray-700 text-white rounded-lg px-4 py-3 text-2xl text-center tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
              <label className="block text-gray-300 text-sm font-medium mb-1">Your name</label>
              <input
                className="w-full bg-gray-700 text-white rounded-lg px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Enter your name"
                maxLength={30}
                value={joinName}
                onChange={(e) => setJoinName(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={loading || !joinName.trim() || joinCode.length !== 6}
              className="w-full py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-lg transition-colors"
            >
              {loading ? 'Joining…' : '🚪 Join Game'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
