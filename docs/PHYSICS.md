# The physics, in plain language

This document explains every model in `src/physics/`. Each section starts with the idea in
plain words, then gives the formulas the code uses. All units are SI unless stated.

Every number below comes from [`src/data/specs.ts`](../src/data/specs.ts), where it is tagged
**reported** (from coverage of the 15 Oct 2026 reveal), **estimate** (our assumption or
calibration) or **confirmed** (a textbook constant). The validation tests in
[`tests/physics/`](../tests/physics/) check that the models reproduce the reported numbers.

The physics module is pure TypeScript. It has no rendering imports, it is deterministic, and the
3D simulation steps it at a fixed 120 Hz.

---

## 1. Why tires limit acceleration

A tire can only push along the road as hard as the road pushes back on it, times a friction
coefficient μ:

```
F_tire ≤ μ · N
```

On flat ground with nothing else going on, `N = m·g`, so the best possible acceleration is
`a = μ·g`. Lars Moravy said the Roadster's tires alone manage about **1.26 g** (reported), so
we use μ = 1.26. In our model, 0–60 mph on tires alone takes about **2.2 s** however much
motor power you add.

There are two ways to beat this limit:

1. **Raise N without adding mass.** Suction pulls the car onto the road, so N rises while the
   mass stays the same, and grip rises with it.
2. **Don't use the tires at all.** A thruster pushes on the car directly, so μ never comes into
   it.

`tires.ts` implements `normalLoad`, `gripLimit` and a friction circle (`√(Fx² + Fy²) ≤ μN`).
The 3D car uses the friction circle for each tire.

### Motors

With the fans on, grip is no longer the bottleneck. The motors are. We model the motors as a
peak tractive force and a peak power:

```
F_motor(v) = min(F_peak, P_peak / v)
```

F_peak = 44 kN and P_peak = 1,100 kW are **estimates**. We calibrated them so the Performance
trim (fans, no thrusters) runs 0–60 mph just under its claimed 1.6 s. Our model gives 1.47 s.

---

## 2. Suction: sucked onto the road

The underbody fans pump air out from under the car. Deployable skirts seal the gap to the road,
so the pressure under the car drops below ambient. The atmosphere then presses down on the roof
harder than the thinner air under the floor presses up:

```
D = Δp · A_floor · η_seal
```

**The aha:** the reveal showed a downforce readout of **4,700 kg** (reported). That is about
46 kN. Over a sealed floor of about 4 m² (**estimate**), it needs a pressure drop of only

```
Δp = 46,100 N / 4 m² ≈ 11.5 kPa  ≈ 11 % below ambient (101.3 kPa)
```

That is roughly the pressure difference between sea level and the top of a 1,000 m hill. The
trick is the large area, not a strong vacuum.

### Fan curve versus leakage

The fans can only hold that Δp if they pump out as much air as leaks back in under the skirts.
We model both sides:

```
Fan:    Q_fan  = Q_max · n · √(1 − Δp / (Δp_max · n² · ρ/ρ_ref))      n = fan speed 0..1
Leak:   Q_leak = C_d · P · g · √(2·Δp / ρ)                            P = skirt perimeter, g = gap
```

The suction you get is where the two flows meet, found by bisection in
`equilibriumSuction`. We calibrated the fan's free-delivery flow `Q_max` so that a sealed floor
(4 mm equivalent leak gap, **estimate**) at full fan speed holds exactly 11.5 kPa.

Leakage grows very fast with the gap:

| Equivalent gap | Δp       | Downforce |
| -------------- | -------- | --------- |
| 4 mm (sealed)  | 11.5 kPa | 46 kN     |
| 1 cm           | 5.9 kPa  | 24 kN     |
| 2 cm           | 2.2 kPa  | 9 kN      |
| 5 cm           | 0.4 kPa  | 1.6 kN    |

### Measuring the gap

