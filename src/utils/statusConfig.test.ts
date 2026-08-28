import { describe, it, expect } from 'vitest';
import { STATUS_CONFIG } from './statusConfig';

describe('STATUS_CONFIG palette', () => {
  it('uses the Calm Clarity status tokens', () => {
    expect(STATUS_CONFIG['not-started']).toMatchObject({ color: '#52525B', bgColor: '#F1F1F0' });
    expect(STATUS_CONFIG['in-progress']).toMatchObject({ color: '#B45309', bgColor: '#FBF0E1' });
    expect(STATUS_CONFIG['ready-to-post']).toMatchObject({ color: '#4F46E5', bgColor: '#EEF2FF' });
    expect(STATUS_CONFIG['posted']).toMatchObject({ color: '#15803D', bgColor: '#E6F4EA', icon: 'check_circle' });
    expect(STATUS_CONFIG['overdue']).toMatchObject({ color: '#DC2626', bgColor: '#FCEBEB', icon: 'error' });
  });
});
