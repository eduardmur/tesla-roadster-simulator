# Decisions log

Choices made while building Tesla Roadster Simulator. Each entry says what we decided and why.

## Project and repository

- **Name "Tesla Roadster Simulator", repo `tesla-roadster-simulator` (v2.0).** The project
  started as `flying-tesla-explained` (following the brief), became "Flying Tesla" (v1.0), and
  was renamed again at the project owner's request when it became a single-purpose simulator.
  GitHub redirects the old URLs. The "Unofficial fan project. Not affiliated with Tesla." line
  always sits next to the name, so it is clear this is not a Tesla product.
- **TypeScript 6.0, not 7.0.** TS 7 is the newest stable release, but `typescript-eslint`
  (8.71) only supports TS < 6.1, so we pinned `~6.0`.
- **Rapier used directly (`@dimforge/rapier3d-compat`), not `@react-three/rapier`.** The sim
  needs a fixed 120 Hz step, pause, deterministic stepping for captures, and a headless
  autopilot test in Node. An imperative world in `src/sim/world.ts` makes all of this
  straightforward. The declarative wrapper would fight it.
- **Custom raycast vehicle.** We use our own vehicle instead of Rapier's
  `DynamicRayCastVehicleController`. Its tires use the friction circle from
  `src/physics/tires.ts`, so the grip ceiling is exactly μ·N with N including suction. That
  keeps the 3D car consistent with the 1D validation model.

## Facts (checked against the sources on 16 Oct 2026)

A fact-check of every source in the brief turned up some contradictions. The project owner
approved the following changes:

- **Tank sizes follow Lars Moravy via InsideEVs.** The Thrust trim has a **200 L** tank and
  the Rocket adds a **400 L** vessel in place of the passenger seat (600 L total). The brief
  had 400 L + 200 L. Yahoo/MotorTrend's "tripled the total amount of gas" agrees with Moravy.
