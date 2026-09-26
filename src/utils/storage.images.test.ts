import { describe, it, expect } from 'vitest';
import { rowToTemplate, templateToRow } from './storage';

const baseRow = {
  id: '1', title: 'X', description: '', brand_id: 'shared', category: 'Clinical',
  platform: 'instagram', spec_type: 'feed-post', default_caption: '', tags: [],
  image_preview: '', uses_count: 0,
};

describe('template images mapping', () => {
  it('rowToTemplate reads the images array', () => {
    const t = rowToTemplate({ ...baseRow, image_preview: 'https://a', images: ['https://a', 'https://b'] });
    expect(t.images).toEqual(['https://a', 'https://b']);
  });

  it('rowToTemplate defaults images to [] for a pre-migration row with no images value', () => {
    const t = rowToTemplate({ ...baseRow });
    expect(t.images).toEqual([]);
  });

  it('rowToTemplate defaults images to [] when the column comes back non-array (defensive)', () => {
    const t = rowToTemplate({ ...baseRow, images: null });
    expect(t.images).toEqual([]);
  });

  it('templateToRow writes the images array', () => {
    const row = templateToRow({
      id: '1', title: 'X', description: '', brandId: 'shared', category: 'Clinical',
      platform: 'instagram', specType: 'feed-post', defaultCaption: '', tags: [],
      imagePreview: 'https://a', images: ['https://a'], usesCount: 0,
    });
    expect(row.images).toEqual(['https://a']);
  });

  it('templateToRow defaults images to [] when the template has none', () => {
    const row = templateToRow({
      id: '1', title: 'X', description: '', brandId: 'shared', category: 'Clinical',
      platform: 'instagram', specType: 'feed-post', defaultCaption: '', tags: [],
      imagePreview: '', images: [], usesCount: 0,
    });
    expect(row.images).toEqual([]);
  });
});
