export const FOCUS_PRESETS = {
  general: { name: 'General factual claims', instruction: 'Prioritize important, concrete factual statements.' },
  politics: { name: 'Politics & current events', instruction: 'Prioritize policy, elections, public figures, and current affairs.' },
  science: { name: 'Science & health', instruction: 'Prioritize scientific, medical, and health claims.' },
  economics: { name: 'Economics', instruction: 'Prioritize economic indicators, markets, and public finance.' },
  history: { name: 'History', instruction: 'Prioritize dates, events, and historical assertions.' },
  technology: { name: 'Technology', instruction: 'Prioritize technical capabilities, products, and computing claims.' },
  numbers: { name: 'Numbers & statistics', instruction: 'Prioritize quantities, rates, rankings, and comparisons.' },
  all: { name: 'All relevant claims', instruction: 'Select all important fact-checkable claims.' }
};
export function getFocus(key) { return FOCUS_PRESETS[key] || FOCUS_PRESETS.general; }
