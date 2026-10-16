/** Test pad structures: both curls, the tube, the tilt rig, parked cars, hover pad, gates, cones. */
import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  CURLS,
  DRAG_STRIP,
  EIGHTH_MILE,
  HOVER_PAD,
  PARKED_CARS,
  PARKED_CAR_BOXES,
  TILT_RIG,
  TUBE,
  conePositions,
  curlNormal,
  curlPoint,
  type CurlSpec,
} from '../../sim/track';
import { COLORS } from '../../ui/theme';

const concrete = new THREE.MeshStandardMaterial({ color: '#9b9690', roughness: 0.85 });
const steel = new THREE.MeshStandardMaterial({ color: '#3d434c', roughness: 0.5, metalness: 0.7 });
const paintYellow = new THREE.MeshStandardMaterial({ color: '#d9a62b', roughness: 0.6 });

/** Solid curl: inner riding face, outer face and the two sides. */
function curlSlabGeometry(c: CurlSpec, segments = 96): THREE.BufferGeometry {
  const pos: number[] = [];
  const nor: number[] = [];
  const idx: number[] = [];
  const half = c.width / 2;
  const push = (p: number[], n: number[]) => {
    pos.push(...p);
    nor.push(...n);
    return pos.length / 3 - 1;
  };
  const ring = (sideX: number, outer: boolean, theta: number) => {
    const p = curlPoint(c, theta, c.x + sideX);
    const n = curlNormal(theta);
    if (outer) {
      p[1] -= n[1] * c.thickness;
      p[2] -= n[2] * c.thickness;
    }
    return p;
  };
  const faces: {
    a: (t: number) => number[];
    b: (t: number) => number[];
    n: (t: number) => number[];
  }[] = [
    { a: (t) => ring(half, false, t), b: (t) => ring(-half, false, t), n: (t) => curlNormal(t) },
    {
      a: (t) => ring(-half, true, t),
      b: (t) => ring(half, true, t),
      n: (t) => curlNormal(t).map((v) => -v),
    },
    { a: (t) => ring(half, true, t), b: (t) => ring(half, false, t), n: () => [1, 0, 0] },
    { a: (t) => ring(-half, false, t), b: (t) => ring(-half, true, t), n: () => [-1, 0, 0] },
  ];
  for (const f of faces) {
    let prev: [number, number] | null = null;
    for (let i = 0; i <= segments; i++) {
      const t = (i / segments) * c.arc;
      const n = f.n(t);
      const ia = push(f.a(t), n);
      const ib = push(f.b(t), n);
      if (prev) idx.push(prev[0], prev[1], ia, prev[1], ib, ia);
      prev = [ia, ib];
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}

/** Steel truss: arch ribs along both sides, legs to the ground, and cross beams. */
function curlTrussGeometry(c: CurlSpec): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const off = c.width / 2 + 0.6;
  const beam = (a: THREE.Vector3, b: THREE.Vector3, r: number) => {
    const len = a.distanceTo(b);
    const g = new THREE.CylinderGeometry(r, r, len, 8, 1);
    g.translate(0, len / 2, 0);
    const q = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      b.clone().sub(a).normalize(),
    );
    g.applyQuaternion(q);
    g.translate(a.x, a.y, a.z);
    parts.push(g);
  };
  const ribPoint = (side: number, t: number) => {
    const p = curlPoint(c, t, c.x + side * off);
    const n = curlNormal(t);
    return new THREE.Vector3(
      p[0],
      p[1] - n[1] * (c.thickness + 0.25),
      p[2] - n[2] * (c.thickness + 0.25),
    );
  };
  const steps = 22;
  for (const side of [1, -1]) {
    for (let i = 0; i < steps; i++) {
      const t0 = (i / steps) * c.arc;
      const t1 = ((i + 1) / steps) * c.arc;
      beam(ribPoint(side, t0), ribPoint(side, t1), 0.12);
    }
    for (let i = 3; i <= steps; i += 3) {
      const t = (i / steps) * c.arc;
      const top = ribPoint(side, t);
      if (top.y > 1) beam(new THREE.Vector3(top.x, 0, top.z), top, 0.16);
      // Diagonal brace.
      const t2 = Math.max(0, ((i - 3) / steps) * c.arc);
      const b2 = ribPoint(side, t2);
      beam(new THREE.Vector3(b2.x, 0, b2.z), top, 0.07);
    }
  }
  for (let i = 1; i <= steps; i += 2) {
    const t = (i / steps) * c.arc;
    beam(ribPoint(1, t), ribPoint(-1, t), 0.08);
  }
  return mergeGeometries(parts)!;
}

