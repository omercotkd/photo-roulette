import clsx from 'clsx';
import { useGame } from '../context/GameContext';
import type { VoteInfo } from '../types/game';

const MEDALS = ['🥇', '🥈', '🥉'];

export default function RevealScreen() {
  const { state } = useGame();
  const data = state.roundEndData;

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center gap-4">
        <div className="text-6xl animate-bounce">🎰</div>
        <h2 className="text-2xl font-bold text-white">Loading results…</h2>
        <p className="text-gray-400">Please wait</p>
      </div>
    );
  }

  const voteMap = new Map<string, VoteInfo>(data.votes.map((v) => [v.voter_id, v]));

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="text-center py-4 bg-gray-800 border-b border-gray-700">
        <h2 className="text-xl font-bold text-white">Round {data.round_number} Results</h2>
        <p className="text-xs text-gray-500 mt-0.5">Next round starting soon…</p>
      </div>

      {/* Thumbnail */}
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

      {/* Combined leaderboard + votes */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <ol className="space-y-2">
          {state.leaderboard.map((entry, idx) => {
            const vote = voteMap.get(entry.player_id);
            const isMe = entry.player_id === state.myPlayerId;
            const correct = vote?.correct ?? false;
            const elapsedSec =
              vote?.elapsed_ms != null && vote.voted_for_id != null
                ? (vote.elapsed_ms / 1000).toFixed(1)
                : null;

            return (
              <li
                key={entry.player_id}
                className={clsx(
                  'rounded-lg px-3 py-2',
                  isMe ? 'bg-indigo-900/60 border border-indigo-500' : 'bg-gray-700/60'
                )}
              >
                {/* Top row: rank · correctness · name · streak · total score */}
                <div className="flex items-center gap-2">
                  <span className="text-lg w-8 text-center shrink-0">
                    {MEDALS[idx] ?? <span className="text-gray-400 text-sm font-bold">{idx + 1}</span>}
                  </span>
                  <span className="text-base shrink-0">{correct ? '✅' : '❌'}</span>
                  <span className="flex-1 font-semibold text-white truncate">
                    {entry.name}
                    {isMe && <span className="ml-1 text-xs text-indigo-300">(you)</span>}
                  </span>
                  {entry.streak >= 2 && (
                    <span className="text-sm text-orange-400 shrink-0">🔥 {entry.streak}</span>
                  )}
                  <span className="font-bold text-white text-lg shrink-0 min-w-[4rem] text-right">
                    {entry.score.toLocaleString()}
                  </span>
                </div>

                {/* Bottom row: voted for · elapsed · delta */}
                <div className="flex items-center gap-2 mt-1 pl-10 text-sm">
                  <span className={clsx('truncate', correct ? 'text-green-400' : 'text-red-400')}>
                    → {vote?.voted_for_name ?? '— no vote —'}
                  </span>
                  {elapsedSec != null && (
                    <>
                      <span className="text-gray-600">·</span>
                      <span className="text-gray-400 shrink-0">⚡ {elapsedSec}s</span>
                    </>
                  )}
                  {entry.delta > 0 && (
                    <span className="ml-auto text-green-400 font-semibold shrink-0">
                      +{entry.delta}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
