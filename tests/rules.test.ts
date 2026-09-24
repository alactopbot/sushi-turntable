import { test } from "node:test";
import assert from "node:assert/strict";
import { LEVELS, TYPES, advance, matches, newGame, outcome, points, resolve, take, type Sushi } from "../src/game";
import { makePath, measure } from "../src/path";
const s: Sushi = "salmon", t: Sushi = "tuna", c: Sushi = "cucumber";
test("frozen five-level table", () => {
  assert.deepEqual(LEVELS.map(l => [l.capacity,l.types,l.target,l.maxOnBelt,l.spawnMs]), [
    [8,3,180,4,1200],[7,4,300,5,1100],[6,4,420,5,1000],[6,5,540,6,900],[5,5,660,6,800],
  ]);
  const lengths = LEVELS.map(l => measure(makePath(l.path)).length);
  assert.ok(lengths.every((length, i) => !i || length > lengths[i-1]));
});
test("take any visible piece into the right tail; preserve order and reject missing IDs", () => {
  const state = newGame(); state.plate = [s,t];
  state.belt = [s,c,t].map((kind,i) => ({kind,id:i+1,distance:i*90}));
  assert.ok(take(state,2)); assert.deepEqual(state.plate,[s,t,c]);
  assert.deepEqual(state.belt.map(p=>p.id),[1,3]);
  const before = structuredClone(state); assert.equal(take(state,2),null); assert.deepEqual(state,before);
});
test("capacity blocks pickup; the last free slot may clear before loss", () => {
  const state = newGame(); state.plate = [s,t,s,t,s,t,s,t];
  state.belt = [{id:1,kind:t,distance:0}];
  const before = structuredClone(state); assert.equal(take(state,1),null); assert.deepEqual(state,before);
  assert.equal(outcome(state),"lose");
  state.plate = [s,t,s,t,s,t,t]; assert.ok(take(state,1));
  assert.deepEqual(state.plate,[s,t,s,t,s]); assert.equal(state.score,60); assert.equal(state.status,"playing");
});
test("linear maximal runs, simultaneous clear, then splice with wave multipliers", () => {
  assert.deepEqual(matches([s,s,t,s]),[]);
  const original = [s,s,t,t,t,s];
  const result = resolve(original);
  assert.deepEqual(original,[s,s,t,t,t,s]);
  assert.deepEqual(result.plate,[]); assert.deepEqual(result.waves.map(w=>w.gain),[60,120]);
  assert.equal(result.score,180);
  assert.deepEqual(resolve([s,s,s,t,t,t]).waves.map(w=>w.gain),[120]);
  const triple = resolve([s,s,t,t,c,c,c,t,s]);
  assert.deepEqual(triple.waves.map(w=>w.gain),[60,120,180]);
});
test("exact 3/4/5/6+ scores and uncapped wave n scaling", () => {
  assert.deepEqual([2,3,4,5,6,8].map(n=>points(n)),[0,60,120,180,240,360]);
  assert.deepEqual([1,2,3,4,10].map(n=>points(3,n)),[60,120,180,240,600]);
  for (const length of [3,4,5,6,8]) assert.equal(resolve(Array(length).fill(s)).score,points(length));
});
test("target wins, full unmatchable plate loses, terminal input freezes, new game resets", () => {
  const state = newGame(); state.score = 120; state.plate = [s,s]; state.belt = [{id:1,kind:s,distance:0}];
  take(state,1); assert.equal(state.status,"win"); assert.equal(state.score,180);
  const before = structuredClone(state); advance(state,10,800); assert.equal(take(state,1),null); assert.deepEqual(state,before);
  assert.equal(outcome({...state,score:0,plate:[s,t,s,t,s,t,s,t]}),"lose");
  assert.equal(outcome({...state,score:0,plate:[s,s,s,t,s,t,s,t]}),"playing");
  assert.equal(outcome({...state,score:180,plate:[s,t,s,t,s,t,s,t]}),"win");
  const fresh=newGame(LEVELS[1]); assert.equal(fresh.score,0); assert.deepEqual(fresh.plate,[]); assert.equal(fresh.status,"playing");
});
test("spawn cadence, cap, allowed types, movement and harmless recycling at every level", () => {
  for (const level of LEVELS) {
    const state=newGame(level); const length=measure(makePath(level.path)).length;
    advance(state,0,length); assert.equal(state.belt.length,1);
    advance(state,level.spawnMs/1000-.01,length); assert.equal(state.belt.length,1);
    advance(state,.011,length); assert.equal(state.belt.length,2);
    for(let i=0;i<5000;i++) {
      advance(state,.02,length); assert.ok(state.belt.length<=level.maxOnBelt);
      assert.ok(state.belt.every(p=>TYPES.slice(0,level.types).includes(p.kind)));
    }
    assert.ok(state.recycled>0); assert.equal(state.score,0); assert.equal(state.status,"playing");
  }
});