The 3D sim fires 8 rays from points around the skirt line along the car's local −Y axis. The
skirts can extend up to 0.25 m (**estimate**) to follow the surface. Whatever distance is left
over is open gap. A ray that hits nothing counts as fully open (0.5 m). Leakage is weighted by
perimeter, so we average the gaps:

```
g_eff = g_residual + mean_i( clamp(d_i − reach, 0, 0.5 m) )
```

### Dynamics: why the curl ramp works

The plenum pressure relaxes toward the equilibrium with a time constant. That is 0.15 s when
suction builds up and 0.05 s when it collapses (**estimates**). The fan speed itself spins up
with a 0.4 s time constant. When the car reaches the end of the curl, the rays at the leading
edge suddenly find nothing, the gap blows open, and suction falls by 90 % in about 0.1 s. Weight
takes over and the car drops away from the ramp. The test `suction collapses within a fraction
of a second` checks this.

### Direction

Downforce always acts along the car's own −Y axis, toward whatever surface the skirts are
sealed against. That is why the car can drive on a wall or a ceiling. On a ceiling, the tires
are pressed onto the surface with `N = D − m·g`, which is about 23 kN, so they still have
`μ·N ≈ 29 kN` of grip.

### Fan power

```
P_fan = Q · Δp / η
```

At the sealed operating point, Q ≈ 2.7 m³/s and η = 0.55 (**estimate**), which gives
**≈ 57 kW**. The fans run on battery power and do not use the air tanks (reported).

### Moon and Mars

The fans' pressure rise scales with air density and can never exceed ambient pressure. On the
Moon there is no air, so there is no suction at all.

---

## 3. A tank of air

The Rocket carries **600 L** of air in two composite-overwrapped pressure vessels (COPVs):
200 L behind the seats and 400 L in place of the passenger seat. Together they hold **about
250 kg** of air (all reported). The Thrust trim has only the 200 L tank. An in-car screen
showed **5,500 psi** (≈ 379 bar, reported). Older Musk statements said ~10,000 psi. That
figure is available as a "what if".

### Equation of state

An ideal gas at 379 bar and 20 °C in 600 L would weigh 271 kg, not 250 kg. Real gas at this
pressure is less compressible than ideal. We capture this with a compressibility factor that
grows linearly with pressure:

```
p·V = Z(p)·m·R·T,     Z(p) = 1 + b·p,     so  p = ρRT / (1 − b·ρRT)
```

We calibrated b so the reported 600 L at 5,500 psi hold 250 kg. That gives Z ≈ 1.08
(**estimate**), which is in the right range for nitrogen at that pressure.

### Blowdown

There is no pump. The tank just empties:

```
dm/dt = −ṁ
m·c_v·dT/dt = −ṁ·R·T + Q̇
```

The second line is the energy balance. The gas that stays behind does work pushing the
escaping gas out, so it cools. There are three thermal modes:

- **adiabatic**: `Q̇ = 0`, so `T = T₀·(m/m₀)^(γ−1)`. For an ideal gas that equals
  `T₀·(p/p₀)^((γ−1)/γ)`. Blowing down to a third of the pressure chills the gas from 20 °C to
  about −56 °C.
- **isothermal**: the walls keep `T = T₀`. Pressure falls more slowly and the tank lasts
  longer.
- **blended** (default): `Q̇ = hA·(T_wall − T)` with hA = 1.5 kW/K (**estimate**). Over a
  2-second blowdown this is close to adiabatic. Over minutes the gas warms back up and the
  pressure recovers a little.

Thrust is roughly proportional to tank pressure, and pressure falls as the tank empties, so
the car gets weaker as it uses its air.

The code uses the exact isentropic update for the adiabatic part and a backward-Euler step
for the heat transfer, so the update is stable at any step size.

Air: γ = 1.4, R = 287 J/(kg·K). The nitrogen preset uses R = 296.8. Ambient pressure is
101,325 Pa and T₀ = 293 K.

---

