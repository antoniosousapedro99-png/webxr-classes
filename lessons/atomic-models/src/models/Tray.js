import * as THREE from 'three';
import { makeLabel, clearGroup } from '../ui/labels.js';

// A shelf in front of the model holding parts to take (protons… or atoms) and a bin to drop things in.
// Positions are in lab space; the shelf sits below the model, a little towards the user.

export const TRAY_POS = new THREE.Vector3(0, -0.3, 0.14);
const BIN_X = 0.33;

export class Tray {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'tray';
    this.group.position.copy(TRAY_POS);
    this.items = new THREE.Group();
    this.group.add(this.items);
    this.sphere = new THREE.SphereGeometry(1, 24, 16);

    const shelf = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.008, 0.1),
      new THREE.MeshStandardMaterial({ color: 0x2a3560, transparent: true, opacity: 0.85, roughness: 0.6 }),
    );
    shelf.position.set(-0.04, -0.04, 0);
    this.group.add(shelf);

    this.bin = new THREE.Group();
    this.bin.position.set(BIN_X, 0, 0);
    const binMat = new THREE.MeshStandardMaterial({ color: 0xe5484d, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.042, 0.08, 28, 1, true), binMat);
    const base = new THREE.Mesh(new THREE.CircleGeometry(0.042, 28).rotateX(-Math.PI / 2), binMat);
    base.position.y = -0.04;
    const label = makeLabel('Bin', { height: 0.026, size: 44 });
    label.position.set(0, 0.07, 0);
    this.bin.add(cup, base, label);
    this.binMat = binMat;
    this.group.add(this.bin);
  }

  /** items: [{ kind, label, color, radius, emissive? }] — each becomes a grabbable source. */
  setItems(items, handler) {
    clearGroup(this.items, new Set([this.sphere]));
    const step = 0.105;
    const x0 = -0.04 - ((items.length - 1) * step) / 2 - 0.04;
    items.forEach((it, i) => {
      const mat = new THREE.MeshStandardMaterial({ color: it.color, emissive: it.emissive ?? 0x000000, roughness: 0.35 });
      const m = new THREE.Mesh(this.sphere, mat);
      m.scale.setScalar(it.radius);
      m.position.set(x0 + i * step, 0, 0);
      m.userData.trayItem = it.kind;
      m.userData.handler = handler;
      this.items.add(m);
      const label = makeLabel(it.label, { height: 0.024, size: 40 });
      label.position.set(m.position.x, 0.05 + it.radius * 0.4, 0);
      this.items.add(label);
    });
  }

  get grabTargets() {
    return this.items.children.filter((c) => c.userData.trayItem);
  }

  /** Is this world-space point inside the bin? */
  binContains(world) {
    if (this.screenCamera) {
      // On a flat screen you drag in 2D, so check whether it is over the bin on screen.
      const cam = this.screenCamera;
      const c = this.bin.getWorldPosition(new THREE.Vector3());
      const edge = c.clone().add(new THREE.Vector3(0.065, 0, 0).applyQuaternion(cam.quaternion));
      const [a, b, e] = [world.clone().project(cam), c.project(cam), edge.project(cam)];
      return Math.hypot(a.x - b.x, a.y - b.y) < Math.hypot(e.x - b.x, e.y - b.y);
    }
    const p = this.bin.worldToLocal(world.clone());
    return Math.hypot(p.x, p.z) < 0.075 && p.y > -0.07 && p.y < 0.12;
  }

  /** Light the bin up while something is held over it. */
  highlightBin(on) {
    this.binMat.opacity = on ? 0.75 : 0.35;
  }
}
