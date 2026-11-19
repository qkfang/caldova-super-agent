// Visual + functional smoke test for the Wealth Team in a Day frontend.
// Usage: node shots.mjs <outDir>
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const outDir = process.argv[2];
fs.mkdirSync(outDir, { recursive: true });
const shot = (page, name) =>
  page.screenshot({ path: path.join(outDir, `${name}.png`) });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({
  channel: "msedge",
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [];
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));

await page.goto("http://localhost:5199/", { waitUntil: "networkidle" });
await sleep(5000);
await shot(page, "01-office-overview");

// Zoom the office camera in a little so the signage is legible.
const canvas = page.locator("#renderCanvas");
const box = await canvas.boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
for (let i = 0; i < 6; i++) {
  await page.mouse.wheel(0, -120);
  await sleep(60);
}
await sleep(1500);
await shot(page, "02-office-zoomed");
// Orbit a little to the right to look at the back row / identity wall.
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.down();
await page.mouse.move(box.x + box.width / 2 + 260, box.y + box.height / 2 + 40, { steps: 12 });
await page.mouse.up();
await sleep(1200);
await shot(page, "03-office-orbit");

// Neighbourhood overview.
await page.click('.scene-toggle button[data-scene="neighbourhood"]');
await sleep(2500);
await shot(page, "04-neighbourhood-overview");
await page.click('.scene-toggle button[data-scene="office"]');
await sleep(800);

// Scenario picker.
await page.click("#spawn-btn");
await sleep(600);
await shot(page, "05-scenario-picker");
await page.keyboard.press("Escape");
await sleep(300);

const results = [];
const order = ["onboarding", "protection", "retirement", "hardship", "bereavement"];
for (const id of order) {
  // Speed x1 for the neighbourhood close-up, then x5 for the office run.
  await page.click('.sim-speed button[data-speed="1"]');
  await page.click("#spawn-btn");
  await sleep(400);
  const autoplay = page.locator("#scenario-picker-overlay .autoplay-checkbox");
  // Scenario 1 runs with the step gate so we can capture it; the rest auto-play.
  if (id === "onboarding") {
    if (await autoplay.isChecked()) await autoplay.uncheck();
  } else if (!(await autoplay.isChecked())) {
    await autoplay.check();
  }
  await page.click(`#scenario-picker-overlay .scenario-option[data-id="${id}"]`);
  await sleep(2600);
  await shot(page, `10-${id}-neighbourhood`);
  await page.click('.sim-speed button[data-speed="5"]');

  const started = Date.now();
  let gateShots = 0;
  let resultShot = false;
  let done = false;
  while (Date.now() - started < 240000) {
    const gateOpen = await page
      .locator("#step-gate-overlay:not(.hidden)")
      .count();
    if (gateOpen) {
      if (gateShots < 2) {
        await shot(page, `11-${id}-stepgate-${gateShots + 1}`);
      }
      gateShots++;
      await page.click("#step-gate-overlay .step-continue");
      await sleep(300);
      continue;
    }
    if (!resultShot && (await page.locator("#customer-result:not(.hidden)").count())) {
      await sleep(400);
      await shot(page, `12-${id}-result`);
      resultShot = true;
    }
    if (await page.locator("#scenario-summary-overlay:not(.hidden)").count()) {
      await sleep(400);
      await shot(page, `13-${id}-summary`);
      const text = await page.locator("#scenario-summary-overlay .summary-card").innerText();
      results.push({ id, seconds: Math.round((Date.now() - started) / 1000), gates: gateShots, text });
      await page.click("#scenario-summary-overlay .summary-done");
      done = true;
      break;
    }
    await sleep(250);
  }
  if (!done) {
    await shot(page, `19-${id}-TIMEOUT`);
    results.push({ id, timeout: true });
  }
  await sleep(800);
}

// Activity log + agents panel after all runs.
await shot(page, "20-after-all-scenarios");
const log = await page.locator("#log-list").innerText();
fs.writeFileSync(path.join(outDir, "activity-log.txt"), log);
fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify({ results, errors }, null, 2));
console.log(JSON.stringify({ results: results.map((r) => ({ id: r.id, seconds: r.seconds, gates: r.gates, timeout: r.timeout })), errors }, null, 2));
await browser.close();
