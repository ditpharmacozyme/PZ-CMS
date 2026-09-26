/**
 * Shared helpers for the multi-image carousel feature (Posts + Templates).
 * See docs/superpowers/specs/2026-09-22-multi-image-carousel-design.md.
 */

/** UI-enforced cap on carousel slides -- matches Instagram's own limit. Not a DB constraint. */
export const MAX_CAROUSEL_IMAGES = 10;

/**
 * The single "cover" image derived from an ordered image list. Every write
 * path that sets `images` must also set `visualUrl`/`imagePreview` to this,
 * so consumers that only ever need one image (Sheets sync, reminder email,
 * calendar thumbnails, exports, delete-cascade's reference scan) keep
 * working unchanged on records that now carry a full carousel.
 */
export function coverOf(images: string[]): string {
  return images[0] ?? '';
}
