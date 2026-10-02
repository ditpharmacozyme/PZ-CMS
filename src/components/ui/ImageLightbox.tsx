import React, { useEffect, useState } from 'react';
import { Modal } from './Modal';
import { copyImage } from '../../utils/clipboard';

export interface ImageLightboxProps {
  isOpen: boolean;
  onClose: () => void;
  images: string[];
  initialIndex?: number;
  title?: string;
}

type CopyState = 'idle' | 'copied-image' | 'copied-link' | 'failed';

const COPY_LABEL: Record<CopyState, string> = {
  idle: 'Copy image',
  'copied-image': 'Image copied!',
  'copied-link': 'Copied as link (image copy unsupported here)',
  failed: 'Copy failed — try again',
};

const COPY_ICON: Record<CopyState, string> = {
  idle: 'content_copy',
  'copied-image': 'check',
  'copied-link': 'link',
  failed: 'error',
};

export const ImageLightbox: React.FC<ImageLightboxProps> = ({
  isOpen,
  onClose,
  images,
  initialIndex = 0,
  title,
}) => {
  const [index, setIndex] = useState(initialIndex);
  const [copyState, setCopyState] = useState<CopyState>('idle');

  useEffect(() => {
    if (isOpen) {
      setIndex(initialIndex);
      setCopyState('idle');
    }
  }, [isOpen, initialIndex]);

  useEffect(() => {
    if (!isOpen || images.length < 2) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') setIndex((i) => (i - 1 + images.length) % images.length);
      if (e.key === 'ArrowRight') setIndex((i) => (i + 1) % images.length);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, images.length]);

  if (!isOpen || images.length === 0) return null;
  const current = images[index];

  const handleCopy = async () => {
    const result = await copyImage(current);
    setCopyState(result === 'image' ? 'copied-image' : result === 'link' ? 'copied-link' : 'failed');
    window.setTimeout(() => setCopyState('idle'), 2500);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title || 'Image'}
      description={images.length > 1 ? `Image ${index + 1} of ${images.length}` : undefined}
      size="lg"
      footer={
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => { void handleCopy(); }}
            className={`px-3.5 py-2 text-xs font-label-caps font-bold rounded-lg flex items-center gap-1.5 cursor-pointer ${
              copyState === 'copied-image'
                ? 'bg-[#16a34a] text-white'
                : copyState === 'failed'
                  ? 'bg-[#fcebeb] text-[#dc2626]'
                  : 'bg-[#4f46e5] hover:bg-[#4338ca] text-white'
            }`}
          >
            <span className="material-symbols-outlined text-sm">{COPY_ICON[copyState]}</span>
            {COPY_LABEL[copyState]}
          </button>
        </div>
      }
    >
      <div className="relative flex items-center justify-center bg-[#1b1c1a] rounded-xl overflow-hidden" style={{ minHeight: '40vh' }}>
        <img src={current} alt={`${title || 'Image'} ${index + 1}`} className="max-h-[55vh] w-full object-contain" />

        {images.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous image"
              onClick={() => setIndex((i) => (i - 1 + images.length) % images.length)}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 hover:bg-white text-[#1b1c1a] flex items-center justify-center shadow-xs cursor-pointer"
            >
              <span className="material-symbols-outlined text-xl">chevron_left</span>
            </button>
            <button
              type="button"
              aria-label="Next image"
              onClick={() => setIndex((i) => (i + 1) % images.length)}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 hover:bg-white text-[#1b1c1a] flex items-center justify-center shadow-xs cursor-pointer"
            >
              <span className="material-symbols-outlined text-xl">chevron_right</span>
            </button>
          </>
        )}
      </div>

      {images.length > 1 && (
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
          {images.map((url, i) => (
            <button
              key={url}
              type="button"
              aria-label={`View image ${i + 1}`}
              onClick={() => setIndex(i)}
              className={`shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 cursor-pointer ${
                i === index ? 'border-[#4f46e5]' : 'border-transparent opacity-70 hover:opacity-100'
              }`}
            >
              <img src={url} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
};
