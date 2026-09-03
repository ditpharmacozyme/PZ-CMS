import { describe, it, expect } from 'vitest';
import { voiceRulesReducer } from './voiceRules';

describe('voiceRulesReducer', () => {
  it('add appends an empty string', () => {
    expect(voiceRulesReducer(['a'], { type: 'add' })).toEqual(['a', '']);
  });
  it('edit replaces one entry', () => {
    expect(voiceRulesReducer(['a', 'b'], { type: 'edit', index: 1, text: 'B' })).toEqual(['a', 'B']);
  });
  it('remove drops one entry', () => {
    expect(voiceRulesReducer(['a', 'b', 'c'], { type: 'remove', index: 1 })).toEqual(['a', 'c']);
  });
  it('move reorders', () => {
    expect(voiceRulesReducer(['a', 'b', 'c'], { type: 'move', from: 0, to: 2 })).toEqual(['b', 'c', 'a']);
  });
  it('ignores out-of-range indices', () => {
    expect(voiceRulesReducer(['a'], { type: 'remove', index: 5 })).toEqual(['a']);
    expect(voiceRulesReducer(['a'], { type: 'move', from: 0, to: 9 })).toEqual(['a']);
  });
});
