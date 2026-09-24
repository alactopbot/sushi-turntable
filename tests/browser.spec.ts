import { test, expect, type Page } from "@playwright/test";
import { matches, points, swap, type State } from "../src/game";

async function snapshot(page: Page): Promise<State> {
  return page.evaluate(() => (window as any).__sushi);
}
async function tapSlot(page: Page, i: number) {
  const box = (await page.locator("canvas").boundingBox())!;
  const angle = -Math.PI / 2 + (i * Math.PI) / 6;
  const x = box.x + ((260 + 199 * Math.cos(angle)) * box.width) / 520;
  const y = box.y + ((260 + 199 * Math.sin(angle)) * box.height) / 520;
  if (test.info().project.name === "mobile") await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}
async function move(page: Page, index: number) {
  const before = await snapshot(page);
  if (before.selected !== null) await tapSlot(page, before.selected);
  await tapSlot(page, index);
  await tapSlot(page, (index + 1) % 12);
  await expect.poll(async () => (await snapshot(page)).busy).toBe(false);
}
test("S1–S5/R1–R9: real pointer selection, full win/loss, two in-page restarts", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    let seed = 237;
    Math.random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    (window as any).__documentToken = "same-document";
  });
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await tapSlot(page, 0);
  await tapSlot(page, 5);
  expect((await snapshot(page)).selected).toBe(5);
  expect((await snapshot(page)).moves).toBe(20);
  await tapSlot(page, 5);
  let eliminated = false;
  while (
    (await snapshot(page)).moves > 0 &&
    (await snapshot(page)).score < 300
  ) {
    const state = await snapshot(page);
    const choices = state.board.map((_, i) => ({
      i,
      gain: matches(swap(state.board, i, (i + 1) % 12)).reduce(
        (sum, g) => sum + points(g.length, 1),
        0,
      ),
    }));
    choices.sort((a, b) => b.gain - a.gain);
    await move(page, choices[0].i);
    if ((await snapshot(page)).score > 0) eliminated = true;
  }
  expect(eliminated).toBe(true);
  await expect(page.locator("#result-title")).toHaveText("美味大成功！");
  await page.screenshot({
    path: `test-results/${test.info().project.name}-win.png`,
  });
  await page.getByRole("button", { name: "再来一盘" }).click();
  expect((await snapshot(page)).moves).toBe(20);
  expect((await snapshot(page)).score).toBe(0);
  // Score once, then alternate the same safe pair to finish a losing game.
  let state = await snapshot(page);
  const scoring = state.board.findIndex(
    (_, i) => matches(swap(state.board, i, (i + 1) % 12)).length > 0,
  );
  await move(page, scoring);
  expect((await snapshot(page)).score).toBeGreaterThan(0);
  state = await snapshot(page);
  const safe = state.board.findIndex(
    (_, i) => matches(swap(state.board, i, (i + 1) % 12)).length === 0,
  );
  expect(safe).toBeGreaterThanOrEqual(0);
  while ((await snapshot(page)).moves > 0) await move(page, safe);
  await expect(page.locator("#result-title")).toHaveText("这一盘吃完啦");
  await page.getByRole("button", { name: "再来一盘" }).click();
  expect((await snapshot(page)).moves).toBe(20);
  expect((await snapshot(page)).score).toBe(0);
  expect(await page.evaluate(() => (window as any).__documentToken)).toBe(
    "same-document",
  );
  await page.screenshot({
    path: `test-results/${test.info().project.name}-opening.png`,
  });
  expect(errors).toEqual([]);
});
