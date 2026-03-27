import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Dices } from 'lucide-react';
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

  // Show "Starting…" countdown banner briefly
  if (state.status === 'LOBBY') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <Dices className="w-16 h-16 text-white animate-bounce" />
        <h2 className="text-2xl font-extrabold text-white">Game starting…</h2>
        <p className="text-white/60 font-semibold">Get ready!</p>
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
