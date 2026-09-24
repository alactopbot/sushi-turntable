import { test, expect, type Page } from "@playwright/test";
import { type State } from "../src/game";
type Snapshot = State & { busy: boolean; positions: { id: number; x: number; y: number }[] };
async function snapshot(page: Page): Promise<Snapshot> { return page.evaluate(() => (window as any).__sushi); }
async function tap(page: Page, x: number, y: number) {
  const box = (await page.locator("canvas").boundingBox())!;
  const px = box.x + x * box.width / 520, py = box.y + y * box.height / 570;
  if (test.info().project.name === "mobile") await page.touchscreen.tap(px,py);
  else await page.mouse.click(px,py);
}
async function pick(page: Page, choose: (s: Snapshot) => number | undefined) {
  for (let attempts=0;attempts<200;attempts++) {
    const state = await snapshot(page);
    const id = !state.busy ? choose(state) : undefined;
    const p = state.positions.find(p=>p.id===id);
    if (p) { await tap(page,p.x,p.y); return; }
    await page.clock.runFor(300);
  }
  throw new Error("No selectable sushi within one simulated minute");
}
test("desktop/touch: full five-level wins, tail-only input, recycle, loss and in-page retries", async ({page}) => {
  test.setTimeout(300_000);
  const errors: string[]=[]; page.on("pageerror",e=>errors.push(e.message));
  await page.clock.install(); await page.goto("/"); await page.clock.runFor(100);
  await page.evaluate(()=>{ (window as any).__documentToken="same-document"; });
  await expect(page).toHaveTitle("转转寿司");
  await expect(page.locator("h1")).toHaveText("转转寿司");
  await expect(page.locator("header p")).toHaveText("从流水线点到盘子里，连成三个就消掉。盘子不能换顺序哦。");
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.clock.runFor(2700);
  const opening=await snapshot(page); expect(opening.belt.length).toBeGreaterThanOrEqual(3);
  const middle=opening.belt[1]; const p=opening.positions.find(p=>p.id===middle.id)!;
  await tap(page,p.x,p.y);
  expect((await snapshot(page)).plate).toEqual([middle.kind]);
  expect((await snapshot(page)).belt.map(p=>p.id)).not.toContain(middle.id);
  await tap(page,40,510); await tap(page,480,510);
  expect((await snapshot(page)).plate).toEqual([middle.kind]);
  await page.screenshot({path:`test-results/${test.info().project.name}-opening.png`});
  await page.getByRole("button",{name:"重开本关"}).click();
  for(let level=1;level<=5;level++) {
    expect((await snapshot(page)).level.id).toBe(level);
    for(let i=0;i<40 && (await snapshot(page)).status==="playing";i++) {
      await pick(page,s=> {
        const kind = s.plate.at(-1) ?? [...s.belt].sort((a,b) =>
          s.belt.filter(p=>p.kind===b.kind).length - s.belt.filter(p=>p.kind===a.kind).length)[0]?.kind;
        return s.belt.find(p=>p.kind===kind)?.id;
      });
      await page.clock.runFor(300);
    }
    await expect(page.locator("#result-title")).toHaveText("美味大成功！");
    expect((await snapshot(page)).score).toBeGreaterThanOrEqual((await snapshot(page)).level.target);
    console.info(`${test.info().project.name}: level ${level} passed`);
    if(level===5) await page.screenshot({path:`test-results/${test.info().project.name}-win.png`});
    await page.locator("#next").click();
    expect((await snapshot(page)).score).toBe(0); expect((await snapshot(page)).plate).toEqual([]);
  }
  expect((await snapshot(page)).level.id).toBe(1);
  await page.clock.runFor(13000);
  expect((await snapshot(page)).recycled).toBeGreaterThan(0);
  expect((await snapshot(page)).status).toBe("playing");
  for(let i=0;i<8;i++) await pick(page,s=>s.belt.find(p=>p.kind!==(s.plate.at(-1)??""))?.id);
  await expect(page.locator("#result-title")).toHaveText("盘子装满啦");
  expect((await snapshot(page)).plate).toHaveLength(8);
  await page.screenshot({path:`test-results/${test.info().project.name}-lose.png`});
  await page.getByRole("button",{name:"再试一次",exact:true}).click();
  expect((await snapshot(page)).plate).toEqual([]); expect((await snapshot(page)).score).toBe(0);
  expect((await snapshot(page)).status).toBe("playing");
  expect(await page.evaluate(()=>(window as any).__documentToken)).toBe("same-document");
  expect(errors).toEqual([]);
});
