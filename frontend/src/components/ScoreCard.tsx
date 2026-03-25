import clsx from 'clsx';
import type { LeaderboardEntry } from '../types/game';

interface ScoreCardProps {
  entries: LeaderboardEntry[];
  myPlayerId: string | null;
  showDelta?: boolean;
}

const MEDALS = ['🥇', '🥈', '🥉'];

export default function ScoreCard({ entries, myPlayerId, showDelta = false }: ScoreCardProps) {
  return (
    <ol className="space-y-2">
      {entries.map((entry, idx) => (
        <li
          key={entry.player_id}
          className={clsx(
            'flex items-center gap-3 rounded-lg px-4 py-3',
            entry.player_id === myPlayerId
              ? 'bg-indigo-900/60 border border-indigo-500'
              : 'bg-gray-700/60'
          )}
        >
          {/* Rank */}
          <span className="text-xl w-8 text-center shrink-0">
            {MEDALS[idx] ?? <span className="text-gray-400 text-base font-bold">{idx + 1}</span>}
          </span>

          {/* Name */}
          <span className="flex-1 font-semibold text-white truncate">
            {entry.name}
            {entry.player_id === myPlayerId && (
              <span className="ml-1 text-indigo-300 text-xs">(you)</span>
            )}
          </span>

          {/* Streak */}
          {entry.streak >= 2 && (
            <span className="text-sm text-orange-400 shrink-0">🔥 {entry.streak}</span>
          )}

          {/* Delta */}
          {showDelta && entry.delta > 0 && (
            <span className="text-sm text-green-400 font-semibold shrink-0 min-w-[3rem] text-right">
              +{entry.delta}
            </span>
          )}

          {/* Total score */}
          <span className="text-white font-bold text-lg shrink-0 min-w-[4rem] text-right">
            {entry.score.toLocaleString()}
          </span>
        </li>
      ))}
    </ol>
  );
}
