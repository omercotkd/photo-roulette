import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';
import CountdownTimer from '../components/CountdownTimer';
import { useGame } from '../context/GameContext';

export default function VotingScreen() {
  const { state, dispatch, socket } = useGame();
  const round = state.currentRound;
  const videoRef = useRef<HTMLVideoElement>(null);
  const [startMs, setStartMs] = useState(Date.now());

  // Re-set timer whenever a new round starts
  useEffect(() => {
    setStartMs(Date.now());
  }, [round?.round_idx]);

  // Video 5-second loop
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const handleTime = () => {
      if (video.currentTime >= 5) {
        video.currentTime = 0;
        video.play().catch(() => {});
      }
    };
    video.addEventListener('timeupdate', handleTime);
    return () => video.removeEventListener('timeupdate', handleTime);
  }, [round?.media_url]);

  if (!round) return null;

  function handleVote(playerId: string) {
    if (state.myVote !== null) return; // already voted — locked
    dispatch({ type: 'MY_VOTE_CAST', votedForId: playerId });
    socket?.emit('cast_vote', {
      round_idx: round!.round_idx,
      voted_for_player_id: playerId,
      timestamp_ms: Date.now(),
    });
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Round progress bars */}
      <div className="flex gap-1.5 px-4 pt-5 pb-1">
        {Array.from({ length: round.total_rounds }).map((_, i) => (
          <div
            key={i}
            className={clsx(
              'h-1 flex-1 rounded-full transition-colors',
              i < round.round_number ? 'bg-white' : 'bg-white/30'
            )}
          />
        ))}
      </div>

      {/* Title + compact timer */}
      <div className="flex items-center justify-between px-4 py-3 gap-3">
        <h2 className="text-2xl font-extrabold text-white leading-tight">
          {state.myVote !== null ? 'Vote locked in!' : 'Who uploaded this?'}
        </h2>
        <div className="flex flex-col items-center shrink-0">
          <CountdownTimer
            totalSeconds={state.settings.vote_timer_seconds}
            startedAtMs={startMs}
            compact
          />
          <span className="text-white/55 text-xs font-bold mt-1">
            {state.votesCast}/{state.totalPlayers}
          </span>
        </div>
      </div>

      {/* Media display */}
      <div className="flex-1 flex items-center justify-center px-4 py-1 min-h-0">
        <div
          className="w-full rounded-3xl overflow-hidden bg-white/8 border border-white/15 flex items-center justify-center"
          style={{ maxHeight: '42vh' }}
        >
          {round.media_type === 'image' ? (
            <img
              src={round.media_url}
              alt="Round photo"
              className="max-w-full object-contain"
              style={{ maxHeight: '42vh' }}
            />
          ) : (
            <video
              ref={videoRef}
              src={round.media_url}
              autoPlay
              muted
              playsInline
              className="max-w-full object-contain"
              style={{ maxHeight: '42vh' }}
            />
          )}
        </div>
      </div>

      {/* Vote buttons */}
      <div className="px-4 pb-8 pt-3">
        {state.myVote !== null && (
          <p className="text-center text-white/55 text-sm font-semibold mb-3">
            Waiting for others to vote…
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          {state.players.map((player) => {
            const isMyVote = state.myVote === player.player_id;
            const votingDone = state.myVote !== null;

            return (
              <button
                key={player.player_id}
                onClick={() => handleVote(player.player_id)}
                disabled={votingDone}
                className={clsx(
                  'py-5 rounded-2xl font-bold text-base transition-all',
                  votingDone
                    ? isMyVote
                      ? 'bg-white/25 text-white ring-2 ring-white/40 scale-105'
                      : 'bg-white/5 text-white/30'
                    : 'bg-red-950/60 hover:bg-red-900/70 backdrop-blur-sm border border-white/10 active:scale-95 text-white'
                )}
              >
                {player.name}
                {player.player_id === state.myPlayerId && (
                  <span className="block text-xs font-semibold opacity-55 mt-0.5">(you)</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
