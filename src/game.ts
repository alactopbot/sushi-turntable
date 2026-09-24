import data from "./levels.json";
export const TYPES = ["salmon", "tuna", "cucumber", "egg", "shrimp", "roe"] as const;
export type Sushi = (typeof TYPES)[number];
export type Level = { id: number; name: string; capacity: number; types: number; target: number; maxOnBelt: number; spawnMs: number; speed: number; path: string };
// Frozen v2.1 level values; speed and path geometry are presentation settings.
export const LEVELS: readonly Level[] = data;
export type Piece = { id: number; kind: Sushi; distance: number };
export type State = { level: Level; plate: Sushi[]; belt: Piece[]; score: number; status: "playing" | "win" | "lose"; elapsed: number; nextId: number; served: number; recycled: number };
export function points(length: number, wave = 1): number {
  return length < 3 ? 0 : 60 * (length - 2) * wave;
}
export function matches(plate: readonly Sushi[]): number[][] {
  const groups: number[][] = [];
  for (let start = 0; start < plate.length;) {
    let end = start + 1;
    while (end < plate.length && plate[end] === plate[start]) end++;
    if (end - start >= 3) groups.push(Array.from({ length: end - start }, (_, i) => start + i));
    start = end;
  }
  return groups;
}
export function resolve(plate: readonly Sushi[]) {
  let remaining = [...plate], score = 0;
  const waves: { before: Sushi[]; removed: number[]; gain: number }[] = [];
  for (let groups = matches(remaining); groups.length; groups = matches(remaining)) {
    const removed = groups.flat();
    const gain = groups.reduce((sum, group) => sum + points(group.length, waves.length + 1), 0);
    waves.push({ before: remaining, removed, gain });
    score += gain;
    remaining = remaining.filter((_, i) => !removed.includes(i));
  }
  return { plate: remaining, score, waves };
}
export function outcome(state: Pick<State, "score" | "plate" | "level">): State["status"] {
  if (state.score >= state.level.target) return "win";
  return state.plate.length >= state.level.capacity && !matches(state.plate).length ? "lose" : "playing";
}
export function newGame(level: Level = LEVELS[0]): State {
  return { level, plate: [], belt: [], score: 0, status: "playing", elapsed: level.spawnMs, nextId: 1, served: 0, recycled: 0 };
}
export function take(state: State, id: number) {
  const index = state.belt.findIndex(piece => piece.id === id);
  if (state.status !== "playing" || state.plate.length >= state.level.capacity || index < 0) return null;
  const [piece] = state.belt.splice(index, 1);
  const result = resolve([...state.plate, piece.kind]);
  state.plate = result.plate;
  state.score += result.score;
  state.status = outcome(state);
  return result;
}
export function advance(state: State, seconds: number, pathLength: number) {
  if (state.status !== "playing" || seconds < 0) return;
  state.belt.forEach(piece => piece.distance += state.level.speed * seconds);
  const live = state.belt.filter(piece => piece.distance <= pathLength);
  state.recycled += state.belt.length - live.length;
  state.belt = live;
  state.elapsed += seconds * 1000;
  // Cycling supply guarantees every allowed type returns; waiting never causes failure.
  // Spacing protects large touch targets; a blocked outlet waits instead of piling up.
  if (state.elapsed >= state.level.spawnMs && state.belt.length < state.level.maxOnBelt && state.belt.every(piece => piece.distance >= 82)) {
    state.belt.push({ id: state.nextId++, kind: TYPES[state.served++ % state.level.types], distance: 0 });
    state.elapsed = 0;
  }
}
