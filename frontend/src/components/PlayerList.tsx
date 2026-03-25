import clsx from 'clsx';
import type { PlayerInfo } from '../types/game';

interface PlayerListProps {
  players: PlayerInfo[];
  myPlayerId: string | null;
}

export default function PlayerList({ players, myPlayerId }: PlayerListProps) {
  return (
    <ul className="space-y-2">
      {players.map((player) => (
        <li
          key={player.player_id}
          className={clsx(
            'flex items-center justify-between rounded-lg px-3 py-2',
            player.player_id === myPlayerId
              ? 'bg-indigo-900/60 border border-indigo-500'
              : 'bg-gray-700/60'
          )}
        >
          <div className="flex items-center gap-2 min-w-0">
            {/* Host badge */}
            {player.is_host && (
              <span className="shrink-0 text-xs font-bold bg-yellow-500 text-black rounded px-1">HOST</span>
            )}
            <span className="truncate font-medium text-white">
              {player.name}
              {player.player_id === myPlayerId && (
                <span className="ml-1 text-indigo-300 text-xs">(you)</span>
              )}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0 ml-2">
            {/* Photo count badge */}
            {player.photo_count > 0 && (
              <span className="text-xs text-gray-400">
                📷 {player.photo_count}
              </span>
            )}
            {/* Ready badge */}
            <span
              className={clsx(
                'text-xs font-semibold rounded px-1.5 py-0.5',
                player.is_ready
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-600 text-gray-300'
              )}
            >
              {player.is_ready ? '✓ Ready' : 'Not ready'}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
