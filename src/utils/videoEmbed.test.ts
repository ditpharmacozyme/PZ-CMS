import { describe, it, expect } from 'vitest';
import {
  extractYouTubeId,
  extractDriveId,
  extractVimeoId,
  detectPlatform,
  getEmbedInfo
} from './videoEmbed';

describe('videoEmbed utilities', () => {
  describe('extractYouTubeId', () => {
    it('extracts ID from standard watch URL', () => {
      expect(extractYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });

    it('extracts ID from watch URL with extra query params', () => {
      expect(extractYouTubeId('https://www.youtube.com/watch?t=10s&v=dQw4w9WgXcQ&feature=shared')).toBe('dQw4w9WgXcQ');
    });

    it('extracts ID from youtu.be short URL', () => {
      expect(extractYouTubeId('https://youtu.be/dQw4w9WgXcQ?t=42')).toBe('dQw4w9WgXcQ');
    });

    it('extracts ID from YouTube Shorts URL', () => {
      expect(extractYouTubeId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });

    it('extracts ID from embed URL', () => {
      expect(extractYouTubeId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });

    it('returns null for invalid or empty URLs', () => {
      expect(extractYouTubeId('')).toBeNull();
      expect(extractYouTubeId('https://google.com')).toBeNull();
      expect(extractYouTubeId('https://youtube.com/channel/123')).toBeNull();
    });
  });

  describe('extractDriveId', () => {
    it('extracts ID from /file/d/.../view link', () => {
      const url = 'https://drive.google.com/file/d/1A2B3C4D5E6F7G8H9I0J/view?usp=sharing';
      expect(extractDriveId(url)).toBe('1A2B3C4D5E6F7G8H9I0J');
    });

    it('extracts ID from /file/d/.../preview link', () => {
      const url = 'https://drive.google.com/file/d/1A2B3C4D5E6F7G8H9I0J/preview';
      expect(extractDriveId(url)).toBe('1A2B3C4D5E6F7G8H9I0J');
    });

    it('extracts ID from ?id= query param', () => {
      const url = 'https://drive.google.com/open?id=1A2B3C4D5E6F7G8H9I0J';
      expect(extractDriveId(url)).toBe('1A2B3C4D5E6F7G8H9I0J');
    });

    it('returns null for non-drive links', () => {
      expect(extractDriveId('https://dropbox.com/s/12345')).toBeNull();
      expect(extractDriveId('')).toBeNull();
    });
  });

  describe('extractVimeoId', () => {
    it('extracts ID from standard Vimeo link', () => {
      expect(extractVimeoId('https://vimeo.com/76979871')).toBe('76979871');
    });

    it('returns null for invalid vimeo links', () => {
      expect(extractVimeoId('https://vimeo.com/upgrade')).toBeNull();
    });
  });

  describe('detectPlatform', () => {
    it('identifies YouTube', () => {
      expect(detectPlatform('https://www.youtube.com/watch?v=12345678901')).toBe('youtube');
      expect(detectPlatform('https://youtu.be/12345678901')).toBe('youtube');
    });

    it('identifies Drive', () => {
      expect(detectPlatform('https://drive.google.com/file/d/123/view')).toBe('drive');
    });

    it('identifies Vimeo', () => {
      expect(detectPlatform('https://vimeo.com/12345')).toBe('vimeo');
    });

    it('identifies Other for generic websites', () => {
      expect(detectPlatform('https://loom.com/share/123')).toBe('other');
    });
  });

  describe('getEmbedInfo', () => {
    it('generates correct embed and thumbnail for YouTube', () => {
      const info = getEmbedInfo('https://youtu.be/dQw4w9WgXcQ');
      expect(info.type).toBe('youtube');
      expect(info.videoId).toBe('dQw4w9WgXcQ');
      expect(info.embedUrl).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?enablejsapi=1&fs=1&rel=0&playsinline=1');
      expect(info.thumbnailUrl).toBe('https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
    });

    it('generates correct embed and thumbnail for Google Drive', () => {
      const info = getEmbedInfo('https://drive.google.com/file/d/test-file-id/view');
      expect(info.type).toBe('drive');
      expect(info.videoId).toBe('test-file-id');
      expect(info.embedUrl).toBe('https://drive.google.com/file/d/test-file-id/preview');
      expect(info.thumbnailUrl).toBe('https://drive.google.com/thumbnail?id=test-file-id&sz=w640');
    });

    it('handles unrecognized or other URLs gracefully', () => {
      const info = getEmbedInfo('https://example.com/course');
      expect(info.type).toBe('other');
      expect(info.embedUrl).toBeUndefined();
      expect(info.rawUrl).toBe('https://example.com/course');
    });
  });
});
