import * as THREE from 'three';
import { anemone, makeCoralPiece } from './bodies.js';
import { softPoints, pointAttributes } from './Water.js';

// The shared reef in the middle of the room: a coral bommie rising from the floor to about table height,
// a seagrass meadow beside it, and clouds of plankton in the water. It shows the ecosystem's state:
// coral bleaches white or dies and is overgrown by algae; seagrass and plankton thin out or bloom.

const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.75, ...o });

function rng(seed) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

const ROCK = { rx: 0.8, ry: 0.85, rz: 0.65 }; // ellipsoid radii (m); it sits on the floor

/** A point on the rock surface for direction (theta around, phi down from the top). */
export function rockPoint(theta, phi, out = new THREE.Vector3()) {
  return out.set(Math.sin(phi) * Math.cos(theta) * ROCK.rx, Math.cos(phi) * ROCK.ry, Math.sin(phi) * Math.sin(theta) * ROCK.rz);
}

export function insideRock(p) {
  return (p.x / (ROCK.rx + 0.08)) ** 2 + (p.y / (ROCK.ry + 0.08)) ** 2 + (p.z / (ROCK.rz + 0.08)) ** 2 < 1;
}

export function pushOutOfRock(p) {
  const k = (p.x / (ROCK.rx + 0.1)) ** 2 + (p.y / (ROCK.ry + 0.1)) ** 2 + (p.z / (ROCK.rz + 0.1)) ** 2;
  if (k < 1) p.multiplyScalar(1 / Math.sqrt(Math.max(k, 0.01)));
  return p;
}

// ── coral colonies ─────────────────────────────────────

function staghorn(r, color) {
  const g = new THREE.Group();
  const m = std({ color });
  const branch = (parent, len, rad, depth) => {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(rad * 0.6, rad, len, 6), m);
    b.position.y = len / 2;
    const tip = new THREE.Group();
    tip.position.y = len;
    parent.add(b, tip);
    if (depth > 0) {
      for (let i = 0; i < 2 + (r() < 0.4 ? 1 : 0); i++) {
        const j = new THREE.Group();
        j.rotation.set((r() - 0.5) * 1.2, r() * Math.PI * 2, (r() - 0.5) * 1.2);
        tip.add(j);
        branch(j, len * (0.65 + r() * 0.2), rad * 0.7, depth - 1);
      }
    }
  };
  branch(g, 0.08, 0.012, 3);
  g.userData.mats = [m];
  return g;
}

function brain(color) {
  const geo = new THREE.SphereGeometry(0.09, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  const pos = geo.attributes.position;
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const groove = Math.abs(Math.sin(x * 90 + Math.sin(z * 60) * 2)) < 0.25 ? 0.65 : 1; // meandering grooves
    col.set([groove, groove, groove], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = std({ color, vertexColors: true });
  const g = new THREE.Group();
  g.add(new THREE.Mesh(geo, m));
  g.userData.mats = [m];
  return g;
}

function table(color) {
  const m = std({ color });
  const g = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.07, 8), m);
  stem.position.y = 0.035;
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.12, 0.015, 24), m);
  top.position.y = 0.075;
  g.add(stem, top);
  g.userData.mats = [m];
  return g;
}

function fingers(r, color) {
  const m = std({ color });
  const g = new THREE.Group();
  for (let i = 0; i < 12; i++) {
    const h = 0.05 + r() * 0.07;
    const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.009, h, 4, 8), m);
    f.position.set((r() - 0.5) * 0.1, h / 2 + 0.01, (r() - 0.5) * 0.1);
    f.rotation.set((r() - 0.5) * 0.4, 0, (r() - 0.5) * 0.4);
    g.add(f);
  }
  g.userData.mats = [m];
  return g;
}

