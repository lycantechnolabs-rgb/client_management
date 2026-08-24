"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { createMotes, createPodGeometry, createStalkGeometry } from "./pod-geometry";
import { damp, mapRange, usePointer, useScrollProgressRef } from "@/lib/scroll";

/* -------------------------------------------------------------------------- */
/* Palette — the same tokens as globals.css, in linear space for three         */
/* -------------------------------------------------------------------------- */

const POD_GREEN = new THREE.Color("#8fb56a");
const POD_DEEP = new THREE.Color("#4a7c2f");
const CREAM = new THREE.Color("#f6f3e9");
const STALK = new THREE.Color("#a8a06a");

type Arrangement = {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
  /** Phase offset so the pods do not bob in unison. */
  phase: number;
};

const HERO_PODS: Arrangement[] = [
  { position: [0.1, 0.15, 0], rotation: [0.15, 0, 0.22], scale: 1, phase: 0 },
  { position: [-1.5, -0.55, -1.1], rotation: [-0.2, 0.7, -0.45], scale: 0.72, phase: 1.7 },
  { position: [1.55, -0.3, -0.8], rotation: [0.3, -0.5, 0.55], scale: 0.66, phase: 3.1 },
  { position: [-0.9, 1.05, -2], rotation: [0.1, 1.2, -0.2], scale: 0.5, phase: 4.4 },
  { position: [1.1, 1.25, -2.4], rotation: [-0.35, -1, 0.3], scale: 0.44, phase: 5.6 },
];

/* -------------------------------------------------------------------------- */
/* One pod                                                                     */
/* -------------------------------------------------------------------------- */

function Pod({
  arrangement,
  geometry,
  stalkGeometry,
  material,
  stalkMaterial,
  scroll,
}: {
  arrangement: Arrangement;
  geometry: THREE.BufferGeometry;
  stalkGeometry: THREE.BufferGeometry;
  material: THREE.Material;
  stalkMaterial: THREE.Material;
  scroll: RefObject<number>;
}) {
  const group = useRef<THREE.Group>(null);
  const [x, y, z] = arrangement.position;
  const [rx, ry, rz] = arrangement.rotation;

  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    const p = scroll.current;

    // Idle: a slow turn and a shallow bob, so the scene is alive before the
    // visitor has scrolled a pixel.
    g.rotation.y = ry + t * 0.16;
    g.rotation.x = rx + Math.sin(t * 0.5 + arrangement.phase) * 0.08;
    g.rotation.z = rz + Math.cos(t * 0.4 + arrangement.phase) * 0.05;

    // Scrolling lifts the pods out of frame and spreads them apart, so the
    // hero clears itself away rather than simply scrolling off.
    g.position.y = y + Math.sin(t * 0.7 + arrangement.phase) * 0.09 + p * 2.6;
    g.position.x = x * (1 + p * 0.7);
    g.position.z = z - p * 1.2;
  });

  return (
    <group ref={group} position={[x, y, z]} scale={arrangement.scale}>
      <mesh geometry={geometry} material={material} castShadow />
      <mesh
        geometry={stalkGeometry}
        material={stalkMaterial}
        position={[0, 1.02, 0]}
      />
    </group>
  );
}

/* -------------------------------------------------------------------------- */
/* Dust                                                                        */
/* -------------------------------------------------------------------------- */

function Motes({ count = 90, spread = 12 }) {
  const ref = useRef<THREE.Points>(null);
  const { positions, speeds } = useMemo(
    () => createMotes(count, spread),
    [count, spread],
  );

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return g;
  }, [positions]);

  useFrame((_, dt) => {
    const points = ref.current;
    if (!points) return;
    const attr = points.geometry.getAttribute("position") as THREE.BufferAttribute;
    const array = attr.array as Float32Array;

    for (let i = 0; i < count; i++) {
      const yi = i * 3 + 1;
      array[yi] += speeds[i] * dt;
      if (array[yi] > spread / 2) array[yi] = -spread / 2;
    }
    attr.needsUpdate = true;
  });

  return (
    <points ref={ref} geometry={geometry}>
      <pointsMaterial
        size={0.045}
        sizeAttenuation
        color={POD_DEEP}
        transparent
        opacity={0.35}
        depthWrite={false}
      />
    </points>
  );
}

/* -------------------------------------------------------------------------- */
/* Scene                                                                       */
/* -------------------------------------------------------------------------- */

function HeroScene({
  scroll,
  pointer,
}: {
  scroll: RefObject<number>;
  pointer: RefObject<{ x: number; y: number }>;
}) {
  const rig = useRef<THREE.Group>(null);

  const geometry = useMemo(() => createPodGeometry(), []);
  const stalkGeometry = useMemo(() => createStalkGeometry(), []);

  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: POD_GREEN,
        roughness: 0.62,
        metalness: 0.02,
        // A touch of its own colour bled in stops the shadowed side reading as
        // grey mud against the cream page.
        emissive: POD_DEEP,
        emissiveIntensity: 0.12,
        flatShading: false,
      }),
    [],
  );

  const stalkMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: STALK, roughness: 0.9 }),
    [],
  );

  // The camera is read off the frame state rather than captured from useThree,
  // so nothing outside this callback is mutated after render.
  useFrame((state, dt) => {
    const g = rig.current;
    if (!g) return;

    // The whole rig leans a little toward the cursor. Damped, not tracked, so
    // it never feels like the page is snapping at the pointer.
    const target = pointer.current;
    g.rotation.y = damp(g.rotation.y, target.x * 0.22, 0.002, dt);
    g.rotation.x = damp(g.rotation.x, target.y * 0.14, 0.002, dt);

    state.camera.position.z = damp(
      state.camera.position.z,
      mapRange(scroll.current, 0, 1, 6.2, 8.4),
      0.002,
      dt,
    );
  });

  return (
    <>
      <fog attach="fog" args={[CREAM.getHex(), 7, 16]} />

      <hemisphereLight args={["#ffffff", "#cfe0bb", 1.15]} />
      <directionalLight position={[3.5, 5, 4]} intensity={1.5} color="#fff6dd" />
      <directionalLight position={[-4, -1, -3]} intensity={0.45} color="#9dbd7c" />

      <group ref={rig}>
        {HERO_PODS.map((a, i) => (
          <Pod
            key={i}
            arrangement={a}
            geometry={geometry}
            stalkGeometry={stalkGeometry}
            material={material}
            stalkMaterial={stalkMaterial}
            scroll={scroll}
          />
        ))}
        <Motes />
      </group>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Host                                                                        */
/* -------------------------------------------------------------------------- */

export default function CardamomCanvas({ className }: { className?: string }) {
  const scroll = useRef(0);
  const pointer = usePointer();
  const [onScreen, setOnScreen] = useState(true);

  const host = useScrollProgressRef<HTMLDivElement>((p) => {
    scroll.current = p;
  }, "enter");

  // Stop the render loop the moment the hero leaves the viewport. Without this
  // the GPU keeps drawing pods nobody can see for the whole length of the page.
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting), {
      rootMargin: "120px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, [host]);

  return (
    <div ref={host} className={className} aria-hidden="true">
      <Canvas
        // Capping DPR matters more than antialiasing here: a 3x phone screen
        // would otherwise render nine times the pixels for no visible gain.
        dpr={[1, 1.75]}
        camera={{ position: [0, 0, 6.2], fov: 40 }}
        gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
        frameloop={onScreen ? "always" : "never"}
      >
        <HeroScene scroll={scroll} pointer={pointer} />
      </Canvas>
    </div>
  );
}
