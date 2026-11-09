import * as THREE from 'three';

// Procedural, animated sea life at real size. Every model faces +z (its nose), so steering can use lookAt.
// Each returns a Group with userData.animate(t, speed) for swimming / pulsing / walking.

const std = (opts) => new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.05, ...opts });
const lerp = (a, b, t) => a + (b - a) * t;
const C = (hex) => new THREE.Color(hex);

/** Colour a geometry vertex by vertex: fn(t along length 0=tail..1=nose, h height −1..1, side −1..1) → Color. */
function paint(geo, length, height, fn) {
  const pos = geo.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = pos.getZ(i) / length + 0.5;
    const h = pos.getY(i) / (height / 2);
    c.copy(fn(t, h, pos.getX(i)));
    col.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
}

/** A flat fin from 2D points (in the y-z plane, z forward). */
function fin(points, color, opacity = 1) {
  const shape = new THREE.Shape(points.map(([z, y]) => new THREE.Vector2(z, y)));
  const g = new THREE.ShapeGeometry(shape);
  g.rotateY(-Math.PI / 2); // shape x → z
  return new THREE.Mesh(g, std({ color, side: THREE.DoubleSide, transparent: opacity < 1, opacity }));
}

function eye(r) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), std({ color: 0xf2f2e8 })));
  const pupil = new THREE.Mesh(new THREE.SphereGeometry(r * 0.6, 10, 8), std({ color: 0x050505, roughness: 0.2 }));
  pupil.position.x = r * 0.5;
  g.add(pupil);
  return g;
}

/**
 * A fish: lathe body flattened sideways, painted with a pattern; tail fin on a pivot that beats.
 * o: { length, height, width, pattern(t,h)→Color, tail: 'fork'|'round'|'shark'|'lunate', tailColor, finColor, dorsal, dorsalColor }
 */
export function fish(o) {
  const L = o.length;
  const H = o.height;
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  // body profile: nose at +L/2, tail stalk at -L/2
  const pts = [];
  const n = 24;
  for (let i = 0; i <= n; i++) {
    const t = i / n; // 0 tail → 1 nose
    const r = (H / 2) * (o.profile ? o.profile(t) : Math.pow(Math.sin(Math.PI * Math.min(1, t * 0.92 + 0.08)), 0.75) * (0.25 + 0.75 * Math.min(1, t * 2.2)));
    pts.push(new THREE.Vector2(Math.max(0.0005, r), (t - 0.5) * L));
  }
  const geo = new THREE.LatheGeometry(pts, 20);
  geo.rotateX(Math.PI / 2); // lathe axis (y) → z
  geo.scale(o.width / H, 1, 1);
  paint(geo, L, H, (t, h) => o.pattern(t, h));
  body.add(new THREE.Mesh(geo, std({ vertexColors: true, roughness: o.shiny ? 0.25 : 0.55, metalness: o.shiny ? 0.35 : 0.05 })));

  // tail on a pivot at the tail stalk
  const tail = new THREE.Group();
  tail.position.z = -L / 2 + L * 0.02;
  const th = H * (o.tailSize ?? 0.9);
  const tl = L * 0.22;
  const shapes = {
    fork: [[0, 0.04 * th], [-tl, th * 0.6], [-tl * 0.55, 0], [-tl, -th * 0.6], [0, -0.04 * th]],
    lunate: [[0, 0.04 * th], [-tl * 0.9, th * 0.75], [-tl * 0.6, 0], [-tl * 0.9, -th * 0.75], [0, -0.04 * th]],
    round: [[0, 0.05 * th], [-tl * 0.6, th * 0.45], [-tl, 0.2 * th], [-tl, -0.2 * th], [-tl * 0.6, -th * 0.45], [0, -0.05 * th]],
    shark: [[0, 0.05 * th], [-tl * 1.1, th * 0.95], [-tl * 0.75, th * 0.2], [-tl * 0.5, -th * 0.35], [0, -0.05 * th]],
  };
  tail.add(fin(shapes[o.tail ?? 'fork'], o.tailColor ?? 0x888888));
  g.add(tail);

  // dorsal fin(s)
  if (o.dorsal !== false) {
    const d = o.dorsal ?? { at: 0.55, len: 0.5, h: 0.35 };
    const df = fin([[L * d.len * 0.5, 0], [L * d.len * 0.1, H * d.h], [-L * d.len * 0.5, H * d.h * 0.4], [-L * d.len * 0.5, 0]], o.dorsalColor ?? o.finColor ?? 0x888888, o.finOpacity ?? 1);
    df.position.set(0, H * 0.42, (d.at - 0.5) * L);
    body.add(df);
  }
  if (o.anal) {
    const af = fin([[L * 0.12, 0], [-L * 0.02, -H * 0.3], [-L * 0.16, -H * 0.15], [-L * 0.16, 0]], o.finColor ?? 0x888888, o.finOpacity ?? 1);
    af.position.set(0, -H * 0.38, -L * 0.18);
    body.add(af);
  }
  // pectoral fins (they flap)
  const pecs = [];
  for (const side of [-1, 1]) {
    const pf = fin([[0, 0], [-L * (o.pecLen ?? 0.14), H * 0.12], [-L * (o.pecLen ?? 0.14) * 0.8, -H * (o.pecDrop ?? 0.25)]], o.finColor ?? 0x888888, o.finOpacity ?? 0.9);
    pf.position.set(side * o.width * 0.45, -H * 0.12, L * 0.18);
    pf.rotation.y = side * 0.5;
    pf.rotation.z = side * (o.pecTilt ?? 0.4);
    pf.userData.side = side;
    body.add(pf);
    pecs.push(pf);
  }
  for (const side of [-1, 1]) {
    const e = eye(H * (o.eye ?? 0.07));
    e.position.set(side * o.width * 0.42, H * 0.1, L * 0.36);
    e.rotation.y = side > 0 ? 0 : Math.PI;
    body.add(e);
  }
  if (o.extra) o.extra(g, body, L, H);

  const beat = o.beat ?? 7;
  g.userData.animate = (t, speed = 1) => {
    const s = Math.sin(t * beat * (0.6 + speed));
    tail.rotation.y = s * 0.45;
    body.rotation.y = -s * 0.06;
    for (const p of pecs) p.rotation.x = Math.sin(t * 5 + p.userData.side) * 0.3;
  };
  return g;
}

