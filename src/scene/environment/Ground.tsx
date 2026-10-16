/**
 * Desert ground with a concrete test pad, an asphalt drag strip and lane markings, all drawn
 * in the fragment shader from world position (no texture downloads). Lighting and shadows come
 * from MeshStandardMaterial; we only replace the albedo.
 */
import { useMemo } from 'react';
import * as THREE from 'three';
import { CURLS, DRAG_STRIP, EIGHTH_MILE, HOP_LANE, HOVER_PAD, TUBE } from '../../sim/track';

const f = (n: number) => n.toFixed(3);

export function Ground() {
  const material = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95, metalness: 0 });
    const lanes = [CURLS.curl, CURLS.practice];
    mat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWorldPos;')
        .replace(
          '#include <worldpos_vertex>',
          '#include <worldpos_vertex>\nvWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;',
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          /* glsl */ `#include <common>
varying vec3 vWorldPos;
float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n2(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h2(i), h2(i + vec2(1, 0)), u.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * n2(p); p *= 2.03; a *= 0.5; } return s; }
float box(vec2 p, vec2 lo, vec2 hi) { return step(lo.x, p.x) * step(p.x, hi.x) * step(lo.y, p.y) * step(p.y, hi.y); }
float lineAt(float v, float at, float w) { return 1.0 - smoothstep(w * 0.5, w * 0.5 + 0.02, abs(v - at)); }
`,
        )
        .replace(
          '#include <color_fragment>',
          /* glsl */ `#include <color_fragment>
vec2 p = vWorldPos.xz;
float n = fbm(p * 0.08) * 0.6 + fbm(p * 1.3) * 0.4;
vec3 sand = mix(vec3(0.62, 0.45, 0.31), vec3(0.74, 0.56, 0.39), n);
sand *= 0.85 + 0.15 * fbm(p * 0.01);
vec3 col = sand;
// Concrete test pad.
float pad = box(p, vec2(-150.0, -200.0), vec2(150.0, 130.0));
vec3 concrete = vec3(0.6, 0.575, 0.54) * (0.84 + 0.2 * n);
concrete *= 0.92 + 0.08 * fbm(p * 0.35);
vec2 j = abs(fract(p / 6.0) - 0.5);
float joint = 1.0 - smoothstep(0.0, 0.006, 0.497 - max(j.x, j.y));
concrete *= 1.0 - 0.45 * joint;
col = mix(col, concrete, pad);
// Run-in lanes for the curls and the hop lane.
${lanes
  .map(
    (
      c,
    ) => `{ float lane = box(p, vec2(${f(c.x - c.width / 2 - 0.5)}, ${f(c.runInStart - 6)}), vec2(${f(c.x + c.width / 2 + 0.5)}, ${f(c.z0 + 1)}));
col = mix(col, vec3(0.34, 0.34, 0.35) * (0.9 + 0.1 * n), lane);
col = mix(col, vec3(0.92, 0.9, 0.8), lane * lineAt(p.x, ${f(c.x)}, 0.15) * step(0.5, fract(p.y / 6.0))); }`,
  )
  .join('\n')}
{ float lane = box(p, vec2(${f(HOP_LANE.x - 6)}, ${f(HOP_LANE.start - 6)}), vec2(${f(HOP_LANE.x + 6)}, ${f(HOP_LANE.carsZ + 40)}));
col = mix(col, vec3(0.36, 0.36, 0.37) * (0.9 + 0.1 * n), lane); }
// Drag strip.
{ float strip = box(p, vec2(${f(DRAG_STRIP.x - DRAG_STRIP.width / 2)}, ${f(DRAG_STRIP.start - 20)}), vec2(${f(DRAG_STRIP.x + DRAG_STRIP.width / 2)}, ${f(DRAG_STRIP.start + DRAG_STRIP.length + 120)}));
vec3 asphalt = vec3(0.13, 0.135, 0.145) * (0.85 + 0.3 * fbm(p * 2.0));
col = mix(col, asphalt, strip);
float edge = lineAt(p.x, ${f(DRAG_STRIP.x - DRAG_STRIP.width / 2 + 0.4)}, 0.15) + lineAt(p.x, ${f(DRAG_STRIP.x + DRAG_STRIP.width / 2 - 0.4)}, 0.15);
float centre = lineAt(p.x, ${f(DRAG_STRIP.x)}, 0.12) * step(0.55, fract(p.y / 9.0));
float marks = lineAt(p.y, ${f(DRAG_STRIP.start)}, 0.5) + lineAt(p.y, ${f(DRAG_STRIP.start + EIGHTH_MILE)}, 0.4) + lineAt(p.y, ${f(DRAG_STRIP.start + DRAG_STRIP.length)}, 0.6);
col = mix(col, vec3(0.93, 0.93, 0.9), strip * clamp(edge + centre + marks, 0.0, 1.0)); }
// Hover pad.
{ float r = length(p - vec2(${f(HOVER_PAD.x)}, ${f(HOVER_PAD.z)}));
float disc = 1.0 - step(${f(HOVER_PAD.radius)}, r);
col = mix(col, vec3(0.2, 0.22, 0.25), disc);
float ring = lineAt(r, ${f(HOVER_PAD.radius - 0.4)}, 0.35) + lineAt(r, ${f(HOVER_PAD.radius * 0.55)}, 0.18);
col = mix(col, vec3(0.95, 0.78, 0.25), clamp(ring, 0.0, 1.0)); }
// Tube apron.
col = mix(col, vec3(0.4, 0.4, 0.41), box(p, vec2(${f(TUBE.x - 8)}, ${f(TUBE.z - TUBE.length / 2 - 40)}), vec2(${f(TUBE.x + 8)}, ${f(TUBE.z + TUBE.length / 2 + 5)})));
diffuseColor.rgb = col;
`,
        );
    };
    return mat;
  }, []);

  return (
    <mesh rotation-x={-Math.PI / 2} receiveShadow material={material}>
      <planeGeometry args={[6000, 6000, 1, 1]} />
    </mesh>
  );
}

/** Low-poly mesas on the horizon. */
export function Mesas() {
  const items = useMemo(() => {
    const out: { pos: [number, number, number]; r: number; h: number; seg: number; rot: number }[] =
      [];
    let seed = 7;
    const rnd = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2 + rnd() * 0.15;
      const d = 1100 + rnd() * 700;
      out.push({
        pos: [Math.cos(a) * d, 0, Math.sin(a) * d],
        r: 60 + rnd() * 160,
        h: 25 + rnd() * 90,
        seg: 5 + Math.floor(rnd() * 4),
        rot: rnd() * Math.PI,
      });
    }
    return out;
  }, []);
  return (
    <group>
      {items.map((m, i) => (
        <mesh key={i} position={[m.pos[0], m.h / 2 - 2, m.pos[2]]} rotation-y={m.rot}>
          <cylinderGeometry args={[m.r * 0.7, m.r, m.h, m.seg]} />
          <meshStandardMaterial color="#7a5a5c" roughness={1} flatShading />
        </mesh>
      ))}
    </group>
  );
}
