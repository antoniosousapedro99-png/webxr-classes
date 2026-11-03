import * as THREE from 'three';
import { ORGANELLES, CELLS, PROCESSES } from '../data/cells.js';
import * as O from './organelles.js';

// One cell (animal, plant or bacterium), cut open so you can see inside.
//  • every organelle is registered by id, so it can be named, tapped, pulled out or "knocked out"
//  • knocking an organelle out switches off the jobs (processes) that depend on it, and you see it:
//    transport stops, the cell greys, a plant cell shrinks from its wall, the flagellum stops…

const GHOST = new THREE.MeshBasicMaterial({ color: 0x9aa3b8, wireframe: true, transparent: true, opacity: 0.18, depthWrite: false });

export class Cell {
  constructor(type, { scale = 1, seed = 7 } = {}) {
    this.type = type;
    this.def = CELLS[type];
    this.group = new THREE.Group();
    this.group.scale.setScalar(scale);
    this.inner = new THREE.Group(); // everything inside the wall (shrinks in plasmolysis)
    this.group.add(this.inner);
    this.clip = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);
    this.cut = true;
    this.parts = new Map(); // organelle id → [objects]
    this.knocked = new Set();
    this.rand = O.rng(seed + type.length * 31);
    this.time = 0;
    this.traffic = [];
    this.membraneMats = [];
    ({ animal: () => this.buildAnimal(), plant: () => this.buildPlant(), bacterium: () => this.buildBacterium() })[type]();
    this.makeClipAwarePicking();
  }

  // ───────────── registering parts ─────────────

  add(id, obj, parent = this.inner) {
    parent.add(obj);
    if (!this.parts.has(id)) this.parts.set(id, []);
    this.parts.get(id).push(obj);
    const tapOnly = !!ORGANELLES[id].structural || ['ribosomes', 'vacuole', 'pili'].includes(id);
    obj.traverse((o) => {
      if (o.isMesh) Object.assign(o.userData, { organelle: id, root: obj, cell: this, tapOnly });
    });
    return obj;
  }

  /** Rays shouldn't hit the part of a shell that has been cut away. */
  makeClipAwarePicking() {
    const clip = this.clip;
    this.group.traverse((o) => {
      if (!o.isMesh || !o.material.clippingPlanes) return;
      o.raycast = function (raycaster, hits) {
        const mine = [];
        THREE.Mesh.prototype.raycast.call(this, raycaster, mine);
        for (const h of mine) if (clip.distanceToPoint(h.point) >= -1e-4) hits.push(h);
      };
    });
  }

  get targets() {
    const t = [];
    this.group.traverse((o) => {
      if (o.isMesh && o.userData.organelle && o.visible && !this.knocked.has(o.userData.organelle)) t.push(o);
    });
    return t;
  }

  /** Where an organelle is (in the coordinates of `space`), for labels and flows. */
  anchor(id, space) {
    const list = this.parts.get(id);
    if (!list) return null;
    this.group.updateWorldMatrix(true, true); // may be called right after the cell was created
    const box = new THREE.Box3().setFromObject(list[0]);
    const p = box.getCenter(new THREE.Vector3());
    if (ORGANELLES[id].structural || id === 'cellWall') {
      // Big shells: point at their upper-right edge rather than their (empty) middle.
      const size = box.getSize(new THREE.Vector3());
      p.add(new THREE.Vector3(size.x * 0.4, size.y * 0.3, -size.z * 0.15));
    }
    return space ? space.worldToLocal(p) : p;
  }

  // ───────────── the three cells ─────────────

  buildAnimal() {
    const r = this.rand;
    const R = 0.25;
    const clip = this.clip;
    const mem = O.shellMat(0xf2a7b5, 0.4, clip);
    this.membraneMats.push(mem);
    const membrane = new THREE.Group();
    membrane.add(new THREE.Mesh(new THREE.SphereGeometry(R, 64, 48), mem));
    membrane.add(new THREE.Mesh(new THREE.SphereGeometry(R * 0.985, 64, 48), O.shellMat(0xe57f98, 0.25, clip)));
    this.add('membrane', membrane);
    this.add('cytoplasm', new THREE.Mesh(new THREE.SphereGeometry(R * 0.975, 48, 32), O.shellMat(0xffe7ee, 0.08, clip)));

    const N = new THREE.Vector3(-0.03, 0.02, -0.06);
    const nr = 0.075;
    const nuc = this.add('nucleus', O.nucleus(nr, clip, r));
    nuc.position.copy(N);
    const rer = this.add('roughER', O.roughER(nr, r, 0.003));
    rer.position.copy(N);
    rer.rotation.z = -0.9;
    const ser = this.add('smoothER', O.smoothER(nr, r));
    ser.position.copy(N);
    const G = new THREE.Vector3(0.12, -0.1, -0.03);
    const gol = this.add('golgi', O.golgi(0.045, r));
    gol.position.copy(G);
    gol.rotation.z = 0.6;
    const cen = this.add('centrioles', O.centrioles(0.02));
    cen.position.set(0.075, 0.13, -0.08);

    const free = (min, avoid) => {
      for (;;) {
        const p = O.randomInSphere(r, R * 0.82);
        if (p.z > 0.1) continue;
        if (p.distanceTo(N) < nr + min) continue;
        if (p.distanceTo(G) < 0.07) continue;
        if (avoid && avoid.some((q) => q.distanceTo(p) < min)) continue;
        return p;
      }
    };
    const placed = [];
    for (let i = 0; i < 9; i++) {
      const m = this.add('mitochondria', O.mitochondrion(0.011, 0.035));
      m.position.copy(free(0.06, placed));
      placed.push(m.position);
      O.orientRandom(m, r);
    }
    for (let i = 0; i < 5; i++) {
      const l = this.add('lysosomes', O.lysosome(0.012, r));
      l.position.copy(free(0.05, placed));
      placed.push(l.position);
    }
    for (let i = 0; i < 8; i++) {
      const v = this.add('vesicles', O.vesicle(0.007));
      v.position.copy(G.clone().add(O.randomInSphere(r, 0.06)).add(new THREE.Vector3(0.03, -0.02, 0)));
    }
    const dots = [];
    while (dots.length < 220) {
      const p = O.randomInSphere(r, R * 0.9);
      if (p.distanceTo(N) > nr + 0.01) dots.push(p);
    }
    this.add('ribosomes', O.ribosomeCloud(dots, 0.003));
    this.makeTraffic(N.clone().add(new THREE.Vector3(0.09, -0.05, 0)), G, new THREE.Vector3(0.2, -0.13, 0.02), 0.006);
  }

  buildPlant() {
    const r = this.rand;
    const clip = this.clip;
    const [W, H, D] = [0.5, 0.3, 0.3];
    const wall = new THREE.Group();
    wall.add(new THREE.Mesh(new THREE.BoxGeometry(W, H, D), O.shellMat(0x7fb069, 0.55, clip)));
    wall.add(new THREE.Mesh(new THREE.BoxGeometry(W - 0.016, H - 0.016, D - 0.016), O.shellMat(0x5d8f4a, 0.3, clip)));
    this.add('cellWall', wall, this.group);
    const mem = O.shellMat(0xb5e48c, 0.32, clip);
    this.membraneMats.push(mem);
    this.add('membrane', new THREE.Mesh(new THREE.BoxGeometry(W - 0.03, H - 0.03, D - 0.03), mem));
    this.add('cytoplasm', new THREE.Mesh(new THREE.BoxGeometry(W - 0.036, H - 0.036, D - 0.036), O.shellMat(0xeaf7d8, 0.07, clip)));
    const vac = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), O.shellMat(0x9fd8ff, 0.35, clip));
    vac.scale.set(0.19, 0.098, 0.1);
    vac.position.set(0.02, -0.005, -0.01);
    this.add('vacuole', vac);

    const N = new THREE.Vector3(-0.19, 0.07, -0.07);
    const nr = 0.038;
    this.add('nucleus', O.nucleus(nr, clip, r)).position.copy(N);
    const rer = this.add('roughER', O.roughER(nr, r, 0.0022));
    rer.position.copy(N);
    rer.rotation.z = -1.6;
    const G = new THREE.Vector3(-0.17, -0.09, -0.06);
    const gol = this.add('golgi', O.golgi(0.024, r));
    gol.position.copy(G);

    const outsideVacuole = (p) => ((p.x - 0.02) / 0.205) ** 2 + (p.y / 0.11) ** 2 + (p.z / 0.112) ** 2 > 1;
    const periphery = (min, avoid) => {
      for (;;) {
        const p = new THREE.Vector3((r() - 0.5) * 0.44, (r() - 0.5) * 0.24, (r() - 0.5) * 0.24);
        if (p.z > 0.06 || !outsideVacuole(p)) continue;
        if (p.distanceTo(N) < nr + 0.03 || p.distanceTo(G) < 0.04) continue;
        if (avoid.some((q) => q.distanceTo(p) < min)) continue;
        return p;
      }
    };
    const placed = [];
    for (let i = 0; i < 16; i++) {
      const c = this.add('chloroplasts', O.chloroplast(0.06, r));
      c.position.copy(periphery(0.05, placed));
      placed.push(c.position);
      c.rotation.set(r() * 0.6, r() * Math.PI, r() * 0.6);
    }
    for (let i = 0; i < 5; i++) {
      const m = this.add('mitochondria', O.mitochondrion(0.006, 0.018));
      m.position.copy(periphery(0.035, placed));
      placed.push(m.position);
      O.orientRandom(m, r);
    }
    for (let i = 0; i < 5; i++) {
      const v = this.add('vesicles', O.vesicle(0.005));
      v.position.copy(G.clone().add(O.randomInSphere(r, 0.03)));
    }
    const dots = [];
    while (dots.length < 120) {
      const p = new THREE.Vector3((r() - 0.5) * 0.45, (r() - 0.5) * 0.26, (r() - 0.5) * 0.26);
      if (outsideVacuole(p) && p.distanceTo(N) > nr + 0.005) dots.push(p);
    }
    this.add('ribosomes', O.ribosomeCloud(dots, 0.0022));
    this.makeTraffic(N.clone().add(new THREE.Vector3(0.03, -0.06, 0)), G, new THREE.Vector3(-0.23, -0.13, -0.02), 0.004);
  }

  buildBacterium() {
    const r = this.rand;
    const clip = this.clip;
    const L = 0.24;
    const capsule = (rad, color, op) => {
      const m = new THREE.Mesh(new THREE.CapsuleGeometry(rad, L, 12, 32), O.shellMat(color, op, clip));
      m.rotation.z = Math.PI / 2;
      return m;
    };
    this.add('capsule', capsule(0.095, 0xd8f0c0, 0.15), this.group);
    this.add('cellWall', capsule(0.087, 0x8fbc6a, 0.45), this.group);
    const mem = capsule(0.08, 0xe8b07a, 0.35);
    this.membraneMats.push(mem.material);
    this.add('membrane', mem);
    this.add('cytoplasm', capsule(0.077, 0xfff0dd, 0.08));
    const dna = this.add('nucleoid', O.dnaLoop(0.12, 0.05, r));
    dna.position.z = -0.015;
    for (let i = 0; i < 3; i++) {
      const p = this.add('plasmids', O.plasmid(0.014));
      p.position.set(-0.13 + i * 0.12, (r() - 0.5) * 0.06, -0.035 + r() * 0.02);
      O.orientRandom(p, r);
    }
    const dots = [];
    while (dots.length < 140) {
      const p = new THREE.Vector3((r() - 0.5) * 0.36, (r() - 0.5) * 0.13, (r() - 0.5) * 0.13);
      if (Math.hypot(p.y, p.z) < 0.068) dots.push(p);
    }
    this.add('ribosomes', O.ribosomeCloud(dots, 0.004));
    const fl = this.add('flagellum', O.flagellum(0.28, 0.003), this.group);
    fl.position.x = 0.2;
    const pili = new THREE.Group();
    const pm = O.mat(0xc8e6a0);
    for (let i = 0; i < 16; i++) {
      const x = (r() - 0.5) * 0.3;
      const a = r() * Math.PI * 2;
      const dir = new THREE.Vector3(0, Math.cos(a), Math.sin(a));
      const hair = new THREE.Mesh(new THREE.CylinderGeometry(0.0013, 0.0013, 0.04, 5), pm);
      hair.position.set(x, 0, 0).addScaledVector(dir, 0.105);
      hair.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      pili.add(hair);
    }
    this.add('pili', pili, this.group);
  }

  /** Vesicles carrying proteins: rough ER → Golgi → membrane (stops if delivery stops). */
  makeTraffic(from, golgiPos, membranePoint, rad) {
    this.trafficCurve = new THREE.CatmullRomCurve3([from, golgiPos, membranePoint]);
    const m = O.mat(0xffd97a, { emissive: 0x6a5000 });
    for (let i = 0; i < 6; i++) {
      const v = new THREE.Mesh(new THREE.SphereGeometry(rad, 10, 8), m);
      v.userData.t = i / 6;
      this.inner.add(v);
      this.traffic.push(v);
    }
  }

  // ───────────── what the cell can do ─────────────

  status(proc, memo = {}) {
    if (proc in memo) return memo[proc];
    const needs = this.def.needs[proc];
    if (!needs) return 1;
    let v = 1;
    for (const n of needs) v = Math.min(v, PROCESSES[n] && this.def.needs[n] ? this.status(n, memo) : this.knocked.has(n) ? 0 : 1);
    if (this.type === 'plant' && proc === 'energy' && this.status('food', memo) === 0) v = Math.min(v, 0.5); // stored starch, for a while
    memo[proc] = v;
    return v;
  }

  get processes() {
    return Object.keys(this.def.needs).map((p) => ({ id: p, ...PROCESSES[p], value: this.status(p) }));
  }

  knock(id) {
    this.knocked.add(id);
    for (const obj of this.parts.get(id) ?? []) {
      obj.traverse((o) => {
        if (o.isMesh) {
          o.userData.mat ??= o.material;
          o.material = GHOST;
        }
      });
    }
  }

  revive(id) {
    this.knocked.delete(id);
    for (const obj of this.parts.get(id) ?? []) {
      obj.traverse((o) => {
        if (o.isMesh && o.userData.mat) o.material = o.userData.mat;
      });
    }
  }

  // ───────────── every frame ─────────────

  update(dt) {
    this.time += dt;
    // Cutting plane, in world space: keep the half of the cell away from you.
    const q = this.group.getWorldQuaternion(new THREE.Quaternion());
    const n = new THREE.Vector3(0, 0, -1).applyQuaternion(q);
    const c = this.group.getWorldPosition(new THREE.Vector3());
    this.clip.setFromNormalAndCoplanarPoint(n, this.cut ? c : c.addScaledVector(n, -10));

    const energy = this.status('energy');
    const delivery = this.def.needs.delivery ? this.status('delivery') * energy : 0;
    for (const v of this.traffic) {
      v.visible = delivery > 0;
      v.userData.t = (v.userData.t + dt * 0.12 * delivery) % 1;
      v.position.copy(this.trafficCurve.getPoint(v.userData.t));
    }
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 3);
    for (const id of ['mitochondria', 'chloroplasts']) {
      const on = id === 'mitochondria' ? energy : this.status('food');
      for (const obj of this.parts.get(id) ?? []) {
        obj.traverse((o) => {
          if (o.isMesh && o.material.emissive) o.material.emissive.setHex(id === 'mitochondria' ? 0x502000 : 0x0f3f10).multiplyScalar(on * pulse);
        });
      }
    }
    // A cell with no energy goes grey.
    for (const m of this.membraneMats) m.emissive.setHex(0x000000);
    const tint = energy === 0 ? 0.6 : 0;
    for (const m of this.membraneMats) m.color.lerp(new THREE.Color(0x8a8f99), tint * dt * 2);
    if (energy > 0) for (const m of this.membraneMats) m.color.lerp(new THREE.Color(m.userData.base ?? (m.userData.base = m.color.getHex())), dt * 2);

    // Plant: no vacuole → plasmolysis (contents shrink from the wall); no wall → the cell swells.
    let target = 1;
    if (this.knocked.has('vacuole')) target = 0.8;
    if (this.knocked.has('cellWall') && this.type !== 'animal') target = 1.07 + 0.02 * Math.sin(this.time * 6);
    const s = THREE.MathUtils.lerp(this.inner.scale.x, target, Math.min(1, dt * 2));
    this.inner.scale.setScalar(s);

    for (const f of this.parts.get('flagellum') ?? []) if (this.status('movement') > 0) f.rotation.x += dt * 12;
  }
}