// ── species ────────────────────────────────────────────

export function shark() {
  return fish({
    length: 1.6, height: 0.26, width: 0.24, tail: 'shark', tailSize: 1.25, beat: 3,
    profile: (t) => Math.pow(Math.sin(Math.PI * Math.min(1, t * 0.95 + 0.05)), 0.9) * (0.2 + 0.8 * Math.min(1, t * 1.8)),
    pattern: (t, h) => (h > -0.15 ? C(0x7d8a96) : C(0xe8ecef)).lerp(C(0x5e6b78), Math.max(0, h) * 0.4), // countershading
    tailColor: 0x6f7c88, finColor: 0x6f7c88, dorsal: { at: 0.55, len: 0.26, h: 1.05 }, dorsalColor: 0x6f7c88, pecLen: 0.24, pecDrop: 0.7, pecTilt: 0.9, eye: 0.035, anal: true,
    extra(g, body, L, H) {
      // black tips on the fins, and five gill slits
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.07, 8), std({ color: 0x111111 }));
      tip.position.set(0, H * 0.42 + H * 0.95, L * 0.06);
      body.add(tip);
      for (let i = 0; i < 5; i++) {
        for (const side of [-1, 1]) {
          const slit = new THREE.Mesh(new THREE.BoxGeometry(0.003, H * 0.2, 0.006), std({ color: 0x3d4650 }));
          slit.position.set(side * 0.082, -H * 0.02, L * (0.24 - i * 0.022));
          body.add(slit);
        }
      }
    },
  });
}

export function barracuda() {
  return fish({
    length: 1.2, height: 0.14, width: 0.11, tail: 'fork', tailSize: 1.3, beat: 3.5, shiny: true,
    profile: (t) => Math.pow(Math.sin(Math.PI * Math.min(1, t * 0.97 + 0.03)), 0.6) * (0.3 + 0.7 * Math.min(1, t * 2.5)),
    pattern: (t, h) => {
      const bar = h > 0 && Math.sin(t * 52) > 0.55 && t > 0.2 && t < 0.8;
      return bar ? C(0x3b4650) : h > 0.35 ? C(0x5f6f7a) : C(0xc9d2d8).lerp(C(0xf5f7f8), Math.max(0, -h));
    },
    tailColor: 0x47535c, finColor: 0x5b6670, dorsal: { at: 0.6, len: 0.12, h: 0.7 }, eye: 0.11, anal: true,
    extra(g, body, L, H) {
      const jaw = new THREE.Mesh(new THREE.ConeGeometry(H * 0.18, L * 0.1, 8), std({ color: 0xb8c2c8 }));
      jaw.rotation.x = Math.PI / 2;
      jaw.position.set(0, -H * 0.15, L * 0.52);
      body.add(jaw);
    },
  });
}

export function parrotfish() {
  return fish({
    length: 0.4, height: 0.15, width: 0.07, tail: 'lunate', beat: 6,
    pattern: (t, h) => {
      const base = C(0x2bb3a3).lerp(C(0x3d7fd9), (h + 1) / 2);
      if (Math.abs(Math.sin(t * 30 + h * 3)) > 0.93) return C(0xf28fb3);
      return t > 0.85 ? C(0x7fd9c7) : base;
    },
    tailColor: 0x2f8fd0, finColor: 0x4fb7c9, dorsal: { at: 0.45, len: 0.6, h: 0.25 }, anal: true,
    extra(g, body, L, H) {
      const beak = new THREE.Mesh(new THREE.SphereGeometry(H * 0.18, 10, 8), std({ color: 0xe8f2ea }));
      beak.scale.set(0.8, 0.7, 1);
      beak.position.set(0, -H * 0.05, L * 0.5);
      body.add(beak);
    },
  });
}

