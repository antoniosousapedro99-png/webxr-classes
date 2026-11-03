import * as THREE from 'three';
import { PARTS, partsIn } from '../data/parts.js';
import { partMesh } from './parts3d.js';
import { makeLabel } from '../../../../shared/ui/labels.js';

// A shelf in front of the case with every option for one kind of part.
// Parts are shown shrunk to fit (like Lego pieces); picked up, they become life-size.

export const TRAY_POS = new THREE.Vector3(0, -0.29, 0.2);
const CELL = 0.13; // each item fits in a cube this size

export class PartsTray {
  constructor(handler) {
    this.handler = handler;
    this.group = new THREE.Group();
    this.group.position.copy(TRAY_POS);
    const shelf = new THREE.Mesh(
      new THREE.BoxGeometry(0.66, 0.01, 0.16),
      new THREE.MeshStandardMaterial({ color: 0x2a3560, transparent: true, opacity: 0.85, roughness: 0.6 }),
    );
    shelf.position.y = -0.05;
    this.group.add(shelf);
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
    const step = 0.16;
    ids.forEach((id, i) => {
      const holder = new THREE.Group();
      const model = partMesh(id);
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const scale = Math.min(1, CELL / Math.max(size.x, size.y, size.z));
      model.position.copy(box.getCenter(new THREE.Vector3())).multiplyScalar(-scale);
      model.scale.setScalar(scale);
      holder.add(model);
      holder.rotation.x = -0.5; // tilt towards you so the face is visible
      holder.position.set((i - (ids.length - 1) / 2) * step, 0.02, 0);
      holder.traverse((o) => {
        if (o.isMesh) Object.assign(o.userData, { handler: this.handler, trayPart: id });
      });
      this.items.add(holder);
      const p = PARTS[id];
      const label = makeLabel(p.short, { height: 0.022, size: 40 });
      label.position.set(holder.position.x, -0.035, 0.07);
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
