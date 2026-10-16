/**
 * Smoke test of the built site: landing, every tour chapter, every challenge and X-ray mode.
 * Fails on any console error. Screenshots go to artifacts/ (gitignored) for human review.
 */
import { expect, test, type Page } from '@playwright/test';

type FT = {
  host: {
    sim: {
      telemetry: Record<string, unknown> & { airborne: boolean; upright: number; tankMass: number };
    } | null;
    lastResult: { success: boolean; medal: string | null } | null;
    startChallenge(k: string): void;
    watchAutopilot(k: string): void;
    stopChallenge(): void;
  };
  app: {
    getState(): Record<string, unknown> & {
      set(p: Record<string, unknown>): void;
      load: { stage: string };
    };
  };
};

declare global {
  interface Window {
    __ft: FT;
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
  await page.waitForFunction(() => !!document.querySelector('.nowebgl') || !!window.__ft, null, {
    timeout: 30_000,
  });
  if (await page.locator('.nowebgl').count()) {
    throw new Error('WebGL 2 is unavailable in this browser: the fallback page is shown');
  }
  await page.waitForFunction(() => window.__ft?.app.getState().load.stage === 'ready', null, {
    timeout: 90_000,
  });
  await page.evaluate(() => localStorage.setItem('flying-tesla:seenControls', 'true'));
}

test('landing renders with the unofficial notice and real loader', async ({ page }) => {
  const errors = trackErrors(page);
  await ready(page);
  await expect(page.getByRole('heading', { name: /Flying Tesla/ })).toBeVisible();
  await expect(
    page
      .getByText('Unofficial educational simulation. Not affiliated with Tesla or SpaceX.')
      .first(),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Take the tour' })).toBeEnabled();
  await shot(page, 'landing');
  expect(errors).toEqual([]);
});

test('the six tour chapters play through', async ({ page }) => {
  const errors = trackErrors(page);
  await ready(page);
  await page.getByRole('button', { name: 'Take the tour' }).click();
  for (let c = 1; c <= 6; c++) {
    await expect(page.locator('#tour-h')).toContainText(`${c} ·`);
    await page.waitForTimeout(800);
    await shot(page, `tour-${c}`);
    for (;;) {
      const next = page.getByRole('button', { name: /^(Next|Try it)$/ });
      const label = await next.first().innerText();
      await next.first().click();
      if (label === 'Try it') break;
      await page.waitForTimeout(300);
    }
    await expect(page.getByText(/Your turn/)).toBeVisible();
    await page.waitForTimeout(800);
    await shot(page, `tour-${c}-task`);
    await page.getByRole('button', { name: 'Skip task' }).click();
    if (c < 6) await page.getByRole('button', { name: 'Next chapter' }).click();
  }
  await expect(page.getByRole('button', { name: /Watch the autopilot do The Curl/ })).toBeVisible();
  expect(errors).toEqual([]);
});

test('every challenge starts', async ({ page }) => {
  const errors = trackErrors(page);
  await ready(page);
  await page.getByRole('button', { name: 'Drive it' }).click();
  for (const kind of ['free', 'drag', 'curl', 'practice', 'hop', 'hover']) {
    await page.evaluate((k) => window.__ft.host.startChallenge(k), kind);
    await page.waitForTimeout(1500);
    await shot(page, `challenge-${kind}`);
  }
  // A mouse click on a challenge gives the keyboard back to the game (Space must thrust, not re-click).
  await page
    .getByRole('button', { name: /Drag strip/ })
    .first()
    .click();
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe('BUTTON');
  expect(errors).toEqual([]);
});

test('autopilot completes The Curl; X-ray opens mid-flight', async ({ page }) => {
  const errors = trackErrors(page);
  await ready(page);
  await page.getByRole('button', { name: 'Drive it' }).click();
  await page.evaluate(() => window.__ft.host.watchAutopilot('curl'));
  await page.waitForFunction(
    () => {
      const t = window.__ft.host.sim?.telemetry;
      return !!t && t.airborne && t.upright > 0;
    },
    null,
    { timeout: 180_000, polling: 50 },
  );
  await page.keyboard.press('KeyX');
  await page.evaluate(() => window.__ft.app.getState().set({ paused: true }));
  await page.waitForTimeout(800);
  await shot(page, 'curl-xray-midflight');
  await expect(page.getByLabel('Thrust per nozzle with valve duty cycle')).toBeVisible();
  await page.evaluate(() => window.__ft.app.getState().set({ paused: false, xray: false }));
  await page.waitForFunction(() => window.__ft.host.lastResult !== null, null, {
    timeout: 180_000,
  });
  const result = await page.evaluate(() => window.__ft.host.lastResult);
  expect(result?.success).toBe(true);
  await shot(page, 'curl-result');
  // "Your turn" replays the autopilot run as a ghost.
  await page.getByRole('button', { name: 'Your turn (with ghost)' }).click();
  await page.waitForTimeout(500);
  expect(
    await page.evaluate(
      () => (window.__ft.host as unknown as { ghostVisible: boolean }).ghostVisible,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test('look inside: X-ray, hotspot card and lab panels', async ({ page }) => {
  const errors = trackErrors(page);
  await ready(page);
  await page.getByRole('button', { name: 'Look inside' }).click();
  await page.waitForTimeout(1500);
  await shot(page, 'xray');
  await page
    .getByRole('button', { name: 'Main air tank (COPV): open details' })
    .click({ force: true });
  await expect(page.getByRole('heading', { name: 'Main air tank (COPV)' })).toBeVisible();
  await shot(page, 'xray-card');
  for (const tab of ['Grip', 'Tanks', 'Nozzle', 'Underbody', 'Energy']) {
    await page.getByRole('tab', { name: tab }).click();
    await page.waitForTimeout(400);
    await shot(page, `lab-${tab.toLowerCase()}`);
  }
  expect(errors).toEqual([]);
});

test('confirmed vs estimated panel lists sourced specs', async ({ page }) => {
  const errors = trackErrors(page);
  await ready(page);
  await page.getByRole('button', { name: 'Confirmed vs estimated' }).click();
  await expect(page.getByRole('heading', { name: 'What’s confirmed vs estimated' })).toBeVisible();
  await expect(page.locator('.spec-table a.tag--reported').first()).toBeVisible();
  await shot(page, 'specs');
  expect(errors).toEqual([]);
});

test('how-it-works page works without canvas', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('./how-it-works/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'How the flying Tesla Roadster works',
  );
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
  // Pretend the browser has no WebGL 2.
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
  await expect(
    page.getByText('Unofficial educational simulation. Not affiliated with Tesla or SpaceX.'),
  ).toBeVisible();
  const link = page.getByRole('link', { name: 'Read how it works' });
  await expect(link).toHaveAttribute('href', /how-it-works\/$/);
  await shot(page, 'fallback');
  expect(errors).toEqual([]);
});
