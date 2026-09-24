import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CONFIG,
  TYPES,
  adjacent,
  hasMove,
  initialBoard,
  matches,
  newGame,
  outcome,
  points,
  refill,
  select,
  swap,
  type Sushi,
} from "../src/game";

const s: Sushi = "salmon",
  t: Sushi = "tuna",
  c: Sushi = "cucumber",
  e: Sushi = "egg",
  h: Sushi = "shrimp",
  r: Sushi = "roe";
const board: Sushi[] = [s, s, t, s, e, h, r, c, t, e, h, c];
function seeded(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

test("R1/R2/R5: selection never clears; only adjacent swaps spend a move, including zero-clear and same-kind swaps", () => {
  const state = newGame();
  state.board = [...board];
  assert.equal(select(state, 0), null);
  assert.equal(state.moves, 20);
  assert.deepEqual(state.board, board);
  assert.equal(select(state, 5), null);
  assert.equal(state.selected, 5);
  assert.equal(state.moves, 20);
  assert.deepEqual(select(state, 6), [5, 6]);
  assert.equal(state.moves, 19);
  assert.equal(matches(swap(board, 5, 6)).length, 0);
  assert.equal(select(state, 7), null);
  assert.equal(state.moves, 19);
  state.busy = false;
  state.selected = null;
  select(state, 0);
  assert.deepEqual(select(state, 1), [0, 1]);
  assert.equal(state.moves, 18);
  assert.equal(select(state, 12), null);
});
test("R1: ring boundary adjacency and complete maximal runs", () => {
  assert.ok(adjacent(11, 0));
  assert.ok(adjacent(0, 11));
  assert.ok(!adjacent(0, 10));
  assert.deepEqual(matches([s, s, t, c, e, h, r, t, e, c, h, s]), [[11, 0, 1]]);
  assert.deepEqual(matches([s, s, s, s, s, s, s, s, s, s, s, s]), [
    Array.from({ length: 12 }, (_, i) => i),
  ]);
  assert.deepEqual(matches([s, s, s, s, t, c, e, h, r, t, c, e]), [
    [0, 1, 2, 3],
  ]);
  assert.equal(matches(board).length, 0);
  assert.deepEqual(matches(swap(board, 2, 3)), [[0, 1, 2]]);
});
test("R3: clockwise-side survivors slide along the ring; refill enters at the top seam", () => {
  const source: Sushi[] = [s, s, s, t, c, e, h, r, t, c, e, h];
  const next = refill(source, matches(source), () => 0.9);
  assert.deepEqual(next.board, [t, c, e, h, r, t, c, e, h, r, r, r]);
  assert.deepEqual(next.slides[0], { sushi: t, from: 3, to: 0, fresh: false });
  assert.deepEqual(next.slides[9], { sushi: r, from: 12, to: 9, fresh: true });
  assert.ok(next.slides.every((x) => x.from >= x.to));
  const wrapped: Sushi[] = [s, s, t, c, e, h, r, t, e, c, h, s];
  assert.deepEqual(refill(wrapped, matches(wrapped), () => 0.9).board, [
    t,
    c,
    e,
    h,
    r,
    t,
    e,
    c,
    h,
    r,
    r,
    r,
  ]);
});
test("R4: simultaneous groups share a wave multiplier; refill produces a second wave", () => {
  const source: Sushi[] = [s, s, s, t, t, t, c, e, h, r, c, e];
  const groups = matches(source);
  assert.deepEqual(groups, [
    [0, 1, 2],
    [3, 4, 5],
  ]);
  assert.equal(
    groups.reduce((sum, g) => sum + points(g.length, 1), 0),
    60,
  );
  const next = refill(source, groups, () => 0.9);
  assert.deepEqual(matches(next.board), [[6, 7, 8, 9, 10, 11]]);
  assert.equal(points(6, 2), 114);
});
test("scoring: 3/4/5/6, every extra piece, wave scaling and x2 cap", () => {
  assert.deepEqual(
    [3, 4, 5, 6, 12].map((n) => points(n, 1)),
    [30, 50, 80, 95, 185],
  );
  assert.deepEqual(
    [1, 2, 3, 4, 5, 6, 7, 20].map((n) => points(3, n)),
    [30, 36, 42, 48, 54, 60, 60, 60],
  );
});
test("R6/R7/R9: 1000 fresh boards have six allowed IDs, no existing matches and a scoring move", () => {
  assert.equal(TYPES.length, 6);
  assert.deepEqual(CONFIG, { slots: 12, moves: 20, target: 300 });
  const random = seeded(81);
  for (let i = 0; i < 1000; i++) {
    const opening = initialBoard(random);
    assert.equal(opening.length, 12);
    assert.ok(opening.every((x) => TYPES.includes(x)));
    assert.equal(matches(opening).length, 0);
    assert.ok(hasMove(opening));
  }
  assert.ok(hasMove(initialBoard(() => 0)));
});
test("R8/S3: victory including final move; failure and reset", () => {
  assert.equal(outcome({ moves: 1, score: 300 }), "win");
  assert.equal(outcome({ moves: 0, score: 300 }), "win");
  assert.equal(outcome({ moves: 0, score: 299 }), "lose");
  assert.equal(outcome({ moves: 1, score: 299 }), null);
  const state = newGame();
  assert.equal(state.moves, 20);
  assert.equal(state.score, 0);
  assert.equal(state.busy, false);
  assert.equal(state.selected, null);
  state.moves = 0;
  assert.equal(select(state, 0), null);
});
