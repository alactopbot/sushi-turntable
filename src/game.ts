export const TYPES = [
  "salmon",
  "tuna",
  "cucumber",
  "egg",
  "shrimp",
  "roe",
] as const;
export type Sushi = (typeof TYPES)[number];
export const CONFIG = { slots: 12, moves: 20, target: 300 } as const;
export type Random = () => number;
export type State = {
  board: Sushi[];
  moves: number;
  score: number;
  selected: number | null;
  busy: boolean;
};
export const randomSushi = (random: Random): Sushi =>
  TYPES[Math.floor(random() * TYPES.length)];
export const adjacent = (
  a: number,
  b: number,
  length = CONFIG.slots,
): boolean =>
  a !== b && (Math.abs(a - b) === 1 || Math.abs(a - b) === length - 1);

export function matches(board: readonly Sushi[]): number[][] {
  const n = board.length;
  if (n < 3) return [];
  const start = board.findIndex((s, i) => s !== board[(i + n - 1) % n]);
  if (start === -1) return [Array.from({ length: n }, (_, i) => i)];
  const groups: number[][] = [];
  let run: number[] = [];
  for (let k = 0; k < n; k++) {
    const i = (start + k) % n;
    if (run.length && board[i] !== board[run[0]]) {
      if (run.length >= 3) groups.push(run);
      run = [];
    }
    run.push(i);
  }
  if (run.length >= 3) groups.push(run);
  return groups;
}

export function swap(board: readonly Sushi[], a: number, b: number): Sushi[] {
  const next = [...board];
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}

export function hasMove(board: readonly Sushi[]): boolean {
  return board.some(
    (_, i) => matches(swap(board, i, (i + 1) % board.length)).length > 0,
  );
}

export function initialBoard(random: Random = Math.random): Sushi[] {
  for (let attempt = 0; attempt < 500; attempt++) {
    const board = Array.from({ length: CONFIG.slots }, () =>
      randomSushi(random),
    );
    if (!matches(board).length && hasMove(board)) return board;
  }
  // Bounded fallback also guarantees a playable opening for a constant RNG.
  return [
    "salmon",
    "salmon",
    "tuna",
    "salmon",
    "egg",
    "shrimp",
    "roe",
    "cucumber",
    "tuna",
    "egg",
    "shrimp",
    "cucumber",
  ];
}

export function newGame(random: Random = Math.random): State {
  return {
    board: initialBoard(random),
    moves: CONFIG.moves,
    score: 0,
    selected: null,
    busy: false,
  };
}

export function outcome(
  state: Pick<State, "score" | "moves">,
): "win" | "lose" | null {
  return state.score >= CONFIG.target
    ? "win"
    : state.moves === 0
      ? "lose"
      : null;
}

export function select(state: State, index: number): [number, number] | null {
  if (
    state.busy ||
    outcome(state) ||
    !Number.isInteger(index) ||
    index < 0 ||
    index >= CONFIG.slots
  )
    return null;
  const previous = state.selected;
  if (previous === null || !adjacent(previous, index)) {
    state.selected = previous === index ? null : index;
    return null;
  }
  state.selected = null;
  state.moves--;
  state.busy = true;
  return [previous, index];
}

export function points(length: number, wave: number): number {
  const base =
    length < 3
      ? 0
      : length === 3
        ? 30
        : length === 4
          ? 50
          : 80 + (length - 5) * 15;
  return Math.round(base * Math.min(2, 1 + 0.2 * (wave - 1)));
}

export type Slide = { sushi: Sushi; from: number; to: number; fresh: boolean };
export function refill(
  board: readonly Sushi[],
  groups: number[][],
  random: Random = Math.random,
): { board: Sushi[]; slides: Slide[] } {
  const removed = new Set(groups.flat());
  const slides: Slide[] = [];
  // Indices increase clockwise from the top. Clockwise neighbours slide back
  // into gaps; new pieces enter across the top seam (12 -> 11 -> ...).
  board.forEach((sushi, from) => {
    if (!removed.has(from))
      slides.push({ sushi, from, to: slides.length, fresh: false });
  });
  let incoming = 0;
  while (slides.length < board.length) {
    slides.push({
      sushi: randomSushi(random),
      from: board.length + incoming++,
      to: slides.length,
      fresh: true,
    });
  }
  return { board: slides.map((s) => s.sushi), slides };
}
