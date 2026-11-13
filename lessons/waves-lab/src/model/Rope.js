import * as THREE from 'three';
import { ROPE, lightHue } from '../data/waves.js';

// A rope shaken at its left end. The wave really travels: every point on the rope does what the end did a
// moment earlier (x / speed seconds ago), so a change of frequency or amplitude can be watched moving along.
// The far end absorbs the wave (no reflections). The same rope can be dressed as a sound wave, a light wave
// or the surface of the sea.

const STEP = 1 / 120; // s between remembered positions of the shaken end
const MEMORY = 1024; // 8.5 s, more than the slowest wave needs to cross the rope
const RAD = 6; // sides of the rope's cross-section

function tubeGeometry(n) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * RAD * 3), 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(n * RAD * 3), 3));
  const idx = [];
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < RAD; j++) {
      const a = i * RAD + j;
      const b = i * RAD + ((j + 1) % RAD);
      idx.push(a, a + RAD, b, b, a + RAD, b + RAD);
    }
  }
  geo.setIndex(idx);
  return geo;
}

/** Bend a tube along the heights `ys` (evenly spaced along `length`). */
function writeTube(geo, ys, length, r) {
  const pos = geo.attributes.position.array;
  const nor = geo.attributes.normal.array;
  const n = ys.length;
  const dx = length / (n - 1);
  let k = 0;
  for (let i = 0; i < n; i++) {
    const slope = (ys[Math.min(n - 1, i + 1)] - ys[Math.max(0, i - 1)]) / (dx * (i === 0 || i === n - 1 ? 1 : 2));
    const len = Math.hypot(1, slope);
    const nx = -slope / len;
    const ny = 1 / len;
    for (let j = 0; j < RAD; j++) {
      const th = (j / RAD) * Math.PI * 2;
      const c = Math.cos(th);
      const s = Math.sin(th);
      nor[k] = c * nx;
      nor[k + 1] = c * ny;
      nor[k + 2] = s;
      pos[k] = i * dx + r * c * nx;
      pos[k + 1] = ys[i] + r * c * ny;
      pos[k + 2] = r * s;
      k += 3;
    }
  }
  geo.attributes.position.needsUpdate = true;
  geo.attributes.normal.needsUpdate = true;
}

/** A still copy of a wave (a snapshot), for comparing settings. */
export function makeGhost({ f, a, v }, color, length = ROPE.length) {
  const n = 160;
  const ys = new Float32Array(n);
  const lambda = v / f;
  for (let i = 0; i < n; i++) ys[i] = a * Math.sin((2 * Math.PI * (i / (n - 1)) * length) / lambda);
  const geo = tubeGeometry(n);
  writeTube(geo, ys, length, 0.004);
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.6, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
  mesh.frustumCulled = false;
  return mesh;
}

