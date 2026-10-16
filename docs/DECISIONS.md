# Decisions log

Choices made while building Flying Tesla, newest last. Each entry says what we
decided and why.

## Project and repository

- **Name "Flying Tesla", repo `flying-tesla`.** The repo was first created as
  `flying-tesla-explained`, following the brief's `gh repo create` command. The project owner
  then asked for "Flying Tesla" without "Explained", so it was renamed (GitHub redirects the
  old URL). The "Unofficial educational simulation. Not affiliated with Tesla or SpaceX." line
  always sits next to the name, which keeps it clear this is an explainer and not a Tesla
  product.
- **TypeScript 6.0, not 7.0.** TS 7 is the newest stable release, but `typescript-eslint`
  (8.71) only supports TS < 6.1, so we pinned `~6.0`.
- **Rapier used directly (`@dimforge/rapier3d-compat`), not `@react-three/rapier`.** The sim
  needs a fixed 120 Hz step, slow motion, pause, a 10-second scrub-back that restores
  rigid-body state, and a headless autopilot test in Node. An imperative world in
  `src/sim/world.ts` makes all of this straightforward. The declarative wrapper would fight it.
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
  the ground, which gives R ≈ 10.6 m for a circular curl. A smaller 5 m "practice curl"
  (estimate) is also available so everyone can finish the challenge.
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
