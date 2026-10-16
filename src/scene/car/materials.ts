/** Car materials: normal paint/glass/metal, plus the X-ray set (ghost body, glowing parts). */
import * as THREE from 'three';
import { COLORS } from '../../ui/theme';

let carbonTex: THREE.Texture | null = null;

/** Procedural carbon-fibre weave (drawn on a canvas, no image assets). */
function carbonTexture(): THREE.Texture {
  if (carbonTex) return carbonTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#16181c';
  g.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const horiz = (x + y) % 2 === 0;
      const grad = horiz
        ? g.createLinearGradient(x * 16, 0, x * 16 + 16, 0)
        : g.createLinearGradient(0, y * 16, 0, y * 16 + 16);
      grad.addColorStop(0, '#23262c');
      grad.addColorStop(0.5, '#3a3e46');
      grad.addColorStop(1, '#202328');
      g.fillStyle = grad;
      g.fillRect(x * 16 + 1, y * 16 + 1, 14, 14);
    }
  }
  carbonTex = new THREE.CanvasTexture(c);
  carbonTex.wrapS = carbonTex.wrapT = THREE.RepeatWrapping;
  carbonTex.repeat.set(4, 4);
  carbonTex.colorSpace = THREE.SRGBColorSpace;
  return carbonTex;
}

export interface CarMaterials {
  paint: THREE.MeshPhysicalMaterial;
  trim: THREE.MeshStandardMaterial;
  glass: THREE.MeshPhysicalMaterial;
  tire: THREE.MeshStandardMaterial;
  rim: THREE.MeshStandardMaterial;
  lightFront: THREE.MeshStandardMaterial;
  lightRear: THREE.MeshStandardMaterial;
  carbon: THREE.MeshStandardMaterial;
  metal: THREE.MeshStandardMaterial;
  nozzle: THREE.MeshStandardMaterial;
  fan: THREE.MeshStandardMaterial;
  floor: THREE.MeshStandardMaterial;
  skirt: THREE.MeshStandardMaterial;
  seat: THREE.MeshStandardMaterial;
  valve: THREE.MeshStandardMaterial;
  // X-ray
  ghost: THREE.ShaderMaterial;
  xThrust: THREE.MeshStandardMaterial;
  xSuction: THREE.MeshStandardMaterial;
  xTank: THREE.MeshStandardMaterial;
  xPipe: THREE.MeshStandardMaterial;
  xValve: THREE.MeshStandardMaterial;
  ghostCar: THREE.MeshBasicMaterial;
}

const ghostVertex = /* glsl */ `
  varying vec3 vNormalW;
  varying vec3 vViewDir;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vViewDir = normalize(cameraPosition - wp.xyz);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const ghostFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying vec3 vNormalW;
  varying vec3 vViewDir;
  void main() {
    float f = 1.0 - abs(dot(normalize(vNormalW), normalize(vViewDir)));
    float rim = pow(f, 2.2);
    gl_FragColor = vec4(uColor * (0.35 + 1.4 * rim), uOpacity * (0.08 + 0.9 * rim));
  }
`;

let cached: CarMaterials | null = null;

export function carMaterials(): CarMaterials {
  if (cached) return cached;
  const carbon = carbonTexture();
  const glow = (color: string, intensity = 1.6) =>
    new THREE.MeshStandardMaterial({
      color: '#0b0e14',
      emissive: new THREE.Color(color),
      emissiveIntensity: intensity,
      roughness: 0.5,
      metalness: 0.2,
      toneMapped: false,
    });
  cached = {
    paint: new THREE.MeshPhysicalMaterial({
      color: '#eef1f5',
      metalness: 0.15,
      roughness: 0.3,
      clearcoat: 1,
      clearcoatRoughness: 0.06,
      envMapIntensity: 1.5,
    }),
    trim: new THREE.MeshStandardMaterial({ color: '#15171b', roughness: 0.55, metalness: 0.3 }),
    glass: new THREE.MeshPhysicalMaterial({
      color: '#0c1219',
      roughness: 0.04,
      metalness: 0.1,
      transparent: true,
      opacity: 0.86,
      clearcoat: 1,
    }),
    tire: new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.9 }),
    rim: new THREE.MeshStandardMaterial({ color: '#2b2f36', roughness: 0.3, metalness: 0.9 }),
    lightFront: new THREE.MeshStandardMaterial({
      color: '#ffffff',
      emissive: '#e8f2ff',
      emissiveIntensity: 2.5,
      toneMapped: false,
    }),
    lightRear: new THREE.MeshStandardMaterial({
      color: '#300',
      emissive: '#ff2a2a',
      emissiveIntensity: 2.2,
      toneMapped: false,
    }),
    carbon: new THREE.MeshStandardMaterial({ map: carbon, roughness: 0.35, metalness: 0.2 }),
    metal: new THREE.MeshStandardMaterial({ color: '#8f98a3', roughness: 0.35, metalness: 0.9 }),
    nozzle: new THREE.MeshStandardMaterial({
      color: '#a7aeb6',
      roughness: 0.3,
      metalness: 1,
      side: THREE.DoubleSide,
    }),
    fan: new THREE.MeshStandardMaterial({ color: '#2a2e35', roughness: 0.5, metalness: 0.6 }),
    floor: new THREE.MeshStandardMaterial({ color: '#0d0f12', roughness: 0.8 }),
    skirt: new THREE.MeshStandardMaterial({
      color: '#1b1e23',
      roughness: 0.7,
      side: THREE.DoubleSide,
    }),
    seat: new THREE.MeshStandardMaterial({ color: '#23262b', roughness: 0.8 }),
    valve: new THREE.MeshStandardMaterial({ color: '#3a3f47', roughness: 0.4, metalness: 0.7 }),
    ghost: new THREE.ShaderMaterial({
      vertexShader: ghostVertex,
      fragmentShader: ghostFragment,
      uniforms: { uColor: { value: new THREE.Color('#9fb7d6') }, uOpacity: { value: 0.55 } },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    xThrust: glow(COLORS.thrust, 1.3),
    xSuction: glow(COLORS.suction, 1.3),
    xTank: glow('#d8e3f0', 0.6),
    xPipe: glow(COLORS.thrust, 0.7),
    xValve: glow('#ffd27a', 0.9),
    ghostCar: new THREE.MeshBasicMaterial({
      color: COLORS.suction,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
    }),
  };
  return cached;
}