function seaFan(r, color) {
  const pts = [];
  const grow = (x, y, a, len, d) => {
    const x2 = x + Math.sin(a) * len;
    const y2 = y + Math.cos(a) * len;
    pts.push(new THREE.Vector3(x, y, 0), new THREE.Vector3(x2, y2, 0));
    if (d > 0) {
      grow(x2, y2, a - 0.35 - r() * 0.2, len * 0.8, d - 1);
      grow(x2, y2, a + 0.35 + r() * 0.2, len * 0.8, d - 1);
    }
  };
  grow(0, 0, 0, 0.05, 5);
  const m = new THREE.LineBasicMaterial({ color });
  const g = new THREE.Group();
  g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), m));
  g.userData.mats = [m];
  return g;
}

const CORAL_COLORS = [0xe07a5f, 0xf2cc8f, 0x9b5de5, 0xf15bb5, 0x00bbf9, 0xfee440, 0x8ac926, 0xff924c, 0xc77dff];

export class Reef {
  constructor(handler) {
    this.group = new THREE.Group();
    this.handler = handler;
    const r = rng(42);

    // the rock
    const rockGeo = new THREE.IcosahedronGeometry(1, 5);
    const p = rockGeo.attributes.position;
    const col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(p, i);
      const n = 1 + 0.08 * Math.sin(v.x * 9) * Math.cos(v.z * 8) + 0.05 * Math.sin(v.y * 13 + v.x * 5);
      v.multiplyScalar(n);
      p.setXYZ(i, v.x * ROCK.rx, Math.max(-0.05, v.y * ROCK.ry), v.z * ROCK.rz);
      // dark reef rock, mottled with patches of pink coralline algae and green turf
      const shade = 0.17 + 0.05 * Math.sin(v.x * 20 + v.z * 17) + 0.03 * Math.sin(v.y * 31 + v.x * 7);
      const pink = Math.max(0, Math.sin(v.x * 7 + v.y * 5) * Math.sin(v.z * 6 - v.y * 3)) * 0.5;
      const green = Math.max(0, Math.sin(v.x * 4 - v.z * 9 + 1.3)) * 0.3;
      col.set([shade * (1.05 + pink * 0.9), shade * (0.95 + green * 0.6), shade * (0.85 + pink * 0.5)], i * 3);
    }
    rockGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    rockGeo.computeVertexNormals();
    this.rock = new THREE.Mesh(rockGeo, std({ vertexColors: true, roughness: 0.95 }));
    this.tag(this.rock, 'coral'); // the reef itself is built by coral
    this.group.add(this.rock);