export function clownfish() {
  return fish({
    length: 0.09, height: 0.042, width: 0.022, tail: 'round', beat: 10, eye: 0.12,
    pattern: (t) => {
      // three white bands edged in black
      for (const c of [0.78, 0.5, 0.12]) {
        const d = Math.abs(t - c);
        if (d < 0.055) return C(0xffffff);
        if (d < 0.075) return C(0x111111);
      }
      return C(0xff7a1a);
    },
    tailColor: 0xff7a1a, finColor: 0xff8c2e, dorsal: { at: 0.45, len: 0.55, h: 0.35 }, anal: true,
  });
}

export function wrasse() {
  return fish({
    length: 0.1, height: 0.026, width: 0.016, tail: 'round', beat: 11,
    pattern: (t, h) => {
      const stripe = Math.abs(h) < 0.18 + (1 - t) * 0.35; // black stripe widening to the tail
      if (stripe) return C(0x0a0a14);
      return t > 0.5 ? C(0xf2ecd8).lerp(C(0x4aa6ff), 1 - (t - 0.5) * 2) : C(0x2f7fff);
    },
    tailColor: 0x1a3fa0, finColor: 0x3a70d0, dorsal: { at: 0.45, len: 0.6, h: 0.2 },
  });
}

export function turtle() {
  const g = new THREE.Group();
  const shell = new THREE.SphereGeometry(0.5, 32, 16);
  shell.scale(0.85, 0.28, 1);
  paint(shell, 1, 0.28, (t, h, x) => {
    // scutes: a polygon pattern of lighter plates with dark seams
    const u = x * 9 + 3;
    const v = t * 9;
    const seam = Math.abs(Math.sin(u)) < 0.12 || Math.abs(Math.sin(v + (Math.floor(u / Math.PI) % 2) * 1.5)) < 0.12;
    return h < -0.2 ? C(0xe8d9a8) : seam ? C(0x2e2414) : C(0x6b5530).lerp(C(0x9a7a42), Math.abs(Math.sin(u * 0.5 + v)));
  });
  g.add(new THREE.Mesh(shell, std({ vertexColors: true, roughness: 0.7 })));
  const skin = std({ color: 0x8a8a5c, roughness: 0.8 });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), skin);
  head.scale.set(0.9, 0.8, 1.3);
  head.position.set(0, 0.02, 0.55);
  g.add(head);
  for (const side of [-1, 1]) {
    const e = eye(0.014);
    e.position.set(side * 0.06, 0.05, 0.62);
    e.rotation.y = side > 0 ? 0 : Math.PI;
    g.add(e);
  }
  const flippers = [];
  const make = (front, side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.38, -0.02, front ? 0.25 : -0.3);
    const f = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), skin);
    f.scale.set(front ? 0.3 : 0.12, 0.02, front ? 0.09 : 0.07);
    f.position.x = side * (front ? 0.28 : 0.1);
    f.rotation.y = side * (front ? -0.5 : 0.4);
    pivot.add(f);
    pivot.userData = { front, side };
    g.add(pivot);
    flippers.push(pivot);
  };
  for (const s of [-1, 1]) {
    make(true, s);
    make(false, s);
  }
  g.userData.animate = (t, speed = 1) => {
    for (const f of flippers) {
      const a = Math.sin(t * (1.6 + speed)) * (f.userData.front ? 0.55 : 0.25);
      f.rotation.z = f.userData.side * a;
      f.rotation.y = f.userData.front ? f.userData.side * Math.cos(t * (1.6 + speed)) * 0.25 : 0;
    }
    head.rotation.x = Math.sin(t * 0.7) * 0.1;
  };
  return g;
}

export function octopus() {
  const g = new THREE.Group();
  const skin = std({ color: 0xb05a3a, roughness: 0.75 });
  const mantle = new THREE.Mesh(new THREE.SphereGeometry(0.07, 20, 14), skin);
  mantle.scale.set(1, 1.2, 1.5);
  mantle.position.set(0, 0.09, -0.06);
  mantle.rotation.x = -0.6;
  g.add(mantle);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 12), skin);
  head.position.set(0, 0.05, 0.03);
  g.add(head);
  for (const side of [-1, 1]) {
    const e = eye(0.012);
    e.position.set(side * 0.045, 0.075, 0.05);
    e.rotation.y = side > 0 ? 0 : Math.PI;
    g.add(e);
  }
  const arms = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    let parent = new THREE.Group();
    parent.position.set(Math.sin(a) * 0.04, 0.02, Math.cos(a) * 0.04 + 0.03);
    parent.rotation.y = a;
    g.add(parent);
    const segs = [];
    for (let k = 0; k < 7; k++) {
      const r = 0.016 * (1 - k / 8);
      const seg = new THREE.Mesh(new THREE.CapsuleGeometry(r, 0.03, 4, 8), skin);
      seg.rotation.x = Math.PI / 2;
      seg.position.z = 0.02;
      const joint = new THREE.Group();
      joint.position.z = k === 0 ? 0 : 0.035;
      joint.add(seg);
      parent.add(joint);
      parent = joint;
      segs.push(joint);
    }
    arms.push(segs);
  }
  g.userData.animate = (t, speed = 1) => {
    arms.forEach((segs, i) => segs.forEach((j, k) => {
      j.rotation.x = 0.25 + Math.sin(t * (1.5 + speed) + i * 0.8 + k * 0.6) * 0.25;
      j.rotation.y = Math.sin(t * 0.9 + i + k * 0.4) * 0.15;
    }));
    mantle.scale.y = 1.2 + Math.sin(t * 2) * 0.05; // breathing
  };
  return g;
}

