"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { createPodGeometry, createStalkGeometry } from "./pod-geometry";
import { STAGES } from "./stages";
import { damp, easeInOutCubic, mapRange, useScrollProgressRef } from "@/lib/scroll";

const POD_COUNT = 7;

const FRESH = new THREE.Color("#8fb56a");
const CURED = new THREE.Color("#6f8f4a");
const CREAM = new THREE.Color("#f6f3e9");

/* -------------------------------------------------------------------------- */
/* Layouts — one entry per stage, per pod                                      */
/* -------------------------------------------------------------------------- */

type Placement = {
  position: THREE.Vector3;
  rotation: THREE.Euler;
  scale: number;
};

/**
 * Deterministic jitter. Real randomness would make the layout reshuffle on
 * every hot reload and would be impossible to tune; this gives the scatter of
 * a natural cluster while staying the same scene every time.
 */
const wobble = (i: number, salt: number) =>
  Math.sin(i * 12.9898 + salt * 78.233) * 0.5;

function buildLayouts(): Placement[][] {
  const layouts: Placement[][] = [];

  // 0 — hanging in a cluster on the runner, low and tangled.
  layouts.push(
    Array.from({ length: POD_COUNT }, (_, i) => ({
      position: new THREE.Vector3(
        wobble(i, 1) * 1.6,
        -0.9 + wobble(i, 2) * 0.9,
        wobble(i, 3) * 1.4,
      ),
      rotation: new THREE.Euler(
        Math.PI * 0.85 + wobble(i, 4) * 0.6,
        wobble(i, 5) * 3,
        wobble(i, 6) * 0.8,
      ),
      scale: 0.82 + wobble(i, 7) * 0.22,
    })),
  );

  // 1 — gathered into a basket: a loose ring, pods tipped inward.
  layouts.push(
    Array.from({ length: POD_COUNT }, (_, i) => {
      const a = (i / POD_COUNT) * Math.PI * 2;
      const r = 1.35 + wobble(i, 8) * 0.25;
      return {
        position: new THREE.Vector3(
          Math.cos(a) * r,
          -0.35 + wobble(i, 9) * 0.25,
          Math.sin(a) * r * 0.55,
        ),
        rotation: new THREE.Euler(Math.PI / 2 + wobble(i, 10) * 0.4, -a, 0.2),
        scale: 0.9 + wobble(i, 11) * 0.12,
      };
    }),
  );

  // 2 — spread on the curing tray, upright, evenly spaced, drying.
  layouts.push(
    Array.from({ length: POD_COUNT }, (_, i) => {
      const col = i % 4;
      const row = Math.floor(i / 4);
      return {
        position: new THREE.Vector3(
          (col - 1.5) * 1.05,
          0.55 - row * 1.15,
          wobble(i, 12) * 0.5,
        ),
        rotation: new THREE.Euler(0.2, i * 0.9, wobble(i, 13) * 0.35),
        scale: 0.86,
      };
    }),
  );

  // 3 — graded: sorted largest to smallest along a single line.
  layouts.push(
    Array.from({ length: POD_COUNT }, (_, i) => ({
      position: new THREE.Vector3((i - (POD_COUNT - 1) / 2) * 0.92, 0, 0),
      rotation: new THREE.Euler(0.06, 0.3, 0),
      // The size gradient is the point of the shot — it is what grading means.
      scale: 1.08 - i * 0.075,
    })),
  );

  return layouts;
}

/* -------------------------------------------------------------------------- */
/* Scene                                                                       */
/* -------------------------------------------------------------------------- */

const scratch = {
  position: new THREE.Vector3(),
  quatA: new THREE.Quaternion(),
  quatB: new THREE.Quaternion(),
  colour: new THREE.Color(),
};

