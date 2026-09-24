import "./style.css";
import { LEVELS, advance, newGame, take, type Sushi } from "./game";
import { makePath, measure } from "./path";
const canvas = document.querySelector<HTMLCanvasElement>("#board")!;
const ctx = canvas.getContext("2d")!;
const $ = (id: string) => document.getElementById(id)!;
const progress = $("progress") as HTMLProgressElement;
const RADIUS = 36, WIDTH = 520, HEIGHT = 570;
let state = newGame();
let path = makePath(state.level.path), route = measure(path);
let waves: NonNullable<ReturnType<typeof take>>["waves"] = [];
let animationStart = 0, previous = 0;
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const waveDuration = () => reduced.matches ? 240 : 550;
const platePosition = (i: number) => ({ x: 40 + i * 440 / Math.max(1, state.level.capacity - 1), y: 510 });
function circle(
  x: number,
  y: number,
  radius: number,
  fill: string,
  stroke?: string,
  width = 2,
) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.stroke();
  }
}
function rounded(
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fill: string,
  stroke?: string,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }
}
function line(points: number[], color: string, width: number) {
  ctx.beginPath();
  ctx.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2)
    ctx.lineTo(points[i], points[i + 1]);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.stroke();
}
function sushi(
  kind: Sushi,
  p: { x: number; y: number },
  scale = 1,
  alpha = 1,
  selected = false,
) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.scale(scale, scale);
  ctx.globalAlpha = alpha;
  if (selected) circle(0, 0, RADIUS + 6, "#f9d97e", "#ba7b2b", 3);
  circle(0, 4, RADIUS, "#d5c4a5");
  circle(
    0,
    0,
    RADIUS,
    selected ? "#fff3c6" : "#fffdf5",
    selected ? "#bc883b" : "#d3c4a7",
    2.5,
  );
  circle(0, 0, RADIUS - 7, "#f5eddc");
  if (kind === "cucumber" || kind === "roe") {
    rounded(-24, -21, 48, 45, 16, "#354c3c", "#293d30");
    rounded(-20, -23, 40, 37, 14, "#fff9dc");
    if (kind === "cucumber") {
      circle(0, -5, 15, "#83b75d", "#426d3a", 3);
      line([-7, -5, 7, -5], "#e5edaa", 3);
      line([0, -12, 0, 2], "#e5edaa", 3);
    } else {
      for (const [x, y] of [
        [-10, -12],
        [3, -14],
        [12, -5],
        [-1, -3],
        [-12, 1],
        [4, 7],
      ]) {
        circle(x, y, 6.5, "#e9692e", "#a74625", 1.5);
        circle(x - 1, y - 2, 1.7, "#ffd07b");
      }
    }
  } else {
    rounded(-26, -11, 52, 34, 13, "#fffdf2", "#d8cbb0");
    if (kind === "salmon") {
      rounded(-29, -24, 58, 31, 10, "#f38d61", "#c16b48");
      for (const x of [-18, -3, 12]) line([x, -20, x + 10, 3], "#ffdab2", 4);
    } else if (kind === "tuna") {
      rounded(-29, -24, 58, 31, 10, "#ba4454", "#873b49");
      line([-18, -14, 13, -14], "#f0858b", 3);
      line([-11, -5, 21, -5], "#f0858b", 3);
    } else if (kind === "egg") {
      rounded(-29, -24, 58, 31, 6, "#f1cc4d", "#bf9933");
      rounded(-7, -25, 14, 49, 3, "#3f5140");
    } else {
      ctx.save();
      ctx.rotate(-0.22);
      rounded(-27, -23, 48, 31, 14, "#ffc3b0", "#d18470");
      for (const x of [-17, -6, 5]) line([x, -20, x + 2, 3], "#e3917b", 3);
      ctx.beginPath();
      ctx.moveTo(17, -9);
      ctx.lineTo(31, -21);
      ctx.lineTo(30, 7);
      ctx.closePath();
      ctx.fillStyle = "#e68c78";
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.restore();
}

function label(text: string, x: number, y: number, size = 18, color = "#4b5946") {
  ctx.fillStyle = color; ctx.font = `700 ${size}px system-ui`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(text, x, y);
}
function draw(now = performance.now()) {
  ctx.setTransform(canvas.width / WIDTH, 0, 0, canvas.height / HEIGHT, 0, 0);
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  for (const [width, color] of [[86, "#c4b89b"], [76, "#eee4cd"], [56, "#d9ccb0"]] as const) {
    ctx.beginPath(); path.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
    ctx.lineWidth = width; ctx.strokeStyle = color; ctx.stroke();
  }
  ctx.setLineDash([3, 18]); ctx.lineWidth = 2; ctx.strokeStyle = "#a99b7c"; ctx.stroke(); ctx.setLineDash([]);
  const first = path[0], last = path.at(-1)!;
  rounded(first.x - 48, first.y - 52, 96, 36, 12, "#566e4b");
  label("出餐口 →", first.x, first.y - 34, 16, "#fffdf3");
  label("回收", last.x, last.y + 51, 15);
  for (const piece of state.belt) sushi(piece.kind, route.at(piece.distance));
  rounded(6, 460, 508, 102, 22, "#fff9e9", "#d8c7a4");
  label(`我的盘子  ${state.plate.length}/${state.level.capacity} 格 · 从左到右入盘`, 260, 441, 17);
  const wave = waves[0];
  const t = wave ? Math.min(1, (now - animationStart) / waveDuration()) : 0;
  const plate = wave?.before ?? state.plate;
  for (let i = 0; i < state.level.capacity; i++) {
    const p = platePosition(i);
    circle(p.x, p.y, 26, "#efe8d7", "#d4c7b0");
    if (plate[i]) sushi(plate[i], p, .68, wave?.removed.includes(i) ? 1 - t : 1);
    else label(String(i + 1), p.x, p.y, 14, "#9b8c73");
  }
  if (wave) {
    rounded(173, 353 - t * 24, 174, 53, 16, "#fff2bb", "#e0ac53");
    label(`+${wave.gain}`, 260, 380 - t * 24, 32, "#b55533");
  }
}
function hud() {
  $("level").textContent = String(state.level.id);
  $("level-name").textContent = state.level.name;
  $("score").textContent = String(state.score);
  $("target").textContent = String(state.level.target);
  $("capacity").textContent = `${state.level.capacity} 格 · ${state.level.types} 种寿司`;
  progress.max = state.level.target; progress.value = state.score;
}
function finish() {
  if (state.status === "playing") return;
  const win = state.status === "win";
  $("result-title").textContent = win ? "美味大成功！" : "盘子装满啦";
  $("result-copy").textContent = win ? `收集了 ${state.score} 分${state.level.id === 5 ? "，五关全部完成！" : "，准备下一关吧！"}` : `收集了 ${state.score} / ${state.level.target} 分，再试一次吧。`;
  $("next").hidden = !win;
  $("next").textContent = state.level.id === 5 ? "从第一关再玩" : "下一关";
  $("result").hidden = false;
  (win ? $("next") : $("restart")).focus({ preventScroll: true });
}
function start(index: number) {
  state = newGame(LEVELS[index]); path = makePath(state.level.path); route = measure(path);
  waves = []; previous = 0; $("result").hidden = true;
  $("hint").textContent = "点线上任意寿司，放到盘尾 →"; hud(); draw();
}
canvas.addEventListener("pointerdown", event => {
  if (!event.isPrimary || event.button !== 0 || waves.length || state.status !== "playing") return;
  event.preventDefault();
  const box = canvas.getBoundingClientRect();
  const x = (event.clientX - box.left) * WIDTH / box.width;
  const y = (event.clientY - box.top) * HEIGHT / box.height;
  const nearest = state.belt.map(piece => ({ piece, d: Math.hypot(x - route.at(piece.distance).x, y - route.at(piece.distance).y) }))
    .filter(item => item.d <= 39).sort((a, b) => a.d - b.d)[0];
  if (!nearest) return;
  const result = take(state, nearest.piece.id);
  if (!result) return;
  waves = [...result.waves]; animationStart = performance.now();
  $("hint").textContent = waves.length ? `好吃！+${result.score} 分${waves.length > 1 ? ` · ${waves.length} 次连锁` : ""}` : "已放到盘尾，盘子不能换顺序哦";
  hud(); if (!waves.length) finish(); draw();
});
$("restart").addEventListener("click", () => start(state.level.id - 1));
$("retry").addEventListener("click", () => start(state.level.id - 1));
$("next").addEventListener("click", () => start(state.level.id % LEVELS.length));
new ResizeObserver(() => {
  const ratio = Math.min(devicePixelRatio || 1, 3);
  canvas.width = Math.round(canvas.clientWidth * ratio);
  canvas.height = Math.round(canvas.clientWidth * HEIGHT / WIDTH * ratio); draw();
}).observe(canvas);
function tick(now: number) {
  const dt = previous ? Math.min(.05, (now - previous) / 1000) : 0; previous = now;
  if (waves.length) {
    if (now - animationStart >= waveDuration()) {
      waves.shift(); animationStart = now; if (!waves.length) finish();
    }
  } else if (!document.hidden) advance(state, dt, route.length);
  draw(now); requestAnimationFrame(tick);
}
hud(); requestAnimationFrame(tick);
// Browser acceptance tests observe state; production exposes no test interface.
if (import.meta.env.DEV) Object.defineProperty(window, "__sushi", {
  get: () => structuredClone({ ...state, busy: waves.length > 0,
    positions: state.belt.map(piece => ({ id: piece.id, ...route.at(piece.distance) })) }),
});
