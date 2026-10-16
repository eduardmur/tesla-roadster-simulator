# Contributing to Flying Tesla

Thanks for helping! Bug fixes, better physics, accessibility improvements and spec corrections are
all welcome.

## Ground rules

- **No invented numbers.** Every number the product shows must come from
  [`src/data/specs.ts`](src/data/specs.ts), tagged `confirmed`, `reported` or `estimate`, with a
  source for anything reported. Values derived from those go through the physics module and are
  shown with a `sim` tag.
- **No Tesla or SpaceX branding.** No logos, wordmarks, badges or copied design details. The car is
  an original procedural model. Always keep the "Unofficial educational simulation. Not affiliated
  with Tesla or SpaceX." line next to the name.
- **Assets**: CC0 only, credited in [`CREDITS.md`](CREDITS.md).
- **No trackers or analytics.**
- English for UI, copy, code comments and docs.

## Getting started

```bash
npm install
npm run dev          # http://localhost:5173/flying-tesla/
npm test             # physics + headless sim tests (Vitest)
npm run typecheck
npm run lint
npm run format       # Prettier
npm run build && npm run e2e   # Playwright smoke test against the build
```

## Where things live

```
src/physics/   pure, deterministic physics (no rendering imports), fully unit-tested
src/sim/       Rapier world, raycast vehicle, forces, recorder, autopilot, challenges
src/scene/     three.js / react-three-fiber: car, environment, effects, cameras
src/ui/        HUD, lab panels, tour, challenges, controls
src/data/      specs.ts (every number), sources.ts, tour.ts, components.ts
scripts/       build-time generator for the /how-it-works page
docs/          PHYSICS.md, SOURCES.md, DECISIONS.md
```

## Spec corrections

If you find a newer or better source for a number, open a **Spec correction** issue. A source URL
is required. In a PR, update the spec's `value`, `status` and `source`. Note the change in
`docs/DECISIONS.md` if it changes a calibration, and make sure `npm test` still passes. The
validation tests are the contract with the reported numbers.

## Commits and PRs

- Use [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`,
  `chore:`…).
- CI must be green: typecheck, lint, format check, unit tests and build.
- For visual changes, attach a screenshot (`H` hides the UI).

By contributing you agree that code is licensed under MIT and written explainer content under
CC BY 4.0, as described in the README.