export class Rope {
  constructor({ length = ROPE.length, points = 190, radius = 0.006, stand = true } = {}) {
    this.L = length;
    this.n = points;
    this.r = radius;
    this.group = new THREE.Group();
    this.p = { f: 1, a: 0.03, v: 0.3 };
    this.amp = 0.03; // eases towards p.a
    this.phase = 0;
    this.hist = new Float32Array(MEMORY);
    this.head = 0;
    this.acc = 0;
    this.ys = new Float32Array(points);
    this.fresh = true;

    this.tube = new THREE.Mesh(tubeGeometry(points), new THREE.MeshStandardMaterial({ color: 0xffd166, roughness: 0.45, side: THREE.DoubleSide }));
    this.tube.frustumCulled = false;
    this.group.add(this.tube);

    // beads: watch one and see that it only goes up and down
    this.beads = [];
    const beadGeo = new THREE.SphereGeometry(radius * 1.9, 14, 10);
    const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
    const red = new THREE.MeshStandardMaterial({ color: 0xff5566, roughness: 0.4, emissive: 0x661118 });
    const every = Math.round(points / 12);
    for (let i = every; i < points - 4; i += every) {
      const special = this.beads.length === 5;
      const m = new THREE.Mesh(beadGeo, special ? red : white);
      if (special) m.scale.setScalar(1.35);
      m.position.x = (i / (points - 1)) * length;
      m.userData.i = i;
      this.group.add(m);
      this.beads.push(m);
    }

    // the rest line
    const rest = new THREE.Mesh(new THREE.BoxGeometry(length, 0.0015, 0.0015), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.28 }));
    rest.position.x = length / 2;
    this.group.add(rest);

    // the shaker at the left end, and the post the far end is tied to
    const metal = new THREE.MeshStandardMaterial({ color: 0x8793c4, roughness: 0.5, metalness: 0.3 });
    this.shaker = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.028, 0.028), new THREE.MeshStandardMaterial({ color: 0x5b6cff, roughness: 0.4 }));
    this.shaker.position.x = -0.014;
    this.group.add(this.shaker);
    if (stand) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.2, 0.008), metal);
      rail.position.set(-0.014, 0, -0.02);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.2, 10), metal);
      post.position.set(length + 0.004, 0, 0);
      this.group.add(rail, post);
    }

    // the sea (ocean link): the same wave as a strip of water with a boat on it
    const half = 0.05;
    const depth = -0.11;
    const top = new THREE.BufferGeometry();
    top.setAttribute('position', new THREE.BufferAttribute(new Float32Array(points * 2 * 3), 3));
    const front = new THREE.BufferGeometry();
    front.setAttribute('position', new THREE.BufferAttribute(new Float32Array(points * 2 * 3), 3));
    const idx = [];
    for (let i = 0; i < points - 1; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    top.setIndex(idx);
    front.setIndex(idx);
    this.sea = new THREE.Group();
    this.seaTop = new THREE.Mesh(top, new THREE.MeshBasicMaterial({ color: 0x3aa0e8, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
    this.seaFront = new THREE.Mesh(front, new THREE.MeshBasicMaterial({ color: 0x14508f, transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
    this.seaTop.frustumCulled = false;
    this.seaFront.frustumCulled = false;
    this.seaHalf = half;
    this.seaDepth = depth;
    this.boat = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.014, 0.024), new THREE.MeshStandardMaterial({ color: 0xa5632c, roughness: 0.7 }));
    hull.position.y = 0.005;
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.0015, 0.0015, 0.055, 6), new THREE.MeshStandardMaterial({ color: 0xdddddd }));
    mast.position.y = 0.038;
    const sail = new THREE.Mesh(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0.002, 0.016, 0), new THREE.Vector3(0.002, 0.064, 0), new THREE.Vector3(0.032, 0.016, 0)]), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
    this.boat.add(hull, mast, sail);
    this.boatI = Math.round(points * 0.58);
    this.boat.position.x = (this.boatI / (points - 1)) * length;
    this.sea.add(this.seaTop, this.seaFront, this.boat);
    this.sea.visible = false;
    this.group.add(this.sea);

    this.lookKey = '';
    this.settle();
  }

  /** f (Hz), a (m), v (m/s). */
  set(p) {
    if (p.f !== this.p.f || p.a !== this.p.a || p.v !== this.p.v) this.fresh = true;
    this.p = { ...p };
  }

  /** Dress the rope: 'rope', 'sound', 'light' or 'ocean' (levels 0–10 give light its colour and brightness). */
  look(link, fl, al) {
    const key = `${link}|${fl}|${al}`;
    if (key === this.lookKey) return;
    this.lookKey = key;
    this.drawn = false; // redraw even while frozen
    const ocean = link === 'ocean';
    this.sea.visible = ocean;
    this.tube.visible = !ocean;
    for (const b of this.beads) b.visible = link === 'rope' || link === 'sound';
    const m = this.tube.material;
    if (link === 'light') {
      m.color.set(0x111111);
      m.emissive.setHSL(lightHue(fl), 1, 0.12 + 0.43 * (al / 10));
    } else {
      m.color.set(link === 'sound' ? 0x6fe3ff : 0xffd166);
      m.emissive.set(0x000000);
    }
  }

  step() {
    this.phase = (this.phase + 2 * Math.PI * this.p.f * STEP) % (2 * Math.PI);
    this.amp += (this.p.a - this.amp) * Math.min(1, STEP * 8);
    this.hist[this.head] = this.amp * Math.sin(this.phase);
    this.head = (this.head + 1) % MEMORY;
  }

  /** Fill the whole rope with the current wave at once (a frozen wave has no time to travel). */
  settle() {
    this.amp = this.p.a;
    for (let i = 0; i < MEMORY; i++) this.step();
  }

  /** Where the shaken end was `delay` seconds ago. */
  at(delay) {
    const back = Math.min(MEMORY - 2, (delay + STEP - this.acc) / STEP);
    const i = Math.floor(back);
    const k = back - i;
    const a = this.hist[(this.head - 1 - i + MEMORY * 2) % MEMORY];
    const b = this.hist[(this.head - 2 - i + MEMORY * 2) % MEMORY];
    return a + (b - a) * k;
  }

  /** Height of the rope at x (m from the shaken end). */
  yAt(x) {
    return this.at(x / this.p.v);
  }

  update(dt, frozen) {
    if (frozen) {
      if (this.fresh) this.settle();
    } else {
      this.acc += dt;
      while (this.acc >= STEP) {
        this.step();
        this.acc -= STEP;
      }
    }
    const wasFresh = this.fresh;
    this.fresh = false;
    if (frozen && !wasFresh && this.drawn) return;
    this.drawn = true;
    const { n, L, ys } = this;
    for (let i = 0; i < n; i++) ys[i] = this.yAt((i / (n - 1)) * L);
    this.shaker.position.y = ys[0];
    if (this.tube.visible) {
      writeTube(this.tube.geometry, ys, L, this.r);
      for (const b of this.beads) b.position.y = ys[b.userData.i];
    }
    if (this.sea.visible) {
      const t = this.seaTop.geometry.attributes.position.array;
      const f = this.seaFront.geometry.attributes.position.array;
      for (let i = 0; i < n; i++) {
        const x = (i / (n - 1)) * L;
        const k = i * 6;
        t[k] = x; t[k + 1] = ys[i]; t[k + 2] = -this.seaHalf;
        t[k + 3] = x; t[k + 4] = ys[i]; t[k + 5] = this.seaHalf;
        f[k] = x; f[k + 1] = ys[i]; f[k + 2] = this.seaHalf;
        f[k + 3] = x; f[k + 4] = this.seaDepth; f[k + 5] = this.seaHalf;
      }
      this.seaTop.geometry.attributes.position.needsUpdate = true;
      this.seaFront.geometry.attributes.position.needsUpdate = true;
      const i = this.boatI;
      this.boat.position.y = ys[i];
      this.boat.rotation.z = Math.atan((ys[i + 2] - ys[i - 2]) / ((4 * L) / (n - 1)));
    }
  }

  /** x positions (m) of the crests and troughs right now, for rulers to click onto. */
  peaks() {
    const out = [];
    const { ys, n, L } = this;
    for (let i = 1; i < n - 1; i++) {
      const up = ys[i] > ys[i - 1] && ys[i] >= ys[i + 1] && ys[i] > this.p.a * 0.5;
      const down = ys[i] < ys[i - 1] && ys[i] <= ys[i + 1] && ys[i] < -this.p.a * 0.5;
      if (!up && !down) continue;
      // the true turning point lies between samples: fit a parabola through the three
      const d = ys[i - 1] - 2 * ys[i] + ys[i + 1];
      const shift = d ? (0.5 * (ys[i - 1] - ys[i + 1])) / d : 0;
      out.push({ x: ((i + shift) / (n - 1)) * L, crest: up });
    }
    return out;
  }
}