function Curl({ curl }: { curl: CurlSpec }) {
  const slab = useMemo(() => curlSlabGeometry(curl), [curl]);
  const truss = useMemo(() => curlTrussGeometry(curl), [curl]);
  const lip = useMemo(() => {
    const p = curlPoint(curl, curl.arc, curl.x);
    return p;
  }, [curl]);
  return (
    <group>
      <mesh geometry={slab} material={concrete} castShadow receiveShadow />
      <mesh geometry={truss} material={steel} castShadow />
      {/* Hazard stripe at the lip. */}
      <mesh
        position={[lip[0], lip[1] + 0.02, lip[2]]}
        rotation-x={-curl.arc}
        material={paintYellow}
      >
        <boxGeometry args={[curl.width, 0.03, 0.3]} />
      </mesh>
    </group>
  );
}

function Tube() {
  const shell = useMemo(() => {
    const g = new THREE.CylinderGeometry(
      TUBE.radius + 0.02,
      TUBE.radius + 0.02,
      TUBE.length,
      72,
      1,
      true,
    );
    g.rotateX(Math.PI / 2);
    return g;
  }, []);
  const ribs = useMemo(() => {
    const parts: THREE.BufferGeometry[] = [];
    for (let z = -TUBE.length / 2; z <= TUBE.length / 2 + 0.01; z += 7) {
      const r = new THREE.TorusGeometry(TUBE.radius + 0.35, 0.18, 6, 48);
      r.translate(0, 0, z);
      parts.push(r);
    }
    return mergeGeometries(parts)!;
  }, []);
  const strips = useMemo(() => {
    const parts: THREE.BufferGeometry[] = [];
    for (const a of [Math.PI * 0.5, Math.PI, Math.PI * 1.5]) {
      const b = new THREE.BoxGeometry(0.12, 0.05, TUBE.length * 0.95);
      b.translate(0, -TUBE.radius + 0.06, 0);
      b.rotateZ(a);
      parts.push(b);
    }
    return mergeGeometries(parts)!;
  }, []);
  return (
    <group position={[TUBE.x, TUBE.radius - 0.02, TUBE.z]}>
      <mesh geometry={shell} receiveShadow>
        <meshStandardMaterial color="#8b8781" roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={ribs} material={steel} castShadow />
      <mesh geometry={strips}>
        <meshStandardMaterial
          color="#fff"
          emissive="#cfe6ff"
          emissiveIntensity={1.4}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function TiltRig({ angle }: { angle: () => number }) {
  const slab = useRef<THREE.Group>(null);
  useFrame(() => {
    if (slab.current) slab.current.rotation.z = angle();
  });
  const r = TILT_RIG;
  return (
    <group position={[r.x, 0, r.z]}>
      <group ref={slab} position={[0, r.axleHeight, 0]}>
        <mesh position={[0, -r.thickness / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[r.width, r.thickness, r.length]} />
          <meshStandardMaterial color="#6f7378" roughness={0.8} />
        </mesh>
        <mesh position={[r.width / 2 - 0.15, 0.005, 0]}>
          <boxGeometry args={[0.15, 0.01, r.length]} />
          <meshStandardMaterial
            color={COLORS.suction}
            emissive={COLORS.suction}
            emissiveIntensity={0.6}
          />
        </mesh>
      </group>
      {[-1, 1].map((s) => (
        <group key={s} position={[0, 0, s * (r.length / 2 + 0.6)]}>
          <mesh
            position={[-1.6, r.axleHeight / 2, 0]}
            rotation-z={-0.2}
            material={steel}
            castShadow
          >
            <boxGeometry args={[0.35, r.axleHeight + 0.6, 0.35]} />
          </mesh>
          <mesh position={[1.6, r.axleHeight / 2, 0]} rotation-z={0.2} material={steel} castShadow>
            <boxGeometry args={[0.35, r.axleHeight + 0.6, 0.35]} />
          </mesh>
          <mesh position={[0, r.axleHeight, 0]} rotation-x={Math.PI / 2} material={steel}>
            <cylinderGeometry args={[0.35, 0.35, 0.8, 20]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function ParkedCars() {
  return (
    <group>
      {PARKED_CARS.map((c, i) => (
        <group key={i} position={c.center} rotation-y={c.yaw}>
          {PARKED_CAR_BOXES.map((b, j) => (
            <mesh key={j} position={b.offset} castShadow receiveShadow>
              <boxGeometry args={[b.half[0] * 2, b.half[1] * 2, b.half[2] * 2]} />
              <meshStandardMaterial
                color={j === 1 ? '#2a2f36' : c.color}
                roughness={0.55}
                metalness={0.3}
              />
            </mesh>
          ))}
          {[
            [0.85, 1.4],
            [-0.85, 1.4],
            [0.85, -1.4],
            [-0.85, -1.4],
          ].map(([x, z], k) => (
            <mesh key={k} position={[x!, 0.33, z!]} rotation-z={Math.PI / 2}>
              <cylinderGeometry args={[0.33, 0.33, 0.22, 18]} />
              <meshStandardMaterial color="#111" roughness={0.9} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function HoverPad() {
  return (
    <group position={[HOVER_PAD.x, 0, HOVER_PAD.z]}>
      {[HOVER_PAD.targetHeight - HOVER_PAD.band, HOVER_PAD.targetHeight + HOVER_PAD.band].map(
        (h) => (
          <mesh key={h} position={[0, h, 0]} rotation-x={Math.PI / 2}>
            <torusGeometry args={[HOVER_PAD.radius * 0.95, 0.02, 6, 96]} />
            <meshBasicMaterial
              color={COLORS.suction}
              transparent
              opacity={0.45}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        ),
      )}
      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        const r = HOVER_PAD.radius * 0.95;
        return (
          <mesh key={i} position={[Math.cos(a) * r, 1.4, Math.sin(a) * r]} material={steel}>
            <cylinderGeometry args={[0.05, 0.05, 2.8, 8]} />
          </mesh>
        );
      })}
    </group>
  );
}

function Gate({ z, label }: { z: number; label: string }) {
  const w = DRAG_STRIP.width + 2;
  return (
    <group position={[DRAG_STRIP.x, 0, z]} name={label}>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[(s * w) / 2, 2.5, 0]} material={steel} castShadow>
          <boxGeometry args={[0.3, 5, 0.3]} />
        </mesh>
      ))}
      <mesh position={[0, 5, 0]} material={steel}>
        <boxGeometry args={[w + 0.3, 0.4, 0.4]} />
      </mesh>
      <mesh position={[0, 4.75, 0.21]}>
        <boxGeometry args={[w - 1, 0.08, 0.02]} />
        <meshStandardMaterial
          color="#fff"
          emissive={COLORS.thrust}
          emissiveIntensity={1.5}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function Cones() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const positions = useMemo(() => conePositions(), []);
  const geo = useMemo(() => {
    const cone = new THREE.ConeGeometry(0.18, 0.5, 12);
    cone.translate(0, 0.27, 0);
    const base = new THREE.BoxGeometry(0.42, 0.04, 0.42);
    base.translate(0, 0.02, 0);
    return mergeGeometries([cone, base])!;
  }, []);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    positions.forEach((p, i) => {
      m.makeTranslation(p[0], p[1], p[2]);
      ref.current?.setMatrixAt(i, m);
    });
    if (ref.current) ref.current.instanceMatrix.needsUpdate = true;
  }, [positions]);
  return (
    <instancedMesh ref={ref} args={[geo, undefined, positions.length]} castShadow>
      <meshStandardMaterial color="#ff6a1f" roughness={0.6} />
    </instancedMesh>
  );
}

export function TestPad({ tiltAngle }: { tiltAngle: () => number }) {
  return (
    <group>
      <Curl curl={CURLS.curl} />
      <Curl curl={CURLS.practice} />
      <Tube />
      <TiltRig angle={tiltAngle} />
      <ParkedCars />
      <HoverPad />
      <Gate z={DRAG_STRIP.start} label="start" />
      <Gate z={DRAG_STRIP.start + EIGHTH_MILE} label="eighth" />
      <Gate z={DRAG_STRIP.start + DRAG_STRIP.length} label="quarter" />
      <Cones />
    </group>
  );
}
