/**
 * Smoke test of the built site: the scene loads with the car in front of the ramp, the
 * autopilot jump completes, "How it works" opens, the static page and the no-WebGL fallback
 * work. Fails on any console error. Screenshots go to artifacts/ (gitignored).
 */
import { expect, test, type Page } from '@playwright/test';

type TRS = {
  host: {
    sim: {
      telemetry: { position: number[]; airborne: boolean; upright: number; tankMass: number };
    } | null;
    hold: boolean;
    launch(): void;
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

test('the car waits in front of the ramp, with the unofficial notice', async ({ page }) => {
  const errors = trackErrors(page);
  await ready(page);
  await expect(page.getByText('Tesla Roadster Simulator')).toBeVisible();
  await expect(page.getByText('Unofficial fan project. Not affiliated with Tesla.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Launch' })).toBeEnabled();
  const z = await page.evaluate(() => window.__trs.host.sim!.telemetry.position[2]!);
  expect(z).toBeLessThan(0);
  await shot(page, 'ready');
  expect(errors).toEqual([]);
});

test('Launch: the autopilot climbs, flips and lands', async ({ page }) => {
  const errors = trackErrors(page);
  await ready(page);
  await page.getByRole('button', { name: 'Launch' }).click();
  // Step the sim deterministically (software WebGL is slow).
  await page.evaluate(() => {
    window.__trs.host.hold = true;
  });
  const until = async (fn: () => boolean, name: string) => {
    for (let i = 0; i < 3000; i++) {
      await page.evaluate(() => window.__trs.host.stepFor(12));
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
  expect(errors).toEqual([]);
});

test('How it works opens as a simple article with sources, and closes', async ({ page }) => {
  const errors = trackErrors(page);
  await ready(page);
  await page.getByRole('button', { name: 'How it works' }).click();
  await expect(page.getByRole('heading', { name: 'How the Tesla Roadster flies' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sources' })).toBeVisible();
  expect(await page.locator('.reader figure svg').count()).toBeGreaterThanOrEqual(5);
  await shot(page, 'article');
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('heading', { name: 'How the Tesla Roadster flies' })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('how-it-works page works without canvas', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('./how-it-works/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('How the Tesla Roadster flies');
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
