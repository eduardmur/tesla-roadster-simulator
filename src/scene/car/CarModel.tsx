/**
 * The procedural car. Hardware appears/disappears by trim; X-ray swaps the body for a ghost
 * shell and lights up the internals; "exploded" pulls the assemblies apart.
 */
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import {
  DOWN_NOZZLES,
  REAR_NOZZLES,
  SUSPENSION_REST,
  TANK_POSITIONS,
  WHEELS,
  YAW_NOZZLES,
  type NozzleLayout,
} from '../../physics/layout';
import { tankPartsFor, type TrimId } from '../../physics/params';
import type { Telemetry } from '../../sim/types';
import {
  FLOOR_Y,
  canopyGeometry,
  capsuleTankGeometry,
  fanDuctGeometry,
  fanRotorGeometry,
  lightBarGeometry,
  nozzleGeometry,
  pipeGeometry,
  podGeometry,
  rimGeometry,
  sphereTankGeometry,
  tireGeometry,
  tubGeometry,
} from './geometry';
import { carMaterials } from './materials';
import { nozzleVisualPosition } from './nozzles';

export interface CarModelProps {
  trim: TrimId;
  xray: boolean;
  exploded: boolean;
  /** Live data, or null for a parked display car. */
  telemetry: () => Telemetry | null;
  reducedMotion?: boolean;
}

const DOWN = new THREE.Vector3(0, -1, 0);

/** Exit radius from the calibrated throat (≈ 21 mm throat, area ratio 8 → ≈ 59 mm exit). */
const EXIT_R = 0.03;

function jetQuaternion(n: NozzleLayout): THREE.Quaternion {
  const jet = new THREE.Vector3(...n.direction).multiplyScalar(-1).normalize();
  return new THREE.Quaternion().setFromUnitVectors(DOWN, jet);
}

const pipePaths = (trim: TrimId): [number, number, number][][] => {
  const M: [number, number, number] = [0, -0.26, -1.25];
  const paths: [number, number, number][][] = [];
  if (trim === 'performance') return paths;
  paths.push([[TANK_POSITIONS.main[0], -0.3, TANK_POSITIONS.main[2]], [0, -0.3, -1.0], M]);
  for (const n of REAR_NOZZLES) {
    paths.push([
      M,
      [n.position[0] * 0.6, -0.2, -1.6],
      [n.position[0], -0.14, -1.85],
      [n.position[0], -0.12, -2.0],
    ]);
  }
  if (trim === 'rocket') {
    const F: [number, number, number] = [0, -0.27, 1.35];
    paths.push([
      [TANK_POSITIONS.passenger[0], -0.28, TANK_POSITIONS.passenger[2]],
      [-0.3, -0.29, -0.5],
      M,
    ]);
    paths.push([M, [0, -0.29, 0], F]);
    for (const n of DOWN_NOZZLES) {
      const from = n.position[2] > 0 ? F : M;
      paths.push([
        from,
        [n.position[0] * 0.5, -0.26, n.position[2] * 0.95],
        [n.position[0], -0.22, n.position[2]],
      ]);
    }
    for (const n of YAW_NOZZLES) {
      const x = Math.sign(n.direction[0]) * -0.9;
      paths.push([F, [x * 0.5, -0.15, 1.7], [x, -0.06, n.position[2]]]);
    }
  }
  return paths;
};

