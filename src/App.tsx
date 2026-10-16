import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';

/** Milestone 1 placeholder: an empty test pad at dusk. */
export function App() {
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0d1117', color: '#e6edf3' }}>
      <Canvas camera={{ position: [6, 3, 8], fov: 45 }}>
        <color attach="background" args={['#1a1f2b']} />
        <hemisphereLight args={['#ffcf9e', '#1b2233', 0.8]} />
        <directionalLight position={[5, 8, 3]} intensity={1.5} />
        <mesh position={[0, 0.5, 0]}>
          <boxGeometry args={[4.2, 1, 2]} />
          <meshStandardMaterial color="#8892a6" />
        </mesh>
        <mesh rotation-x={-Math.PI / 2}>
          <planeGeometry args={[60, 60]} />
          <meshStandardMaterial color="#3a3530" />
        </mesh>
        <OrbitControls autoRotate autoRotateSpeed={0.5} />
      </Canvas>
      <div style={{ position: 'absolute', left: 24, top: 24, fontFamily: 'system-ui, sans-serif' }}>
        <h1 style={{ margin: 0 }}>Flying Tesla Explained</h1>
        <p style={{ margin: '4px 0' }}>
          Unofficial educational simulation. Not affiliated with Tesla or SpaceX. Work in progress.
        </p>
      </div>
    </div>
  );
}
