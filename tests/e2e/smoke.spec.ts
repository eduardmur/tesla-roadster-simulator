/**
 * Smoke test of the built site: the scene loads with the car in front of the ramp, holding W
 * completes the jump and the car then stops, "How it works" opens, the static page and the
 * no-WebGL fallback work. Fails on any console error. Screenshots go to artifacts/ (gitignored).
 */
import { expect, test, type Page } from '@playwright/test';

type TRS = {
  host: {
    sim: {
      telemetry: {
        position: number[];
        airborne: boolean;
        upright: number;
        tankMass: number;
        speed: number;
        forwardSpeed: number;
      };
    } | null;
    hold: boolean;
    stepFor(n: number): void;
  };
  app: {
    getState(): { load: { stage: string }; mode: string; result: { success: boolean } | null };
  };
};

declare global {
  interface Window {
    __trs: TRS;
  }
}

const shot = (page: Page, name: string) => page.screenshot({ path: `artifacts/e2e-${name}.png` });

function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

async function ready(page: Page) {
  await page.goto('./');
  // If the browser has no WebGL 2 the app shows its text fallback instead; report that clearly.
  await page.waitForFunction(() => !!document.querySelector('.nowebgl') || !!window.__trs, null, {
    timeout: 30_000,
  });
  if (await page.locator('.nowebgl').count()) {
    throw new Error('WebGL 2 is unavailable in this browser: the fallback page is shown');
  }
  await page.waitForFunction(() => window.__trs.app.getState().load.stage === 'ready', null, {
    timeout: 90_000,
  });
}

test('the car waits in front of the ramp; the fine print is behind the "?"', async ({ page }) => {
  const errors = trackErrors(page);
  await ready(page);
  await expect(page.getByText('Tesla Roadster Simulator')).toBeVisible();
  await expect(page.getByText('Hold W to drive up the ramp')).toBeVisible();
  const z = await page.evaluate(() => window.__trs.host.sim!.telemetry.position[2]!);
  expect(z).toBeLessThan(0);
  await shot(page, 'ready');
  await page.getByRole('button', { name: 'About this project' }).click();
  await expect(page.getByText(/Unofficial fan project\. Not affiliated with/)).toBeVisible();
  await shot(page, 'about');
  await page.keyboard.press('Escape');
  await expect(page.getByText(/Unofficial fan project/)).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('hold W: the car climbs, flips, lands and then stops', async ({ page }) => {
  const errors = trackErrors(page);
  await ready(page);
  // Step the sim deterministically (software WebGL is slow).
  await page.evaluate(() => {
    window.__trs.host.hold = true;
  });
  await page.keyboard.down('KeyW');
  const step = (n: number) => page.evaluate((k) => window.__trs.host.stepFor(k), n);
  const until = async (fn: () => boolean, name: string) => {
    for (let i = 0; i < 3000; i++) {
      await step(12);
      if (await page.evaluate(fn)) break;
    }
    await page.waitForTimeout(600);
    await shot(page, name);
  };
  await until(() => window.__trs.host.sim!.telemetry.upright < -0.9, 'inverted');
  await until(() => {
    const t = window.__trs.host.sim!.telemetry;
    return t.airborne && t.upright > 0.5;
  }, 'flight');
  await until(() => window.__trs.app.getState().mode === 'done', 'landed');
  const result = await page.evaluate(() => window.__trs.app.getState().result);
  expect(result?.success).toBe(true);
  await expect(page.getByRole('button', { name: 'Again' })).toBeVisible();

  // Still holding W: the car stops and stays put (no reversing), the result stays up.
  await step(120 * 6);
  const t = await page.evaluate(() => window.__trs.host.sim!.telemetry);
  expect(t.speed).toBeLessThan(0.1);
  expect(await page.evaluate(() => window.__trs.app.getState().mode)).toBe('done');

  // Release and press W again: you drive on from where it landed.
  await page.keyboard.up('KeyW');
  await step(1);
  await page.keyboard.down('KeyW');
  await step(120);
  expect(await page.evaluate(() => window.__trs.app.getState().mode)).toBe('manual');
  const after = await page.evaluate(() => window.__trs.host.sim!.telemetry.forwardSpeed);
  expect(after).toBeGreaterThan(1);
  await page.keyboard.up('KeyW');
  expect(errors).toEqual([]);
});

test('How it works opens as a simple article with sources, and closes', async ({ page }) => {
  const errors = trackErrors(page);
  await ready(page);
  await page.getByRole('button', { name: 'How it works' }).click();
  await expect(page.getByRole('heading', { name: 'How it works', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sources' })).toBeVisible();
  expect(await page.locator('.reader figure svg').count()).toBeGreaterThanOrEqual(5);
  await shot(page, 'article');
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('heading', { name: 'How it works', level: 1 })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('how-it-works page works without canvas', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('./how-it-works/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('How it works');
  expect(await page.locator('canvas').count()).toBe(0);
  const ld = await page.evaluate(
    () =>
      JSON.parse(document.querySelector('script[type="application/ld+json"]')!.textContent!)[
        '@type'
      ],
  );
  expect(ld).toBe('TechArticle');
  await shot(page, 'how-it-works');
  expect(errors).toEqual([]);
});

test('graceful fallback when WebGL 2 is unavailable', async ({ page }) => {
  const errors = trackErrors(page);
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...rest: unknown[]
    ) {
      if (type === 'webgl2') return null;
      return (original as (...a: unknown[]) => unknown).call(this, type, ...rest);
    } as typeof HTMLCanvasElement.prototype.getContext;
  });
  await page.goto('./');
  await expect(page.locator('.nowebgl')).toBeVisible();
  await expect(page.getByRole('link', { name: 'How it works' })).toHaveAttribute(
    'href',
    /how-it-works\/$/,
  );
  await shot(page, 'fallback');
  expect(errors).toEqual([]);
});
