import "./style.css";
import {
  CONFIG,
  matches,
  newGame,
  outcome,
  points,
  refill,
  select,
  swap,
  type Slide,
  type Sushi,
} from "./game";

const canvas = document.querySelector<HTMLCanvasElement>("#board")!;
const ctx = canvas.getContext("2d")!;
const movesLabel = document.querySelector("#moves")!;
const scoreLabel = document.querySelector("#score")!;
const progress = document.querySelector<HTMLProgressElement>("#progress")!;
const hint = document.querySelector("#hint")!;
const result = document.querySelector<HTMLElement>("#result")!;
const restart = document.querySelector<HTMLButtonElement>("#restart")!;
let state = newGame();
const SIZE = 520,
  CENTER = 260,
  RING = 199,
  RADIUS = 43;
type Animation =
  | { kind: "swap"; pair: [number, number]; t: number }
  | { kind: "pop"; removed: number[]; t: number; gain: number; wave: number }
  | { kind: "slide"; slides: Slide[]; t: number };
let animation: Animation | null = null;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function position(index: number) {
  const angle = -Math.PI / 2 + (index * Math.PI) / 6;
  return {
    x: CENTER + Math.cos(angle) * RING,
    y: CENTER + Math.sin(angle) * RING,
  };
}
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
  index: number,
  scale = 1,
  alpha = 1,
  selected = false,
) {
  const p = position(index);
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
function draw() {
  const ratio = canvas.width / SIZE;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, SIZE, SIZE);
  circle(CENTER, CENTER + 6, 251, "#e0d0ae");
  circle(CENTER, CENTER, 251, "#eadbbc", "#d5c29a", 2);
  circle(CENTER, CENTER, 242, "#f5e9cf", "#fff8e6", 2);
  circle(CENTER, CENTER, 149, "#dfcfaa", "#cbbb95");
  circle(CENTER, CENTER, 141, "#fffaf0", "#f4ebd8", 4);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "700 13px system-ui";
  ctx.fillStyle = "#9c8a6b";
  ctx.fillText("美 味 回 转 中", CENTER, CENTER - 57);
  ctx.font = "800 33px system-ui";
  ctx.fillStyle = "#61754e";
  ctx.fillText("凑齐三个", CENTER, CENTER - 12);
  ctx.font = "600 17px system-ui";
  ctx.fillStyle = "#97846a";
  ctx.fillText("一样的，就消掉", CENTER, CENTER + 27);
  ctx.fillStyle = "#d9a753";
  ctx.font = "24px system-ui";
  ctx.fillText("✦   ✦   ✦", CENTER, CENTER + 69);
  if (animation?.kind === "slide") {
    for (const s of animation.slides) {
      const t = animation.t;
      sushi(
        s.sushi,
        s.from + (s.to - s.from) * t,
        s.fresh ? 0.6 + t * 0.4 : 1,
        s.fresh ? t : 1,
      );
    }
  } else {
    state.board.forEach((kind, i) => {
      let index = i,
        scale = 1,
        alpha = 1;
      if (animation?.kind === "swap") {
        const [a, b] = animation.pair;
        const delta = b - a === 11 ? -1 : b - a === -11 ? 1 : b - a;
        if (i === a) index += delta * animation.t;
        if (i === b) index -= delta * animation.t;
      }
      if (animation?.kind === "pop" && animation.removed.includes(i)) {
        scale = 1 + Math.sin(animation.t * Math.PI) * 0.3;
        alpha = 1 - animation.t;
      }
      sushi(kind, index, scale, alpha, state.selected === i);
    });
  }
  if (animation?.kind === "pop") {
    ctx.save();
    ctx.globalAlpha = 1 - Math.max(0, animation.t - 0.7) / 0.3;
    rounded(170, 224 - animation.t * 28, 180, 69, 20, "#fff3c6", "#dfb461");
    ctx.fillStyle = "#b95a33";
    ctx.font = "900 36px system-ui";
    ctx.fillText(`+${animation.gain}`, CENTER, 259 - animation.t * 28);
    ctx.restore();
  }
}
function resize() {
  const size = Math.round(
    canvas.getBoundingClientRect().width *
      Math.min(window.devicePixelRatio || 1, 3),
  );
  canvas.width = size;
  canvas.height = size;
  draw();
}
new ResizeObserver(resize).observe(canvas);
function hud() {
  movesLabel.textContent = String(state.moves);
  scoreLabel.textContent = String(state.score);
  progress.value = state.score;
}
async function animate(frame: Animation, duration: number) {
  const start = performance.now();
  const length = reducedMotion.matches ? Math.min(duration, 100) : duration;
  await new Promise<void>((resolve) => {
    function tick(now: number) {
      const linear = Math.min(1, (now - start) / length);
      frame.t = linear * linear * (3 - 2 * linear);
      animation = frame;
      draw();
      if (linear < 1) requestAnimationFrame(tick);
      else resolve();
    }
    requestAnimationFrame(tick);
  });
  animation = null;
}
async function play(pair: [number, number]) {
  hud();
  hint.textContent = "寿司换个位置…";
  await animate({ kind: "swap", pair, t: 0 }, 200);
  state.board = swap(state.board, ...pair);
  let wave = 1;
  for (
    let groups = matches(state.board);
    groups.length;
    groups = matches(state.board)
  ) {
    const gain = groups.reduce((sum, g) => sum + points(g.length, wave), 0);
    state.score += gain;
    hud();
    hint.textContent =
      wave === 1 ? "好吃！凑到一起啦" : `好吃！连续消掉 ${wave} 次`;
    await animate(
      { kind: "pop", removed: groups.flat(), gain, wave, t: 0 },
      430,
    );
    const next = refill(state.board, groups);
    await animate({ kind: "slide", slides: next.slides, t: 0 }, 360);
    state.board = next.board;
    wave++;
  }
  state.busy = false;
  const ending = outcome(state);
  hint.textContent = ending
    ? "再来一盘，发现新的美味"
    : wave > 1
      ? "好吃！再找找三个一样的"
      : "换相邻的，每换一次用一步";
  if (ending) {
    document.querySelector("#result-icon")!.textContent =
      ending === "win" ? "★ ★ ★" : "♡";
    document.querySelector("#result-title")!.textContent =
      ending === "win" ? "美味大成功！" : "这一盘吃完啦";
    document.querySelector("#result-copy")!.textContent =
      ending === "win"
        ? `收集了 ${state.score} 分，好吃！`
        : `收集了 ${state.score} 分，再试试凑到 300 分吧`;
    result.hidden = false;
    restart.focus({ preventScroll: true });
  }
  draw();
}
canvas.addEventListener("pointerdown", (event) => {
  if (!event.isPrimary || event.button !== 0 || state.busy || outcome(state))
    return;
  event.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) * SIZE) / rect.width,
    y = ((event.clientY - rect.top) * SIZE) / rect.height;
  let best = -1,
    distance = Infinity;
  for (let i = 0; i < CONFIG.slots; i++) {
    const p = position(i),
      d = Math.hypot(x - p.x, y - p.y);
    if (d <= RADIUS * 1.14 && d < distance) {
      best = i;
      distance = d;
    }
  }
  if (best < 0) return;
  const pair = select(state, best);
  if (pair) void play(pair);
  else {
    hint.textContent =
      state.selected === null
        ? "点一格，再点旁边的一格"
        : "选好啦，点它旁边的寿司";
    draw();
  }
});
restart.addEventListener("click", () => {
  state = newGame();
  animation = null;
  result.hidden = true;
  hint.textContent = "点一格，再点旁边的一格";
  hud();
  draw();
});
hud();
resize();

// Read-only snapshots let browser acceptance tests play through actual pointers.
if (import.meta.env.DEV) {
  Object.defineProperty(window, "__sushi", {
    get: () => structuredClone(state),
  });
}
