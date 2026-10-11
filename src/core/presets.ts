export interface Preset {
  id: string;
  name: string;
  grammar: string;
  language: string;
  description: string;
  valid: string[];
  invalid: string[];
  /** theoretical significance of individual productions, keyed "S→aSb" (ε written as "") */
  notes?: Record<string, string>;
}

export const PRESETS: Preset[] = [
  {
    id: 'team6',
    name: 'aⁿb²ⁿ (Team 6 problem)',
    grammar: 'S → aSbb | ε',
    language: 'L = { aⁿ b²ⁿ | n ≥ 0 }',
    description: 'Strings in which every a precedes every b and there are exactly twice as many b’s as a’s.',
    valid: ['aabbbb', '', 'abb', 'aaabbbbbb'],
    invalid: ['aabbb', 'abab', 'ab', 'bba'],
    notes: {
      'S→aSbb': 'Each application adds one a on the left and two b’s on the right, so #b = 2·#a is preserved and every a stays before every b.',
      'S→': 'The recursion terminates. The a’s and b’s generated so far meet in the middle, completing a string aⁿb²ⁿ.',
    },
  },
  {
    id: 'anbn',
    name: 'aⁿbⁿ',
    grammar: 'S → aSb | ε',
    language: 'L = { aⁿ bⁿ | n ≥ 0 }',
    description: 'Strings with equal numbers of a and b, with all a symbols preceding all b symbols.',
    valid: ['', 'ab', 'aabb', 'aaabbb'],
    invalid: ['aabbb', 'abb', 'ba', 'aaabb'],
    notes: {
      'S→aSb': 'The production preserves the structure required to generate strings with equal numbers of a and b: one a on the left is always balanced by one b on the right.',
      'S→': 'The recursion terminates with the empty string, leaving n a’s followed by n b’s.',
    },
  },
  {
    id: 'brackets',
    name: 'Balanced brackets',
    grammar: 'S → (S)S | ε',
    language: 'L = { w ∈ {(, )}* | w is balanced }',
    description: 'Properly nested parentheses: the classic language that needs a stack.',
    valid: ['(())()', '', '()', '()()'],
    invalid: ['(()', '())(', ')('],
    notes: {
      'S→(S)S': 'An opening bracket is paired with its closing bracket around a balanced inside, followed by another balanced string.',
      'S→': 'An empty balanced string.',
    },
  },
  {
    id: 'pal',
    name: 'Palindromes',
    grammar: 'S → aSa | bSb | a | b | ε',
    language: 'L = { w ∈ {a, b}* | w = wᴿ }',
    description: 'Strings that read the same forwards and backwards. The PDA must guess the middle.',
    valid: ['abba', 'aba', 'b', 'babbab'],
    invalid: ['ab', 'aab', 'abab'],
  },
  {
    id: 'equal',
    name: 'Equal a’s and b’s',
    grammar: 'S → aSbS | bSaS | ε',
    language: 'L = { w ∈ {a, b}* | #a(w) = #b(w) }',
    description: 'Equal counts in any order. Highly nondeterministic: a good test for the branch explorer.',
    valid: ['abba', 'baab', 'abab'],
    invalid: ['aab', 'bbba'],
  },
  {
    id: 'twovar',
    name: 'Two variables',
    grammar: 'S → aAb\nA → aAb | c',
    language: 'L = { aⁿ c bⁿ | n ≥ 1 }',
    description: 'A grammar with two variables and a centre marker c.',
    valid: ['acb', 'aacbb'],
    invalid: ['ab', 'aacb', 'c'],
  },
  {
    id: 'expr',
    name: 'Expressions (left-recursive)',
    grammar: 'E → E+T | T\nT → T*F | F\nF → (E) | x',
    language: 'L = arithmetic expressions over x with + , * and brackets',
    description: 'A left-recursive grammar. A naive top-down parser would loop; the search terminates because of sound pruning.',
    valid: ['x', 'x+x*x', '(x+x)*x'],
    invalid: ['x+', '*x', '(x'],
  },
];

export const presetById = (id: string) => PRESETS.find((p) => p.id === id);

export interface Challenge {
  presetId: string;
  input: string;
  level: 1 | 2 | 3 | 4;
}

/** Progressively harder prediction challenges. Results are computed, never stored. */
export const CHALLENGES: Challenge[] = [
  { presetId: 'anbn', input: 'aabb', level: 1 },
  { presetId: 'anbn', input: 'aabbb', level: 1 },
  { presetId: 'team6', input: 'abb', level: 1 },
  { presetId: 'team6', input: '', level: 2 },
  { presetId: 'team6', input: 'aabbb', level: 2 },
  { presetId: 'brackets', input: '(()())', level: 2 },
  { presetId: 'brackets', input: '())(()', level: 3 },
  { presetId: 'pal', input: 'abbab', level: 3 },
  { presetId: 'equal', input: 'abbaab', level: 3 },
  { presetId: 'twovar', input: 'aacb', level: 3 },
  { presetId: 'expr', input: 'x*(x+x)', level: 4 },
  { presetId: 'expr', input: 'x+*x', level: 4 },
];
