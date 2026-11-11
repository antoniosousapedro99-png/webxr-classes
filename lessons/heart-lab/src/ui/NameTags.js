import * as THREE from 'three';
import { makeLabel } from '../../../../shared/ui/labels.js';
import { PARTS, partsFor } from '../data/heart.js';

// Name tags like a textbook diagram: two neat columns either side of the heart, each with a thin line to its
// part. Every frame they are laid out again for where you are looking from (parts on your left get a tag on the
// left, sorted top to bottom and spaced so no two overlap), so they stay readable however the heart is turned.

export class NameTags {
  /** heart: Heart or RealHeart; height: tag height in metres. */
  constructor(heart, height) {
    this.heart = heart;
    this.height = height;
    this.group = new THREE.Group(); // in the heart's group (not turned with the heart)
    heart.group.add(this.group);
    this.tags = [];
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(3 * 2 * 24), 3));
    this.lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, depthTest: false }));
    this.lines.renderOrder = 6;
    this.lines.frustumCulled = false;
    this.group.add(this.lines);
    this.group.visible = false;
  }

  /** Show tags for the parts of this level (or none). */
  set(on, level) {
    for (const t of this.tags) {
      t.sprite.userData.dispose?.();
      this.group.remove(t.sprite);
    }
    this.tags = [];
    this.group.visible = on;
    if (!on) return;
    const s = this.heart.group.scale.x;
    const h = this.height / s; // in the heart's own units
    for (const id of partsFor(level)) {
      const sprite = makeLabel(PARTS[id].name, { height: h, size: 40 });
      sprite.material.depthTest = false;
      sprite.renderOrder = 7;
      this.group.add(sprite);
      this.tags.push({ id, sprite, w: sprite.scale.x });
    }
  }

  /** Lay the tags out for the camera (call every frame while shown). */
  update(camera) {
    if (!this.group.visible || !this.tags.length) return;
    const heart = this.heart;
    const g = heart.group;
    g.updateMatrixWorld(true);
    const toLocal = g.matrixWorld.clone().invert();
    // view axes in the heart group's coordinates
    const eye = camera.getWorldPosition(new THREE.Vector3()).applyMatrix4(toLocal);
    const fwd = eye.clone().normalize(); // from the heart towards you
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.getWorldQuaternion(new THREE.Quaternion()));
    up.transformDirection(toLocal);
    const right = new THREE.Vector3().crossVectors(up, fwd).normalize();
    up.crossVectors(fwd, right).normalize();
    const h = this.height / g.scale.x;
    const gap = h * 1.25;
    const R = (heart.real ? Math.max(heart.size.x, heart.size.z) * 0.5 : 0.62) + h * 0.6; // clear of the heart

    // where each part is, seen from here
    // (opened up: no tags for parts in the half that has been cut away)
    const items = [];
    for (const t of this.tags) {
      const local = heart.cutOn && heart.anchorCut ? heart.anchorCut(t.id) : heart.anchor(t.id);
      const w = local && heart.space.localToWorld(local);
      t.sprite.visible = !!w && !(heart.cutOn && !heart.anchorCut && heart.clip.distanceToPoint(w) < -0.004);
      if (!t.sprite.visible) continue;
      const a = w.applyMatrix4(toLocal);
      items.push({ t, a, x: a.dot(right), y: a.dot(up) });
    }
    const columns = [items.filter((i) => i.x < 0), items.filter((i) => i.x >= 0)];
    // keep the columns about even (a part near the middle can go to the shorter side)
    const sorted = [...items].sort((p, q) => p.x - q.x);
    if (Math.abs(columns[0].length - columns[1].length) > 2) {
      const half = Math.ceil(sorted.length / 2);
      columns[0] = sorted.slice(0, half);
      columns[1] = sorted.slice(half);
    }
    const pos = this.lines.geometry.attributes.position;
    let n = 0;
    columns.forEach((col, side) => {
      col.sort((p, q) => q.y - p.y); // top first
      // spread out: no two closer than `gap`, staying near their parts
      const ys = col.map((i) => i.y);
      for (let k = 1; k < ys.length; k++) ys[k] = Math.min(ys[k], ys[k - 1] - gap);
      const shift = (col.reduce((s, i) => s + i.y, 0) - ys.reduce((s, y) => s + y, 0)) / Math.max(1, ys.length);
      for (let k = 0; k < ys.length; k++) ys[k] += Math.max(0, shift * 0.8);
      for (let k = 1; k < ys.length; k++) ys[k] = Math.min(ys[k], ys[k - 1] - gap);
      const dir = side ? 1 : -1;
      col.forEach((i, k) => {
        const x = dir * (R + i.t.w / 2);
        const p = right.clone().multiplyScalar(x).addScaledVector(up, ys[k]);
        i.t.sprite.position.copy(p);
        // leader line: from the part to the near edge of its tag
        const edge = right.clone().multiplyScalar(dir * R).addScaledVector(up, ys[k]);
        if (n < 24) {
          pos.setXYZ(n * 2, i.a.x, i.a.y, i.a.z);
          pos.setXYZ(n * 2 + 1, edge.x, edge.y, edge.z);
          n++;
        }
      });
    });
    for (; n < 24; n++) {
      pos.setXYZ(n * 2, 0, 0, 0);
      pos.setXYZ(n * 2 + 1, 0, 0, 0);
    }
    pos.needsUpdate = true;
  }

  /** Move to another heart (when the anatomical model replaces the backup one). */
  attach(heart) {
    this.group.removeFromParent();
    this.heart = heart;
    heart.group.add(this.group);
  }
}