export function jellyfish() {
  const g = new THREE.Group();
  const bellGeo = new THREE.SphereGeometry(0.12, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  const bell = new THREE.Mesh(bellGeo, std({ color: 0xcfe8ff, transparent: true, opacity: 0.45, side: THREE.DoubleSide, emissive: 0x24405a, depthWrite: false }));
  bell.scale.y = 0.55;
  g.add(bell);
  for (let i = 0; i < 4; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.006, 6, 16), std({ color: 0xf2a7d8, emissive: 0x401030 }));
    const a = (i / 4) * Math.PI * 2;
    ring.position.set(Math.cos(a) * 0.04, 0.03, Math.sin(a) * 0.04);
    ring.rotation.x = Math.PI / 2;
    g.add(ring);
  }
  // oral arms: frilly ribbons that sway
  const arms = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    const pts = [];
    for (let k = 0; k <= 8; k++) pts.push(new THREE.Vector3(Math.cos(a) * 0.02 + Math.sin(k) * 0.01, -k * 0.03, Math.sin(a) * 0.02));
    const arm = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.008, 6), std({ color: 0xe6f2ff, transparent: true, opacity: 0.6, depthWrite: false }));
    g.add(arm);
    arms.push(arm);
  }
  // fringe of fine tentacles
  const fringe = [];
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    fringe.push(new THREE.Vector3(Math.cos(a) * 0.12, 0, Math.sin(a) * 0.12), new THREE.Vector3(Math.cos(a) * 0.125, -0.07, Math.sin(a) * 0.125));
  }
  const tent = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(fringe), new THREE.LineBasicMaterial({ color: 0xdff0ff, transparent: true, opacity: 0.5 }));
  g.add(tent);
  g.rotation.x = -Math.PI / 2; // swims bell-first (+z is "up" for the bell)
  const wrap = new THREE.Group();
  wrap.add(g);
  wrap.userData.animate = (t) => {
    const p = Math.sin(t * 2.2);
    bell.scale.set(1 + p * 0.12, 0.55 - p * 0.08, 1 + p * 0.12);
    tent.scale.set(1 + p * 0.12, 1, 1 + p * 0.12);
    arms.forEach((a, i) => { a.rotation.y = Math.sin(t * 0.8 + i) * 0.4; });
  };
  return wrap;
}

export function crab() {
  const g = new THREE.Group();
  const shell = std({ color: 0xc0432c, roughness: 0.5 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.06, 20, 12), shell);
  body.scale.set(1.3, 0.55, 1);
  body.position.y = 0.035;
  g.add(body);
  const legs = [];
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.06, 0.03, 0.03 - i * 0.022);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.003, 0.08, 6), shell);
      leg.rotation.z = side * 1.0;
      leg.position.set(side * 0.03, -0.012, 0);
      pivot.add(leg);
      pivot.userData = { side, i };
      g.add(pivot);
      legs.push(pivot);
    }
    const claw = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 8), std({ color: 0x8e2a1c }));
    claw.scale.set(1, 0.7, 1.5);
    claw.position.set(side * 0.055, 0.035, 0.075);
    g.add(claw);
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.02, 5), shell);
    stalk.position.set(side * 0.015, 0.065, 0.05);
    g.add(stalk);
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.005, 8, 6), std({ color: 0x080808 }));
    e.position.set(side * 0.015, 0.076, 0.05);
    g.add(e);
  }
  g.userData.animate = (t, speed = 1) => {
    for (const l of legs) l.rotation.y = Math.sin(t * 8 * speed + l.userData.i * 1.3 + (l.userData.side > 0 ? 0 : Math.PI)) * 0.3 * speed;
  };
  return g;
}

export function urchin() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 12), std({ color: 0x1a1020 }));
  body.position.y = 0.03;
  g.add(body);
  const n = 70;
  const spines = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.0006, 0.0022, 0.16, 4), std({ color: 0x120a18 }), n);
  const m = new THREE.Object3D();
  for (let i = 0; i < n; i++) {
    const phi = Math.acos(1 - (i + 0.5) / n); // upper hemisphere-biased
    const th = i * 2.399;
    const d = new THREE.Vector3(Math.sin(phi) * Math.cos(th), Math.cos(phi) * 0.9 + 0.1, Math.sin(phi) * Math.sin(th)).normalize();
    m.position.copy(d).multiplyScalar(0.035 + 0.08).add(new THREE.Vector3(0, 0.03, 0));
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
    m.updateMatrix();
    spines.setMatrixAt(i, m.matrix);
  }
  g.add(spines);
  g.userData.animate = (t) => { spines.rotation.y = Math.sin(t * 0.5) * 0.05; };
  return g;
}

