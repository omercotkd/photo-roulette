import { useEffect, useRef, useState } from 'react';

interface CountdownTimerProps {
  totalSeconds: number;
  startedAtMs: number;
  onExpire?: () => void;
  compact?: boolean;
}

export default function CountdownTimer({ totalSeconds, startedAtMs, onExpire, compact }: CountdownTimerProps) {
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const [remaining, setRemaining] = useState(totalSeconds);
  const expiredRef = useRef(false);

  useEffect(() => {
    expiredRef.current = false;
    const interval = setInterval(() => {
      const elapsed = (Date.now() - startedAtMs) / 1000;
      const left = Math.max(0, totalSeconds - elapsed);
      setRemaining(left);
      if (left <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        onExpire?.();
        clearInterval(interval);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [totalSeconds, startedAtMs, onExpire]);

  const fraction = remaining / totalSeconds;
  const dashOffset = circumference * (1 - fraction);
  const color = fraction > 0.5 ? '#22c55e' : fraction > 0.25 ? '#f59e0b' : '#ef4444';

  if (compact) {
    return (
      <div
        className="w-12 h-12 rounded-full bg-white/10 border-2 flex items-center justify-center shrink-0"
        style={{ borderColor: color }}
      >
        <span className="text-base font-extrabold text-white">{Math.ceil(remaining)}</span>
      </div>
    );
  }

  return (
    <div className="relative w-24 h-24 flex items-center justify-center mx-auto">
      <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
        {/* Background ring */}
        <circle
          cx="50" cy="50" r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="8"
        />
        {/* Progress ring */}
        <circle
          cx="50" cy="50" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.1s linear, stroke 0.3s' }}
        />
      </svg>
      <span className="absolute text-2xl font-extrabold text-white">
        {Math.ceil(remaining)}
      </span>
    </div>
  );
}
