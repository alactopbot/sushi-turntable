import { test, expect, type Page } from '@playwright/test';
import { LEVELS, TYPES, matches, swap, type State } from '../src/game';
type Snapshot = State & { busy: boolean };
const snapshot = (page: Page): Promise<Snapshot> => page.evaluate(() => (window as any).__sushi);
async function tap(page: Page, selector: string) {
  const locator = page.locator(selector);
  if (test.info().project.name === 'mobile') await locator.tap(); else await locator.click();
}
async function exchange(page: Page, a: number, b: number) {
  await tap(page, `[data-index="${a}"]`); await tap(page, `[data-index="${b}"]`);
  await expect.poll(async () => (await snapshot(page)).busy).toBe(false);
}
function fixture(levelIndex = 0, losing = false): State {
  const level = LEVELS[levelIndex];
  const board = Array.from({ length: 64 }, (_, i) => TYPES[(Math.floor(i / 8) + i % 8) % level.types]);
  board[0] = board[1] = board[10] = 'salmon'; board[2] = 'tuna';
  return { level, board, score: losing ? 0 : level.target - 60, moves: losing ? 1 : level.moves, status: 'playing' };
}
async function load(page: Page, state: State) {
  await page.evaluate(value => (window as any).__loadSushi(value), state);
}
test('opening copy, stable board, invalid and valid swaps, retry without navigation', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page).toHaveTitle('转转寿司');
  await expect(page.locator('h1')).toHaveText('转转寿司');
  await expect(page.locator('.tagline')).toHaveText('交换旁边的寿司，连成三个就消掉。掉下来的还能再连哦。');
  await expect(page.locator('.cell')).toHaveCount(64);
  const initial = await snapshot(page);
  expect(matches(initial.board)).toEqual([]); expect(initial.moves).toBe(30);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.locator('.cell').first().evaluate(el => el.getBoundingClientRect().width)).toBeGreaterThanOrEqual(40);
  let valid: [number, number] | undefined, invalid: [number, number] | undefined;
  for (let i = 0; i < 64; i++) for (const j of [i % 8 < 7 ? i + 1 : -1, i + 8 < 64 ? i + 8 : -1]) {
    if (j < 0) continue;
    if (matches(swap(initial.board, i, j)).length) valid = [i, j]; else invalid = [i, j];
  }
  expect(invalid).toBeDefined();
  await exchange(page, ...invalid!);
  expect((await snapshot(page)).board).toEqual(initial.board); expect((await snapshot(page)).moves).toBe(30);
  // Stable openings are random; the frozen rules intentionally do not detect dead boards.
  if (valid) {
    await exchange(page, ...valid);
    expect((await snapshot(page)).moves).toBe(29); expect((await snapshot(page)).score).toBeGreaterThanOrEqual(60);
  }
  await page.evaluate(() => (window as any).__documentMarker = 'same document');
  if ((await snapshot(page)).status === 'playing') await tap(page, '#retry'); else await tap(page, '#restart');
  const fresh = await snapshot(page);
  expect(fresh.score).toBe(0); expect(fresh.moves).toBe(30); expect(matches(fresh.board)).toEqual([]);
  expect(await page.evaluate(() => (window as any).__documentMarker)).toBe('same document');
  await page.screenshot({ path: test.info().outputPath('board.png'), fullPage: true });
  expect(errors).toEqual([]);
});
test('real swaps win all five levels, next resets, loss and retry are distinct', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?e2e');
  await page.evaluate(() => (window as any).__documentMarker = 'same document');
  for (let level = 0; level < 5; level++) {
    await load(page, fixture(level));
    await exchange(page, 2, 10);
    await expect(page.locator('#result')).toBeVisible();
    await expect(page.locator('#result-title')).toHaveText('美味大成功！');
    expect((await snapshot(page)).status).toBe('win');
    await tap(page, '#next');
    const next = await snapshot(page);
    expect(next.level.id).toBe((level + 1) % 5 + 1); expect(next.score).toBe(0);
    expect(next.moves).toBe(next.level.moves); expect(matches(next.board)).toEqual([]);
  }
  // Restrict random refill to a known non-matching pattern so the final move stays below target.
  await load(page, fixture(0, true));
  await page.evaluate(() => { const values = [.3, .55, .8]; let i = 0; Math.random = () => values[i++ % values.length]; });
  await exchange(page, 2, 10);
  await expect(page.locator('#result-title')).toHaveText('步数用完啦');
  await expect(page.locator('#next')).toBeHidden();
  expect((await snapshot(page)).status).toBe('lose'); expect((await snapshot(page)).moves).toBe(0);
  await tap(page, '#restart');
  const reset = await snapshot(page);
  expect(reset.score).toBe(0); expect(reset.moves).toBe(30); expect(reset.status).toBe('playing'); expect(matches(reset.board)).toEqual([]);
  expect(await page.evaluate(() => (window as any).__documentMarker)).toBe('same document');
  expect(errors).toEqual([]);
});
test('visible cascades keep one move cost and restarting cancels pending animations', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/?e2e');
  await load(page, { ...fixture(), score: 0 });
  await page.evaluate(() => {
    const values = [0, 0, 0, .3, .55, .8]; let i = 0;
    const original = Math.random;
    Math.random = () => i < values.length ? values[i++] : original();
  });
  await tap(page, '[data-index="2"]'); await tap(page, '[data-index="10"]');
  await expect(page.locator('#hint')).toContainText('2 连锁！本轮 ×2，+120 分');
  await expect.poll(async () => (await snapshot(page)).busy).toBe(false);
  expect((await snapshot(page)).score).toBe(180); expect((await snapshot(page)).moves).toBe(29);
  await expect(page.locator('#score')).toHaveText('180');
  await expect(page.locator('#moves')).toHaveText('29');
  await load(page, { ...fixture(), score: 0 });
  await tap(page, '[data-index="2"]'); await tap(page, '[data-index="10"]');
  await tap(page, '#retry');
  const fresh = await snapshot(page);
  await page.waitForTimeout(1000);
  expect(await snapshot(page)).toEqual(fresh); expect(fresh.score).toBe(0); expect(fresh.moves).toBe(30);
});