- **The 4 down + 2 yaw nozzle split is credited to MotorTrend's own analysis** (via Yahoo
  Autos). It is not a Tesla statement. The spec note quotes EV Central ("six thrusters point
  down") and Paul Tan ("at all four corners… firing downwards").
- **The Curl ramp uses the reported geometry.** Paul Tan reports a 170° end pitch about 21 m off
  the ground, which gives R ≈ 10.6 m for a circular curl. (v1 also had a smaller "practice
  curl"; v2 keeps only the reported ramp.)
- **Lift-nozzle thrust is calibrated to the reported 3.3 g landing readout:** 4 × 19 kN at full
  pressure for a 2,350 kg car. The full array is then ~161 kN, which is 5.5× tire-only grip or
  3.5× fan-assisted grip. Tesla's "4–5×" claim sits between the two.
- **The 1.7 / 3.0 / 4.64 g figures are credited to CellCog.** They are CellCog's arithmetic
  from the claimed 0–60 times, not Tesla figures.
- Attribution fixes that don't change any value:
  - The 2–6 h refill quote comes from InsideEVs (Moravy, Top Gear interview), not Paul Tan,
    who wrote that Tesla "didn't say how the tanks are refilled".
  - The 600 L / 250 kg figures are also in Not a Tesla App.
  - The top-speed figure is from Fox Business, and Drive Tesla Canada attributes it to the
    Rocket.
- Not applied, at the owner's choice: Moravy's "roughly five seconds of boost", the reported
  1 MW motor power, and the Waco/McGregor location variants.
- Two sources could not be loaded for verification (HTTP 403): Notebookcheck and Axios. They
  stay in the source list as cited by the brief, and `docs/SOURCES.md` marks them unverified.

## Modelling

- **Thrust-trim duty cap (estimate).** Both thruster trims have the same 4 rear nozzles, yet the
  Thrust trim is claimed to be much slower. We cap its average rear valve duty at 60 %, which
  gives 0–60 mph in 0.86 s against the claimed "under 0.9 s". The Rocket fires at 100 %. We
  say this openly in the UI.
- **Motor model (estimate):** a peak force of 44 kN and peak power of 1,100 kW, calibrated so the
  Performance trim runs 0–60 in 1.47 s (claimed: under 1.6 s).
- **One mass for all trims:** 2,350 kg with full tanks (estimate, adjustable). CellCog infers
  about the same figure, and 46 kN of suction ≈ 2× weight matches Musk's "up to 2 Gs".
- **Compressibility:** a linear Z(p) = 1 + b·p, calibrated per gas so 600 L at 5,500 psi holds
  250 kg (Z ≈ 1.08 for air). At 10,000 psi this underestimates real-gas behaviour. The what-if
  is labelled fiction anyway.
- **Blended thermal mode:** hA = 1.5 kW/K, so a 2 s blowdown stays close to adiabatic. This is
  realistic for a COPV with a polymer liner.
- **Summerfield separation** stops the nozzle-thrust formula from collapsing at low tank
  pressures.
- **PWM:** a 25 Hz period, integrated exactly within each physics step.
- **Physical constants are "confirmed"** and cite a reference page. Unit conversions (psi, mph)
  are exact definitions and live in code, not in the specs.
- **Game-feel tuning lives in code:** suspension stiffness, camera, steering ratio. These
  numbers are never shown on screen, so they are not specs.

## v2: one jump, minimal interface

In v2 the project owner asked for a much simpler product. v1 had a guided tour, lab panels,
challenges, settings and "what if" sliders. The feedback was that it was overcomplicated, so v2:

- **Does one thing.** The car starts parked in front of the reported 170° ramp. **Launch** hands
  it to the autopilot; holding **W** lets you drive it yourself with the assists on. Everything
  else (the tour, lab, X-ray, other challenges, the test pad, trims, slow motion and scrub-back,
  settings) was removed. The physics module keeps all of it, because its tests check it against
  every reported number.
- **Has a Tesla-screen-like interface:** the name and the unofficial notice top left, "How it
  works" and mute top right, speed and three quiet readouts (suction, thrust, air) bottom left,
  and one button. White on black, system font, no accent colours. It borrows the mood, not any
  Tesla marks, fonts or logos.
- **Takes its look from the reveal's night setting** (described in coverage and in stills the
  owner shared): a dark sky, a lit concrete curl with red light strips and a truss, red runway
  lamps and blue searchlights. Everything is still procedural.
- **Has quieter sound.** v1 used oscillators for the fan and motor, which read as a constant
  whine. v2 has no tones at all: filtered noise for the gas hiss and a low rumble, both driven
  only by the air flow, so it is silent when parked.
- **Has a plain-language article** ("How it works") instead of the tour. It is one narrow column
  of text with an animated demonstration of the jump, five simple diagrams, and numbered sources
  at the end. The same HTML is shown in the app and generated as the static `/how-it-works`
  page at build time, so the two cannot drift apart.

## 3D app

- **No downloaded assets at all.** The sky, ground, ramp, reflections (in-scene light panels)
  and sound are procedural. The car body is lofted from cross-sections, and its windows are
  drawn per pixel in the shader. That removes any licensing questions and keeps the first load
  small.
- **Rapier "compat" build.** It embeds its WASM, so the physics chunk is about 1.7 MB gzipped. It
  is lazy-loaded after the first frame of the scene, so the page shows the car before physics
  is ready. The non-compat build would be smaller but needs WASM bundler plugins in both Vite
  and Vitest.
- **Slow climb on the reported curl.** Entering a 10.6 m radius loop at 80+ km/h is a ~5 g
  pull-up that bottoms out any suspension. The autopilot enters at ~40 km/h and climbs at
  ~32 km/h, letting suction hold the car on. The peak load at touchdown in the sim is about 5 g,
  including the suspension hitting its stops. The reported in-car readout was 3.3 g.
- **Ramp speed assist (always on when you drive).** A naive "hold W" run reaches the curl far too
  fast, where v²/R is many g. The suspension bottoms out and the car bounces off or lands very
  hard, which is what physics says. With the assist, W means "go at a safe speed" on the run-in
  and climb, and the flight assists handle the roll and landing, so a first-time visitor can
  finish the trick. Tests cover both: the assisted naive run lands under 8 g, and the unassisted
  one lands at least 1.5× harder (or fails).
- **Film-style cameras.** The autopilot run cuts between fixed shots (behind the car, beside the
  ramp, the landing from the runway, then a slow orbit). Driving yourself uses a chase camera.
  Camera shake is off with reduced motion.
- **The `/how-it-works` page is generated at build time** by `scripts/howItWorks.ts` from
  `src/article/article.ts`. Every number in it comes from `specs.ts` or from
  `src/data/derived.ts` (computed from specs by the physics module).
- **Cross-browser checks.** CI runs the full Playwright smoke suite on Chromium with software
  WebGL. Headless Firefox on CI runners has no WebGL 2, so its CI job checks the graceful fallback
  and the text page instead. That is itself a requirement, and a dedicated test forces it in
  Chromium too.
- **Test hook.** `window.__trs` exposes the host, the app store and the camera director so the
  smoke tests and the media script can drive the app. It sends nothing anywhere.