    // coral colonies over the rock
    this.colonies = [];
    for (let i = 0; i < 44; i++) {
      const theta = r() * Math.PI * 2;
      const phi = Math.pow(r(), 0.8) * 1.35;
      const pos = rockPoint(theta, phi);
      const color = CORAL_COLORS[Math.floor(r() * CORAL_COLORS.length)];
      const kind = r();
      const c = kind < 0.3 ? staghorn(r, color) : kind < 0.5 ? brain(color) : kind < 0.65 ? table(color) : kind < 0.85 ? fingers(r, color) : seaFan(r, color);
      c.position.copy(pos).multiplyScalar(0.97);
      c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(pos.x / ROCK.rx ** 2, pos.y / ROCK.ry ** 2, pos.z / ROCK.rz ** 2).normalize());
      if (kind >= 0.85) c.rotateY(r() * Math.PI);
      c.scale.setScalar(0.8 + r() * 0.7);
      c.userData.base = new THREE.Color(color);
      c.userData.rank = r(); // order in which colonies die / bleach
      this.tag(c, 'coral');
      this.group.add(c);
      this.colonies.push(c);
    }

    // turf algae: tufts that spread over dead coral and bare rock
    const maxAlgae = 500;
    this.algae = new THREE.InstancedMesh(new THREE.ConeGeometry(0.012, 0.035, 5), std({ color: 0x5f8f2f }), maxAlgae);
    const m = new THREE.Object3D();
    this.algaeSpots = [];
    for (let i = 0; i < maxAlgae; i++) {
      const pos = rockPoint(r() * Math.PI * 2, r() * 1.45);
      m.position.copy(pos);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), pos.clone().normalize());
      m.scale.setScalar(0.7 + r() * 0.8);
      m.updateMatrix();
      this.algaeSpots.push(m.matrix.clone());
    }
    this.tag(this.algae, 'algae');
    this.group.add(this.algae);

    // seagrass meadow on the floor beside the reef
    const blades = 260;
    this.grass = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.012, 0.35).translate(0, 0.175, 0), std({ color: 0x4d9a3c, side: THREE.DoubleSide }), blades);
    this.grassBase = [];
    for (let i = 0; i < blades; i++) {
      this.grassBase.push({ x: 1.05 + r() * 0.9, z: -0.5 + r() * 1.0, a: r() * Math.PI, s: 0.6 + r() * 0.7, ph: r() * 6 });
    }
    this.tag(this.grass, 'seagrass');
    this.group.add(this.grass);

    // anemone (home of the clownfish) on a ledge
    this.anemone = anemone();
    this.anemonePos = rockPoint(0.7, 0.9).multiplyScalar(0.98);
    this.anemone.position.copy(this.anemonePos);
    this.anemone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), this.anemonePos.clone().normalize());
    this.tag(this.anemone, 'anemone');
    this.group.add(this.anemone);

    // plankton clouds (shown hugely enlarged)
    this.phyto = this.cloud(900, 0x8dffb0, [0.004, 0.013], r, 'phyto');
    this.zoo = this.cloud(500, 0xfff1d6, [0.005, 0.017], r, 'zoo');
    this.time = 0;
    this.show({ pop: { coral: 0.6, algae: 0.15, seagrass: 1, phyto: 1, zoo: 1, anemone: 1 }, bleach: 0, removed: [] });
  }

  /** Swap the drawn coral colonies for 3D coral models (keeps each colony's place, size and fate). */
  useCoralModels(pieces) {
    if (!pieces?.length) return;
    const r = rng(7);
    for (const c of this.colonies) {
      for (const child of [...c.children]) c.remove(child);
      const model = makeCoralPiece(pieces, r);
      model.scale.multiplyScalar(0.12 + r() * 0.14); // pieces are 1 m across: make 12–26 cm colonies
      model.rotation.y = r() * Math.PI * 2;
      c.add(model);
      c.scale.setScalar(1);
      c.userData.bleach = model.userData.bleach;
      c.userData.mats = [];
      this.tag(c, 'coral');
    }
    if (this.lastState) this.show(this.lastState);
  }

  tag(obj, species) {
    obj.traverse((o) => {
      if (o.isMesh || o.isInstancedMesh) Object.assign(o.userData, { handler: this.handler, species, tapOnly: true });
    });
  }

  cloud(n, color, size, r, species) {
    const pos = new Float32Array(n * 3);
    const base = [];
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2;
      const rad = 0.6 + Math.pow(r(), 0.6) * 2.2;
      const y = 0.2 + r() * 2.0;
      base.push([Math.cos(a) * rad, y, Math.sin(a) * rad, r() * 10]);
      pos.set(base[i].slice(0, 3), i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    pointAttributes(geo, n, size[0], size[1]);
    // soft glowing specks (enlarged plankton) that twinkle as they turn in the light
    const pts = new THREE.Points(geo, softPoints({ color, opacity: 0.85, glow: true, twinkle: 0.55 }));
    pts.userData.base = base;
    this.group.add(pts);
    // invisible "handles" so a pinch/click on a cloud can identify it
    pts.userData.handles = [];
    for (let i = 0; i < 8; i++) {
      const h = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
      h.position.set(...base[i * 37].slice(0, 3));
      this.tag(h, species);
      this.group.add(h);
      pts.userData.handles.push(h);
    }
    return pts;
  }

  /** Show the ecosystem's state: coral alive / bleached / dead, algae cover, seagrass and plankton. */
  show(s) {
    this.lastState = s;
    const live = s.removed.includes('coral') ? 0 : Math.min(1.4, s.pop.coral / 0.6);
    const white = new THREE.Color(0xf4f6f2);
    const dead = new THREE.Color(0x6b6a4a);
    for (const c of this.colonies) {
      const rank = c.userData.rank;
      let color;
      if (rank > live * 0.9) color = dead; // dead colony, overgrown
      else if (rank < s.bleach * live * 0.9) color = white; // bleached: the zooxanthellae have left
      else color = c.userData.base;
      c.userData.target = color;
      c.userData.alive = rank <= live * 0.9;
      // model corals keep their own colours while healthy, and fade to bleached white or dead grey-brown
      c.userData.mix = color === c.userData.base ? 0 : color === white ? 0.92 : 0.85;
    }
    const algaeN = s.removed.includes('algae') ? 0 : Math.round(Math.min(1, s.pop.algae / 0.95) * this.algaeSpots.length);
    this.algae.count = algaeN;
    this.algaeSpots.forEach((mm, i) => this.algae.setMatrixAt(i, mm));
    this.algae.instanceMatrix.needsUpdate = true;
    this.grassCount = Math.round(Math.min(1.3, s.pop.seagrass) * 200);
    this.grass.count = Math.min(this.grassBase.length, this.grassCount);
    this.phyto.geometry.setDrawRange(0, Math.round(Math.min(2.5, s.pop.phyto) / 2.5 * 900));
    this.zoo.geometry.setDrawRange(0, Math.round(Math.min(2, s.pop.zoo) / 2 * 500));
    for (const h of this.phyto.userData.handles) h.visible = s.pop.phyto > 0.05;
    for (const h of this.zoo.userData.handles) h.visible = s.pop.zoo > 0.05;
    this.anemone.visible = !s.removed.includes('anemone');
  }

  /** A representative position (reef-local) for a fixed species, for food-web threads. */
  anchor(species) {
    if (species === 'coral') return rockPoint(2.5, 0.5);
    if (species === 'algae') return rockPoint(4, 1.1);
    if (species === 'seagrass') return new THREE.Vector3(1.5, 0.2, 0);
    if (species === 'anemone') return this.anemonePos.clone().add(new THREE.Vector3(0, 0.1, 0));
    if (species === 'phyto') return new THREE.Vector3(-1.1, 1.5, 0.6);
    if (species === 'zoo') return new THREE.Vector3(-0.9, 1.2, -0.7);
    return null;
  }

  update(dt) {
    this.time += dt;
    const t = this.time;
    for (const c of this.colonies) {
      if (!c.userData.target) continue;
      for (const m of c.userData.mats) m.color.lerp(c.userData.target, Math.min(1, dt * 1.5));
      const b = c.userData.bleach;
      if (b) {
        if (c.userData.mix > 0) b.uTint.value.lerp(c.userData.target, Math.min(1, dt * 1.5));
        b.uMix.value += (c.userData.mix - b.uMix.value) * Math.min(1, dt * 1.5);
      }
    }
    this.anemone.userData.animate(t);
    const m = new THREE.Object3D();
    this.grassBase.forEach((b, i) => {
      m.position.set(b.x, 0, b.z);
      m.rotation.set(Math.sin(t * 1.2 + b.ph) * 0.18, b.a, Math.cos(t + b.ph) * 0.12);
      m.scale.set(1, b.s, 1);
      m.updateMatrix();
      this.grass.setMatrixAt(i, m.matrix);
    });
    this.grass.instanceMatrix.needsUpdate = true;
    for (const cl of [this.phyto, this.zoo]) {
      cl.material.uniforms.uTime.value = t;
      const p = cl.geometry.attributes.position;
      const base = cl.userData.base;
      const jitter = cl === this.zoo ? 0.03 : 0.01;
      for (let i = 0; i < p.count; i++) {
        const [x, y, z, ph] = base[i];
        p.setXYZ(i, x + Math.sin(t * 0.2 + ph) * 0.08, y + Math.sin(t * 0.5 + ph * 2) * 0.05 + Math.sin(t * 7 + ph) * jitter * 0.1, z + Math.cos(t * 0.17 + ph) * 0.08);
      }
      p.needsUpdate = true;
    }
  }
}
