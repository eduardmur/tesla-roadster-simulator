/**
 * The 3D experience root (code-split from the landing shell). Owns the Canvas, the frame loop
 * that drives the sim, lights, environment, car, effects, cameras and post-processing.
 */
import { Environment, Lightformer, PerformanceMonitor } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Bloom, EffectComposer, SMAA } from '@react-three/postprocessing';
import { Suspense, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { host } from '../app/host';
import { onAction } from '../app/actions';
import { resolvedQuality, useApp, type Quality } from '../state/store';
import { CameraRig } from './cameras/CameraRig';
import { Car, GhostCar } from './car/Car';
import { ExhaustParticles } from './effects/Plumes';
import { SuctionDust } from './effects/Suction';
import { Ground, Mesas } from './environment/Ground';
import { Sky } from './environment/Sky';
import { HORIZON, SUN_DIR } from './environment/skyConstants';
import { TestPad } from './environment/TestPad';

const getSim = () => host.sim;
const tilt = () => host.sim?.tiltAngle ?? 0;

const PRESETS: Record<
  Quality,
  { dpr: number; shadows: number; particles: number; post: boolean; bloom: boolean }
> = {
  low: { dpr: 1, shadows: 0, particles: 200, post: false, bloom: false },
  medium: { dpr: 1.5, shadows: 1024, particles: 500, post: true, bloom: false },
  high: { dpr: 2, shadows: 2048, particles: 900, post: true, bloom: true },
};

function SimDriver() {
  useFrame((_, dt) => host.frame(dt, onAction), -2);
  return null;
}

function SunLight({
  carRef,
  shadowSize,
}: {
  carRef: React.RefObject<THREE.Group | null>;
  shadowSize: number;
}) {
  const light = useRef<THREE.DirectionalLight>(null);
  const target = useMemo(() => new THREE.Object3D(), []);
  useFrame(() => {
    const car = carRef.current;
    const l = light.current;
    if (!car || !l) return;
    target.position.copy(car.position);
    l.position.copy(car.position).addScaledVector(SUN_DIR, 80);
    target.updateMatrixWorld();
  });
  return (
    <>
      <primitive object={target} />
      <directionalLight
        ref={light}
        target={target}
        color="#ffc49a"
        intensity={3.4}
        castShadow={shadowSize > 0}
        shadow-mapSize-width={shadowSize || 512}
        shadow-mapSize-height={shadowSize || 512}
        shadow-camera-left={-28}
        shadow-camera-right={28}
        shadow-camera-top={28}
        shadow-camera-bottom={-28}
        shadow-camera-near={1}
        shadow-camera-far={200}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
      />
    </>
  );
}

function RendererSettings() {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.3;
  }, [gl]);
  return null;
}

function ReadySignal() {
  const set = useApp((s) => s.set);
  const frames = useRef(0);
  useFrame(() => {
    frames.current++;
    if (frames.current === 2) {
      const load = useApp.getState().load;
      if (load.stage === 'scene')
        set({ load: { stage: 'scene', progress: 0.45, label: 'Scene ready' } });
      window.dispatchEvent(new Event('flying-tesla:first-frame'));
    }
  });
  return null;
}

export default function Experience() {
  const carRef = useRef<THREE.Group>(null);
  const quality = useApp((s) => resolvedQuality(s));
  const trim = useApp((s) => s.trim);
  const set = useApp((s) => s.set);
  const preset = PRESETS[quality];
  const dpr = Math.min(
    preset.dpr,
    typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
  );

  return (
    <Canvas
      className="experience-canvas"
      shadows={preset.shadows > 0 ? 'percentage' : false}
      dpr={dpr}
      gl={{ antialias: !preset.post, powerPreference: 'high-performance', alpha: false }}
      camera={{ fov: 45, near: 0.1, far: 6000, position: [8, 2.5, -32] }}
      aria-label="3D view of the car on a desert test pad"
      role="img"
    >
      <RendererSettings />
      <PerformanceMonitor
        onDecline={() => {
          const q = useApp.getState().autoQuality;
          set({ autoQuality: q === 'high' ? 'medium' : 'low' });
        }}
        onIncline={() => {
          const q = useApp.getState().autoQuality;
          if (q === 'low') set({ autoQuality: 'medium' });
        }}
      />
      <color attach="background" args={[HORIZON]} />
      <fogExp2 attach="fog" args={[HORIZON, 0.00042]} />
      <SimDriver />
      <hemisphereLight args={['#b4c2e4', '#8d6a49', 1.15]} />
      <directionalLight position={[60, 40, 80]} intensity={0.35} color="#86a8ff" />
      <SunLight carRef={carRef} shadowSize={preset.shadows} />
      <Suspense fallback={null}>
        <Environment resolution={128} frames={1}>
          <Lightformer
            form="rect"
            intensity={3}
            color="#ff9f70"
            position={[-60, 6, -55]}
            scale={[90, 10, 1]}
            target={[0, 0, 0]}
          />
          <Lightformer
            form="rect"
            intensity={1.2}
            color="#3b4f86"
            position={[0, 60, 0]}
            scale={[120, 120, 1]}
            rotation-x={Math.PI / 2}
          />
          <Lightformer
            form="rect"
            intensity={0.8}
            color="#c07a5a"
            position={[60, 5, 60]}
            scale={[90, 8, 1]}
            target={[0, 0, 0]}
          />
          <Lightformer
            form="rect"
            intensity={0.4}
            color="#5a3d2e"
            position={[0, -10, 0]}
            scale={[120, 120, 1]}
            rotation-x={-Math.PI / 2}
          />
        </Environment>
      </Suspense>
      <Sky />
      <Ground />
      <Mesas />
      <TestPad tiltAngle={tilt} />
      <Car carRef={carRef} />
      <GhostCar />
      <ExhaustParticles
        sim={getSim}
        trim={trim}
        maxParticles={preset.particles}
        carGroup={carRef}
      />
      <SuctionDust sim={getSim} maxParticles={Math.round(preset.particles / 3)} carGroup={carRef} />
      <CameraRig carRef={carRef} />
      <ReadySignal />
      {preset.post && (
        <EffectComposer multisampling={0} enableNormalPass={false}>
          <SMAA />
          {preset.bloom ? (
            <Bloom luminanceThreshold={1.0} luminanceSmoothing={0.2} intensity={0.55} mipmapBlur />
          ) : (
            <></>
          )}
        </EffectComposer>
      )}
    </Canvas>
  );
}
