import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Dices, LogIn } from 'lucide-react';
import { useGame } from '../context/GameContext';

const API = '/api';

export default function JoinPage() {
  const { code } = useParams<{ code: string }>();
  const { initSession } = useGame();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !code) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/games/${code}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.detail ?? 'Failed to join game');
      }
      const data = await res.json();
      initSession(data.game_code, data.player_id, data.token, name.trim());
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

        <form onSubmit={handleJoin} className="space-y-4">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex items-center gap-1 text-white/70 hover:text-white text-sm font-bold transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          {/* Read-only game code display */}
          <div>
            <label className="block text-white/70 text-sm font-bold mb-1.5">Game code</label>
            <div className="w-full bg-white/10 backdrop-blur-sm border border-white/20 text-white rounded-2xl px-4 py-3 text-2xl text-center tracking-widest font-mono font-bold text-white/80">
              {code}
            </div>
          </div>

          <div>
            <label className="block text-white/70 text-sm font-bold mb-1.5">Your name</label>
            <input
              className="w-full bg-white/10 backdrop-blur-sm border border-white/20 text-white rounded-2xl px-4 py-3 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-white/30 placeholder:text-white/30"
              placeholder="Enter your name"
              maxLength={30}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="w-full py-4 rounded-2xl bg-white text-red-700 font-extrabold text-lg transition-all hover:bg-white/90 disabled:opacity-50 active:scale-95 flex items-center justify-center gap-2"
          >
            <LogIn className="w-5 h-5" />
            {loading ? 'Joining…' : 'Join Game'}
          </button>
        </form>
      </div>
    </div>
  );
}