export function cucumber() {
  const g = new THREE.Group();
  const skin = std({ color: 0x5a3a24, roughness: 0.9 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.28, 8, 14), skin);
  body.rotation.x = Math.PI / 2;
  body.position.y = 0.035;
  g.add(body);
  for (let i = 0; i < 26; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 5), std({ color: 0x7a5434 }));
    const a = Math.random() * Math.PI;
    b.position.set(Math.cos(a) * 0.04, 0.035 + Math.sin(a) * 0.04, (Math.random() - 0.5) * 0.3);
    g.add(b);
  }
  g.userData.animate = (t) => { body.scale.set(1, 1 + Math.sin(t * 0.8) * 0.04, 1); };
  return g;
}

export function anemone() {
  const g = new THREE.Group();
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.07, 24), std({ color: 0x9a3b55 }));
  column.position.y = 0.035;
  g.add(column);
  const n = 110;
  const tent = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.008, 0.11, 4, 6), std({ color: 0xd9c47a, emissive: 0x2a2208 }), n);
  const base = [];
  for (let i = 0; i < n; i++) {
    const r = 0.11 * Math.sqrt((i + 0.5) / n);
    const a = i * 2.399;
    base.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, a, r });
  }
  const m = new THREE.Object3D();
  const update = (t) => {
    base.forEach((b, i) => {
      m.position.set(b.x, 0.12, b.z);
      m.rotation.set(Math.sin(t * 1.3 + b.a) * 0.35 + b.z * 4, 0, -b.x * 4 + Math.cos(t * 1.1 + b.r * 30) * 0.3);
      m.updateMatrix();
      tent.setMatrixAt(i, m.matrix);
    });
    tent.instanceMatrix.needsUpdate = true;
  };
  update(0);
  g.add(tent);
  g.userData.animate = (t) => update(t);
  return g;
}

/** Simple stand-ins for the hammerhead and manta (shown until / unless their 3D models load). */
export function hammer() {
  return fish({
    length: 3.0, height: 0.42, width: 0.38, tail: 'shark', tailSize: 1.3, beat: 2.5,
    pattern: (t, h) => (h > -0.15 ? C(0x8a9098) : C(0xe8ecef)),
    tailColor: 0x7a8088, finColor: 0x7a8088, dorsal: { at: 0.55, len: 0.22, h: 1.4 }, dorsalColor: 0x7a8088, eye: 0.03, anal: true,
    extra(g, body, L, H) {
      const head = new THREE.Mesh(new THREE.BoxGeometry(L * 0.3, H * 0.18, L * 0.07), std({ color: 0x8a9098 }));
      head.position.set(0, 0, L * 0.47); // the "hammer" (cephalofoil)
      body.add(head);
    },
  });
}

export function manta() {
  const g = new THREE.Group();
  const shape = new THREE.Shape([[0, 0.6], [1.5, -0.2], [0.3, -0.5], [0, -0.45], [-0.3, -0.5], [-1.5, -0.2]].map(([x, z]) => new THREE.Vector2(x, z)));
  const geo = new THREE.ShapeGeometry(shape, 8).rotateX(-Math.PI / 2);
  const wings = new THREE.Mesh(geo, std({ color: 0x2a3038, side: THREE.DoubleSide }));
  g.add(wings);
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.02, 1.2, 6).rotateX(Math.PI / 2), std({ color: 0x2a3038 }));
  tail.position.z = -1.0;
  g.add(tail);
  g.userData.animate = (t) => { wings.scale.y = 1; wings.rotation.z = Math.sin(t * 2) * 0.05; };
  return g;
}

export const BUILDERS = { shark, hammer, manta, barracuda, parrotfish, clownfish, wrasse, turtle, octopus, jelly: jellyfish, crab, urchin, cucumber, anemone };

