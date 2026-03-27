import { useState } from 'react';
import { Check, Copy, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

interface QRModalProps {
  gameCode: string;
  onClose: () => void;
}

export default function QRModal({ gameCode, onClose }: QRModalProps) {
  const shareUrl = `${window.location.origin}/join/${gameCode}`;
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      {/* Modal card */}
      <div
        className="relative w-full max-w-xs rounded-3xl bg-white/10 backdrop-blur-md border border-white/20 p-6 flex flex-col items-center gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-lg font-extrabold text-white">Invite Players</h2>

        {/* QR Code */}
        <div className="rounded-2xl bg-white p-3">
          <QRCodeSVG value={shareUrl} size={180} />
        </div>

        {/* Game code */}
        <div className="text-center">
          <div className="text-xs text-white/50 uppercase tracking-widest font-bold mb-1">Game Code</div>
          <div className="text-4xl font-extrabold text-white tracking-widest font-mono">{gameCode}</div>
        </div>

        {/* Copyable link */}
        <div className="w-full flex items-center gap-2 bg-white/10 border border-white/15 rounded-2xl px-3 py-2">
          <span className="flex-1 text-xs text-white/60 font-mono truncate">{shareUrl}</span>
          <button
            onClick={handleCopy}
            className="shrink-0 text-white/60 hover:text-white transition-colors"
            aria-label="Copy link"
          >
            {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
