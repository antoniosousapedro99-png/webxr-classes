import * as THREE from 'three';
import { makeLabel } from '../../../../shared/ui/labels.js';

// Healthy and narrowed coronary arteries side by side, cut open lengthways, with blood flowing through:
// plaque narrows one; in a heart attack a clot blocks it completely.

const LEN = 0.17;
const R = 0.026;

function artery(label) {
  const g = new THREE.Group();
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(R, R, LEN, 32, 1, true, 0, Math.PI),
    new THREE.MeshStandardMaterial({ color: 0xd88a80, roughness: 0.6, side: THREE.DoubleSide }));
  wall.rotation.z = Math.PI / 2; // lying along x, cut open towards you
  wall.rotation.x = -Math.PI / 2; // (keeps the back half)
  const outer = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.18, R * 1.18, LEN, 32, 1, true, 0, Math.PI),
    new THREE.MeshStandardMaterial({ color: 0xb85a52, roughness: 0.7, side: THREE.BackSide }));
  outer.rotation.copy(wall.rotation);
  g.add(wall, outer);
  const tag = makeLabel(label, { height: 0.022, size: 40 });
  tag.position.set(0, -R - 0.03, 0);
  g.add(tag);
  return g;
}

export class Arteries {
  constructor(parent) {
    this.group = new THREE.Group();
    parent.add(this.group);
    this.healthy = artery('Healthy artery');
    this.narrow = artery('Narrowed artery');
    this.healthy.position.set(-0.27, -0.1, 0.16);
    this.narrow.position.set(0.27, -0.1, 0.16);
    this.healthy.scale.setScalar(1.25);
    this.narrow.scale.setScalar(1.25);
    this.healthy.rotation.y = 0.35;
    this.narrow.rotation.y = -0.35;
    this.group.add(this.healthy, this.narrow);
    // plaque: a fatty lump on the wall, narrowing the middle
    this.plaque = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshStandardMaterial({ color: 0xf0d27a, roughness: 0.85 }));
    this.plaque.scale.set(0.05, R * 0.75, R * 0.9);
    this.plaque.position.set(0, -R * 0.55, -R * 0.2);
    this.clot = new THREE.Mesh(new THREE.SphereGeometry(R * 0.55, 16, 12), new THREE.MeshStandardMaterial({ color: 0x3a0606, roughness: 0.7 }));
    this.clot.position.set(0.012, R * 0.3, -R * 0.2);
    this.narrow.add(this.plaque, this.clot);
    const dot = new THREE.SphereGeometry(0.0055, 8, 6);
    const mat = new THREE.MeshBasicMaterial({ color: 0xff2b2b, toneMapped: false });
    this.cells = [];
    for (const [art, n] of [[this.healthy, 40], [this.narrow, 40]]) {
      for (let i = 0; i < n; i++) {
        const m = new THREE.Mesh(dot, mat);
        const c = { m, art, u: Math.random(), y: (Math.random() * 2 - 1) * 0.8, z: -Math.random() * 0.8 };
        art.add(m);
        this.cells.push(c);
      }
    }
    this.group.visible = false;
  }

  /** cond: 'chd' (narrowed) or 'attack' (blocked by a clot). */
  set(cond) {
    this.cond = cond;
    this.clot.visible = cond === 'attack';
  }

  update(dt, pulse) {
    if (!this.group.visible) return;
    const attack = this.cond === 'attack';
    for (const c of this.cells) {
      const narrow = c.art === this.narrow;
      // past the plaque the gap is small: blood squeezes through the top of the artery, slowly
      const nearPlaque = narrow && Math.abs(c.u - 0.5) < 0.18;
      let v = (narrow ? 0.18 : 0.45) * (0.7 + pulse * 0.6);
      if (narrow && attack && c.u < 0.5) v = c.u > 0.42 - (c.y + 1) * 0.08 ? 0 : v; // piles up behind the clot
      c.u += v * dt;
      if (c.u > 1) c.u = 0;
      const y = nearPlaque ? 0.45 + Math.abs(c.y) * 0.4 : c.y;
      c.m.position.set((c.u - 0.5) * LEN, y * R, c.z * R);
      c.m.visible = !(narrow && attack && c.u > 0.5);
    }
  }
}