function Pods({ scroll }: { scroll: RefObject<number> }) {
  const group = useRef<THREE.Group>(null);
  const meshes = useRef<(THREE.Group | null)[]>([]);

  const layouts = useMemo(() => buildLayouts(), []);
  const geometry = useMemo(() => createPodGeometry(), []);
  const stalkGeometry = useMemo(() => createStalkGeometry(), []);

  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: FRESH.clone(),
        roughness: 0.6,
        metalness: 0.02,
        emissive: new THREE.Color("#2e4a1c"),
        emissiveIntensity: 0.1,
      }),
    [],
  );

  const stalkMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#a8a06a", roughness: 0.9 }),
    [],
  );

  // Quaternions, cached per stage per pod: slerping is the only way to get a
  // pod from "hanging upside down on a runner" to "standing on a tray" without
  // it spinning through a full turn on one axis.
  const quaternions = useMemo(
    () =>
      layouts.map((stage) =>
        stage.map((p) => new THREE.Quaternion().setFromEuler(p.rotation)),
      ),
    [layouts],
  );

  useFrame((state, dt) => {
    const p = scroll.current;

    // Three transitions across four stages. Easing each one separately gives a
    // beat of stillness on every stage instead of one continuous slide.
    const span = (layouts.length - 1) * p;
    const from = Math.min(layouts.length - 2, Math.floor(span));
    const raw = span - from;
    const t = easeInOutCubic(Math.min(1, Math.max(0, raw)));

    for (let i = 0; i < POD_COUNT; i++) {
      const node = meshes.current[i];
      if (!node) continue;

      const a = layouts[from][i];
      const b = layouts[from + 1][i];

      scratch.position.copy(a.position).lerp(b.position, t);
      // A small idle drift on top of the scrubbed position, so a visitor who
      // stops scrolling is not left looking at a frozen render.
      const drift = Math.sin(state.clock.elapsedTime * 0.6 + i) * 0.04;
      node.position.set(
        scratch.position.x,
        scratch.position.y + drift,
        scratch.position.z,
      );

      scratch.quatA.copy(quaternions[from][i]);
      scratch.quatB.copy(quaternions[from + 1][i]);
      node.quaternion.slerpQuaternions(scratch.quatA, scratch.quatB, t);

      const scale = a.scale + (b.scale - a.scale) * t;
      node.scale.setScalar(scale);
    }

    // Curing is where the colour actually changes, so the shift is weighted to
    // the third stage rather than spread evenly over the scroll.
    scratch.colour.copy(FRESH).lerp(CURED, mapRange(p, 0.45, 0.78, 0, 1));
    material.color.copy(scratch.colour);

    if (group.current) {
      group.current.rotation.y = damp(
        group.current.rotation.y,
        mapRange(p, 0, 1, -0.35, 0.3),
        0.002,
        dt,
      );
    }

    // Read off the frame state rather than captured from useThree, so nothing
    // outside this callback is mutated after render.
    const { camera } = state;
    camera.position.z = damp(camera.position.z, mapRange(p, 0, 1, 7, 6.2), 0.004, dt);
    camera.position.y = damp(camera.position.y, mapRange(p, 0, 1, -0.4, 0.5), 0.004, dt);
    camera.lookAt(0, 0, 0);
  });

  return (
    <>
      <fog attach="fog" args={[CREAM.getHex(), 8, 18]} />
      <hemisphereLight args={["#ffffff", "#cfe0bb", 1.1]} />
      <directionalLight position={[4, 6, 5]} intensity={1.6} color="#fff6dd" />
      <directionalLight position={[-5, -2, -4]} intensity={0.4} color="#9dbd7c" />

      <group ref={group}>
        {Array.from({ length: POD_COUNT }, (_, i) => (
          <group
            key={i}
            ref={(node) => {
              meshes.current[i] = node;
            }}
          >
            <mesh geometry={geometry} material={material} />
            <mesh
              geometry={stalkGeometry}
              material={stalkMaterial}
              position={[0, 1.02, 0]}
            />
          </group>
        ))}
      </group>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Host — a tall section with a pinned viewport                                */
/* -------------------------------------------------------------------------- */

export default function PodStages() {
  const scroll = useRef(0);
  const [stage, setStage] = useState(0);

  const host = useScrollProgressRef<HTMLDivElement>((p) => {
    scroll.current = p;
    // Clamped to the last stage so the closing stretch of scroll holds the
    // final copy rather than flicking past it.
    const next = Math.min(STAGES.length - 1, Math.floor(p * STAGES.length));
    setStage((current) => (current === next ? current : next));
  }, "pin");

  const current = STAGES[stage];

  // The section is over four viewports tall and the page is longer still.
  // Rendering pods while it is nowhere near the screen is pure battery drain.
  const [onScreen, setOnScreen] = useState(false);
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting), {
      rootMargin: "200px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, [host]);

  return (
    <div ref={host} className="relative h-[420vh]">
      <div className="sticky top-0 flex h-dvh flex-col overflow-hidden bg-forest">
        {/* The scene sits behind everything, dimmed toward the text */}
        <div className="absolute inset-0">
          <Canvas
            dpr={[1, 1.6]}
            camera={{ position: [0, 0, 7], fov: 42 }}
            gl={{ alpha: true, antialias: true }}
            frameloop={onScreen ? "always" : "never"}
          >
            <Pods scroll={scroll} />
          </Canvas>
        </div>

        {/* Portrait puts the copy under the pods, so the scrim comes up from
            the bottom; from lg the two sit side by side and it comes in from
            the left instead. */}
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-forest via-forest/75 to-transparent lg:bg-gradient-to-r lg:via-forest/40"
          aria-hidden="true"
        />

        <div className="relative mx-auto flex w-full max-w-6xl flex-1 items-end px-4 sm:px-6 lg:items-center">
          <div className="max-w-lg">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sage">
              One pod, four stages
            </p>

            {/* Keyed so React swaps the node and the entry animation replays */}
            <div key={stage} className="animate-fade-up">
              <h2 className="mt-4 font-display text-3xl leading-[1.1] text-cream sm:text-5xl">
                {current.title}
              </h2>
              <p className="mt-5 max-w-md leading-relaxed text-cream/70">
                {current.text}
              </p>
              <p className="mt-6 inline-flex rounded-full border border-cream/20 bg-cream/5 px-4 py-2 text-sm text-sage">
                {current.metric}
              </p>
            </div>
          </div>
        </div>

        {/* Stage rail */}
        <ol className="relative mx-auto flex w-full max-w-6xl gap-2 px-4 pb-10 sm:gap-4 sm:px-6">
          {STAGES.map((s, i) => (
            <li key={s.label} className="flex-1">
              <div className="h-0.5 w-full overflow-hidden rounded-full bg-cream/15">
                <div
                  className="h-full rounded-full bg-sage transition-[width] duration-500 ease-out"
                  style={{ width: i <= stage ? "100%" : "0%" }}
                />
              </div>
              <p
                className={
                  "mt-3 text-[11px] uppercase tracking-[0.14em] transition-colors sm:text-xs " +
                  (i <= stage ? "text-cream" : "text-cream/35")
                }
              >
                {s.label}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
