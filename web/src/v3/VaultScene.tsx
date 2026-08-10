import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

/** The narrative in one object: a glass vault (the contract) holding the
    glowing treasury core, rule rings orbiting it, and the agent — a small
    bright mote — allowed in only through the rules. In "breach" mode a red
    payment ray hits the glass and freezes on it: refusal, made physical.
    Deliberately low-poly and bloom-free; the glass does the talking. */

function VaultBody({ breach }: { breach: boolean }) {
  const group = useRef<THREE.Group>(null);
  const core = useRef<THREE.Mesh>(null);
  const ringA = useRef<THREE.Mesh>(null);
  const ringB = useRef<THREE.Mesh>(null);
  const agent = useRef<THREE.Mesh>(null);
  const ray = useRef<THREE.Mesh>(null);
  const frost = useRef<THREE.Mesh>(null);

  useFrame(({ clock, pointer }) => {
    const t = clock.elapsedTime;
    if (group.current) {
      group.current.rotation.y = t * 0.12 + pointer.x * 0.25;
      group.current.rotation.x = Math.sin(t * 0.1) * 0.06 + pointer.y * -0.12;
    }
    if (core.current) {
      const s = 1 + Math.sin(t * 1.6) * 0.045;
      core.current.scale.setScalar(s);
      core.current.rotation.y = t * 0.35;
    }
    if (ringA.current) ringA.current.rotation.z = t * 0.25;
    if (ringB.current) ringB.current.rotation.z = -t * 0.18;
    if (agent.current) {
      // the agent orbits outside and dips toward the gate point each pass
      const a = t * 0.7;
      const dip = Math.max(0, Math.sin(a)) * 0.5;
      agent.current.position.set(Math.cos(a) * (2.6 - dip), Math.sin(a * 0.8) * 0.7, Math.sin(a) * (2.6 - dip));
    }
    if (breach && ray.current && frost.current) {
      // the refused ray: slides in, freezes at the wall, fades, repeats
      const cycle = (t % 3.2) / 3.2;
      const approach = Math.min(1, cycle * 2.2);
      ray.current.position.x = -3.4 + approach * 1.9;
      const mat = ray.current.material as THREE.MeshBasicMaterial;
      mat.opacity = cycle > 0.9 ? (1 - cycle) * 10 : 0.9;
      const hit = Math.max(0, (cycle - 0.45) * 2.2);
      frost.current.scale.setScalar(0.2 + Math.min(1, hit) * 1.15);
      (frost.current.material as THREE.MeshBasicMaterial).opacity = Math.min(0.55, hit) * (cycle > 0.9 ? (1 - cycle) * 10 : 1);
    }
  });

  const glass = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        transmission: 0.92,
        thickness: 1.2,
        roughness: 0.18,
        metalness: 0,
        color: new THREE.Color("#cfe6f5"),
        transparent: true,
        opacity: 0.9,
      }),
    [],
  );

  return (
    <group ref={group}>
      {/* the vault: a glass cube with softly beveled feel via slight scale */}
      <mesh material={glass}>
        <boxGeometry args={[2.1, 2.1, 2.1]} />
      </mesh>
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(2.1, 2.1, 2.1)]} />
        <lineBasicMaterial color="#9fc4dd" transparent opacity={0.55} />
      </lineSegments>

      {/* the treasury core — amber, alive */}
      <mesh ref={core}>
        <icosahedronGeometry args={[0.62, 1]} />
        <meshStandardMaterial color="#f0b429" emissive="#c68a12" emissiveIntensity={1.4} roughness={0.35} />
      </mesh>

      {/* rule rings — the law, always turning */}
      <mesh ref={ringA} rotation={[Math.PI / 2.4, 0, 0]}>
        <torusGeometry args={[1.75, 0.016, 12, 96]} />
        <meshBasicMaterial color="#7fb7d8" transparent opacity={0.75} />
      </mesh>
      <mesh ref={ringB} rotation={[Math.PI / 1.7, 0.5, 0]}>
        <torusGeometry args={[2.05, 0.01, 12, 96]} />
        <meshBasicMaterial color="#a81524" transparent opacity={0.5} />
      </mesh>

      {/* the agent — a mote of light that may only enter through the rules */}
      <mesh ref={agent}>
        <sphereGeometry args={[0.09, 16, 16]} />
        <meshBasicMaterial color="#eaf6ff" />
      </mesh>

      {breach && (
        <>
          {/* the out-of-rule payment ray, frozen at the wall */}
          <mesh ref={ray} position={[-3.4, 0.2, 0.4]} rotation={[0, 0, 0]}>
            <boxGeometry args={[1.6, 0.03, 0.03]} />
            <meshBasicMaterial color="#c11f2e" transparent opacity={0.9} />
          </mesh>
          <mesh ref={frost} position={[-1.06, 0.2, 0.4]} rotation={[0, Math.PI / 2, 0]}>
            <ringGeometry args={[0.18, 0.34, 32]} />
            <meshBasicMaterial color="#cfe6f5" transparent opacity={0} side={THREE.DoubleSide} />
          </mesh>
        </>
      )}
    </group>
  );
}

export function VaultScene({ breach = false }: { breach?: boolean }) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [0, 0.4, 6], fov: 42 }}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      style={{ width: "100%", height: "100%" }}
    >
      <Suspense fallback={null}>
        <ambientLight intensity={0.35} />
        <pointLight position={[4, 3, 5]} intensity={26} color="#bfe0f5" />
        <pointLight position={[-4, -2, 3]} intensity={14} color="#f0b429" />
        <VaultBody breach={breach} />
      </Suspense>
    </Canvas>
  );
}
