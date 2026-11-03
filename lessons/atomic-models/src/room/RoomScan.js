import * as THREE from 'three';
import { materialFor } from '../data/materials.js';
import { makeLabel } from '../../../../shared/ui/labels.js';
import { sup, formatLength } from '../util/format.js';

// Uses the headset's knowledge of the real room (WebXR plane detection: table, wall, window, floor…).
//  • "What's my room made of?" puts a tag on each real surface; tap it to learn its atoms
//  • the Scale tab points the "edge of the atom" through your real window
//  • "Put the lab on my table"
// Without a headset (or before Space Setup) an example room is shown so the idea still works on screen.

const AVOGADRO = 6.022e23;

/** 4.2e27 → "4 × 10²⁷" */
export function sci(n) {
  const e = Math.floor(Math.log10(n));
  const m = Math.round(n / 10 ** e);
  return m === 10 ? `10${sup(e + 1)}` : `${m} × 10${sup(e)}`;
}

export function atomsIn(plane) {
  const m = plane.material;
  return ((plane.area * m.thickness * m.density * 1000) / m.gPerAtom) * AVOGADRO;
}

export function surfaceFact(plane) {
  const m = plane.material;
  const n = atomsIn(plane);
  return {
    title: `${m.name}: ${m.material}`,
    text: `About ${formatLength(plane.width)} × ${formatLength(plane.depth)} of ${m.material} (${m.formula}), made of ${m.elements} atoms. ${m.note} Estimated atoms: ≈ ${sci(n)}${n > 1e24 ? ' — more than all the stars in the observable universe (about 10²³)' : ''}.`,
  };
}

export class RoomScan {
  constructor(app) {
    this.app = app;
    this.group = new THREE.Group(); // world space (planes are fixed in the room, not in the lab)
    this.group.visible = false;
    app.scene.add(this.group);
    this.planes = new Map(); // XRPlane (or demo key) → info
    this.source = 'none'; // 'xr' | 'demo' | 'none'
    this.lastScan = 0;
    this.outlineMat = new THREE.LineBasicMaterial({ color: 0x7ee2a8, transparent: true, opacity: 0.7 });
    this.selected = null;
  }

  // ───────────── reading the real room ─────────────

  update(frame, refSpace) {
    const planes = frame?.detectedPlanes;
    if (!planes || !refSpace) return;
    const now = performance.now();
    if (now - this.lastScan < 1000) return; // planes rarely change; once a second is plenty
    this.lastScan = now;
    if (this.source === 'demo') this.clear();
    this.source = 'xr';
    const seen = new Set();
    planes.forEach((plane) => {
      const pose = frame.getPose(plane.planeSpace, refSpace);
      if (!pose) return;
      seen.add(plane);
      const matrix = new THREE.Matrix4().fromArray(pose.transform.matrix);
      const pts = plane.polygon.map((p) => new THREE.Vector3(p.x, 0, p.z));
      if (!this.planes.has(plane) || plane.lastChangedTime !== this.planes.get(plane).changed) {
        this.removePlane(plane);
        const label = plane.semanticLabel || this.guessLabel(plane.orientation, matrix);
        this.addPlane(plane, label, matrix, pts, plane.lastChangedTime);
      }
    });
    for (const key of [...this.planes.keys()]) if (!seen.has(key)) this.removePlane(key);
  }

  guessLabel(orientation, matrix) {
    if (orientation === 'vertical') return 'wall';
    const y = new THREE.Vector3().setFromMatrixPosition(matrix).y;
    return y < 0.3 ? 'floor' : y > 2 ? 'ceiling' : 'table';
  }

