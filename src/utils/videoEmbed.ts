/**
 * Video Embed & URL Parsing Utilities
 * Handles detection and iframe embed transformations for YouTube and Google Drive.
 */

export type VideoPlatform = 'youtube' | 'drive' | 'vimeo' | 'other';

export interface EmbedInfo {
  type: VideoPlatform;
  rawUrl: string;
  embedUrl?: string;
  thumbnailUrl?: string;
  videoId?: string;
}

/**
 * Extracts YouTube video ID from various YouTube URL formats.
 * Supports: watch?v=, youtu.be/, shorts/, embed/, live/.
 */
export function extractYouTubeId(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();

  // Pattern matches 11-character YouTube video IDs
  const match = trimmed.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/|live\/))([a-zA-Z0-9_-]{11})/
  );

  return match ? match[1] : null;
}

/**
 * Extracts Google Drive file ID from standard sharing/view links.
 */
export function extractDriveId(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();

  // Matches /file/d/FILE_ID or ?id=FILE_ID
  const matchPath = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (matchPath) return matchPath[1];

  const matchParam = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (matchParam) return matchParam[1];

  return null;
}

/**
 * Extracts Vimeo video ID from standard Vimeo URLs.
 */
export function extractVimeoId(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  const match = trimmed.match(/vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/[^/]+\/videos\/|)(\d+)/);
  return match ? match[1] : null;
}

/**
 * Detects the platform of a video/course link.
 */
export function detectPlatform(url: string): VideoPlatform {
  if (!url || typeof url !== 'string') return 'other';
  const trimmed = url.trim().toLowerCase();

  if (trimmed.includes('youtube.com') || trimmed.includes('youtu.be')) {
    return 'youtube';
  }
  if (trimmed.includes('drive.google.com')) {
    return 'drive';
  }
  if (trimmed.includes('vimeo.com')) {
    return 'vimeo';
  }
  return 'other';
}

/**
 * Resolves embed and thumbnail information for a given video URL.
 */
export function getEmbedInfo(url: string): EmbedInfo {
  const trimmed = (url || '').trim();
  const platform = detectPlatform(trimmed);

  if (platform === 'youtube') {
    const videoId = extractYouTubeId(trimmed);
    if (videoId) {
      return {
        type: 'youtube',
        rawUrl: trimmed,
        videoId,
        embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
        thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
      };
    }
  }

  if (platform === 'drive') {
    const fileId = extractDriveId(trimmed);
    if (fileId) {
      return {
        type: 'drive',
        rawUrl: trimmed,
        videoId: fileId,
        embedUrl: `https://drive.google.com/file/d/${fileId}/preview`,
        thumbnailUrl: `https://drive.google.com/thumbnail?id=${fileId}&sz=w640`
      };
    }
  }

  if (platform === 'vimeo') {
    const videoId = extractVimeoId(trimmed);
    if (videoId) {
      return {
        type: 'vimeo',
        rawUrl: trimmed,
        videoId,
        embedUrl: `https://player.vimeo.com/video/${videoId}`
      };
    }
  }

  return {
    type: 'other',
    rawUrl: trimmed
  };
}