// ── 3D models (models/manifest.json) ───────────────────
// .glb files in lessons/reef-dive/models/ replace the built-in shapes. Each entry in manifest.json is either
// a file name, or { file, animation?, animSpeed?, motion?, floor? } — see models/README.md.
// Models are scaled to the species' real length; their nose points along +z and their back along +y.
export async function loadModelOverrides(base) {
  let manifest;
  try {
    const res = await fetch(new URL('manifest.json', base));
    if (!res.ok) return {};
    manifest = await res.json();
  } catch {
    return {};
  }
  const [{ GLTFLoader }, { MeshoptDecoder }, SkeletonUtils] = await Promise.all([
    import('three/addons/loaders/GLTFLoader.js'),
    import('three/addons/libs/meshopt_decoder.module.js'),
    import('three/addons/utils/SkeletonUtils.js'),
  ]);
  skeletonClone = SkeletonUtils.clone;
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const load = (file) => loader.loadAsync(new URL(file, base).toString());
  const out = {};
  await Promise.all(Object.entries(manifest).map(async ([id, entry]) => {
    const opts = typeof entry === 'string' ? { file: entry } : entry;
    try {
      if (opts.files) {
        // a set of interchangeable pieces (e.g. coral colonies); "split" files hold several pieces each
        const pieces = [];
        for (const file of opts.files) {
          const gltf = await load(file);
          if (opts.split?.includes(file)) {
            gltf.scene.updateMatrixWorld(true);
            gltf.scene.traverse((o) => { if (o.isMesh) pieces.push(piece(o)); });
          } else pieces.push(piece(gltf.scene));
        }
        out[id] = { ...opts, pieces };
        return;
      }
      const gltf = await load(opts.file);
      const scene = gltf.scene;
      scene.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(scene, true);
      out[id] = { ...opts, scene, box, clips: gltf.animations };
    } catch (e) {
      console.warn(`Could not load model for ${id}`, e);
    }
  }));
  return out;
}

/** One coral piece, re-centred so it stands on y = 0, with its largest dimension scaled to 1. */
function piece(src) {
  const g = new THREE.Group();
  const m = src.isMesh ? new THREE.Mesh(src.geometry, src.material) : src;
  if (src.isMesh) m.applyMatrix4(src.matrixWorld);
  g.add(m);
  const box = new THREE.Box3().setFromObject(g, true);
  const size = box.getSize(new THREE.Vector3());
  const c = box.getCenter(new THREE.Vector3());
  m.position.sub(new THREE.Vector3(c.x, box.min.y, c.z));
  g.scale.setScalar(1 / Math.max(size.x, size.y, size.z));
  return g;
}

/** A copy of a coral piece (shared geometry, its own materials so it can bleach independently). */
export function makeCoralPiece(pieces, r) {
  const src = pieces[Math.floor(r() * pieces.length)];
  const g = src.clone(true);
  const uniforms = { uTint: { value: new THREE.Color(1, 1, 1) }, uMix: { value: 0 } };
  g.traverse((o) => {
    if (!o.isMesh) return;
    o.material = o.material.clone();
    o.material.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, uniforms);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform vec3 uTint;\nuniform float uMix;')
        .replace('#include <map_fragment>', `#include <map_fragment>
          float lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
          diffuseColor.rgb = mix(diffuseColor.rgb, uTint * (0.55 + 0.6 * lum), uMix);`);
    };
    o.material.customProgramCacheKey = () => 'coral-bleach';
  });
  g.userData.bleach = uniforms;
  return g;
}