  /** An example room around the desktop lab position, so the feature can be tried on screen. */
  useDemoRoom(labPos) {
    if (this.source !== 'none') return;
    this.source = 'demo';
    const rect = (w, d) => [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([x, z]) => new THREE.Vector3(x, 0, z));
    const flat = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);
    const upright = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
    const { x, y, z } = labPos;
    this.addPlane('floor', 'floor', flat(x, 0, z + 0.5), rect(4, 4));
    this.addPlane('table', 'table', flat(x, y - 0.42, z + 0.1), rect(1.4, 0.8));
    this.addPlane('wall', 'wall', upright(x, 1.3, z - 1.6), rect(4, 2.6));
    this.addPlane('window', 'window', upright(x + 1.0, 1.45, z - 1.58), rect(1.0, 1.1));
    this.addPlane('door', 'door', upright(x - 1.3, 1.0, z - 1.58), rect(0.85, 2.0));
  }

  clear() {
    for (const key of [...this.planes.keys()]) this.removePlane(key);
    this.source = 'none';
  }

  addPlane(key, label, matrix, pts, changed = 0) {
    const material = materialFor(label);
    const box = new THREE.Box3().setFromPoints(pts);
    const width = box.max.x - box.min.x;
    const depth = box.max.z - box.min.z;
    const centreLocal = box.getCenter(new THREE.Vector3());
    const info = {
      key, label, material, matrix, width, depth, area: width * depth, changed,
      centre: centreLocal.clone().applyMatrix4(matrix),
      normal: new THREE.Vector3(0, 1, 0).transformDirection(matrix),
      objects: [],
    };
    // Outline of the real surface.
    const outline = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), this.outlineMat);
    outline.matrixAutoUpdate = false;
    outline.matrix.copy(matrix);
    this.group.add(outline);
    info.objects.push(outline);
    if (material) {
      const sprite = makeLabel(`${material.name}\n${material.formula}`, { height: 0.07, size: 44 });
      const tex = sprite.material.map;
      const tag = new THREE.Mesh(
        new THREE.PlaneGeometry(sprite.scale.x, sprite.scale.y),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false }),
      );
      tag.position.copy(info.centre).addScaledVector(info.normal, 0.04);
      if (Math.abs(info.normal.y) > 0.7) tag.position.y += 0.06;
      tag.userData = { handler: this, tapOnly: true, plane: info };
      this.group.add(tag);
      info.tag = tag;
      info.objects.push(tag);
    }
    this.planes.set(key, info);
  }

  removePlane(key) {
    const info = this.planes.get(key);
    if (!info) return;
    for (const o of info.objects) {
      this.group.remove(o);
      o.geometry.dispose();
      if (o.material !== this.outlineMat) {
        o.material.map?.dispose();
        o.material.dispose();
      }
    }
    this.planes.delete(key);
  }

  // ───────────── queries ─────────────

  get list() {
    return [...this.planes.values()].filter((p) => p.material);
  }

  find(word) {
    return this.list.find((p) => p.label.toLowerCase().includes(word)) ?? null;
  }

  get window() {
    return this.find('window');
  }

  /** The table (or desk) nearest to a world position. */
  tableNear(pos) {
    const tables = this.list.filter((p) => /table|desk/i.test(p.label));
    tables.sort((a, b) => a.centre.distanceTo(pos) - b.centre.distanceTo(pos));
    return tables[0] ?? null;
  }

  // ───────────── interaction (tags are tappable) ─────────────

  get grabTargets() {
    return this.group.visible ? this.list.map((p) => p.tag).filter(Boolean) : [];
  }

  describe(object) {
    return `${object.userData.plane.material.name} · tap: what atoms?`;
  }

  tap(object) {
    this.selected = object.userData.plane;
    this.app.explain(surfaceFact(this.selected));
  }

  /** Keep tags facing the viewer, and grow far-away ones so they stay readable. */
  face(cameraPos) {
    if (!this.group.visible) return;
    for (const p of this.list) {
      if (!p.tag) continue;
      p.tag.lookAt(cameraPos);
      p.tag.scale.setScalar(Math.max(1, p.tag.position.distanceTo(cameraPos) / 1.2));
    }
  }
}
