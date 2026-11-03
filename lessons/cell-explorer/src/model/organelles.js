import * as THREE from 'three';

// 3D organelles built from simple shapes, sized in metres for the displayed cell.
// `clip` is the cutting plane that opens the cell; only "shell" materials use it, so organelles stay whole.

export function rng(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const mat = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.05, ...opts });

/** A see-through shell (membrane, wall, envelope…) that is cut open by the clipping plane. */
export const shellMat = (color, opacity, clip) => new THREE.MeshStandardMaterial({
  color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false, roughness: 0.4, clippingPlanes: [clip],
});

/** Random direction / point helpers */
export function randomInSphere(rand, r) {
  for (;;) {
    const v = new THREE.Vector3(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1);
    if (v.lengthSq() <= 1) return v.multiplyScalar(r);
  }
}

export function orientRandom(obj, rand) {
  obj.rotation.set(rand() * Math.PI * 2, rand() * Math.PI * 2, rand() * Math.PI * 2);
}

// ── organelles ─────────────────────────────────────────

export function nucleus(r, clip, rand) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.SphereGeometry(r, 48, 32), shellMat(0x8e6cc4, 0.55, clip)));
  g.add(new THREE.Mesh(new THREE.SphereGeometry(r * 0.94, 48, 32), shellMat(0x6c4aa8, 0.35, clip)));
  // nucleoplasm
  g.add(new THREE.Mesh(new THREE.SphereGeometry(r * 0.92, 32, 24), shellMat(0xd9c8f5, 0.18, clip)));
  const nucleolus = new THREE.Mesh(new THREE.SphereGeometry(r * 0.32, 24, 16), mat(0x4b2a7a));
  nucleolus.position.set(r * 0.2, r * 0.15, -r * 0.2);
  g.add(nucleolus);
  // chromatin threads
  const chromMat = mat(0xb08ee0);
  for (let i = 0; i < 6; i++) {
    const pts = [];
    let p = randomInSphere(rand, r * 0.6);
    for (let k = 0; k < 6; k++) {
      pts.push(p.clone());
      p = p.add(randomInSphere(rand, r * 0.3)).clampLength(0, r * 0.8);
    }
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, r * 0.025, 6), chromMat));
  }
  // nuclear pores
  const poreMat = mat(0x3d2566);
  for (let i = 0; i < 26; i++) {
    const d = randomInSphere(rand, 1).normalize();
    if (d.z > 0.05) d.z *= -1; // keep them on the visible back half
    const pore = new THREE.Mesh(new THREE.TorusGeometry(r * 0.06, r * 0.018, 6, 12), poreMat);
    pore.position.copy(d.multiplyScalar(r));
    pore.lookAt(0, 0, 0);
    g.add(pore);
  }
  return g;
}

export function mitochondrion(r, len) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 8, 16), mat(0xe8743b, { transparent: true, opacity: 0.55, depthWrite: false })));
  const inner = mat(0xc4501f);
  const n = Math.max(3, Math.round(len / (r * 0.9)));
  for (let i = 0; i < n; i++) {
    // cristae: folds of the inner membrane, alternating from each side
    const c = new THREE.Mesh(new THREE.BoxGeometry(r * 1.4, r * 0.18, r * 1.1), inner);
    c.position.set((i % 2 ? 1 : -1) * r * 0.3, -len / 2 + ((i + 0.5) / n) * len, 0);
    g.add(c);
  }
  g.add(new THREE.Mesh(new THREE.CapsuleGeometry(r * 0.85, len, 6, 12), mat(0xf6a26b, { transparent: true, opacity: 0.35, depthWrite: false })));
  g.userData.glow = true;
  return g;
}

/** Ribosomes as instanced dots (there are millions in a real cell). */
export function ribosomeCloud(points, r, color = 0x5a3e8c) {
  const m = new THREE.InstancedMesh(new THREE.SphereGeometry(r, 8, 6), mat(color), points.length);
  const dummy = new THREE.Object3D();
  points.forEach((p, i) => {
    dummy.position.copy(p);
    dummy.updateMatrix();
    m.setMatrixAt(i, dummy.matrix);
  });
  return m;
}

/** Rough ER: curved folded sheets hugging the nucleus, studded with ribosomes. */
export function roughER(nr, rand, ribosomeR) {
  const g = new THREE.Group();
  const sheet = mat(0x5aa0d8, { transparent: true, opacity: 0.85, side: THREE.DoubleSide });
  const dots = [];
  for (let k = 0; k < 5; k++) {
    const R = nr * (1.22 + k * 0.16);
    const arc = 1.9 - k * 0.15;
    const t = new THREE.Mesh(new THREE.TorusGeometry(R, nr * 0.035, 6, 48, arc), sheet);
    t.scale.z = 3.5;
    t.rotation.z = 0.25 + k * 0.08;
    g.add(t);
    for (let i = 0; i < 26; i++) {
      const a = t.rotation.z + rand() * arc;
      const side = rand() < 0.5 ? -1 : 1;
      dots.push(new THREE.Vector3(Math.cos(a) * (R + side * nr * 0.05), Math.sin(a) * (R + side * nr * 0.05), (rand() - 0.5) * nr * 0.2));
    }
  }
  g.add(ribosomeCloud(dots, ribosomeR));
  return g;
}

