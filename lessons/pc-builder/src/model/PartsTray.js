import * as THREE from 'three';
import { PARTS, partsIn } from '../data/parts.js';
import { partMesh } from './parts3d.js';
import { makeLabel } from '../../../../shared/ui/labels.js';

// A shelf in front of the case with every option for one kind of part.
// Parts are shown shrunk to fit (like Lego pieces); picked up, they become life-size.

export const TRAY_POS = new THREE.Vector3(0, -0.29, 0.2);
const CELL = 0.11; // each item fits in a cube this size
const PER_ROW = 5;
const STEP = 0.13; // spacing between parts in a row
const ROW = new THREE.Vector3(0, -0.055, 0.13); // each extra row: lower and closer to you

export class PartsTray {
  constructor(handler) {
    this.handler = handler;
    this.group = new THREE.Group();
    this.group.position.copy(TRAY_POS);
    this.shelfMat = new THREE.MeshStandardMaterial({ color: 0x2a3560, transparent: true, opacity: 0.85, roughness: 0.6 });
    this.shelves = new THREE.Group();
    this.group.add(this.shelves);
    this.items = new THREE.Group();
    this.group.add(this.items);
    this.cat = null;
  }

  show(cat) {
    if (cat === this.cat) return;
    this.cat = cat;
    for (const o of [...this.items.children]) {
      o.traverse((x) => x.userData.dispose?.());
      this.items.remove(o);
    }
    const ids = partsIn(cat);
    const rows = Math.ceil(ids.length / PER_ROW);
    for (const s of [...this.shelves.children]) this.shelves.remove(s);
    for (let r = 0; r < rows; r++) {
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.01, 0.13), this.shelfMat);
      shelf.position.copy(ROW).multiplyScalar(r).add(new THREE.Vector3(0, -0.05, 0));
      this.shelves.add(shelf);
    }
    ids.forEach((id, i) => {
      const row = Math.floor(i / PER_ROW);
      const inRow = Math.min(PER_ROW, ids.length - row * PER_ROW);
      const col = i % PER_ROW;
      const base = ROW.clone().multiplyScalar(row);
      const holder = new THREE.Group();
      const model = partMesh(id);
      // memory sticks face you (side on), so you can compare them, e.g. a short laptop stick
      if (PARTS[id].cat === 'ram') model.rotation.y = Math.PI / 2;
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const scale = Math.min(1, CELL / Math.max(size.x, size.y, size.z));
      model.position.copy(box.getCenter(new THREE.Vector3())).multiplyScalar(-scale);
      model.scale.setScalar(scale);
      holder.add(model);
      holder.rotation.x = -0.5; // tilt towards you so the face is visible
      holder.position.set((col - (inRow - 1) / 2) * STEP, 0.02, 0).add(base);
      holder.traverse((o) => {
        if (o.isMesh) Object.assign(o.userData, { handler: this.handler, trayPart: id });
      });
      this.items.add(holder);
      const p = PARTS[id];
      const label = makeLabel(p.short, { height: 0.022, size: 40 });
      label.position.set(holder.position.x, base.y - 0.035, base.z + 0.06);
      this.items.add(label);
    });
  }

  get grabTargets() {
    const t = [];
    this.items.traverse((o) => {
      if (o.isMesh && o.userData.trayPart) t.push(o);
    });
    return t;
  }
}
