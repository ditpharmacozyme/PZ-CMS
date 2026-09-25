import React, { useRef, useState } from 'react';
import { DndContext, DragEndEvent, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { uploadImages } from '../../utils/uploadImage';
import { MAX_CAROUSEL_IMAGES } from '../../utils/images';

/** Pure reorder helper -- thin wrapper over dnd-kit's own arrayMove so the
 * drag-end handler and its test both go through one function. */
export function moveImage(images: string[], fromIndex: number, toIndex: number): string[] {
  if (fromIndex === toIndex) return images;
  return arrayMove(images, fromIndex, toIndex);
}

export interface ImageCarouselFieldProps {
  images: string[];
  onChange: (images: string[]) => void;
  disabled?: boolean;
  /** Fires true when an upload starts and false when it ends (success or
   * failure) -- lets a parent that has its own full-panel "uploading" overlay
   * (PostDetailModal, Task 6) stay in sync without owning the upload itself. */
  onUploadingChange?: (uploading: boolean) => void;
}

function SortableThumb({ url, index, onRemove, disabled }: { url: string; index: number; onRemove: () => void; disabled?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: url });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className="relative w-20 h-20 rounded-lg overflow-hidden border border-[var(--color-line)] bg-[var(--color-muted)] group">
      <img src={url} alt={`Slide ${index + 1}`} className="w-full h-full object-cover" draggable={false} />
      <span className="absolute top-1 left-1 bg-black/70 text-white text-[9px] font-bold rounded px-1">{index + 1}</span>
      {!disabled && (
        <>
          <button
            type="button"
            aria-label={`Remove slide ${index + 1}`}
            onClick={onRemove}
            className="absolute top-1 right-1 w-4 h-4 rounded-full bg-black/70 text-white text-[10px] leading-4 text-center cursor-pointer"
          >
            ✕
          </button>
          <button
            type="button"
            aria-label={`Drag to reorder slide ${index + 1}`}
            {...attributes}
            {...listeners}
            className="absolute bottom-1 right-1 w-5 h-5 rounded bg-black/70 text-white flex items-center justify-center cursor-grab active:cursor-grabbing"
          >
            <span className="material-symbols-outlined text-[12px]">drag_indicator</span>
          </button>
        </>
      )}
    </div>
  );
}

export const ImageCarouselField: React.FC<ImageCarouselFieldProps> = ({ images, onChange, disabled, onUploadingChange }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [failedNames, setFailedNames] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const remaining = MAX_CAROUSEL_IMAGES - images.length;

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList).slice(0, Math.max(0, remaining));
    if (files.length === 0) return;

    setFailedNames([]);
    setIsUploading(true);
    onUploadingChange?.(true);
    try {
      const { succeeded, failed } = await uploadImages(files, (done, total) => setProgress({ done, total }));
      if (succeeded.length > 0) onChange([...images, ...succeeded.map((r) => r.url)]);
      setFailedNames(failed.map((f) => f.file.name));
    } finally {
      setIsUploading(false);
      setProgress(null);
      onUploadingChange?.(false);
    }
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = images.indexOf(String(active.id));
    const to = images.indexOf(String(over.id));
    if (from === -1 || to === -1) return;
    onChange(moveImage(images, from, to));
  };

  return (
    <div className="space-y-2">
      {images.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={images} strategy={rectSortingStrategy}>
            <div className="flex flex-wrap gap-2">
              {images.map((url, i) => (
                <SortableThumb
                  key={url}
                  url={url}
                  index={i}
                  disabled={disabled}
                  onRemove={() => onChange(images.filter((_, idx) => idx !== i))}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || isUploading || remaining <= 0}
          className="px-3 py-1.5 rounded-lg border border-[var(--color-line)] text-xs font-bold text-[var(--color-accent)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {isUploading
            ? progress
              ? `Uploading slide ${progress.done} of ${progress.total}…`
              : 'Uploading…'
            : remaining <= 0
              ? `${MAX_CAROUSEL_IMAGES}/${MAX_CAROUSEL_IMAGES} — remove a slide to add another`
              : `Add image${remaining > 1 ? 's' : ''} (${images.length}/${MAX_CAROUSEL_IMAGES})`}
        </button>
      </div>

      {failedNames.length > 0 && (
        <p className="text-[10px] text-[var(--color-danger)]">
          Failed to upload: {failedNames.join(', ')}. Try again.
        </p>
      )}
    </div>
  );
};