// Swimming / crawling motion for models without a usable animation, done in the vertex shader so it costs
// nothing on the CPU. Coordinates are the model's own (nose +z, back +y), set up by the optimiser.
// uMin / uMax: the model's bounding box; uPhase: the stroke phase (radians), advanced every frame.
const MOTION = {
  // carangiform swimming: a sideways wave that travels to the tail and grows towards it
  fish: `
    float len = uMax.z - uMin.z;
    float u = clamp((uMax.z - p.z) / len, 0.0, 1.0); // 0 at the nose, 1 at the tail tip
    p.x += sin(uPhase - u * 4.5) * len * (0.012 + 0.09 * u * u);`,

  // sea turtle: front flippers sweep up and down like wings (and a little back), rear flippers paddle
  flippers: `
    vec3 c = (uMin + uMax) * 0.5;
    vec3 h = (uMax - uMin) * 0.5;
    float side = sign(p.x - c.x);
    float hinge = h.x * 0.40;
    float dx = abs(p.x - c.x) - hinge;
    float w = smoothstep(0.0, h.x * 0.12, dx);
    float front = smoothstep(c.z - h.z * 0.1, c.z + h.z * 0.1, p.z);
    float ang = w * mix(0.32 * sin(uPhase + 1.9), 0.80 * sin(uPhase), front);
    float dy = p.y - c.y;
    float nx = dx * cos(ang) - dy * sin(ang);
    float ny = dx * sin(ang) + dy * cos(ang);
    p.x = c.x + side * (hinge + mix(dx, nx, w));
    p.y = c.y + mix(dy, ny, w);
    p.z -= w * front * max(dx, 0.0) * 0.30 * cos(uPhase);`,

  // octopus: arms curl from side to side in travelling waves and lift off the rock; the mantle breathes
  arms: `
    vec3 c = (uMin + uMax) * 0.5;
    vec3 h = (uMax - uMin) * 0.5;
    float R = max(h.x, h.z);
    vec2 d = p.xz - c.xz;
    float r = length(d) / R;
    float a = atan(d.x, d.y);
    float w = smoothstep(0.15, 0.45, r);
    float curl = w * r * 0.55 * sin(uPhase - r * 6.0 + a * 3.0);
    d = mat2(cos(curl), -sin(curl), sin(curl), cos(curl)) * d;
    p.xz = c.xz + d;
    p.y += w * R * 0.10 * (0.6 + 0.4 * sin(uPhase * 1.3 - r * 8.0 + a * 2.0)) * r;
    float body = 1.0 - smoothstep(0.1, 0.35, r);
    p.xz = c.xz + (p.xz - c.xz) * (1.0 + body * 0.07 * sin(uPhase * 0.8));`,

  // crab walking sideways: the legs on each side lift and swing in a wave, the two sides out of step
  legs: `
    vec3 c = (uMin + uMax) * 0.5;
    vec3 h = (uMax - uMin) * 0.5;
    float side = sign(p.z - c.z);
    float hinge = h.z * 0.36;
    float dz = abs(p.z - c.z) - hinge;
    float claws = smoothstep(-0.75, -0.5, (p.x - c.x) / h.x); // the claws (front, -x) don't walk
    float w = smoothstep(0.0, h.z * 0.1, dz) * claws;
    float lp = uPhase + (p.x - c.x) / h.x * 3.5 + (side > 0.0 ? 0.0 : 3.14159);
    float ang = w * 0.45 * max(0.0, sin(lp));
    float hy = uMin.y + (uMax.y - uMin.y) * 0.55;
    float dy = p.y - hy;
    float nz = dz * cos(ang) - dy * sin(ang);
    float ny = dz * sin(ang) + dy * cos(ang);
    p.z = c.z + side * (hinge + mix(dz, nz, w));
    p.y = hy + mix(dy, ny, w);
    p.x += w * max(dz, 0.0) * 0.35 * cos(lp);
    float pinch = (1.0 - claws) * 0.06 * sin(uPhase * 0.5); // claws open and close slowly
    p.z = c.z + (p.z - c.z) * (1.0 - pinch);`,

  // jellyfish: the bell squeezes in (and its rim curls down) then relaxes; tentacles and oral arms trail and sway
  pulse: `
    vec3 c = (uMin + uMax) * 0.5;
    vec3 h = (uMax - uMin) * 0.5;
    float H = uMax.y - uMin.y;
    float depth = (uMax.y - p.y) / H; // 0 at the top of the bell, 1 at the tentacle tips
    float s = sin(uPhase);
    float squeeze = max(0.0, s) * 0.9 + min(0.0, s) * 0.35; // quick power stroke, slower recovery
    float bell = 1.0 - smoothstep(0.22, 0.4, depth);
    float rim = smoothstep(0.0, 0.25, depth);
    p.xz = c.xz + (p.xz - c.xz) * (1.0 - 0.16 * squeeze * bell * (0.3 + rim));
    p.y -= bell * rim * squeeze * H * 0.05;
    p.y += bell * (1.0 - rim) * squeeze * H * 0.03;
    float tail = smoothstep(0.3, 0.9, depth);
    float lag = uPhase - 1.2 - depth * 3.0;
    p.xz = c.xz + (p.xz - c.xz) * (1.0 - tail * 0.12 * sin(lag));
    p.x += tail * h.x * 0.15 * sin(uPhase * 0.35 - depth * 4.0);
    p.z += tail * h.z * 0.15 * cos(uPhase * 0.3 - depth * 3.0 + 1.0);`,

  // manta ray: the wings beat up and down, with a wave running from the front of each wing to the back
  wings: `
    vec3 c = (uMin + uMax) * 0.5;
    vec3 h = (uMax - uMin) * 0.5;
    float span = abs(p.x - c.x) / h.x;            // 0 at the body, 1 at the wingtips
    float along = (uMax.z - p.z) / (uMax.z - uMin.z); // 0 at the front, 1 at the tail
    float w = smoothstep(0.15, 1.0, span);
    p.y += w * w * h.x * 0.38 * sin(uPhase - along * 2.2);
    p.x -= sign(p.x - c.x) * w * w * h.x * 0.06 * (1.0 - cos(uPhase - along * 2.2)); // tips draw in as they rise
    float tail = smoothstep(0.55, 1.0, along) * (1.0 - smoothstep(0.0, 0.2, span));
    p.x += tail * h.x * 0.05 * sin(uPhase * 0.7 - along * 6.0);`,

  // anemone: tentacles sway in the current — the higher up, the more they move; the base stays put
  sway: `
    vec3 c = (uMin + uMax) * 0.5;
    vec3 h = (uMax - uMin) * 0.5;
    float up = clamp((p.y - uMin.y) / (uMax.y - uMin.y), 0.0, 1.0);
    float bend = smoothstep(0.25, 1.0, up);
    bend *= bend;
    float R = max(h.x, h.z);
    p.x += bend * R * 0.16 * sin(uPhase + p.z / R * 2.5);
    p.z += bend * R * 0.12 * cos(uPhase * 0.8 + p.x / R * 2.0 + 1.3);`,

  // sea cucumber: waves of contraction run from tail to head, with a slow side-to-side sway
  crawl: `
    vec3 c = (uMin + uMax) * 0.5;
    vec3 h = (uMax - uMin) * 0.5;
    float u = (p.z - c.z) / h.z;
    float k = u * 6.28318 - uPhase;
    p.z += h.z * 0.07 * sin(k);
    float bulge = 1.0 + 0.12 * cos(k);
    p.x = c.x + (p.x - c.x) * bulge;
    p.y = uMin.y + (p.y - uMin.y) * bulge;
    p.x += h.z * 0.06 * sin(uPhase * 0.4 + u * 1.5);`,
};