export function CarModel({ trim, xray, exploded, telemetry, reducedMotion }: CarModelProps) {
  const m = carMaterials();
  const geo = useMemo(
    () => ({
      tub: tubGeometry(),
      podL: podGeometry(1),
      podR: podGeometry(-1),
      canopy: canopyGeometry(),
      lightF: lightBarGeometry(true),
      lightR: lightBarGeometry(false),
      tire: tireGeometry(),
      rim: rimGeometry(),
      nozzleRear: nozzleGeometry(EXIT_R, 0.12),
      nozzleSmall: nozzleGeometry(EXIT_R * 0.95, 0.1),
      fanRotor: fanRotorGeometry(0.27),
      fanDuct: fanDuctGeometry(0.27),
    }),
    [],
  );
  const parts = tankPartsFor(trim);
  const mainVolume = parts.find((p) => p.id === 'main')?.volume ?? 0;
  const passengerVolume = parts.find((p) => p.id === 'passenger')?.volume ?? 0;
  const tankGeo = useMemo(
    () => ({
      main: mainVolume > 0 ? sphereTankGeometry(mainVolume) : null,
      passenger: passengerVolume > 0 ? capsuleTankGeometry(passengerVolume) : null,
    }),
    [mainVolume, passengerVolume],
  );
  const pipes = useMemo(() => pipePaths(trim).map((p) => pipeGeometry(p)), [trim]);

  const nozzles = useMemo(() => {
    const list: NozzleLayout[] = [];
    if (trim !== 'performance') list.push(...REAR_NOZZLES);
    if (trim === 'rocket') list.push(...DOWN_NOZZLES, ...YAW_NOZZLES);
    return list;
  }, [trim]);

  // Refs for animation.
  const explode = useRef(0);
  const groups = {
    podL: useRef<THREE.Group>(null),
    podR: useRef<THREE.Group>(null),
    canopy: useRef<THREE.Group>(null),
    tanks: useRef<THREE.Group>(null),
    plumbing: useRef<THREE.Group>(null),
    under: useRef<THREE.Group>(null),
    rear: useRef<THREE.Group>(null),
  };
  const wheelRefs = useRef<(THREE.Group | null)[]>([]);
  const spinRefs = useRef<(THREE.Group | null)[]>([]);
  const fanRefs = useRef<(THREE.Mesh | null)[]>([]);
  const skirtRef = useRef<THREE.Group>(null);
  const valveRefs = useRef<(THREE.Mesh | null)[]>([]);
  const fanAngle = useRef(0);
  const frostColor = useMemo(() => new THREE.Color(), []);

  useFrame((_, dt) => {
    const t = telemetry();
    const target = exploded ? 1 : 0;
    explode.current += (target - explode.current) * Math.min(1, dt * (reducedMotion ? 20 : 4));
    const e = explode.current;
    groups.podL.current?.position.set(0.7 * e, 0, 0);
    groups.podR.current?.position.set(-0.7 * e, 0, 0);
    groups.canopy.current?.position.set(0, 0.9 * e, 0);
    groups.tanks.current?.position.set(0, 1.5 * e, 0);
    groups.plumbing.current?.position.set(0, 0.95 * e, 0);
    groups.under.current?.position.set(0, -0.9 * e, 0);
    groups.rear.current?.position.set(0, 0, -0.7 * e);

    WHEELS.forEach((w, i) => {
      const g = wheelRefs.current[i];
      const s = spinRefs.current[i];
      if (!g || !s) return;
      const wt = t?.wheels[i];
      const comp = wt?.compression ?? 0.066;
      g.position.set(
        w.anchor[0] + Math.sign(w.anchor[0]) * 0.6 * e,
        w.anchor[1] - (SUSPENSION_REST - comp) - 0.0,
        w.anchor[2],
      );
      g.rotation.y = wt?.steer ?? 0;
      s.rotation.x = wt?.spin ?? 0;
    });

    const fan = t?.fanSpeed ?? 0.0;
    fanAngle.current += fan * 40 * dt;
    for (const f of fanRefs.current) if (f) f.rotation.y = fanAngle.current;

    // Skirts drop to meet the surface while the fans are working.
    if (skirtRef.current) {
      const drop = Math.min(1, fan * 1.2) * 0.07;
      skirtRef.current.position.y = -drop;
    }

    // Valve indicators follow the actual on/off state of each valve.
    if (t) {
      valveRefs.current.forEach((v, i) => {
        const n = nozzles[i];
        if (!v || !n) return;
        const nt = t.nozzles.find((x) => x.id === n.id);
        const mat = v.material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = nt?.open ? 3 : 0.15;
      });
      // Frost: the nozzles whiten as the tank gas gets cold.
      const cold = THREE.MathUtils.clamp((273 - t.tankTemperature) / 70, 0, 1);
      frostColor.set('#a7aeb6').lerp(new THREE.Color('#f4f8ff'), cold);
      m.nozzle.color.copy(frostColor);
      m.nozzle.roughness = 0.3 + 0.6 * cold;
      m.nozzle.metalness = 1 - 0.7 * cold;
    }
  });

  const body = xray ? m.ghost : m.paint;
  const glass = xray ? m.ghost : m.glass;
  const trimMat = xray ? m.ghost : m.trim;
  const tankMat = xray ? m.xTank : m.carbon;
  const thrustMat = xray ? m.xThrust : m.nozzle;
  const pipeMat = xray ? m.xPipe : m.metal;
  const fanMat = xray ? m.xSuction : m.fan;
  const skirtMat = xray ? m.xSuction : m.skirt;

  return (
    <group>
      {/* Body shell */}
      <mesh
        geometry={geo.tub}
        material={body}
        castShadow
        receiveShadow
        renderOrder={xray ? 10 : 0}
      />
      <group ref={groups.podL}>
        <mesh
          geometry={geo.podL}
          material={body}
          castShadow
          receiveShadow
          renderOrder={xray ? 10 : 0}
        />
      </group>
      <group ref={groups.podR}>
        <mesh
          geometry={geo.podR}
          material={body}
          castShadow
          receiveShadow
          renderOrder={xray ? 10 : 0}
        />
      </group>
      <group ref={groups.canopy}>
        <mesh geometry={geo.canopy} material={glass} castShadow renderOrder={xray ? 11 : 1} />
      </group>
      {!xray && (
        <>
          <mesh geometry={geo.lightF} material={m.lightFront} />
          <mesh geometry={geo.lightR} material={m.lightRear} />
        </>
      )}

      {/* Cabin: driver seat, steering wheel, and the passenger seat unless the Rocket's tank is there. */}
      <group visible={!xray}>
        <mesh position={[0.4, -0.08, -0.12]} material={m.seat}>
          <boxGeometry args={[0.46, 0.12, 0.5]} />
        </mesh>
        <mesh position={[0.4, 0.12, -0.38]} rotation={[-0.35, 0, 0]} material={m.seat}>
          <boxGeometry args={[0.46, 0.5, 0.1]} />
        </mesh>
        <mesh position={[0.4, 0.2, 0.42]} rotation={[0.35, 0, 0]} material={m.trim}>
          <torusGeometry args={[0.16, 0.018, 8, 24]} />
        </mesh>
        {trim !== 'rocket' && (
          <>
            <mesh position={[-0.4, -0.08, -0.12]} material={m.seat}>
              <boxGeometry args={[0.46, 0.12, 0.5]} />
            </mesh>
            <mesh position={[-0.4, 0.12, -0.38]} rotation={[-0.35, 0, 0]} material={m.seat}>
              <boxGeometry args={[0.46, 0.5, 0.1]} />
            </mesh>
          </>
        )}
      </group>

      {/* Tanks */}
      <group ref={groups.tanks}>
        {tankGeo.main && (
          <mesh
            geometry={tankGeo.main}
            material={tankMat}
            position={TANK_POSITIONS.main}
            castShadow
          />
        )}
        {tankGeo.passenger && (
          <mesh
            geometry={tankGeo.passenger}
            material={tankMat}
            position={[TANK_POSITIONS.passenger[0], 0.02, 0.33]}
            castShadow
          />
        )}
      </group>

      {/* Plumbing and valves */}
      <group ref={groups.plumbing} visible={xray || exploded}>
        {pipes.map((g, i) => (
          <mesh key={i} geometry={g} material={pipeMat} />
        ))}
        {nozzles.map((n, i) => {
          const p = nozzleVisualPosition(n);
          const valvePos: [number, number, number] = n.id.startsWith('R')
            ? [n.position[0], -0.14, -1.86]
            : n.id.startsWith('D-')
              ? [n.position[0], -0.2, n.position[2]]
              : [p.x * 0.88, -0.06, n.position[2]];
          return (
            <mesh
              key={n.id}
              position={valvePos}
              ref={(el) => {
                valveRefs.current[i] = el;
              }}
            >
              <boxGeometry args={[0.07, 0.06, 0.07]} />
              <meshStandardMaterial
                color="#2a2f36"
                emissive="#ffd27a"
                emissiveIntensity={0.15}
                toneMapped={false}
              />
            </mesh>
          );
        })}
      </group>

      {/* Underbody: floor, fans, skirts */}
      <group ref={groups.under}>
        <mesh position={[0, FLOOR_Y - 0.005, 0]} material={xray ? m.ghost : m.floor} receiveShadow>
          <boxGeometry args={[1.86, 0.01, 3.7]} />
        </mesh>
        {[0.55, -0.55].map((z, i) => (
          <group key={z} position={[0, FLOOR_Y - 0.03, z]}>
            <mesh geometry={geo.fanDuct} material={fanMat} />
            <mesh
              geometry={geo.fanRotor}
              material={fanMat}
              ref={(el) => {
                fanRefs.current[i] = el;
              }}
            />
          </group>
        ))}
        <group ref={skirtRef}>
          {/* Sealed rectangle 2.5 m × 1.6 m (estimate). */}
          <mesh position={[0.8, FLOOR_Y - 0.04, 0]} material={skirtMat}>
            <boxGeometry args={[0.015, 0.08, 2.5]} />
          </mesh>
          <mesh position={[-0.8, FLOOR_Y - 0.04, 0]} material={skirtMat}>
            <boxGeometry args={[0.015, 0.08, 2.5]} />
          </mesh>
          <mesh position={[0, FLOOR_Y - 0.04, 1.25]} material={skirtMat}>
            <boxGeometry args={[1.6, 0.08, 0.015]} />
          </mesh>
          <mesh position={[0, FLOOR_Y - 0.04, -1.25]} material={skirtMat}>
            <boxGeometry args={[1.6, 0.08, 0.015]} />
          </mesh>
        </group>
      </group>

      {/* Nozzles */}
      <group ref={groups.rear}>
        {trim !== 'performance' && (
          <mesh position={[0, -0.16, -2.04]} material={trimMat}>
            <boxGeometry args={[1.7, 0.12, 0.2]} />
          </mesh>
        )}
      </group>
      {nozzles.map((n) => {
        const p = nozzleVisualPosition(n);
        const q = jetQuaternion(n);
        return (
          <group key={n.id} position={p} quaternion={q}>
            <mesh
              geometry={n.id.startsWith('R') ? geo.nozzleRear : geo.nozzleSmall}
              material={thrustMat}
              castShadow
            />
            <mesh position={[0, 0.07, 0]} material={trimMat}>
              <cylinderGeometry args={[0.055, 0.06, 0.05, 20, 1, true]} />
            </mesh>
          </group>
        );
      })}

      {/* Wheels */}
      {WHEELS.map((w, i) => (
        <group
          key={w.id}
          ref={(el) => {
            wheelRefs.current[i] = el;
          }}
          position={[w.anchor[0], w.anchor[1] - SUSPENSION_REST + 0.066, w.anchor[2]]}
        >
          <group
            ref={(el) => {
              spinRefs.current[i] = el;
            }}
          >
            <mesh geometry={geo.tire} material={xray ? m.ghost : m.tire} castShadow />
            <mesh
              geometry={geo.rim}
              material={xray ? m.ghost : m.rim}
              scale={[w.anchor[0] > 0 ? 1 : -1, 1, 1]}
            />
          </group>
        </group>
      ))}
    </group>
  );
}

/** Simplified translucent car used for the autopilot ghost. */
export function GhostCarModel() {
  const m = carMaterials();
  const geo = useMemo(
    () => ({
      tub: tubGeometry(),
      podL: podGeometry(1),
      podR: podGeometry(-1),
      canopy: canopyGeometry(),
    }),
    [],
  );
  return (
    <group>
      <mesh geometry={geo.tub} material={m.ghostCar} />
      <mesh geometry={geo.podL} material={m.ghostCar} />
      <mesh geometry={geo.podR} material={m.ghostCar} />
      <mesh geometry={geo.canopy} material={m.ghostCar} />
    </group>
  );
}
