import * as THREE from 'three';
import { ORGANELLES } from '../data/cells.js';
import { makeLabel } from '../../../../shared/ui/labels.js';
import { sound } from '../../../../shared/util/sound.js';

// Explore: point at anything to name it, tap it to learn about it, or pull an organelle out of the cell —
// it goes onto the specimen stand, enlarged and turning, so you can look at it closely.

export const STAND_POS = new THREE.Vector3(0, -0.31, 0.2);
const SPECIMEN_SIZE = 0.15;

/** Copy an organelle for the stand: no cutting plane, no references back into the cell. */
function copyOf(root) {
  const saved = new Map();
  root.traverse((o) => {
    saved.set(o, o.userData);
    o.userData = {};
  });
  const copy = root.clone(true);
  for (const [o, ud] of saved) o.userData = ud;
  copy.traverse((o) => {
    if (o.isMesh && o.material.clippingPlanes) {
      o.material = o.material.clone();
      o.material.clippingPlanes = null;
    }
  });
  copy.visible = true;
  return copy;
}

export class Explorer {
  constructor(app) {
    this.app = app;
    this.stand = new THREE.Group();
    this.stand.position.copy(STAND_POS);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.014, 40),
      new THREE.MeshStandardMaterial({ color: 0x2a3560, roughness: 0.5 }));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.003, 8, 48),
      new THREE.MeshBasicMaterial({ color: 0x7ee2a8, toneMapped: false }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.008;
    this.standLabel = makeLabel('Specimen stand · pull an organelle here', { height: 0.022, size: 38 });
    this.standLabel.position.set(0, -0.03, 0.09);
    this.stand.add(base, ring, this.standLabel);
    app.lab.add(this.stand);
    this.specimen = null; // { id, root, copy, scale }
    this.names = new THREE.Group();
    app.lab.add(this.names);
  }

  attach(cell) {
    this.cell = cell;
    this.returnSpecimen();
    cell.group.traverse((o) => {
      if (o.userData.organelle) o.userData.handler = this;
    });
    this.showNames(this.app.state.names);
  }

  // ───────────── Interaction handler ─────────────

  describe(o) {
    const id = o.userData.organelle ?? o.userData.specimen;
    if (!id) return '';
    const canPull = !o.userData.tapOnly && !o.userData.specimen;
    return `${ORGANELLES[id].name}${canPull ? ' · pull out to examine' : ''}`;
  }

  tap(o) {
    this.app.select(o.userData.organelle ?? o.userData.specimen);
  }

  grab(o, mode, world) {
    if (o.userData.specimen) return this.grabSpecimen(world);
    const id = o.userData.organelle;
    if (!id || o.userData.tapOnly || this.cell.knocked.has(id)) return null;
    const root = o.userData.root;
    const lab = this.app.lab;

    // Carry a copy; the original disappears from the cell while it is out.
    const copy = copyOf(root);
    root.updateMatrixWorld(true);
    copy.matrix.copy(root.matrixWorld);
    copy.matrix.decompose(copy.position, copy.quaternion, copy.scale);
    lab.attach(copy);
    root.visible = false;
    const home = copy.position.clone();
    const offset = home.clone().sub(lab.worldToLocal(world.clone()));
    sound.click();
    this.app.netHolding = { label: ORGANELLES[id].name };

    return {
      move: (w) => copy.position.copy(lab.worldToLocal(w.clone())).add(offset),
      release: () => {
        this.app.netHolding = null;
        if (copy.position.distanceTo(home) < 0.06) {
          // Barely moved: that was a tap — put it back and tell them about it.
          lab.remove(copy);
          root.visible = true;
          this.app.select(id);
          return;
        }
        this.place(id, root, copy);
      },
    };
  }

  /** Put a pulled-out organelle on the stand (the previous one goes back into the cell). */
  place(id, root, copy) {
    this.returnSpecimen();
    const box = new THREE.Box3().setFromObject(copy);
    const size = box.getSize(new THREE.Vector3());
    const k = SPECIMEN_SIZE / Math.max(size.x, size.y, size.z);
    copy.traverse((o) => {
      if (o.isMesh) o.userData = { handler: this, specimen: id };
    });
    this.specimen = { id, root, copy, scale: copy.scale.x * k };
    this.standLabel.visible = false;
    sound.bond();
    this.app.interaction.pulse(0.5, 40);
    this.app.examine(id, Math.round(k * 10) / 10);
  }

  grabSpecimen(world) {
    const sp = this.specimen;
    if (!sp) return null;
    const lab = this.app.lab;
    const offset = sp.copy.position.clone().sub(lab.worldToLocal(world.clone()));
    sp.carried = true;
    return {
      move: (w) => sp.copy.position.copy(lab.worldToLocal(w.clone())).add(offset),
      release: () => {
        sp.carried = false;
        const cellCentre = lab.worldToLocal(this.cell.group.getWorldPosition(new THREE.Vector3()));
        if (sp.copy.position.distanceTo(cellCentre) < 0.24) {
          this.returnSpecimen();
          this.app.explain({ title: `${ORGANELLES[sp.id].name} put back`, text: 'Back in its place in the cell.' });
        }
      },
    };
  }

  returnSpecimen() {
    const sp = this.specimen;
    if (!sp) return;
    this.app.lab.remove(sp.copy);
    sp.root.visible = true;
    this.specimen = null;
    this.standLabel.visible = true;
  }

  get grabTargets() {
    const t = this.cell ? [...this.cell.targets] : [];
    this.specimen?.copy.traverse((o) => {
      if (o.isMesh) t.push(o);
    });
    return t;
  }

  /** Name tags on every kind of organelle. */
  showNames(on) {
    for (const o of [...this.names.children]) {
      o.userData.dispose?.();
      this.names.remove(o);
    }
    if (!on || !this.cell) return;
    for (const id of this.cell.parts.keys()) {
      const p = this.cell.anchor(id, this.app.lab);
      if (!p) continue;
      const tag = makeLabel(ORGANELLES[id].name, { height: 0.022, size: 38 });
      tag.position.copy(p).add(new THREE.Vector3(0, 0.025, 0.03));
      tag.material.depthTest = false;
      tag.renderOrder = 6;
      this.names.add(tag);
    }
  }

  update(dt) {
    const sp = this.specimen;
    if (!sp || sp.carried) return;
    // glide onto the stand, grow, and turn slowly
    const target = STAND_POS.clone().add(new THREE.Vector3(0, 0.1, 0));
    const centre = new THREE.Box3().setFromObject(sp.copy).getCenter(new THREE.Vector3());
    this.app.lab.worldToLocal(centre);
    sp.copy.position.add(target.sub(centre).multiplyScalar(Math.min(1, dt * 4)));
    const s = THREE.MathUtils.lerp(sp.copy.scale.x, sp.scale, Math.min(1, dt * 3));
    sp.copy.scale.setScalar(s);
    sp.copy.rotateY(dt * 0.5);
  }
}
