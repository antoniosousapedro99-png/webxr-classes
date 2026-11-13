import * as THREE from 'three';
import { makeLabel } from '../../../../shared/ui/labels.js';
import { BALLS, SURFACES, SURFACE_IDS, G, G_MOON, restitution } from '../data/bounce.js';
import { bounceSound } from './sounds.js';

// The drop zone on the real floor: a row of surface mats in front of you, a 2 m ruler that moves to whichever
// mat was last used, and the physics of every drop. A drop is worked out in full the moment the ball is let
// go (every bounce, until it comes to rest), then played back in real time; after that a "ghost" ball replays
// the fall and the first bounce in slow motion and stops at the top of the bounce, next to the ruler, for
// students to read the height.
// Coordinates: metres, y up from the floor, x along the row of mats, z towards you.

export const MAT_W = 0.38;
export const MAT_D = 0.5;
const PITCH = 0.4;
const RULER_Z = -MAT_D / 2 - 0.03;
const RULER_H = 2.1;
const STEP = 1 / 240;
const SLOW = 0.25; // replay speed

export const matX = (i) => (i - (SURFACE_IDS.length - 1) / 2) * PITCH;
export const topOf = (surf) => SURFACES[surf].depth;

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const gauss = (r) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());

/**
 * Work out a whole drop. `p`: where the ball's centre is let go (zone coordinates), from rest.
 * Returns the samples [t, x, y, z]…, the impacts, the true drop and rebound heights (bottom of the ball,
 * above the surface) and what (if anything) went wrong.
 */
export function simulate(ball, surf, p, seed) {
  const b = BALLS[ball];
  const s = SURFACES[surf];
  const r = rng(seed);
  const i = SURFACE_IDS.indexOf(surf);
  const g = s.moon ? G_MOON : G;
  const kDrag = s.moon ? 0 : g / (b.vt * b.vt);
  const top = topOf(surf);
  const floor = top + b.r;
  const half = MAT_W / 2;
  const dx = p.x - matX(i);
  // something going wrong now and then: the ball lands on the edge of the mat, or it was let go with a spin
  let cause = null;
  if (Math.abs(dx) > half - b.r * 0.6 || Math.abs(p.z) > MAT_D / 2 - b.r * 0.6) cause = 'edge';
  else if (r() < 0.08) cause = 'spin';
  const h1 = p.y - floor;
  let x = p.x;
  let y = p.y;
  let z = p.z;
  let vx = 0;
  let vy = 0;
  let vz = 0;
  let t = 0;
  const out = [];
  const impacts = [];
  let h2 = null;
  let peak = -1;
  let topT = 0;
  let squash = false;
  while (t < 30) {
    out.push(t, x, y, z);
    t += STEP;
    vy -= (g + kDrag * vy * Math.abs(vy)) * STEP;
    const sp = Math.hypot(vx, vz);
    if (sp > 0) {
      const slow = Math.max(0, 1 - (kDrag * sp + 0.2) * STEP);
      vx *= slow;
      vz *= slow;
    }
    x += vx * STEP;
    y += vy * STEP;
    z += vz * STEP;
    // stay on the mat
    const ox = x - matX(i);
    if (impacts.length && Math.abs(ox) > half - b.r) { x = matX(i) + Math.sign(ox) * (half - b.r); vx = -vx * 0.4; }
    if (impacts.length && Math.abs(z) > MAT_D / 2 - b.r) { z = Math.sign(z) * (MAT_D / 2 - b.r); vz = -vz * 0.4; }
    if (impacts.length === 1 && y - floor > peak) { peak = y - floor; topT = t; }
    if (y <= floor && vy < 0) {
      y = floor;
      const v = -vy;
      let e = restitution(ball, surf, v) * (1 + 0.025 * gauss(r));
      if (impacts.length === 0) {
        if (cause === 'edge') {
          e *= 0.55;
          vx = Math.sign(dx || 1) * 0.5;
          vz = Math.sign(p.z || 1) * 0.2;
        } else if (cause === 'spin') {
          e *= 0.8;
          const a = r() * Math.PI * 2;
          vx = Math.cos(a) * 0.35;
          vz = Math.sin(a) * 0.35;
        }
        if (ball === 'plasticine' && surf !== 'trampoline') squash = true;
      }
      e = Math.min(0.97, Math.max(0, e));
      impacts.push({ t, v, e });
      if (impacts.length === 1) { peak = 0; topT = t; }
      vy = v * e;
      if (impacts.length >= 8 || vy < 0.12) break;
    }
  }
  h2 = Math.max(0, peak);
  // finish at rest on the surface
  out.push(t + 0.05, x, floor, z);
  return { ball, surf, samples: new Float32Array(out), impacts, h1, h2, topT, end: t + 0.05, cause, squash, rest: new THREE.Vector3(x, floor, z) };
}

