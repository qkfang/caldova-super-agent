// Targeted close-ups after the visual fixes.
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const outDir = process.argv[2];
fs.mkdirSync(outDir, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({
  channel: "msedge",
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

await page.goto("http://localhost:5199/", { waitUntil: "networkidle" });
await sleep(4000);
// Collapse both HUD side panels so they don't cover the scene.
for (const btn of await page.locator(".panel-toggle").all()) await btn.click();
await sleep(300);

const canvas = page.locator("#renderCanvas");
const box = await canvas.boundingBox();
const cx = box.x + box.width / 2;
const cy = box.y + box.height / 2;
await page.mouse.move(cx, cy);
for (let i = 0; i < 8; i++) {
  await page.mouse.wheel(0, -120);
  await sleep(50);
}
await sleep(1500);
await page.screenshot({ path: path.join(outDir, "30-office-max-zoom.png") });

// Orbit so the camera looks straight up the room (lobby in front, archive
// cabinets on the back wall).
await page.mouse.move(cx, cy);
await page.mouse.down();
await page.mouse.move(cx - 230, cy - 60, { steps: 14 });
await page.mouse.up();
await sleep(1500);
await page.screenshot({ path: path.join(outDir, "31-office-front-view.png") });

// Neighbourhood overview with the relocated labels.
await page.click('.scene-toggle button[data-scene="neighbourhood"]');
await sleep(2500);
await page.screenshot({ path: path.join(outDir, "32-neighbourhood-labels.png") });
await page.click('.scene-toggle button[data-scene="office"]');
await sleep(600);

// Protection scenario: capture the identity-takeover alert.
await page.click("#spawn-btn");
await sleep(400);
const autoplay = page.locator("#scenario-picker-overlay .autoplay-checkbox");
if (!(await autoplay.isChecked())) await autoplay.check();
await page.click('#scenario-picker-overlay .scenario-option[data-id="protection"]');
await sleep(2200);
await page.screenshot({ path: path.join(outDir, "33-protection-alert.png") });
await sleep(800);
await page.screenshot({ path: path.join(outDir, "34-protection-alert-b.png") });
// Let it run to the office and grab a mid-case frame with thought bulbs.
await page.click('.sim-speed button[data-speed="2"]');
const started = Date.now();
let midShot = false;
while (Date.now() - started < 200000) {
  if (!midShot && (await page.locator("#activity-panel:not(.hidden)").count())) {
    const title = await page.locator("#activity-panel .activity-staff-name").innerText();
    if (title.trim() === "Felix") {
      await sleep(1200);
      await page.screenshot({ path: path.join(outDir, "35-protection-felix-in-office.png") });
      midShot = true;
    }
  }
  if (await page.locator("#customer-result:not(.hidden)").count()) {
    await page.screenshot({ path: path.join(outDir, "36-protection-result-banner.png") });
    break;
  }
  await sleep(200);
}
console.log(JSON.stringify({ errors, midShot }, null, 2));
await browser.close();
