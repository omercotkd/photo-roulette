import clsx from 'clsx';
import { useEffect, useState } from 'react';
import ScoreCard from '../components/ScoreCard';
import { useGame } from '../context/GameContext';

const REVEAL_PHASE_MS = 5000; // show vote breakdown for 5s, then leaderboard

export default function RevealScreen() {
  const { state } = useGame();
  const data = state.roundEndData;
  const [phase, setPhase] = useState<'reveal' | 'leaderboard'>('reveal');

  useEffect(() => {
    setPhase('reveal');
    const t = setTimeout(() => setPhase('leaderboard'), REVEAL_PHASE_MS);
    return () => clearTimeout(t);
  }, [data?.round_number]);

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center gap-4">
        <div className="text-6xl animate-bounce">🎰</div>
        <h2 className="text-2xl font-bold text-white">Loading results…</h2>
        <p className="text-gray-400">Please wait</p>
      </div>
    );
  }

  if (phase === 'leaderboard') {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col">
        <div className="text-center py-4 bg-gray-800 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">
            Leaderboard — Round {data.round_number}
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">Next round starting soon…</p>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <ScoreCard
            entries={state.leaderboard}
            myPlayerId={state.myPlayerId}
            showDelta
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Owner banner */}
      <div className="text-center py-4 bg-indigo-900/70 border-b border-indigo-700">
        <div className="text-xs text-indigo-300 uppercase tracking-widest font-semibold mb-1">
          Photo owner
        </div>
        <div className="text-2xl font-extrabold text-white">{data.owner_name}</div>
      </div>

      {/* Thumbnail (small) */}
      <div className="flex justify-center py-3 bg-black">
        {data.media_type === 'image' ? (
          <img
            src={data.media_url}
            alt="Round photo"
            className="h-28 object-contain rounded-lg"
          />
        ) : (
          <video
            src={data.media_url}
            muted
            playsInline
            className="h-28 object-contain rounded-lg"
          />
        )}
      </div>

      {/* Vote breakdown */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Votes</h3>
        <ul className="space-y-2">
          {data.votes.map((vote) => {
            const isMe = vote.voter_id === state.myPlayerId;
            return (
              <li
                key={vote.voter_id}
                className={clsx(
                  'flex items-center gap-3 rounded-lg px-3 py-2',
                  isMe ? 'bg-indigo-900/50 border border-indigo-600' : 'bg-gray-800'
                )}
              >
                <span className="text-xl">{vote.correct ? '✅' : '❌'}</span>
                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-white">{vote.voter_name}</span>
                  {isMe && <span className="ml-1 text-xs text-indigo-300">(you)</span>}
                  <span className="text-gray-400 text-sm">
                    {' '}→{' '}
                    <span className={vote.correct ? 'text-green-400' : 'text-red-400'}>
                      {vote.voted_for_name ?? '— no vote —'}
                    </span>
                  </span>
                </div>
                {vote.points_earned > 0 && (
                  <span className="text-green-400 font-bold text-sm shrink-0">+{vote.points_earned}</span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
