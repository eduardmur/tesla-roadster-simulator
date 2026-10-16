# Tesla Roadster Simulator

> **Unofficial fan project. Not affiliated with Tesla or SpaceX.**

**▶ [Open the simulator](https://eduardmur.github.io/tesla-roadster-simulator/)** · [How it works](https://eduardmur.github.io/tesla-roadster-simulator/how-it-works/)

[![CI](https://github.com/eduardmur/tesla-roadster-simulator/actions/workflows/ci.yml/badge.svg)](https://github.com/eduardmur/tesla-roadster-simulator/actions/workflows/ci.yml)
[![Code: MIT](https://img.shields.io/badge/code-MIT-blue.svg)](LICENSE)
[![Text: CC BY 4.0](https://img.shields.io/badge/text-CC%20BY%204.0-lightgrey.svg)](LICENSE-CONTENT.md)

![The car drives up the curl until it is upside down, drops off, rolls half a turn and lands on its lift jets](docs/media/curl.gif)

At the 15 Oct 2026 reveal, a Roadster drove up a ramp that curled over until it was upside down,
dropped off the end, rolled half a turn in mid-air and landed on its wheels. This is that one
jump, in your browser, with real physics.

The car is parked in front of the ramp. Hold **W** (on a phone, the pedal) to drive up. A speed
assist keeps the car at a safe speed on the ramp, and the flight computer rolls it over and lands
it. After the landing the car stops and waits; drive on whenever you like. **How it works** (top
right) is a short plain-language article with an animated demonstration and its sources.

## Controls

| Key                                 | Action                         |
| ----------------------------------- | ------------------------------ |
| <kbd>W</kbd> / <kbd>↑</kbd>         | Accelerate                     |
| <kbd>S</kbd> / <kbd>↓</kbd>         | Brake, then reverse            |
| <kbd>A</kbd> <kbd>D</kbd> / arrows  | Steer                          |
| <kbd>Space</kbd> / <kbd>Enter</kbd> | After a run: back to the start |
| <kbd>R</kbd>                        | Back to the start              |

Phones and tablets get on-screen steering buttons and pedals. Gamepads work too (triggers to
drive, A to go again).

## How it is simulated

- **Fans suck the car onto the road.** About 46 kN of reported downforce over a sealed floor of
  about 4 m² (estimate) needs only ~11.5 kPa below ambient pressure. The suction is what holds
  the car on the curl, and it collapses within a fraction of a second when the car runs off the
  end.
- **Thrust comes from a tank of air.** Air stored at the reported 5,500 psi leaves choked,
  supersonic nozzles. The rear nozzles are calibrated to the reported 80 kN; the four lift
  nozzles to the reported 3.3 g landing readout.
- **A flight computer** rolls the car upright and does a "suicide burn" landing.
- The ramp follows the reported geometry: a 170° curl about 21 m high (R ≈ 10.6 m).

Every number comes from [`src/data/specs.ts`](src/data/specs.ts), tagged `reported` (with a
source), `estimate` or `confirmed`. Physics notes: [docs/PHYSICS.md](docs/PHYSICS.md). Sources:
[docs/SOURCES.md](docs/SOURCES.md). Choices we made: [docs/DECISIONS.md](docs/DECISIONS.md). Found a
better source? [Open a spec correction](../../issues/new?template=spec-correction.yml).

## Run it locally

```bash
npm install
npm run dev        # http://localhost:5173/tesla-roadster-simulator/
npm test           # physics and headless sim tests
npm run build
npm run e2e        # Playwright smoke test against the build
```

Stack: Vite, TypeScript (strict), React, three.js via react-three-fiber, Rapier, Zustand and Web
Audio. The car, the ramp and the night scene are generated in code. The three sound clips in
`public/audio/` were made by the project owner with ElevenLabs. See [CREDITS.md](CREDITS.md).

```
src/physics/  pure, tested physics (gas, tank, nozzle, suction, tires, flight computer)
src/sim/      Rapier world, raycast vehicle, forces, the ramp, speed assist, jump monitor
src/scene/    car, ramp, night scene, exhaust, cameras
src/ui/       the overlay and the article reader
src/article/  the "How it works" article (also built as a static page)
src/data/     specs.ts · sources.ts
```

No analytics, no trackers.

## Licence

Code: [MIT](LICENSE). Written content (the "How it works" article and the docs):
[CC BY 4.0](LICENSE-CONTENT.md). The sound clips are not covered by either licence (see
[CREDITS.md](CREDITS.md)). Contributions welcome: see [CONTRIBUTING.md](CONTRIBUTING.md) and
the [Code of Conduct](CODE_OF_CONDUCT.md).

Unofficial fan project. Not affiliated with, endorsed by, or connected to Tesla, Inc. or SpaceX.
"Tesla" and "Roadster" are trademarks of Tesla, Inc., used here only to identify the subject. The
3D car is our own model, built in code after public photos, and carries no Tesla logos, wordmarks
or badges. Figures come from public reporting as of
16 Oct 2026; estimates are marked.
