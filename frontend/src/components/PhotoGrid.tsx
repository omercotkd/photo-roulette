import clsx from 'clsx';
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
              className="aspect-square rounded-lg bg-gray-700 border-2 border-dashed border-gray-600 flex items-center justify-center"
            >
              {uploading && i === selectedPhotos.length ? (
                <svg className="animate-spin h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
              ) : (
                <span className="text-gray-500 text-xs">{i + 1}</span>
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
    <div className="relative aspect-square rounded-lg overflow-hidden bg-gray-700 group">
      {photo.media_type === 'image' ? (
        <img
          src={photo.url}
          alt=""
          className="w-full h-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gray-800">
          <svg className="w-8 h-8 text-purple-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 6.82v10.36c0 .79.87 1.27 1.54.84l8.14-5.18a1 1 0 000-1.69L9.54 5.98A.998.998 0 008 6.82z" />
          </svg>
        </div>
      )}

      <button
        onClick={onDelete}
        className={clsx(
          'absolute top-1 right-1 w-6 h-6 rounded-full bg-red-600 text-white text-xs',
          'flex items-center justify-center opacity-70 hover:opacity-100 transition-opacity',
          'hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-400'
        )}
        title="Remove this photo"
        aria-label="Remove photo"
      >
        ✕
      </button>
    </div>
  );
}
