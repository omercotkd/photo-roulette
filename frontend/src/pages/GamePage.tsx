import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import RevealScreen from './RevealScreen';
import VotingScreen from './VotingScreen';

export default function GamePage() {
  const { state } = useGame();
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (state.status === 'GAME_OVER') {
      navigate(`/game/${code}/over`);
    }
  }, [state.status, code, navigate]);

  useEffect(() => {
    if (state.status === 'LOBBY') {
      navigate(`/lobby/${code}`);
    }
  }, [state.status, code, navigate]);

  // Show "Starting…" countdown banner briefly
  if (state.status === 'LOBBY') {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center gap-4">
        <div className="text-6xl animate-bounce">🎰</div>
        <h2 className="text-2xl font-bold text-white">Game starting…</h2>
        <p className="text-gray-400">Get ready!</p>
      </div>
    );
  }

  if (state.status === 'IN_ROUND') {
    return <VotingScreen />;
  }

  if (state.status === 'ROUND_REVEAL' || state.status === 'BETWEEN_ROUNDS') {
    return <RevealScreen />;
  }

  return null;
}
