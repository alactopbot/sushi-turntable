export type Position = { x: number; y: number };
// Sampled cubic geometry in a 520 × 450 kitchen.
export function makePath(kind: string): Position[] {
  const segments = kind === "gentle"
    ? [[70,90, 120,90, 175,90, 220,90], [220,90, 480,90, 470,285, 290,285], [290,285, 210,285, 145,285, 70,285]]
    : kind === "long"
    ? [[70,75, 480,75, 480,230, 270,230], [270,230, 20,230, 30,370, 450,370]]
    : [[70,65, 180,65, 325,65, 400,65], [400,65, 490,65, 490,200, 400,200], [400,200, 320,200, 190,200, 120,200], [120,200, 25,200, 25,kind === "deep" ? 390 : kind === "extended" ? 365 : 340, 130,kind === "deep" ? 390 : kind === "extended" ? 365 : 340], [130,kind === "deep" ? 390 : kind === "extended" ? 365 : 340, 230,kind === "deep" ? 390 : kind === "extended" ? 365 : 340, 360,kind === "deep" ? 390 : kind === "extended" ? 365 : 340, 450,kind === "deep" ? 390 : kind === "extended" ? 365 : 340]];
  return segments.flatMap(s => Array.from({ length: 61 }, (_, i) => {
    const t = i / 60, u = 1 - t;
    return { x: u*u*u*s[0] + 3*u*u*t*s[2] + 3*u*t*t*s[4] + t*t*t*s[6], y: u*u*u*s[1] + 3*u*u*t*s[3] + 3*u*t*t*s[5] + t*t*t*s[7] };
  }));
}
export function measure(path: Position[]) {
  const distances = [0];
  for (let i = 1; i < path.length; i++) distances.push(distances[i-1] + Math.hypot(path[i].x-path[i-1].x, path[i].y-path[i-1].y));
  return { length: distances.at(-1)!, at(distance: number): Position {
    const i = distances.findIndex(d => d >= distance);
    if (i <= 0) return i === 0 ? path[0] : path.at(-1)!;
    const t = (distance-distances[i-1])/(distances[i]-distances[i-1]);
    return { x: path[i-1].x+(path[i].x-path[i-1].x)*t, y: path[i-1].y+(path[i].y-path[i-1].y)*t };
  } };
}