/** Position at time t of a worked-out drop. */
function sampleAt(sim, t, v) {
  const s = sim.samples;
  const n = s.length / 4;
  const i = Math.min(n - 2, Math.max(0, Math.floor(t / STEP)));
  const k = Math.min(1, Math.max(0, (t - s[i * 4]) / STEP));
  const j = i + 1;
  v.set(s[i * 4 + 1] + (s[j * 4 + 1] - s[i * 4 + 1]) * k, s[i * 4 + 2] + (s[j * 4 + 2] - s[i * 4 + 2]) * k, s[i * 4 + 3] + (s[j * 4 + 3] - s[i * 4 + 3]) * k);
  return v;
}

function noiseTexture(base, spots, { size = 256, n = 1600, r = [1, 3], lines = 0 } = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d');
  x.fillStyle = base;
  x.fillRect(0, 0, size, size);
  for (let i = 0; i < n; i++) {
    x.fillStyle = spots[i % spots.length];
    const rr = r[0] + Math.random() * (r[1] - r[0]);
    if (lines) {
      x.fillRect(Math.random() * size, Math.random() * size, 1.5, rr * lines);
    } else {
      x.beginPath();
      x.arc(Math.random() * size, Math.random() * size, rr, 0, Math.PI * 2);
      x.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function woodTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  for (let i = 0; i < 4; i++) {
    x.fillStyle = ['#b27b46', '#a56e3c', '#bb8650', '#9f6939'][i];
    x.fillRect(i * 64, 0, 64, 256);
    x.fillStyle = 'rgba(70,40,15,0.5)';
    x.fillRect(i * 64, 0, 2, 256);
    for (let k = 0; k < 14; k++) {
      x.fillStyle = 'rgba(90,55,25,0.25)';
      x.fillRect(i * 64 + 4 + Math.random() * 56, 0, 1.2, 256);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function rulerTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 4096;
  const x = c.getContext('2d');
  const pxm = c.height / RULER_H;
  x.fillStyle = '#f6f1df';
  x.fillRect(0, 0, c.width, c.height);
  x.fillStyle = '#1c1c22';
  x.textBaseline = 'middle';
  x.font = '700 64px system-ui, sans-serif';
  for (let cm = 0; cm <= 210; cm++) {
    const yy = c.height - cm * (pxm / 100);
    const len = cm % 10 === 0 ? 110 : cm % 5 === 0 ? 70 : 38;
    x.fillRect(0, yy - (cm % 10 === 0 ? 2.5 : 1.2), len, cm % 10 === 0 ? 5 : 2.4);
    if (cm % 10 === 0 && cm > 0) x.fillText(String(cm), 122, yy);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** A thin horizontal line from a point over the mat back to the ruler, with an optional label. */
function levelLine(color) {
  const g = new THREE.Group();
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.004, 1), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthTest: false }));
  bar.renderOrder = 7;
  const tick = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.005, 0.005), bar.material);
  tick.renderOrder = 7;
  g.add(bar, tick);
  g.visible = false;
  g.userData = { bar, tick };
  return g;
}

