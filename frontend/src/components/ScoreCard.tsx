import clsx from 'clsx';
import { Flame, Trophy } from 'lucide-react';
import type { LeaderboardEntry } from '../types/game';

interface ScoreCardProps {
  entries: LeaderboardEntry[];
  myPlayerId: string | null;
  showDelta?: boolean;
}

const RANK_COLORS = ['text-yellow-400', 'text-gray-300', 'text-amber-500'];

export default function ScoreCard({ entries, myPlayerId, showDelta = false }: ScoreCardProps) {
  return (
    <ol className="space-y-2">
      {entries.map((entry, idx) => (
        <li
          key={entry.player_id}
          className={clsx(
            'flex items-center gap-3 rounded-2xl px-4 py-3',
            entry.player_id === myPlayerId
              ? 'bg-white/20 border border-white/30'
              : 'bg-white/10 border border-white/5'
          )}
        >
          {/* Rank */}
          <span className={clsx('w-8 shrink-0 flex justify-center', idx < 3 ? RANK_COLORS[idx] : 'text-white/50')}>
            {idx < 3
              ? <Trophy className="w-5 h-5" />
              : <span className="text-base font-extrabold">{idx + 1}</span>
            }
          </span>

          {/* Name */}
          <span className="flex-1 font-bold text-white truncate">
            {entry.name}
            {entry.player_id === myPlayerId && (
              <span className="ml-1 text-white/55 text-xs font-semibold">(you)</span>
            )}
          </span>

          {/* Streak */}
          {entry.streak >= 2 && (
            <span className="flex items-center gap-0.5 text-sm text-orange-400 shrink-0 font-bold">
              <Flame className="w-4 h-4" />
              {entry.streak}
            </span>
          )}

          {/* Delta */}
          {showDelta && entry.delta > 0 && (
            <span className="text-sm text-green-400 font-bold shrink-0 min-w-[3rem] text-right">
              +{entry.delta}
            </span>
          )}

          {/* Total score */}
          <span className="text-white font-extrabold text-lg shrink-0 min-w-[4rem] text-right">
            {entry.score.toLocaleString()}
          </span>
        </li>
      ))}
    </ol>
  );
}
