import './style.css';
import { LEVELS, adjacent, newGame, playSwap, swap, type Board, type Sushi, type State, type Wave } from './game';
const $ = (id: string) => document.getElementById(id)!;
const boardElement = $('board');
const progress = $('progress') as HTMLProgressElement;
const names: Record<Sushi, string> = { salmon: '三文鱼', tuna: '金枪', cucumber: '黄瓜卷', egg: '玉子', shrimp: '虾', roe: '鱼籽' };
let state = newGame(), selected: number | null = null, busy = false, generation = 0;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const duration = (ms: number) => reduced.matches ? 30 : ms;
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, duration(ms)));
// Local vector art keeps all six skins crisp, distinct, and available offline.
function sushi(kind: Sushi) {
  let top = '';
  if (kind === 'cucumber' || kind === 'roe') {
    top = '<rect x="10" y="13" width="44" height="42" rx="15" fill="#263f32"/><ellipse cx="32" cy="29" rx="22" ry="18" fill="#fffbdf"/>';
    top += kind === 'cucumber'
      ? '<ellipse cx="32" cy="28" rx="14" ry="12" fill="#69ad3c" stroke="#36702b" stroke-width="3"/><path d="M24 28h16M32 21v14" stroke="#e8ef9f" stroke-width="4" stroke-linecap="round"/>'
      : [[22, 23], [34, 20], [43, 28], [31, 31], [21, 34], [38, 39]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="6" fill="#ec6226" stroke="#b63f20" stroke-width="1.5"/><circle cx="${x - 1}" cy="${y - 2}" r="1.6" fill="#ffcf82"/>`).join('');
  } else {
    top = '<rect x="9" y="24" width="46" height="29" rx="12" fill="#fffdf1" stroke="#d6cbb0" stroke-width="2"/>';
    if (kind === 'salmon') top += '<rect x="6" y="12" width="52" height="27" rx="10" fill="#f18755" stroke="#b9633d" stroke-width="2"/><path d="m15 14 10 23m4-23 10 23m4-23 10 21" stroke="#ffe1b6" stroke-width="4"/>';
    if (kind === 'tuna') top += '<rect x="6" y="12" width="52" height="27" rx="10" fill="#b82f4f" stroke="#852740" stroke-width="2"/><path d="M15 21h30M22 30h28" stroke="#ec8291" stroke-width="3" stroke-linecap="round"/>';
    if (kind === 'egg') top += '<rect x="6" y="12" width="52" height="28" rx="6" fill="#f7d547" stroke="#bc9427" stroke-width="2"/><path d="M14 18h13" stroke="#fff09d" stroke-width="3"/><rect x="28" y="11" width="12" height="42" rx="2" fill="#304839"/>';
    if (kind === 'shrimp') top += '<path d="m46 25 13-13-1 26Z" fill="#e17c66"/><rect x="6" y="12" width="44" height="28" rx="14" fill="#ffbea7" stroke="#c37662" stroke-width="2"/><path d="m16 15 3 21m8-23 3 24m8-21 3 18" stroke="#e68b73" stroke-width="3"/>';
  }
  return `<svg viewBox="0 0 64 64" aria-hidden="true">${top}<circle cx="26" cy="46" r="1.5" fill="#354638"/><circle cx="39" cy="46" r="1.5" fill="#354638"/><path d="M30 48q2 3 4 0" fill="none" stroke="#354638" stroke-width="1.5" stroke-linecap="round"/></svg>`;
}
const cells = Array.from({ length: 64 }, (_, i) => {
  const button = document.createElement('button');
  button.type = 'button'; button.className = 'cell'; button.dataset.index = String(i);
  button.addEventListener('click', () => void select(i));
  boardElement.append(button);
  return button;
});
function render(board: Board = state.board) {
  cells.forEach((cell, i) => {
    cell.innerHTML = board[i] ? sushi(board[i]!) : '';
    cell.classList.toggle('selected', selected === i);
    cell.setAttribute('aria-pressed', String(selected === i));
    cell.setAttribute('aria-label', `${Math.floor(i / 8) + 1}行${i % 8 + 1}列 ${board[i] ? names[board[i]!] : '空格'}`);
  });
}
function hud(score = state.score, moves = state.moves) {
  $('level').textContent = String(state.level.id);
  $('score').textContent = String(score); $('target').textContent = String(state.level.target);
  $('moves').textContent = String(moves);
  $('types').textContent = `8×8 · ${state.level.types} 种寿司`;
  progress.max = state.level.target; progress.value = score;
}
async function animateSwap(a: number, b: number) {
  const first = cells[a].getBoundingClientRect(), second = cells[b].getBoundingClientRect();
  const dx = second.x - first.x, dy = second.y - first.y;
  await Promise.all([a, b].map((index, n) => cells[index].querySelector('svg')!.animate([
    { transform: 'translate(0, 0)' }, { transform: `translate(${dx * (n ? -1 : 1)}px, ${dy * (n ? -1 : 1)}px)` },
  ], { duration: duration(190), easing: 'ease-in-out' }).finished.catch(() => {})));
}
async function animateFall(wave: Wave) {
  render(wave.after);
  const step = cells[8].getBoundingClientRect().y - cells[0].getBoundingClientRect().y;
  const animations: Promise<unknown>[] = [];
  for (let col = 0; col < 8; col++) {
    const survivors = Array.from({ length: 8 }, (_, row) => row).filter(row => wave.cleared[row * 8 + col] !== null);
    const empty = 8 - survivors.length;
    for (let row = 0; row < 8; row++) {
      const from = row < empty ? row - empty : survivors[row - empty];
      if (from === row) continue;
      animations.push(cells[row * 8 + col].querySelector('svg')!.animate([
        { transform: `translateY(${(from - row) * step}px)`, opacity: row < empty ? 0 : 1 },
        { transform: 'translateY(0)', opacity: 1 },
      ], { duration: duration(330), easing: 'cubic-bezier(.3,.1,.5,1)' }).finished.catch(() => {}));
    }
  }
  await Promise.all(animations);
}
async function select(index: number) {
  if (busy || state.status !== 'playing') return;
  if (selected === null || !adjacent(selected, index)) {
    selected = selected === index ? null : index; render(); return;
  }
  const a = selected, token = generation;
  selected = null; busy = true; render();
  const result = playSwap(state, a, index);
  await animateSwap(a, index);
  if (token !== generation) return;
  render(swap(state.board, a, index));
  if (!result.valid) {
    await pause(90);
    if (token !== generation) return;
    await animateSwap(a, index);
    if (token !== generation) return;
    render(); busy = false;
    $('hint').textContent = '还没连成三个，换回来啦，不扣步！';
    return;
  }
  let displayedScore = state.score;
  hud(displayedScore, result.state.moves);
  for (const wave of result.waves) {
    render(wave.before);
    $('hint').textContent = wave.multiplier === 1 ? `好吃！+${wave.gain} 分` : `${wave.multiplier} 连锁！本轮 ×${wave.multiplier}，+${wave.gain} 分`;
    $('float-score').textContent = `${wave.multiplier > 1 ? `×${wave.multiplier} ` : ''}+${wave.gain}`;
    $('float-score').animate([{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, offset: .25 }, { opacity: 0, transform: 'translateY(-30px)' }], { duration: duration(650) });
    await Promise.all(wave.removed.map(i => cells[i].querySelector('svg')!.animate([
      { transform: 'scale(1)', opacity: 1 }, { transform: 'scale(1.18)', offset: .3 }, { transform: 'scale(.2)', opacity: 0 },
    ], { duration: duration(280), fill: 'forwards' }).finished.catch(() => {})));
    if (token !== generation) return;
    displayedScore += wave.gain; hud(displayedScore, result.state.moves);
    render(wave.cleared); await pause(80);
    if (token !== generation) return;
    await animateFall(wave);
    if (token !== generation) return;
    await pause(140);
    if (token !== generation) return;
  }
  state = result.state; busy = false; $('float-score').textContent = ''; render(); hud(); finish();
}
function finish() {
  if (state.status === 'playing') return;
  const win = state.status === 'win';
  $('result-title').textContent = win ? '美味大成功！' : '步数用完啦';
  $('result-copy').textContent = win ? `获得 ${state.score} 分${state.level.id === LEVELS.length ? '，五关全部完成！' : '，准备下一关吧！'}` : `获得 ${state.score} / ${state.level.target} 分，再试一次吧。`;
  $('next').hidden = !win;
  $('next').textContent = state.level.id === LEVELS.length ? '从第一关再玩' : '下一关';
  $('result').hidden = false; boardElement.inert = true; $('retry').inert = true;
  (win ? $('next') : $('restart')).focus({ preventScroll: true });
}
function start(index: number) {
  generation++; state = newGame(LEVELS[index]); selected = null; busy = false;
  document.getAnimations().forEach(animation => animation.cancel());
  $('result').hidden = true; boardElement.inert = false; $('retry').inert = false;
  $('float-score').textContent = ''; $('hint').textContent = '点一块寿司，再点它上下左右的伙伴';
  render(); hud();
}
$('restart').addEventListener('click', () => { start(state.level.id - 1); cells[0].focus({ preventScroll: true }); });
$('retry').addEventListener('click', () => start(state.level.id - 1));
$('next').addEventListener('click', () => { start(state.level.id % LEVELS.length); cells[0].focus({ preventScroll: true }); });
$('result').addEventListener('keydown', event => {
  if (event.key !== 'Tab') return;
  event.preventDefault();
  const target = !$('next').hidden && document.activeElement === $('restart') ? $('next') : $('restart');
  target.focus();
});
render(); hud();
// Read-only state in development; deterministic fixture loading is opt-in for E2E only.
if (import.meta.env.DEV) {
  Object.defineProperty(window, '__sushi', { get: () => structuredClone({ ...state, busy }) });
  if (new URLSearchParams(location.search).has('e2e')) Object.defineProperty(window, '__loadSushi', {
    value: (fixture: State) => { start(fixture.level.id - 1); state = structuredClone(fixture); render(); hud(); finish(); },
  });
}