/** A model for a species: a .glb from the manifest if there is one, otherwise the built-in shape. */
export function makeBody(id, overrides, length) {
  const o = overrides?.[id];
  if (!o || !o.scene) return BUILDERS[id]();
  const g = new THREE.Group();
  const m = cloneSkinned(o.scene);
  const size = o.box.getSize(new THREE.Vector3());
  const c = o.box.getCenter(new THREE.Vector3());
  const s = length / Math.max(size.x, size.y, size.z);
  m.scale.setScalar(s);
  m.position.set(-c.x * s, -(o.floor ? o.box.min.y : c.y) * s, -c.z * s);
  g.add(m);

  // its own animation (e.g. the jellyfish's pulse), played at a random point so a group doesn't move in step
  let mixer = null;
  const clip = o.animation && animationClip(o);
  if (clip) {
    mixer = new THREE.AnimationMixer(m);
    const action = mixer.clipAction(clip).play();
    action.time = Math.random() * clip.duration;
    m.traverse((x) => { if (x.isSkinnedMesh) x.frustumCulled = false; }); // its bounds move with the bones
  }
  // otherwise a shader motion (fish tail beat, flippers, arms, legs, crawl)
  const phase = { value: Math.random() * 10 };
  const code = !clip && MOTION[o.motion];
  if (code) {
    m.updateMatrixWorld(true);
    const toModel = m.matrixWorld.clone().invert();
    m.traverse((x) => {
      if (!x.isMesh) return;
      // the model's box in this mesh's own coordinates (compressed meshes store quantised positions
      // and undo it with a node scale/offset, so mesh space is not model space)
      const meshToModel = toModel.clone().multiply(x.matrixWorld);
      const local = o.box.clone().applyMatrix4(meshToModel.invert());
      const uMin = { value: local.min };
      const uMax = { value: local.max };
      x.material = x.material.clone();
      x.material.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, { uPhase: phase, uMin, uMax });
        sh.vertexShader = sh.vertexShader
          .replace('#include <common>', '#include <common>\nuniform float uPhase;\nuniform vec3 uMin;\nuniform vec3 uMax;')
          .replace('#include <begin_vertex>', `#include <begin_vertex>\n{ vec3 p = transformed;${code}\n  transformed = p; }`);
      };
      x.material.customProgramCacheKey = () => `motion-${o.motion}`;
    });
  }
  // strokes per second (radians): set per model with "beat", e.g. slow for the shark, fast for small fish
  const beat = o.beat ?? { fish: 9, flippers: 2.4, arms: 2.0, legs: 7, crawl: 1.6, pulse: 4, sway: 1.4, wings: 2.2 }[o.motion] ?? 2;
  let last = null;
  g.userData.animate = (t, speed = 1) => {
    const dt = last === null ? 0 : Math.min(0.1, Math.max(0, t - last));
    last = t;
    if (mixer) mixer.update(dt * (o.animSpeed ?? 1));
    phase.value += dt * beat * (0.55 + Math.min(speed, 2) * 0.45);
    if (o.motion === 'fish') m.rotation.y = Math.sin(phase.value) * 0.04; // the head sways a little too
    if (o.motion === 'flippers') m.position.y = -c.y * s + Math.sin(phase.value - 0.6) * length * 0.025; // each stroke lifts the body
    if (o.motion === 'legs') m.position.y = -o.box.min.y * s + Math.abs(Math.sin(phase.value)) * length * 0.015;
    if (!clip && !code) m.rotation.y = Math.sin(t * 0.3) * 0.05;
  };
  return g;
}

/** The model's clip, minus any tracks that move the whole body ("lockRoot"): the lesson steers the animal itself. */
function animationClip(o) {
  if (o._clip !== undefined) return o._clip;
  let clip = o.clips.find((a) => a.name.includes(o.animation)) ?? o.clips[0] ?? null;
  if (clip && o.lockRoot) {
    clip = clip.clone();
    clip.tracks = clip.tracks.filter((tr) => !o.lockRoot.some((n) => tr.name === `${n}.position` || tr.name === `${n}.quaternion`));
  }
  o._clip = clip;
  return clip;
}

let skeletonClone = null; // set once loadModelOverrides has loaded SkeletonUtils
/** Clone that also works for rigged (skinned) models, which need their own copy of the skeleton. */
function cloneSkinned(scene) {
  let skinned = false;
  scene.traverse((x) => { if (x.isSkinnedMesh) skinned = true; });
  if (skinned && skeletonClone) return skeletonClone(scene);
  return scene.clone(true);
}