## 4. How a nozzle makes thrust

A cold-gas thruster is a valve plus a converging–diverging (de Laval) nozzle. No combustion
takes place. Compressed gas expands and speeds up, and the car is pushed the other way.

### Choked flow

Once the tank pressure is more than about 1.9× ambient, the flow at the narrowest point (the
throat) reaches the speed of sound and the mass flow stops depending on the outside pressure:

```
ṁ = C_d · A_t · p₀ · √(γ / (R·T₀)) · (2/(γ+1))^((γ+1)/(2(γ−1)))
```

### Supersonic expansion

After the throat, the nozzle widens and the gas accelerates beyond Mach 1. The exit Mach
number follows from the exit-to-throat area ratio alone:

```
A_e/A_t = (1/M) · [ (2/(γ+1)) · (1 + (γ−1)/2 · M²) ]^((γ+1)/(2(γ−1)))
```

We solve this numerically with bisection. The exit temperature and pressure follow from the
isentropic relations, and the exit velocity is `v_e = M_e·√(γ·R·T_e)`.

### Thrust

```
F = ṁ · v_e + (p_e − p_a) · A_e
```

We chose an area ratio of 8 (**estimate**). At full pressure that gives an exit Mach number of
3.7 and an exit pressure of about 3.9 bar, well above ambient. The jet is **under-expanded**,
so it keeps expanding outside the nozzle in a chain of shock diamonds. A rough rule of thumb
from Wikipedia puts the first diamond at `x ≈ 0.67·D·√(p_e/p_a)` downstream. The exhaust is
also extremely cold (about 80 K), which is why the plume looks like white condensation.

### Calibration to 80 kN

Every term of the thrust equation scales with the throat area at a fixed area ratio, so we can
solve exactly for the throat area that gives the reported **80 kN** from 4 rear nozzles at
5,500 psi. The result:

- throat diameter ≈ 21 mm per nozzle
- total mass flow ≈ **117 kg/s**
- effective exhaust velocity `F/ṁ` ≈ **682 m/s**

So 250 kg of air lasts `250 / 117 ≈ 2.1 s` of full rear thrust. That matches CellCog's
independent "about two seconds of full thrust per fill".

### Low pressure and vacuum

- When the tank pressure falls far enough that the jet would be heavily over-expanded, the
  flow separates from the nozzle wall where the pressure reaches ≈ 0.4·p_a (the Summerfield
  criterion). We model this so thrust doesn't collapse unrealistically.
- Below the choking ratio, the flow is subsonic everywhere.
- **Moon mode** (`p_a = 0`): the pressure term grows by `p_a·A_e` per nozzle, so thrust goes
  up by about 1 kN in total.

### Valves are on/off

Real cold-gas thrusters use valves that are fully open or fully shut. To get "half thrust" the
valve opens for half of each short period (pulse-width modulation). We use a 40 ms period
(**estimate**). The sim integrates the exact open time within each 1/120 s step, so the average
force is right even though the valve is always either on or off.

---

## 5. Hover and the hop

To hover, thrust must equal weight: `2,350 kg × 9.81 m/s² ≈ 23 kN`. At full pressure the lift
nozzles deliver that while using `23 kN / 682 m/s ≈ 34 kg/s` of air. That is why a hop lasts
seconds, not minutes.

The layout of the Rocket's extra six nozzles (4 pointing down, 2 at the front pointing
left/right) is MotorTrend's own calculation, reported via Yahoo Autos. Other outlets describe
it differently. We use 19 kN per lift nozzle (**estimate**). We chose it so the four of them
give 3.3 g for a full 2,350 kg car, which matches the 3.3 g readout reported during the
landing. With this value, the whole Rocket array is about 161 kN. That is 5.5× the tire-only
grip, or 3.5× the fan-assisted grip, and Tesla's "4–5× the force the tires can" sits in
between.

---

## 6. The flight computer

