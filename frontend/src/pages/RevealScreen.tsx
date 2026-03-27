import clsx from 'clsx';
import { CircleCheck, CircleX, Dices, Flame, Zap } from 'lucide-react';
import { useGame } from '../context/GameContext';
import type { VoteInfo } from '../types/game';
import CountdownTimer from '../components/CountdownTimer';

export default function RevealScreen() {
  const { state } = useGame();
  const data = state.roundEndData;

  if (!data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <Dices className="w-16 h-16 text-white animate-bounce" />
        <h2 className="text-2xl font-extrabold text-white">Loading results…</h2>
        <p className="text-white/60 font-semibold">Please wait</p>
      </div>
    );
  }

  const voteMap = new Map<string, VoteInfo>(data.votes.map((v) => [v.voter_id, v]));

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <div className="relative text-center py-5 px-4">
        <h2 className="text-2xl font-extrabold text-white">Round {data.round_number} Results</h2>
        <p className="text-white/50 text-sm font-semibold mt-0.5">Next round starting soon…</p>
        {state.leaderboardStartedAtMs != null && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <CountdownTimer
              totalSeconds={state.settings.leaderboard_time_seconds}
              startedAtMs={state.leaderboardStartedAtMs}
              compact
            />
          </div>
        )}
      </div>

      {/* Thumbnail */}
      <div className="flex justify-center px-4 pb-3">
        <div className="rounded-2xl overflow-hidden bg-white/5 border border-white/10">
          {data.media_type === 'image' ? (
            <img
              src={data.media_url}
              alt="Round photo"
              className="h-28 object-contain"
            />
          ) : (
            <video
              src={data.media_url}
              muted
              playsInline
              className="h-28 object-contain"
            />
          )}
        </div>
      </div>

      {/* Leaderboard + votes */}
      <div className="flex-1 overflow-y-auto px-4 pb-6">
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
                  'rounded-2xl px-3 py-2.5',
                  isMe ? 'bg-white/20 border border-white/30' : 'bg-white/10 border border-white/5'
                )}
              >
                {/* Top row: rank · correctness · name · streak · total score */}
                <div className="flex items-center gap-2">
                  <span className="text-white/50 font-extrabold text-sm w-6 text-center shrink-0">
                    {idx + 1}
                  </span>
                  <span className="shrink-0">
                    {correct
                      ? <CircleCheck className="w-4 h-4 text-green-400" />
                      : <CircleX className="w-4 h-4 text-red-400" />}
                  </span>
                  <span className="flex-1 font-bold text-white truncate">
                    {entry.name}
                    {isMe && <span className="ml-1 text-white/55 text-xs font-semibold">(you)</span>}
                  </span>
                  {entry.streak >= 2 && (
                    <span className="flex items-center gap-0.5 text-sm text-orange-400 shrink-0 font-bold">
                      <Flame className="w-3.5 h-3.5" />
                      {entry.streak}
                    </span>
                  )}
                  <span className="font-extrabold text-white text-base shrink-0 min-w-[4rem] text-right">
                    {entry.score.toLocaleString()}
                  </span>
                </div>

                {/* Bottom row: voted for · elapsed · delta */}
                <div className="flex items-center gap-2 mt-1 pl-8 text-sm">
                  <span className={clsx('truncate font-semibold', correct ? 'text-green-400' : 'text-red-400')}>
                    → {vote?.voted_for_name ?? '— no vote —'}
                  </span>
                  {elapsedSec != null && (
                    <>
                      <span className="text-white/20">·</span>
                      <span className="flex items-center gap-0.5 text-white/50 shrink-0 font-semibold">
                        <Zap className="w-3 h-3" />
                        {elapsedSec}s
                      </span>
                    </>
                  )}
                  {entry.delta > 0 && (
                    <span className="ml-auto text-green-400 font-bold shrink-0">
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
