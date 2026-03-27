import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Dices, RotateCcw, Trophy } from 'lucide-react';
import ScoreCard from '../components/ScoreCard';
import { useGame } from '../context/GameContext';

const API = '/api';

export default function GameOverScreen() {
  const { state } = useGame();
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (!state.isRestoring && state.status === 'LOBBY') {
      navigate(`/lobby/${code}`);
    }
  }, [state.isRestoring, state.status, code, navigate]);

  useEffect(() => {
    if (!state.isRestoring && !state.gameCode) {
      navigate('/', { state: { error: state.error } });
    }
  }, [state.isRestoring, state.gameCode, state.error, navigate]);

  if (state.isRestoring) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <Dices className="w-16 h-16 text-white animate-bounce" />
        <h2 className="text-2xl font-extrabold text-white">Reconnecting…</h2>
        <p className="text-white/60 font-semibold">Restoring your session…</p>
      </div>
    );
  }

  async function handlePlayAgain() {
    setResetting(true);
    try {
      const res = await fetch(`${API}/games/${code}/play-again`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${state.myToken}` },
      });
      if (!res.ok) {
        const d = await res.json();
        alert(d.detail ?? 'Could not reset game');
      }
      // Navigation handled by PLAY_AGAIN socket event → LobbyPage redirect
      navigate(`/lobby/${code}`);
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <div className="text-center pt-10 pb-6 px-4">
        <div className="flex justify-center mb-3">
          <div className="w-16 h-16 rounded-2xl bg-yellow-400/20 border border-yellow-400/30 flex items-center justify-center">
            <Trophy className="w-8 h-8 text-yellow-400" />
          </div>
        </div>
        <h1 className="text-3xl font-extrabold text-white">Game Over!</h1>
        <p className="text-white/60 mt-1 font-semibold">Final Results</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-2">
        <ScoreCard
          entries={state.finalLeaderboard}
          myPlayerId={state.myPlayerId}
          showDelta={false}
        />
      </div>

      {/* Play Again (host only) */}
      {state.isHost && (
        <div className="px-4 pb-8 pt-4">
          <button
            onClick={handlePlayAgain}
            disabled={resetting}
            className="w-full py-4 rounded-2xl bg-green-500 hover:bg-green-400 disabled:opacity-50 text-white font-extrabold text-xl transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-5 h-5" />
            {resetting ? 'Resetting…' : 'Play Again'}
          </button>
        </div>
      )}
      {!state.isHost && (
        <p className="text-center text-white/50 text-sm pb-8 font-semibold">Waiting for host to start a new game…</p>
      )}
    </div>
  );
}