`flightComputer.ts` stabilises the Rocket in the air:

- **Rate loop.** `τ = I · k_rate · (ω_cmd − ω)` with k_rate = 10 /s. The pilot's stick sets
  `ω_cmd`.
- **Attitude assists.**
  - _Auto-level_ (on by default) finds the roll error from the (x, y) projection of world-up
    in the body frame and the pitch error from the (z, y) projection. It rolls first when the
    car is upside down, because rolling is about 3.7× easier than pitching (the inertia about
    the long axis is much smaller).
  - _Roll 180°_ runs a profile `ω = min(ω_max, √(α·|err|), k·|err|)`, which accelerates and
    then brakes into the target.
- **Lift.** With the assist on, the lift input sets a target vertical speed between −1 and
  +3 m/s. With no input, a _landing assist_ follows the braking profile
  `v_z = −√(v_touch² + 2·f·a_avail·h)`. It lets the car fall until it has to brake, then burns
  hard, which is the most air-efficient way down. Feed-forward from
  `a = (v² − v_touch²)/(2h)` keeps it on the profile.
- **Mixer.** The four lift nozzles must produce (lift, pitch torque, roll torque). We solve
  with the pseudo-inverse of the 3×4 allocation matrix. Nozzles can only push, so a pure
  torque always comes with some net lift. When saturated, the mixer keeps the torque and gives
  up lift. The two yaw nozzles handle yaw.
- **Hard mode.** Turning the assists off gives you raw lift and leaves auto-levelling to you.
  The rate damping stays on.

---

## 7. Launch (0–60 mph)

`launch.ts` integrates a straight-line launch at 1 kHz:

```
m·dv/dt = min(F_motor(v), μ·(m·g + D)) + F_thrust(t) − ½·ρ·C_dA·v² − C_rr·N
```

The car gets lighter as it uses air. Results with default parameters:

| Trim                                | Claimed (reported) | Our model |
| ----------------------------------- | ------------------ | --------- |
| Tires only (fans and thrusters off) | —                  | 2.20 s    |
| Performance                         | under 1.6 s        | 1.47 s    |
| Thrust                              | under 0.9 s        | 0.86 s    |
| Rocket                              | under 0.59 s       | 0.57 s    |

**An honest caveat.** Both the Thrust and Rocket trims reportedly have the same 4 rear
thrusters, but Thrust is claimed to be much slower. Tesla has not said why. Part of the gap is
real in our model: the Thrust trim's 200 L tank loses pressure three times faster. That alone
is not enough, so we also cap the Thrust trim's average valve duty at 60 % (**estimate**,
calibrated to the claim). The Rocket uses full thrust.

---

## 8. Refill energy

The minimum work to compress air from ambient pressure into the tank while keeping it at
ambient temperature is

```
W = m · R · T · ln(p_tank / p_a) = 250 · 287 · 293 · ln(379 bar / 1.013 bar) ≈ 124.6 MJ ≈ 34.6 kWh
```

A real multi-stage compressor at around 50 % efficiency (**estimate**) needs about **69 kWh**,
roughly the energy in a mid-size EV battery. Reported refill times are 2–6 hours from an
external nitrogen supply (Moravy, via InsideEVs). That works out to an average compressor
power of about 12–35 kW. Musk says the car refills its own tanks. We show both claims.

---

## What we deliberately simplify

- The tanks are one lumped volume, even though the Rocket has two COPVs plumbed together.
- The energy balance uses ideal-gas internal energy. Only the equation of state includes Z.
- We ignore condensation in the jet, even though the exhaust is cold enough to form it. That
  is why the plume looks white, but it barely changes thrust.
- The skirts are idealised as a perimeter leak with an equivalent gap.
- The high-speed fan mode (front and rear openings) is shown visually, but the suction model
  stays the same because the details are not published.
- The tire model is a friction circle with velocity-based slip, which is good enough to show
  the grip ceiling. It is not a Pacejka model.
