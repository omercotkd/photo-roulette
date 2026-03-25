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
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Round indicator */}
      <div className="text-center py-3 bg-gray-800 border-b border-gray-700">
        <span className="text-gray-400 text-sm font-semibold">
          Round {round.round_number} of {round.total_rounds}
        </span>
      </div>

      {/* Media display */}
      <div className="flex-1 flex items-center justify-center bg-black p-2 max-h-[40vh] md:max-h-[50vh]">
        {round.media_type === 'image' ? (
          <img
            src={round.media_url}
            alt="Round photo"
            className="max-h-full max-w-full object-contain rounded-lg"
          />
        ) : (
          <video
            ref={videoRef}
            src={round.media_url}
            autoPlay
            muted
            playsInline
            className="max-h-full max-w-full object-contain rounded-lg"
          />
        )}
      </div>

      {/* Timer + vote status */}
      <div className="py-3 flex flex-col items-center gap-1">
        <CountdownTimer
          totalSeconds={state.settings.vote_timer_seconds}
          startedAtMs={startMs}
        />
        <span className="text-gray-400 text-xs">
          {state.votesCast} / {state.totalPlayers} voted
        </span>
      </div>

      {/* Vote buttons */}
      <div className="px-4 pb-6 space-y-3">
        {state.myVote !== null ? (
          <div className="text-center text-gray-400 py-4 font-semibold">
            ✓ Vote locked in — waiting for others…
          </div>
        ) : (
          <p className="text-center text-gray-300 font-semibold mb-2">Who uploaded this?</p>
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
                  'py-4 rounded-xl font-bold text-base transition-all',
                  votingDone
                    ? isMyVote
                      ? 'bg-indigo-600 text-white ring-2 ring-indigo-300 scale-105'
                      : 'bg-gray-700 text-gray-500 opacity-60'
                    : 'bg-gray-700 hover:bg-indigo-600 active:scale-95 text-white'
                )}
              >
                {player.name}
                {player.player_id === state.myPlayerId && (
                  <span className="block text-xs font-normal opacity-70">(you)</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
