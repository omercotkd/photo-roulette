import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center gap-4">
        <div className="text-6xl animate-bounce">🎰</div>
        <h2 className="text-2xl font-bold text-white">Reconnecting…</h2>
        <p className="text-gray-400">Restoring your session…</p>
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
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="text-center py-6 bg-gradient-to-b from-indigo-900 to-gray-900">
        <div className="text-5xl mb-2">🏆</div>
        <h1 className="text-3xl font-extrabold text-white">Game Over!</h1>
        <p className="text-gray-400 mt-1">Final Results</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
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
            className="w-full py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xl transition-colors"
          >
            {resetting ? 'Resetting…' : '🔄 Play Again'}
          </button>
        </div>
      )}
      {!state.isHost && (
        <p className="text-center text-gray-500 text-sm pb-8">Waiting for host to start a new game…</p>
      )}
    </div>
  );
}
