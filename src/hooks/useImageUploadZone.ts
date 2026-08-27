import { useCallback, useEffect, useState } from 'react';

/**
 * Drag-and-drop + paste-to-upload for an image drop target. The single file
 * picker (`<input type="file">`) stays as the explicit path; this adds the two
 * fast ones. `onFile` gets the first image File found; callers own the actual
 * upload + progress + error state.
 */
export function useImageUploadZone(onFile: (file: File) => void, disabled = false) {
  const [isDragging, setIsDragging] = useState(false);

  const takeFirstImage = useCallback(
    (files: FileList | File[] | null | undefined) => {
      if (disabled || !files) return;
      const img = Array.from(files).find((f) => f.type.startsWith('image/'));
      if (img) onFile(img);
    },
    [onFile, disabled]
  );

  // Paste anywhere while this zone is mounted -- e.g. a screenshot straight
  // from the clipboard. Guarded so it never hijacks a paste into a text field.
  useEffect(() => {
    if (disabled) return;
    const onPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            onFile(file);
            return;
          }
        }
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [onFile, disabled]);

  const dropHandlers = {
    onDragOver: (e: React.DragEvent) => {
      if (disabled) return;
      e.preventDefault();
      if (!isDragging) setIsDragging(true);
    },
    onDragLeave: (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      takeFirstImage(e.dataTransfer?.files);
    },
  };

  return { isDragging, dropHandlers };
}