export function smoothER(nr, rand) {
  const g = new THREE.Group();
  const m = mat(0x8cc8ee);
  for (let i = 0; i < 4; i++) {
    const pts = [];
    let a = 3.4 + i * 0.35;
    for (let k = 0; k < 5; k++) {
      const R = nr * (1.3 + rand() * 0.7);
      pts.push(new THREE.Vector3(Math.cos(a) * R, Math.sin(a) * R, (rand() - 0.5) * nr * 0.5));
      a += 0.3;
    }
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, nr * 0.035, 8), m));
  }
  return g;
}

/** Golgi apparatus: a stack of curved, flattened sacs with vesicles budding off. */
export function golgi(size, rand) {
  const g = new THREE.Group();
  const m = mat(0xf0c040, { side: THREE.DoubleSide });
  for (let i = 0; i < 5; i++) {
    const w = size * (1 - i * 0.12);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(size * 1.4, 32, 6, 0, Math.PI * 2, 0, 0.42), m);
    cap.scale.set(w / size, 0.35, 0.55);
    cap.position.y = i * size * 0.13 - size * 1.4 * 0.35;
    g.add(cap);
  }
  const vm = mat(0xffe08a);
  for (let i = 0; i < 6; i++) {
    const v = new THREE.Mesh(new THREE.SphereGeometry(size * 0.09, 12, 8), vm);
    const a = rand() * Math.PI * 2;
    v.position.set(Math.cos(a) * size * 0.65, (rand() - 0.2) * size * 0.4, Math.sin(a) * size * 0.35);
    g.add(v);
  }
  return g;
}

export function vesicle(r) {
  return new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat(0xffd97a, { transparent: true, opacity: 0.85 }));
}

export function lysosome(r, rand) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), mat(0xc04a8a, { transparent: true, opacity: 0.8 })));
  const dm = mat(0x6d1f4d);
  for (let i = 0; i < 6; i++) {
    const d = new THREE.Mesh(new THREE.SphereGeometry(r * 0.18, 8, 6), dm);
    d.position.copy(randomInSphere(rand, r * 0.6));
    g.add(d);
  }
  return g;
}

export function centrioles(len) {
  const g = new THREE.Group();
  const m = mat(0x7ad0b8);
  const bundle = () => {
    const b = new THREE.Group();
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(len * 0.05, len * 0.05, len, 6), m);
      rod.position.set(Math.cos(a) * len * 0.22, 0, Math.sin(a) * len * 0.22);
      b.add(rod);
    }
    return b;
  };
  const a = bundle();
  const b = bundle();
  b.rotation.x = Math.PI / 2;
  b.position.set(len * 0.6, 0, 0);
  g.add(a, b);
  return g;
}

export function chloroplast(len, rand) {
  const g = new THREE.Group();
  const outer = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), mat(0x3f9a3f, { transparent: true, opacity: 0.6, depthWrite: false }));
  outer.scale.set(len / 2, len / 5, len / 3.2);
  g.add(outer);
  const gm = mat(0x1f6b2a);
  for (let i = 0; i < 5; i++) {
    // grana: stacks of thylakoid discs
    const stack = new THREE.Group();
    for (let k = 0; k < 4; k++) {
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(len * 0.07, len * 0.07, len * 0.018, 12), gm);
      disc.position.y = k * len * 0.025;
      stack.add(disc);
    }
    stack.position.set(-len * 0.32 + i * len * 0.16, -len * 0.04, (rand() - 0.5) * len * 0.12);
    g.add(stack);
  }
  g.userData.glow = true;
  return g;
}

export function dnaLoop(rx, ry, rand) {
  const pts = [];
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * rx * (0.5 + rand() * 0.5), Math.sin(a * 3) * ry * 0.7 + (rand() - 0.5) * ry * 0.6, Math.sin(a) * ry * (0.4 + rand() * 0.6)));
  }
  return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 160, ry * 0.05, 6, true), mat(0x6a5acd));
}

export function plasmid(r) {
  return new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.2, 8, 24), mat(0xffa94d));
}

export function flagellum(len, r) {
  const pts = [];
  for (let i = 0; i <= 60; i++) {
    const t = i / 60;
    pts.push(new THREE.Vector3(t * len, Math.sin(t * Math.PI * 6) * r * 6 * Math.min(1, t * 4), Math.cos(t * Math.PI * 6) * r * 6 * Math.min(1, t * 4)));
  }
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 200, r, 6), mat(0x9ad0ff)));
  g.userData.spin = true;
  return g;
}
