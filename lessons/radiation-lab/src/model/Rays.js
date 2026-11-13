import * as THREE from 'three';
import { TYPES, ABSORBERS } from '../data/radiation.js';
import { HOLDER, SLOT_X } from './Bench.js';

// "X-ray vision": the radiation drawn as streaks flying out of every source. Alpha (red) only gets a few
// centimetres and is stopped by any absorber; beta (blue) flies further and is stopped by aluminium or lead;
// gamma (yellow) goes a long way, and lead stops only some of it. Purely a picture: the counter's numbers
// come from Bench.rate(), not from these streaks.

const MAX = 600;
const LEN = { a: 0.006, b: 0.02, g: 0.05 };
const SPEED = { a: 0.06, b: 0.35, g: 0.9 };
const RANGE = { a: 0.045, b: 0.6, g: 1.4 };
const VISIBLE = { a: 0.5, b: 0.9, g: 2.2 }; // streaks per second for each count per second (gamma is detected less often)

export class Rays {
  constructor(app, bench) {
    this.app = app;
    this.bench = bench;
    this.parts = [];
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX * 6), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAX * 6), 3));
    this.lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false, toneMapped: false }));
    this.lines.frustumCulled = false;
    this.lines.renderOrder = 5;
    bench.group.add(this.lines);
    this.colors = Object.fromEntries(Object.entries(TYPES).map(([k, t]) => [k, new THREE.Color(t.color)]));
    this.on = false;
    this.acc = {};
  }

  update(dt) {
    this.lines.visible = this.on;
    if (!this.on) {
      this.parts.length = 0;
      return;
    }
    const b = this.bench;
    // new streaks
    b.emitters().forEach((e, i) => {
      for (const k of ['a', 'b', 'g']) {
        if (!e[k]) continue;
        const key = `${i}${k}`;
        this.acc[key] = (this.acc[key] ?? 0) + Math.min(40, e[k] * VISIBLE[k]) * dt;
        while (this.acc[key] >= 1 && this.parts.length < MAX) {
          this.acc[key] -= 1;
          const d = new THREE.Vector3().randomDirection();
          if (e.holder && Math.random() < 0.5) d.set(1, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6).normalize(); // more towards the probe, to see the absorber work
          this.parts.push({ k, p: e.p.clone(), d, s: 0, holder: e.holder, stopAt: Infinity });
        }
        this.acc[key] = Math.min(this.acc[key], 2);
      }
    });
    // move them; absorbers stop them
    const ab = b.absorber;
    for (const q of this.parts) {
      if (q.holder && ab !== 'none' && q.d.x > 0 && q.stopAt === Infinity) {
        const t = (SLOT_X - q.p.x) / q.d.x;
        const hit = q.p.clone().addScaledVector(q.d, t);
        const through = Math.random() < ABSORBERS[ab].t[q.k];
        if (t > 0 && Math.abs(hit.y - HOLDER.y) < 0.03 && Math.abs(hit.z - HOLDER.z) < 0.03 && !through) q.stopAt = t;
        else q.stopAt = -1;
      }
      q.s += SPEED[q.k] * dt;
    }
    this.parts = this.parts.filter((q) => q.s - LEN[q.k] < Math.min(RANGE[q.k], q.stopAt > 0 ? q.stopAt : Infinity));
    const pos = this.lines.geometry.attributes.position;
    const col = this.lines.geometry.attributes.color;
    let n = 0;
    for (const q of this.parts) {
      const end = Math.min(q.s, RANGE[q.k], q.stopAt > 0 ? q.stopAt : Infinity);
      const start = Math.max(0, q.s - LEN[q.k]);
      if (start >= end) continue;
      pos.setXYZ(n * 2, q.p.x + q.d.x * start, q.p.y + q.d.y * start, q.p.z + q.d.z * start);
      pos.setXYZ(n * 2 + 1, q.p.x + q.d.x * end, q.p.y + q.d.y * end, q.p.z + q.d.z * end);
      const c = this.colors[q.k];
      col.setXYZ(n * 2, c.r, c.g, c.b);
      col.setXYZ(n * 2 + 1, c.r, c.g, c.b);
      n++;
    }
    this.lines.geometry.setDrawRange(0, n * 2);
    pos.needsUpdate = true;
    col.needsUpdate = true;
  }
}
