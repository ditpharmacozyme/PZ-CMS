export type VoiceRuleAction =
  | { type: 'add' }
  | { type: 'edit'; index: number; text: string }
  | { type: 'remove'; index: number }
  | { type: 'move'; from: number; to: number };

const inRange = (i: number, len: number) => i >= 0 && i < len;

export function voiceRulesReducer(state: string[], action: VoiceRuleAction): string[] {
  switch (action.type) {
    case 'add':
      return [...state, ''];
    case 'edit':
      if (!inRange(action.index, state.length)) return state;
      return state.map((r, i) => (i === action.index ? action.text : r));
    case 'remove':
      if (!inRange(action.index, state.length)) return state;
      return state.filter((_, i) => i !== action.index);
    case 'move': {
      if (!inRange(action.from, state.length) || !inRange(action.to, state.length)) return state;
      const next = [...state];
      const [moved] = next.splice(action.from, 1);
      next.splice(action.to, 0, moved);
      return next;
    }
    default:
      return state;
  }
}
