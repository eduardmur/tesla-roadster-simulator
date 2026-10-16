/**
 * Renders README/OG media from the built site:
 *   docs/media/curl.gif   — the upside-down ramp jump (W held)
 *   public/og-image.png   — 1200×630 Open Graph image
 *
 * Usage: npm run build && npx vite preview --configLoader runner --port 4173 &
 *        node scripts/capture-media.mjs [http://localhost:4173/tesla-roadster-simulator/] [gif|og]
 */
import { chromium } from '@playwright/test';
import gifenc from 'gifenc';
import { PNG } from 'pngjs';
import { mkdirSync, writeFileSync } from 'node:fs';

mkdirSync('artifacts', { recursive: true });

const { GIFEncoder, quantize, applyPalette } = gifenc;

const url = process.argv[2] ?? 'http://localhost:4173/tesla-roadster-simulator/';
const only = process.argv[3];
const browser = await chromium.launch({
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
  ],
});

/** Open the app, hide the interface and hold W (the ramp assist does the rest), sim held. */
async function open(width, height) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await page.goto(url);
  await page.waitForFunction(() => window.__trs?.app.getState().load.stage === 'ready', null, {
    timeout: 90000,
  });
  await page.addStyleTag({ content: '.ui { display: none !important; }' });
  await page.evaluate(() => {
    const { host, app } = window.__trs;
    app.getState().set({ quality: 'high', muted: true });
    // Step the sim by hand for deterministic frames.
    host.hold = true;
  });
  await page.keyboard.down('KeyW');
  return page;
}

/** Advance the sim by n fixed steps with W held, then let the scene render. */
async function advance(page, steps, frames = 3) {
  await page.evaluate((n) => window.__trs.host.stepFor(n), steps);
  for (let i = 0; i < frames; i++)
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r())));
}

const tel = (page) =>
  page.evaluate(() => {
    const t = window.__trs.host.sim.telemetry;
    return { z: t.position[2], up: t.upright, airborne: t.airborne };
  });

const shoot = (page, shot) =>
  page.evaluate((s) => {
    window.__trs.director.shot = s;
    window.__trs.director.cut = true;
  }, shot);

/** Run in until the car is a few metres from the foot of the ramp. */
async function runIn(page) {
  for (let i = 0; i < 400; i++) {
    await advance(page, 30, 0);
    if ((await tel(page)).z > -12) break;
  }
}

// ---------------------------------------------------------------- GIF
if (only !== 'og') {
  const W = 640;
  const H = 360;
  const page = await open(W, H);
  await runIn(page);
  // A spectator camera beside the ramp keeps the whole jump in frame.
  await shoot(page, { kind: 'world', position: [34, 7, -14], lookAt: [0, 9, -4], fov: 44 });
  await advance(page, 1, 6);
  const gif = GIFEncoder();
  let frames = 0;
  let doneFrames = 0;
  while (frames < 160) {
    await advance(page, 10, 3);
    const buf = await page.screenshot({ type: 'png' });
    // Keep a few stills for review (artifacts/ is gitignored).
    if (frames % 20 === 0) writeFileSync(`artifacts/gif-frame-${frames}.png`, buf);
    const png = PNG.sync.read(buf);
    const rgba = new Uint8Array(png.data.buffer, png.data.byteOffset, png.data.length);
    const palette = quantize(rgba, 128);
    gif.writeFrame(applyPalette(rgba, palette), W, H, { palette, delay: 70 });
    frames++;
    const mode = await page.evaluate(() => window.__trs.app.getState().mode);
    if (mode === 'done') doneFrames++;
    if (doneFrames > 16) break;
  }
  gif.finish();
  mkdirSync('docs/media', { recursive: true });
  writeFileSync('docs/media/curl.gif', gif.bytes());
  console.log(`curl.gif: ${frames} frames, ${(gif.bytes().length / 1e6).toFixed(1)} MB`);
  await page.close();
}

// ---------------------------------------------------------------- OG image
if (only !== 'gif') {
  const page = await open(1200, 630);
  await runIn(page);
  // Climb until the car is high on the curl and upside down.
  for (let i = 0; i < 300; i++) {
    await advance(page, 6, 0);
    const t = await tel(page);
    if (t.up < -0.92 && !t.airborne) break;
  }
  // Frame the inverted car to the right of the title.
  await shoot(page, { kind: 'world', position: [24, 8, -15], lookAt: [6, 11.5, 11], fov: 46 });
  await advance(page, 1, 8);
  const shot = await page.screenshot({ type: 'png' });
  const bg = `data:image/png;base64,${shot.toString('base64')}`;
  await page.setContent(`<!doctype html><html><body style="margin:0">
  <div style="position:relative;width:1200px;height:630px;background:url(${bg}) center/cover;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#fff">
    <div style="position:absolute;inset:0;background:linear-gradient(90deg,rgba(0,0,0,.85) 0%,rgba(0,0,0,.5) 40%,rgba(0,0,0,0) 65%)"></div>
    <div style="position:absolute;left:72px;bottom:84px;width:560px">
      <div style="font-size:60px;font-weight:500;line-height:1.08;letter-spacing:-.01em">Tesla Roadster<br>Simulator</div>
      <div style="font-size:24px;line-height:1.4;margin-top:20px;color:rgba(255,255,255,.82)">The upside-down ramp jump, in your browser.</div>
      <div style="font-size:16px;margin-top:28px;color:rgba(255,255,255,.55)">Unofficial fan project. Not affiliated with Tesla.</div>
    </div>
  </div></body></html>`);
  await page.screenshot({ path: 'public/og-image.png', type: 'png' });
  console.log('og-image.png written');
  await page.close();
}

await browser.close();
