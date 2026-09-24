import test from 'node:test';
import assert from 'node:assert/strict';
import { SIZE, TYPES, LEVELS, points, matches, generateBoard, adjacent, swap, clear, gravity, refill, resolve, outcome, newGame, playSwap, type Board } from '../src/game';
function seeded(seed: number) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; }
function fixture(): Board {
  const board = Array.from({ length: 64 }, (_, i) => TYPES[(Math.floor(i / 8) + i % 8) % 4]);
  board[0] = board[1] = board[10] = 'salmon'; board[2] = 'tuna';
  return board;
}
function sequence(values: number[]) { let i = 0; return () => { assert.ok(i < values.length, 'unexpected refill'); return values[i++]; }; }
const stableRefill = () => sequence([.3, .55, .8]);
test('exact frozen five-level table', () => {
  assert.deepEqual(LEVELS, [
    { id: 1, size: 8, types: 4, moves: 30, target: 800 },
    { id: 2, size: 8, types: 5, moves: 26, target: 1400 },
    { id: 3, size: 8, types: 5, moves: 24, target: 2000 },
    { id: 4, size: 8, types: 6, moves: 22, target: 2600 },
    { id: 5, size: 8, types: 6, moves: 20, target: 3200 },
  ]);
});
test('3/4/5/6+ scoring and wave multipliers', () => {
  for (const [length, score] of [[2, 0], [3, 60], [4, 120], [5, 180], [6, 240], [7, 300], [8, 360]]) {
    for (let wave = 1; wave <= 4; wave++) assert.equal(points(length, wave), score * wave);
  }
});
test('opening boards are full, stable, and restricted to the level type set', () => {
  for (const level of LEVELS) for (let seed = 0; seed < 100; seed++) {
    const game = newGame(level, seeded(seed));
    assert.equal(game.board.length, SIZE * SIZE); assert.deepEqual(matches(game.board), []);
    assert.ok(game.board.every(kind => TYPES.slice(0, level.types).includes(kind!)));
    assert.equal(game.score, 0); assert.equal(game.moves, level.moves); assert.equal(game.status, 'playing');
  }
  assert.equal(matches(generateBoard(4, () => 0)).length, 0);
});
test('matches are maximal horizontal/vertical runs, not diagonals or row wraps', () => {
  const board: Board = Array(64).fill(null);
  for (const i of [0, 1, 2, 3, 4, 5, 6, 7, 8, 16, 24]) board[i] = 'salmon';
  assert.deepEqual(matches(board), [[0, 1, 2, 3, 4, 5, 6, 7], [0, 8, 16, 24]]);
  assert.equal(clear(board).filter(Boolean).length, 0);
  const diagonal: Board = Array(64).fill(null);
  [0, 9, 18, 7, 8].forEach(i => diagonal[i] = 'egg');
  assert.deepEqual(matches(diagonal), []);
});
test('simultaneous crossing runs score separately, intersections clear once', () => {
  const board: Board = Array.from({ length: 64 }, (_, i) => TYPES[(Math.floor(i / 8) + i % 8) % 4]);
  [18, 19, 20, 11, 27].forEach(i => board[i] = 'roe');
  const result = resolve(board, 6, seeded(8));
  assert.deepEqual(result.waves[0].groups, [[18, 19, 20], [11, 19, 27]]);
  assert.equal(result.waves[0].gain, 120); assert.equal(result.waves[0].removed.length, 5);
});
test('orthogonal adjacency rejects diagonals, wraps and out-of-range coordinates', () => {
  assert.ok(adjacent(0, 1)); assert.ok(adjacent(0, 8));
  for (const [a, b] of [[0, 9], [7, 8], [0, 0], [-1, 0], [63, 64], [1.5, 2.5]]) assert.equal(adjacent(a, b), false);
});
test('invalid swap snaps back without mutating state, consuming RNG or a move', () => {
  const state = { ...newGame(), board: fixture() }, before = structuredClone(state);
  for (const [a, b] of [[62, 63], [0, 9], [7, 8], [0, 0]]) {
    const result = playSwap(state, a, b, () => { throw Error('invalid swap must not refill'); });
    assert.equal(result.valid, false); assert.deepEqual(result.state, before); assert.deepEqual(state, before);
  }
});
test('valid swap clears, refills and costs exactly one move without mutating input', () => {
  const state = { ...newGame(), board: fixture() }, before = structuredClone(state);
  assert.equal(matches(state.board).length, 0);
  const result = playSwap(state, 2, 10, stableRefill());
  assert.ok(result.valid); assert.equal(result.state.moves, 29); assert.equal(result.state.score, 60);
  assert.equal(result.waves.length, 1); assert.deepEqual(matches(result.state.board), []); assert.deepEqual(state, before);
});
test('cascade is the same swap: wave 2 multiplier, no extra move', () => {
  const state = { ...newGame(), board: fixture() };
  const result = playSwap(state, 2, 10, sequence([0, 0, 0, .3, .55, .8]));
  assert.equal(result.waves.length, 2); assert.deepEqual(result.waves.map(w => w.gain), [60, 120]);
  assert.deepEqual(result.waves.map(w => w.multiplier), [1, 2]);
  assert.equal(result.state.score, 180); assert.equal(result.state.moves, 29);
  assert.equal(matches(result.state.board).length, 0);
});
test('gravity preserves survivor order, then fills only top holes', () => {
  const board: Board = Array(64).fill('egg');
  board[0] = 'salmon'; board[8] = null; board[16] = 'tuna'; board[24] = null;
  const fallen = gravity(board);
  assert.deepEqual(Array.from({ length: 8 }, (_, row) => fallen[row * 8]), [null, null, 'salmon', 'tuna', 'egg', 'egg', 'egg', 'egg']);
  const filled = refill(fallen, 4, sequence([.55, .3]));
  assert.equal(filled[0], 'cucumber'); assert.equal(filled[8], 'tuna'); assert.equal(filled[16], 'salmon');
  assert.equal(board[8], null); assert.equal(fallen[8], null);
});
test('last move loses below target, wins at target, and win takes precedence', () => {
  const state = { ...newGame(), board: fixture(), moves: 1 };
  assert.equal(playSwap(state, 2, 10, stableRefill()).state.status, 'lose');
  const win = playSwap({ ...state, score: 740 }, 2, 10, stableRefill()).state;
  assert.equal(win.score, 800); assert.equal(win.moves, 0); assert.equal(win.status, 'win');
  assert.equal(outcome({ ...state, score: 800, moves: 12 }), 'win');
  assert.equal(outcome({ ...state, score: 799, moves: 0 }), 'lose');
  assert.equal(outcome({ ...state, score: 799 }), 'playing');
});
test('target reached before moves run out wins, terminal states reject input', () => {
  const state = { ...newGame(), board: fixture(), score: 740 };
  const win = playSwap(state, 2, 10, stableRefill()).state;
  assert.equal(win.status, 'win'); assert.equal(win.moves, 29);
  for (const status of ['win', 'lose'] as const) assert.equal(playSwap({ ...state, status }, 2, 10).valid, false);
});
test('swapping is immutable', () => {
  const board = fixture(), before = [...board], exchanged = swap(board, 2, 10);
  assert.deepEqual(board, before); assert.equal(exchanged[2], before[10]); assert.equal(exchanged[10], before[2]);
});