export class Floor {
  constructor(app) {
    this.app = app;
    this.group = new THREE.Group();
    app.scene.add(this.group);
    this.mats = {};
    this.flights = [];

    const tex = {
      concrete: noiseTexture('#9a9a98', ['#8a8a88', '#adadab', '#7e7e7c'], { n: 2600, r: [0.6, 2] }),
      wood: woodTexture(),
      carpet: noiseTexture('#8e3346', ['#7a2a3b', '#a03d52', '#6f2434'], { n: 5000, r: [0.6, 1.4] }),
      grass: noiseTexture('#3f9b3a', ['#2f7f2b', '#56b44e', '#2a6e27', '#6cc35f'], { n: 3500, r: [2, 4], lines: 2 }),
      sand: noiseTexture('#e2c98d', ['#d4b878', '#efd9a3', '#c9ab6a'], { n: 5000, r: [0.5, 1.5] }),
      moon: noiseTexture('#77787f', ['#5f6067', '#8b8c93', '#4f5056'], { n: 700, r: [1, 7] }),
    };
    SURFACE_IDS.forEach((id, i) => {
      const s = SURFACES[id];
      const g = new THREE.Group();
      g.position.x = matX(i);
      if (id === 'trampoline') {
        const frameMat = new THREE.MeshStandardMaterial({ color: 0x3a6cff, roughness: 0.5 });
        const legMat = new THREE.MeshStandardMaterial({ color: 0x9aa3b8, metalness: 0.4, roughness: 0.4 });
        for (const [x, z, w, d] of [[0, MAT_D / 2 - 0.015, MAT_W, 0.03], [0, -MAT_D / 2 + 0.015, MAT_W, 0.03], [MAT_W / 2 - 0.015, 0, 0.03, MAT_D], [-MAT_W / 2 + 0.015, 0, 0.03, MAT_D]]) {
          const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.025, d), frameMat);
          m.position.set(x, s.depth - 0.012, z);
          g.add(m);
        }
        for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, s.depth, 8), legMat);
          leg.position.set(x * (MAT_W / 2 - 0.02), s.depth / 2, z * (MAT_D / 2 - 0.02));
          g.add(leg);
        }
        this.membrane = new THREE.Mesh(new THREE.PlaneGeometry(MAT_W - 0.05, MAT_D - 0.05).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x15171f, roughness: 0.8 }));
        this.membrane.position.y = s.depth;
        g.add(this.membrane);
      } else {
        const mat = new THREE.Mesh(new THREE.BoxGeometry(MAT_W, s.depth, MAT_D), new THREE.MeshStandardMaterial({ color: tex[id] ? 0xffffff : s.color, map: tex[id] ?? null, roughness: 0.9 }));
        mat.position.y = s.depth / 2;
        g.add(mat);
      }
      if (s.moon) {
        // the Moon's patch: a frame of stars around the column of space above it
        const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(MAT_W, RULER_H, MAT_D)), new THREE.LineBasicMaterial({ color: 0x9aa8ff, transparent: true, opacity: 0.35 }));
        edges.position.y = s.depth + RULER_H / 2;
        const pts = [];
        for (let k = 0; k < 90; k++) pts.push((Math.random() - 0.5) * MAT_W, s.depth + Math.random() * RULER_H, -MAT_D / 2 + Math.random() * 0.02);
        const stars = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)), new THREE.PointsMaterial({ color: 0xffffff, size: 0.006 }));
        g.add(edges, stars);
      }
      const label = makeLabel(id === 'moon' ? 'The Moon\n⅙ gravity · no air' : s.name, { height: id === 'moon' ? 0.07 : 0.04, size: 44 });
      label.position.set(0, s.depth + 0.04, MAT_D / 2 + 0.03);
      g.add(label);
      this.group.add(g);
      this.mats[id] = g;
    });

    // the ruler
    this.ruler = new THREE.Group();
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.13, RULER_H), new THREE.MeshBasicMaterial({ map: rulerTexture(), toneMapped: false }));
    face.position.set(0.065, RULER_H / 2, 0);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.14, RULER_H + 0.02, 0.012), new THREE.MeshStandardMaterial({ color: 0x8a6a3c, roughness: 0.7 }));
    back.position.set(0.065, RULER_H / 2, -0.008);
    this.ruler.add(face, back);
    this.group.add(this.ruler);
    this.dropLine = levelLine(0x6fb6ff);
    this.bounceLine = levelLine(0xffd166);
    this.group.add(this.dropLine, this.bounceLine);
    this.moveRuler('concrete');

    // the slow-motion ghost of the last drop
    this.ghost = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false }));
    this.ghost.visible = false;
    this.group.add(this.ghost);
    this.replay = null;

    this.dents = new THREE.Group();
    this.group.add(this.dents);
    this.seed = Math.floor(Math.random() * 1e9);
  }

  /** The zone sits on the floor, under and in front of the lab, facing the same way. */
  place(lab, floorY = 0) {
    lab.updateMatrixWorld();
    const p = new THREE.Vector3().setFromMatrixPosition(lab.matrixWorld);
    const q = new THREE.Quaternion().setFromRotationMatrix(lab.matrixWorld);
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
    this.group.rotation.set(0, Math.atan2(fwd.x, fwd.z), 0);
    this.group.position.set(p.x, floorY, p.z);
  }

  moveRuler(surf) {
    const i = SURFACE_IDS.indexOf(surf);
    this.ruler.position.set(matX(i) - MAT_W / 2 + 0.02, topOf(surf), RULER_Z);
    this.rulerSurf = surf;
  }

  /** Which mat is under a point (zone coordinates), or null. */
  matUnder(p) {
    let best = null;
    SURFACE_IDS.forEach((id, i) => {
      if (Math.abs(p.x - matX(i)) <= MAT_W / 2 + 0.02 && Math.abs(p.z) <= MAT_D / 2 + 0.02) best = id;
    });
    return best;
  }

  /** Draw a level line at height y (zone) from the ball at (x, z) to the ruler. */
  setLine(line, x, y, z) {
    const rx = this.ruler.position.x + 0.03;
    const { bar, tick } = line.userData;
    const from = new THREE.Vector3(x, y, z);
    const to = new THREE.Vector3(rx, y, RULER_Z + 0.005);
    bar.position.copy(from).add(to).multiplyScalar(0.5);
    bar.scale.z = Math.max(0.001, from.distanceTo(to));
    bar.lookAt(this.group.localToWorld(to.clone()));
    tick.position.copy(to);
    line.visible = true;
  }

  /** Let a ball go at `p` (zone coordinates). */
  drop(ball, surf, p) {
    this.seed = (this.seed * 1103515245 + 12345) >>> 0;
    const sim = simulate(ball.id, surf, p, this.seed);
    this.moveRuler(surf);
    ball.flight = { sim, t: 0, next: 0 };
    ball.mesh.scale.set(1, 1, 1);
    this.ghost.visible = false;
    this.replay = null;
    this.bounceLine.visible = false;
    this.setLine(this.dropLine, p.x, p.y - BALLS[ball.id].r, p.z);
    return sim;
  }

  clearMarks() {
    this.dropLine.visible = false;
    this.bounceLine.visible = false;
    this.ghost.visible = false;
    this.replay = null;
  }

  /** Every frame: the balls in flight, the slow-motion replay. */
  update(dt, balls) {
    const v = new THREE.Vector3();
    for (const ball of balls) {
      const f = ball.flight;
      if (!f) continue;
      f.t += dt;
      const sim = f.sim;
      ball.mesh.position.copy(sampleAt(sim, f.t, v));
      while (f.next < sim.impacts.length && sim.impacts[f.next].t <= f.t) {
        const im = sim.impacts[f.next];
        bounceSound(sim.ball, sim.surf, im.v);
        if (f.next === 0) this.onFirstImpact(ball, sim, im);
        f.next++;
      }
      if (f.t >= sim.end && !f.rested) {
        f.rested = true;
        f.restT = f.t;
        this.startReplay(ball, sim);
      }
      if (f.rested && f.t - f.restT > 1.4) {
        ball.flight = null;
        this.app.onBallDone(ball);
      }
    }
    // the trampoline sags as it is hit
    if (this.membrane) {
      this.dip = Math.max(0, (this.dip ?? 0) - dt * 0.6);
      this.membrane.position.y = topOf('trampoline') - this.dip * 0.08 * Math.sin(Math.min(Math.PI, this.dip * 12));
    }
    const rp = this.replay;
    if (rp && !rp.frozen) {
      rp.t += dt * SLOW;
      if (rp.t >= rp.sim.topT) {
        rp.t = rp.sim.topT;
        rp.frozen = true;
        const r = BALLS[rp.sim.ball].r;
        sampleAt(rp.sim, rp.t, v);
        this.setLine(this.bounceLine, v.x, v.y - r, v.z);
        this.app.onReplayDone(rp.sim);
      }
      this.ghost.position.copy(sampleAt(rp.sim, rp.t, v));
    }
  }

  onFirstImpact(ball, sim) {
    if (sim.surf === 'trampoline') this.dip = 1;
    if (sim.squash) ball.mesh.scale.set(1.3, 0.6, 1.3);
    if (sim.surf === 'sand') {
      const dent = new THREE.Mesh(new THREE.CircleGeometry(BALLS[sim.ball].r * 1.3, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xb59457, transparent: true, opacity: 0.85 }));
      const p = sampleAt(sim, sim.impacts[0].t, new THREE.Vector3());
      dent.position.set(p.x, topOf('sand') + 0.001, p.z);
      this.dents.add(dent);
      if (this.dents.children.length > 12) {
        const old = this.dents.children[0];
        old.geometry.dispose();
        old.material.dispose();
        this.dents.remove(old);
      }
    }
  }

  startReplay(ball, sim) {
    if (!sim.impacts.length) return;
    this.ghost.scale.setScalar(BALLS[sim.ball].r);
    this.ghost.material.color.set(BALLS[sim.ball].color);
    this.ghost.visible = true;
    this.replay = { sim, t: 0, frozen: false };
  }

  /** Play the slow-motion replay of the last drop again. */
  playAgain() {
    if (!this.replay) return;
    this.replay.t = 0;
    this.replay.frozen = false;
    this.bounceLine.visible = false;
  }
}
