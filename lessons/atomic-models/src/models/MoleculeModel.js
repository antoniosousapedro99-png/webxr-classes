import * as THREE from 'three';
import { MOLECULES } from '../data/molecules.js';
import { bySymbol, VDW_RADII, IONIC_RADII } from '../data/elements.js';
import { clearGroup } from '../ui/labels.js';

// 1 Å (10⁻¹⁰ m) is shown as 10 cm → the model is magnified one billion times.
export const MOLECULE_SCALE = 0.1;

// Ball-and-stick: every atom of an element has the same ball size, every bond the same thickness,
// so models can be compared fairly with each other.
const BALL_R = { H: 0.022, default: 0.032 };
const BOND_R = 0.0065;
const UP = new THREE.Vector3(0, 1, 0);

export class MoleculeModel {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'molecule';
    this.content = new THREE.Group();
    this.group.add(this.content);
    this.key = '';
    this.materials = new Map();
    this.sphere = new THREE.SphereGeometry(1, 32, 20);
    this.bondMat = new THREE.MeshStandardMaterial({ color: 0xd8dbe8, roughness: 0.5 });
    this.extentA = 0;
    this.fit = 1;
  }

  material(symbol) {
    if (!this.materials.has(symbol)) {
      const el = bySymbol(symbol);
      this.materials.set(symbol, new THREE.MeshStandardMaterial({ color: el ? el.color : 0xff00ff, roughness: 0.35 }));
    }
    return this.materials.get(symbol);
  }

  set(id, style) {
    const key = `${id}/${style}`;
    if (key === this.key) return;
    this.key = key;
    clearGroup(this.content, new Set([this.sphere, this.bondMat, ...this.materials.values()]));
    this.content.rotation.set(0, 0, 0);

    const def = MOLECULES[id];
    const centre = new THREE.Vector3();
    def.atoms.forEach(([, x, y, z]) => centre.add(new THREE.Vector3(x, y, z)));
    centre.divideScalar(def.atoms.length);
    const pos = def.atoms.map(([, x, y, z]) => new THREE.Vector3(x, y, z).sub(centre));

    this.extentA = 0;
    def.atoms.forEach(([symbol], i) => {
      const realR = (def.crystal ? IONIC_RADII[symbol] : VDW_RADII[symbol]) / 100; // Å
      this.extentA = Math.max(this.extentA, pos[i].length() + realR);
      const r = style === 'space' ? realR * MOLECULE_SCALE : (BALL_R[symbol] ?? BALL_R.default) * (def.crystal ? 0.8 : 1);
      const ball = new THREE.Mesh(this.sphere, this.material(symbol));
      ball.scale.setScalar(r);
      ball.position.copy(pos[i]).multiplyScalar(MOLECULE_SCALE);
      this.content.add(ball);
    });
    this.extentA *= 2;

    // Big space-filling models and the salt lattice are shrunk to fit between the panels.
    // Ball-and-stick molecules are never resized, so their balls and bonds stay comparable.
    const maxSize = 0.55;
    this.fit = style === 'space' || def.crystal ? Math.min(1, maxSize / (this.extentA * MOLECULE_SCALE)) : 1;
    this.content.scale.setScalar(this.fit);

    if (style !== 'space') {
      for (const [a, b, order] of def.bonds) this.addBond(pos[a], pos[b], order);
    }
  }

  addBond(a, b, order) {
    const pa = a.clone().multiplyScalar(MOLECULE_SCALE);
    const pb = b.clone().multiplyScalar(MOLECULE_SCALE);
    const dir = pb.clone().sub(pa);
    const len = dir.length();
    dir.normalize();
    let side = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 0, 1));
    if (side.lengthSq() < 1e-6) side = new THREE.Vector3().crossVectors(dir, UP);
    side.normalize();
    const spacing = 0.014;
    const geo = new THREE.CylinderGeometry(order > 1 ? BOND_R * 0.75 : BOND_R, order > 1 ? BOND_R * 0.75 : BOND_R, len, 12);
    for (let i = 0; i < order; i++) {
      const offset = (i - (order - 1) / 2) * spacing;
      const m = new THREE.Mesh(geo, this.bondMat);
      m.position.copy(pa).add(pb).multiplyScalar(0.5).addScaledVector(side, offset);
      m.quaternion.setFromUnitVectors(UP, dir);
      this.content.add(m);
    }
  }

  animate(dt) {
    this.content.rotation.y += 0.35 * dt;
  }
}
