/**
 * Renders README/OG media from the built site:
 *   docs/media/curl.gif   — the autopilot doing The Curl
 *   public/og-image.png   — 1200×630 Open Graph image
 *
 * Usage: npm run build && npx vite preview --configLoader runner --port 4173 &
 *        node scripts/capture-media.mjs [http://localhost:4173/flying-tesla/]
 */
import { chromium } from '@playwright/test';
import gifenc from 'gifenc';
import { PNG } from 'pngjs';
import { mkdirSync, writeFileSync } from 'node:fs';

mkdirSync('artifacts', { recursive: true });

const { GIFEncoder, quantize, applyPalette } = gifenc;

const url = process.argv[2] ?? 'http://localhost:4173/flying-tesla/';
const browser = await chromium.launch({
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
  ],
});

async function open(width, height) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await page.goto(url);
  await page.waitForFunction(() => window.__ft?.app.getState().load.stage === 'ready', null, {
    timeout: 90000,
  });
  await page.evaluate(() => {
    localStorage.setItem('flying-tesla:seenControls', 'true');
    const app = window.__ft.app.getState();
    app.set({ mode: 'drive', hideUi: true, quality: 'high' });
    window.__ft.host.watchAutopilot('curl');
    // Step the sim by hand for deterministic frames.
    window.__ft.app.getState().set({ paused: true, caption: null });
  });
  return page;
}

/** Advance the sim by n fixed steps with the autopilot driving, then let the scene render. */
async function advance(page, steps, frames = 3) {
  await page.evaluate((n) => {
    const h = window.__ft.host;
    for (let i = 0; i < n; i++) {
      h.sim.updateTelemetry();
      if (h.autopilot) h.sim.input = h.autopilot.input(h.sim.telemetry);
      h.sim.step();
    }
    h.sim.updateTelemetry();
  }, steps);
  for (let i = 0; i < frames; i++)
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r())));
}

const tel = (page) =>
  page.evaluate(() => {
    const t = window.__ft.host.sim.telemetry;
    return {
      y: t.position[1],
      up: t.upright,
      airborne: t.airborne,
      surface: t.surface,
      speed: t.speed,
      contacts: t.wheelsInContact,
    };
  });

// ---------------------------------------------------------------- GIF
{
  const W = 640;
  const H = 360;
  const page = await open(W, H);
  // Fast-forward the run-in until the car is a few metres from the curl.
  for (let i = 0; i < 400; i++) {
    await advance(page, 30, 0);
    const t = await page.evaluate(() => window.__ft.host.sim.telemetry.position[2]);
    if (t > -14) break;
  }
  // A spectator camera beside the ramp keeps the whole trick in frame.
  await page.evaluate(() => {
    window.__ft.director.shot = { kind: 'world', position: [66, 7, -22], lookAt: 'car', fov: 40 };
    window.__ft.director.cut = true;
  });
  await advance(page, 1, 6);
  const gif = GIFEncoder();
  let frames = 0;
  let landedFrames = 0;
  while (frames < 140) {
    await advance(page, 10, 3);
    const buf = await page.screenshot({ type: 'png' });
    // Keep a few stills for review (artifacts/ is gitignored).
    if (frames % 20 === 0) writeFileSync(`artifacts/gif-frame-${frames}.png`, buf);
    const png = PNG.sync.read(buf);
    const rgba = new Uint8Array(png.data.buffer, png.data.byteOffset, png.data.length);
    const palette = quantize(rgba, 128);
    gif.writeFrame(applyPalette(rgba, palette), W, H, { palette, delay: 70 });
    frames++;
    const t = await tel(page);
    const phase = await page.evaluate(() => window.__ft.host.autopilot?.phase ?? 'done');
    if (phase === 'landed' || phase === 'done') landedFrames++;
    if (landedFrames > 14) break;
  }
  gif.finish();
  mkdirSync('docs/media', { recursive: true });
  writeFileSync('docs/media/curl.gif', gif.bytes());
  console.log(`curl.gif: ${frames} frames, ${(gif.bytes().length / 1e6).toFixed(1)} MB`);
  await page.close();
}

// ---------------------------------------------------------------- OG image
{
  const page = await open(1200, 630);
  for (let i = 0; i < 400; i++) {
    await advance(page, 30, 0);
    const z = await page.evaluate(() => window.__ft.host.sim.telemetry.position[2]);
    if (z > -14) break;
  }
  // Climb until the car is high on the curl and starting to invert.
  for (let i = 0; i < 300; i++) {
    await advance(page, 6, 0);
    const t = await tel(page);
    if (t.up < -0.92 && !t.airborne) break;
  }
  await page.evaluate(() => {
    // Frame the inverted car to the right of the title.
    window.__ft.director.shot = {
      kind: 'world',
      position: [60, 10, -24],
      lookAt: [39, 18.5, 6.5],
      fov: 32,
    };
    window.__ft.director.cut = true;
  });
  await advance(page, 1, 8);
  const shot = await page.screenshot({ type: 'png' });
  const bg = `data:image/png;base64,${shot.toString('base64')}`;
  await page.setContent(`<!doctype html><html><body style="margin:0">
  <div style="position:relative;width:1200px;height:630px;background:url(${bg}) center/cover;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#e8edf5">
    <div style="position:absolute;inset:0;background:linear-gradient(90deg,rgba(8,11,18,.92) 0%,rgba(8,11,18,.6) 45%,rgba(8,11,18,0) 70%)"></div>
    <div style="position:absolute;left:64px;top:150px;width:560px">
      <div style="font-size:20px;letter-spacing:.14em;text-transform:uppercase;color:#a3afbf;font-weight:700">Interactive 3D explainer</div>
      <div style="font-size:96px;font-weight:800;line-height:1;margin:14px 0 18px">Flying <span style="background:linear-gradient(90deg,#ff8a3d,#ffd0a8 50%,#3ec7ff);-webkit-background-clip:text;color:transparent">Tesla</span></div>
      <div style="font-size:30px;line-height:1.3">Suction fans, cold-gas thrusters and the upside-down ramp, with honest numbers.</div>
      <div style="font-size:18px;color:#c3cfdf;margin-top:26px">Unofficial educational simulation. Not affiliated with Tesla or SpaceX.</div>
    </div>
  </div></body></html>`);
  await page.screenshot({ path: 'public/og-image.png', type: 'png' });
  console.log('og-image.png written');
  await page.close();
}

await browser.close();
