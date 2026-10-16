/** Procedural dusk sky dome (no HDRI download): gradient, sun glow, a few stars. */
import { useMemo } from 'react';
import * as THREE from 'three';

import { SUN_DIR } from './skyConstants';

const vertex = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize((modelMatrix * vec4(position, 0.0)).xyz);
    vec4 p = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
    gl_Position = p.xyww;
  }
`;

const fragment = /* glsl */ `
  uniform vec3 uSun;
  varying vec3 vDir;
  float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
  void main() {
    vec3 d = normalize(vDir);
    float h = d.y;
    vec3 horizon = vec3(0.93, 0.6, 0.45);
    vec3 band = vec3(0.78, 0.45, 0.45);
    vec3 mid = vec3(0.33, 0.29, 0.48);
    vec3 zenith = vec3(0.05, 0.07, 0.17);
    vec3 col = mix(horizon, band, smoothstep(0.0, 0.06, h));
    col = mix(col, mid, smoothstep(0.04, 0.3, h));
    col = mix(col, zenith, smoothstep(0.25, 0.95, h));
    col = mix(col, vec3(0.42, 0.3, 0.3), smoothstep(0.0, -0.08, h));
    float s = max(dot(d, uSun), 0.0);
    col += vec3(1.0, 0.6, 0.35) * pow(s, 8.0) * 0.28;
    col += vec3(1.0, 0.8, 0.55) * smoothstep(0.9993, 0.9997, s) * 0.55;
    // Faint stars near the zenith.
    vec3 cell = floor(d * 380.0);
    float st = step(0.9985, hash(cell)) * smoothstep(0.35, 0.8, h);
    col += vec3(st * 0.8);
    gl_FragColor = vec4(col, 1.0);
  }
`;

export function Sky() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        uniforms: { uSun: { value: SUN_DIR } },
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        toneMapped: false,
      }),
    [],
  );
  return (
    <mesh material={material} renderOrder={-100} frustumCulled={false} scale={3000}>
      <sphereGeometry args={[1, 32, 16]} />
    </mesh>
  );
}
