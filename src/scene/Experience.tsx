/**
 * The 3D scene (code-split from the shell): night test site, the ramp, the car, effects,
 * cameras and light post-processing. Drives the sim once per frame.
 */
import { Environment, Lightformer, PerformanceMonitor } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Bloom, EffectComposer, SMAA } from '@react-three/postprocessing';
import { Suspense, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { host } from '../app/host';
import { RAMP } from '../sim/track';
import { useApp, type Quality } from '../state/store';
import { CameraRig } from './cameras/CameraRig';
import { Car } from './car/Car';
import { ExhaustParticles } from './effects/Plumes';
import {
  Drones,
  Ground,
  LightPanels,
  NIGHT,
  NightSky,
  RunwayLamps,
  Searchlights,
  SiteWall,
} from './environment/Night';
import { Ramp } from './environment/Ramp';

const getSim = () => host.sim;

const PRESETS: Record<Quality, { dpr: number; shadows: number; particles: number; post: boolean }> =
  {
    low: { dpr: 1, shadows: 0, particles: 500, post: false },
    medium: { dpr: 1.5, shadows: 1024, particles: 1000, post: true },
    high: { dpr: 2, shadows: 2048, particles: 1600, post: true },
  };

function SimDriver() {
  useFrame((_, dt) => host.frame(dt), -2);
  return null;
}

/** Overhead "stadium" key light that follows the car, so its shadow is always crisp. */
function KeyLight({
  carRef,
  shadowSize,
}: {
  carRef: React.RefObject<THREE.Group | null>;
  shadowSize: number;
}) {
  const light = useRef<THREE.DirectionalLight>(null);
  const target = useMemo(() => new THREE.Object3D(), []);
  const dir = useMemo(() => new THREE.Vector3(0.35, 1, -0.45).normalize(), []);
  useFrame(() => {
    const car = carRef.current;
    if (!car || !light.current) return;
    target.position.copy(car.position);
    light.current.position.copy(car.position).addScaledVector(dir, 60);
    target.updateMatrixWorld();
  });
  return (
    <>
      <primitive object={target} />
      <directionalLight
        ref={light}
        target={target}
        color="#e6ecff"
        intensity={1.6}
        castShadow={shadowSize > 0}
        shadow-mapSize-width={shadowSize || 512}
        shadow-mapSize-height={shadowSize || 512}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
        shadow-camera-near={1}
        shadow-camera-far={150}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
      />
    </>
  );
}

/** A floodlight at the foot of the runway washing the face of the ramp. */
function RampFlood() {
  const light = useRef<THREE.SpotLight>(null);
  const target = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.set(RAMP.x, RAMP.radius, RAMP.z0 + RAMP.radius * 0.6);
    return o;
  }, []);
  useEffect(() => {
    if (light.current) light.current.target = target;
  }, [target]);
  return (
    <>
      <primitive object={target} />
      <spotLight
        ref={light}
        position={[RAMP.x, 2, RAMP.z0 - 26]}
        angle={0.42}
        penumbra={0.7}
        intensity={2.4}
        decay={0}
        distance={0}
        color="#f2f5ff"
      />
    </>
  );
}

function RendererSettings() {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.15;
  }, [gl]);
  return null;
}

function FirstFrame() {
  const n = useRef(0);
  useFrame(() => {
    if (++n.current === 2) window.dispatchEvent(new Event('trs:first-frame'));
  });
  return null;
}

export default function Experience() {
  const carRef = useRef<THREE.Group>(null);
  const quality = useApp((s) => s.quality);
  const reducedMotion = useApp((s) => s.reducedMotion);
  const set = useApp((s) => s.set);
  const preset = PRESETS[quality];
  const dpr = Math.min(
    preset.dpr,
    typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
  );

  return (
    <Canvas
      className="scene"
      shadows={preset.shadows > 0 ? 'percentage' : false}
      dpr={dpr}
      gl={{ antialias: !preset.post, powerPreference: 'high-performance', alpha: false }}
      camera={{ fov: 50, near: 0.1, far: 3000, position: [-2, 1, -40] }}
      aria-label="The car in front of the curl ramp at night"
      role="img"
    >
      <RendererSettings />
      <PerformanceMonitor
        onDecline={() => {
          const q = useApp.getState().quality;
          set({ quality: q === 'high' ? 'medium' : 'low' });
        }}
      />
      <color attach="background" args={[NIGHT]} />
      <fogExp2 attach="fog" args={[NIGHT, 0.0042]} />
      <SimDriver />
      <hemisphereLight args={['#2a3446', '#000000', 0.35]} />
      <KeyLight carRef={carRef} shadowSize={preset.shadows} />
      <RampFlood />
      <Suspense fallback={null}>
        <Environment resolution={128} frames={1}>
          <Lightformer
            form="rect"
            intensity={2.2}
            color="#ffffff"
            position={[0, 12, 0]}
            rotation-x={Math.PI / 2}
            scale={[30, 6, 1]}
          />
          <Lightformer
            form="rect"
            intensity={1.2}
            color="#dfe8ff"
            position={[-16, 4, -6]}
            scale={[2, 18, 1]}
            target={[0, 1, 0]}
          />
          <Lightformer
            form="rect"
            intensity={1.0}
            color="#ff3020"
            position={[16, 3, 4]}
            scale={[6, 4, 1]}
            target={[0, 1, 0]}
          />
          <Lightformer
            form="rect"
            intensity={0.8}
            color="#ffffff"
            position={[6, 2, -16]}
            scale={[10, 2, 1]}
            target={[0, 1, 0]}
          />
        </Environment>
      </Suspense>
      <NightSky />
      <Ground />
      <RunwayLamps />
      <SiteWall />
      <LightPanels />
      <Searchlights reducedMotion={reducedMotion} />
      <Drones reducedMotion={reducedMotion} />
      <Ramp />
      <Car carRef={carRef} />
      <ExhaustParticles
        sim={getSim}
        trim="rocket"
        maxParticles={preset.particles}
        carGroup={carRef}
      />
      <CameraRig carRef={carRef} />
      <FirstFrame />
      {preset.post && (
        <EffectComposer multisampling={0} enableNormalPass={false}>
          <SMAA />
          <Bloom luminanceThreshold={0.9} luminanceSmoothing={0.2} intensity={0.9} mipmapBlur />
        </EffectComposer>
      )}
    </Canvas>
  );
}
