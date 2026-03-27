import { Camera, CheckCircle2, CircleUser, Clock, Crown } from 'lucide-react';
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
          className="flex items-center gap-3 rounded-2xl px-4 py-3 bg-white/10 backdrop-blur-sm border border-white/10"
        >
          {/* Avatar */}
          <CircleUser className="w-9 h-9 text-white/70 shrink-0" />

          {/* Name + host badge */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="truncate font-bold text-white text-base">
              {player.name}
              {player.player_id === myPlayerId && (
                <span className="ml-1 text-white/60 text-sm font-semibold">(you)</span>
              )}
            </span>
            {player.is_host && (
              <span className="shrink-0 inline-flex items-center gap-1 text-xs font-extrabold bg-white/20 text-white rounded-lg px-2 py-0.5">
                <Crown className="w-3 h-3" />
                HOST
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Photo count */}
            {player.photo_count > 0 && (
              <span className="flex items-center gap-1 text-white/70 text-sm font-bold">
                {player.photo_count}
                <Camera className="w-4 h-4" />
              </span>
            )}
            {/* Ready badge */}
            {player.is_ready ? (
              <span className="inline-flex items-center gap-1 bg-green-500 text-white text-xs font-bold rounded-full px-3 py-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Ready
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 bg-white/20 text-white text-xs font-bold rounded-full px-3 py-1.5">
                <Clock className="w-3.5 h-3.5" />
                Not Ready
              </span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
