import clsx from 'clsx';
import { Video, X } from 'lucide-react';
import type { UploadedPhoto } from '../types/game';

interface PhotoGridProps {
  selectedPhotos: UploadedPhoto[];
  onDelete: (photoId: string) => void;
  uploading: boolean;
}

export default function PhotoGrid({ selectedPhotos, onDelete, uploading }: PhotoGridProps) {
  const slots = Array.from({ length: 16 });

  return (
    <div className="grid grid-cols-4 gap-2">
      {slots.map((_, i) => {
        const photo = selectedPhotos[i];
        if (!photo) {
          return (
            <div
              key={i}
              className="aspect-square rounded-xl bg-white/5 border-2 border-dashed border-white/15 flex items-center justify-center"
            >
              {uploading && i === selectedPhotos.length ? (
                <svg className="animate-spin h-5 w-5 text-white/40" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
              ) : (
                <span className="text-white/25 text-xs font-bold">{i + 1}</span>
              )}
            </div>
          );
        }

        return (
          <PhotoSlot
            key={photo.photo_id}
            photo={photo}
            onDelete={() => onDelete(photo.photo_id)}
          />
        );
      })}
    </div>
  );
}

function PhotoSlot({ photo, onDelete }: { photo: UploadedPhoto; onDelete: () => void }) {
  return (
    <div className="relative aspect-square rounded-xl overflow-hidden bg-white/5">
      {photo.media_type === 'image' ? (
        <img
          src={photo.url}
          alt=""
          className="w-full h-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-black/40">
          <Video className="w-8 h-8 text-white/60" />
        </div>
      )}

      <button
        onClick={onDelete}
        className={clsx(
          'absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-red-600/90 text-white',
          'flex items-center justify-center transition-opacity opacity-80 hover:opacity-100',
          'focus:outline-none focus:ring-2 focus:ring-red-400'
        )}
        title="Remove this photo"
        aria-label="Remove photo"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
