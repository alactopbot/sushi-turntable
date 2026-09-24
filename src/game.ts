import data from './levels.json' with { type: 'json' };
export const SIZE = 8;
export const TYPES = ['salmon', 'tuna', 'cucumber', 'egg', 'shrimp', 'roe'] as const;
export type Sushi = typeof TYPES[number];
export type Board = (Sushi | null)[];
export type Random = () => number;
export type Level = { id: number; size: number; types: number; moves: number; target: number };
export const LEVELS: readonly Level[] = data;
export type State = { level: Level; board: Board; score: number; moves: number; status: 'playing' | 'win' | 'lose' };
export type Wave = { before: Board; cleared: Board; fallen: Board; after: Board; groups: number[][]; removed: number[]; gain: number; multiplier: number };
const pick = <T>(items: readonly T[], random: Random): T => items[Math.floor(random() * items.length)];
export function points(length: number, wave = 1): number {
  return length < 3 ? 0 : 60 * (length - 2) * wave;
}
export function matches(board: readonly (Sushi | null)[]): number[][] {
  const groups: number[][] = [];
  for (const vertical of [false, true]) for (let line = 0; line < SIZE; line++) {
    const at = (offset: number) => vertical ? offset * SIZE + line : line * SIZE + offset;
    for (let start = 0; start < SIZE;) {
      let end = start + 1;
      while (end < SIZE && board[at(start)] != null && board[at(end)] === board[at(start)]) end++;
      if (board[at(start)] != null && end - start >= 3) groups.push(Array.from({ length: end - start }, (_, i) => at(start + i)));
      start = end;
    }
  }
  return groups;
}
export function generateBoard(types: number, random: Random = Math.random): Board {
  const board: Board = [];
  for (let i = 0; i < SIZE * SIZE; i++) {
    const allowed = TYPES.slice(0, types).filter(kind =>
      !(i % SIZE >= 2 && board[i - 1] === kind && board[i - 2] === kind) &&
      !(i >= SIZE * 2 && board[i - SIZE] === kind && board[i - SIZE * 2] === kind));
    board.push(pick(allowed, random));
  }
  return board;
}
export function adjacent(a: number, b: number): boolean {
  return Number.isInteger(a) && Number.isInteger(b) && a >= 0 && b >= 0 && a < 64 && b < 64 &&
    Math.abs(a % SIZE - b % SIZE) + Math.abs(Math.floor(a / SIZE) - Math.floor(b / SIZE)) === 1;
}
export function swap(board: Board, a: number, b: number): Board {
  const result = [...board];
  [result[a], result[b]] = [result[b], result[a]];
  return result;
}
export function clear(board: Board, groups = matches(board)): Board {
  const removed = new Set(groups.flat());
  return board.map((kind, i) => removed.has(i) ? null : kind);
}
export function gravity(board: Board): Board {
  const result: Board = Array(64).fill(null);
  for (let col = 0; col < SIZE; col++) {
    let bottom = SIZE - 1;
    for (let row = SIZE - 1; row >= 0; row--) {
      const kind = board[row * SIZE + col];
      if (kind !== null) result[bottom-- * SIZE + col] = kind;
    }
  }
  return result;
}
export function refill(board: Board, types: number, random: Random = Math.random): Board {
  return board.map(kind => kind ?? pick(TYPES.slice(0, types), random));
}
export function resolve(board: Board, types: number, random: Random = Math.random) {
  let current = [...board], score = 0;
  const waves: Wave[] = [];
  for (let groups = matches(current); groups.length; groups = matches(current)) {
    const multiplier = waves.length + 1;
    // Score each maximal horizontal/vertical run; clear intersections only once.
    const gain = groups.reduce((sum, group) => sum + points(group.length, multiplier), 0);
    const cleared = clear(current, groups), fallen = gravity(cleared), after = refill(fallen, types, random);
    waves.push({ before: current, cleared, fallen, after, groups, removed: [...new Set(groups.flat())], gain, multiplier });
    score += gain;
    current = after;
  }
  return { board: current, score, waves };
}
export function outcome(state: Pick<State, 'score' | 'moves' | 'level'>): State['status'] {
  return state.score >= state.level.target ? 'win' : state.moves <= 0 ? 'lose' : 'playing';
}
export function newGame(level: Level = LEVELS[0], random: Random = Math.random): State {
  return { level, board: generateBoard(level.types, random), score: 0, moves: level.moves, status: 'playing' };
}
export function playSwap(state: State, a: number, b: number, random: Random = Math.random) {
  if (state.status !== 'playing' || !adjacent(a, b)) return { valid: false, state, waves: [] as Wave[] };
  const exchanged = swap(state.board, a, b);
  if (!matches(exchanged).length) return { valid: false, state, waves: [] as Wave[] };
  const resolved = resolve(exchanged, state.level.types, random);
  const next = { ...state, board: resolved.board, score: state.score + resolved.score, moves: state.moves - 1 };
  next.status = outcome(next);
  return { valid: true, state: next, waves: resolved.waves };
}
