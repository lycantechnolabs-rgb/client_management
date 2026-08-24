import * as THREE from "three";

/**
 * A cardamom capsule, built rather than modelled.
 *
 * There is no GLTF for this — and a downloaded model would be a megabyte of
 * payload for growers on hill networks. The pod is a simple enough solid to
 * describe in maths: an ovoid tapering to a point at both ends, with the three
 * longitudinal ridges that make a cardamom pod recognisable at a glance.
 */
export function createPodGeometry({
  segments = 72,
  rings = 56,
  height = 2.1,
  radius = 0.6,
  /** Depth of the three ridges, as a fraction of radius. */
  ridge = 0.085,
  /** >1 moves the widest point above centre, as a real capsule is. */
  bias = 1.18,
} = {}) {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let j = 0; j <= rings; j++) {
    const u = j / rings;

    // sin() gives the ovoid; the exponent sharpens both tips into points.
    // Skewing u inside the sine — but not in the y below — moves the widest
    // part of the pod above centre without redistributing the rings.
    const profile = Math.pow(Math.sin(Math.PI * Math.pow(u, bias)), 0.62);

    // The ridges fade out at the tips, where the pod closes to nothing.
    const ridgeAmount = ridge * Math.sin(Math.PI * u);

    for (let i = 0; i <= segments; i++) {
      const v = i / segments;
      const theta = v * Math.PI * 2;
      const r = radius * profile * (1 + ridgeAmount * Math.cos(3 * theta));

      positions.push(Math.cos(theta) * r, (u - 0.5) * height, Math.sin(theta) * r);
      uvs.push(v, u);
    }
  }

  const stride = segments + 1;
  for (let j = 0; j < rings; j++) {
    for (let i = 0; i < segments; i++) {
      const a = j * stride + i;
      const b = a + stride;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  return geometry;
}

/** The dry stalk left on a picked pod. */
export function createStalkGeometry() {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.06, 0.22, 0.02),
    new THREE.Vector3(0.02, 0.42, -0.05),
    new THREE.Vector3(-0.08, 0.58, -0.04),
  ]);
  return new THREE.TubeGeometry(curve, 20, 0.028, 6, false);
}

/** Scattered motes of dust and pollen, for depth behind the pods. */
export function createMotes(count: number, spread: number) {
  const positions = new Float32Array(count * 3);
  const speeds = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * spread;
    positions[i * 3 + 1] = (Math.random() - 0.5) * spread;
    positions[i * 3 + 2] = (Math.random() - 0.5) * spread * 0.6;
    speeds[i] = 0.04 + Math.random() * 0.12;
  }

  return { positions, speeds };
}
