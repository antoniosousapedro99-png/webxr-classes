import * as THREE from 'three';
import { GEO } from './Heart.js';
import { T } from '../data/heart.js';

// Blood cells flowing through the heart, in time with the valves: they wait in the atria while the AV
// valves are shut, pour into the ventricles when they open, and are pushed out into the arteries only
// while the semilunar valves are open. Blue = deoxygenated, red = oxygenated.
// Extra flows for the conditions: back through a leaky mitral valve, through a hole in the septum, and
// along the narrowed coronary artery.

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const COLORS = { deoxy: 0x3d6dff, oxy: 0xff2b2b, mix: 0xb244c8 };

/** A path through waypoints, with the radius blood spreads over at each (chambers are wide, vessels narrow). */
class Path {
  constructor(points, radii, gates = {}) {
    this.curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
    this.len = this.curve.getLength();
    const N = 300;
    this.samples = this.curve.getSpacedPoints(N);
    // where along the path (0–1) each waypoint is, to spread radii and find the valve gates
    const at = (p) => {
      let best = 0;
      let bd = Infinity;
      this.samples.forEach((s, i) => {
        const d = s.distanceToSquared(p);
        if (d < bd) {
          bd = d;
          best = i;
        }
      });
      return best / N;
    };
    this.wpU = points.map(at);
    this.radii = radii;
    this.gates = Object.fromEntries(Object.entries(gates).map(([k, p]) => [k, at(p)]));
  }

  radius(u) {
    const w = this.wpU;
    for (let i = 0; i < w.length - 1; i++) {
      if (u <= w[i + 1]) {
        const t = (u - w[i]) / Math.max(1e-6, w[i + 1] - w[i]);
        return this.radii[i] + (this.radii[i + 1] - this.radii[i]) * t;
      }
    }
    return this.radii.at(-1);
  }
}

const VAL = GEO.valves;

function paths() {
  const ra = GEO.RA.c;
  const la = GEO.LA.c;
  const rv = V(-0.1, -0.15, 0.08);
  const rvLow = V(-0.06, -0.33, 0.08);
  const lv = V(0.1, -0.15, -0.04);
  const lvLow = V(0.18, -0.38, -0.02);
  const rvOut = V(0.0, 0.05, 0.15);
  const lvOut = V(-0.01, 0.05, -0.03);
  const pa = GEO.paTrunk;
  const ao = GEO.aorta;
  const deoxy = [];
  for (const inlet of [[GEO.svc[0], GEO.svc[1]], [GEO.ivc[0], GEO.ivc[1]]]) {
    for (const out of [GEO.paLeft, GEO.paRight]) {
      deoxy.push(new Path(
        [...inlet, ra, VAL.tricuspid.c, rv, rvLow, rvOut, VAL.pulmonaryValve.c, pa[1], pa[2], ...out.slice(1)],
        [0.02, 0.03, 0.11, 0.03, 0.1, 0.06, 0.04, 0.02, 0.03, 0.03, ...out.slice(1).map(() => 0.025)],
        { av: VAL.tricuspid.c, sl: VAL.pulmonaryValve.c },
      ));
    }
  }
  const oxy = [];
  for (const vein of GEO.pulmVeins) {
    for (const out of [[ao[3], ao[4], ao[5], ao[6], ao[7]], [ao[3], GEO.aortaBranches[1][1]]]) {
      oxy.push(new Path(
        [vein[0], vein.at(-1), la, VAL.mitral.c, lv, lvLow, lvOut, VAL.aorticValve.c, ao[1], ao[2], ...out],
        [0.02, 0.025, 0.1, 0.03, 0.11, 0.06, 0.04, 0.02, 0.035, 0.035, ...out.map(() => 0.03)],
        { av: VAL.mitral.c, sl: VAL.aorticValve.c },
      ));
    }
  }
  return {
    deoxy,
    oxy,
    leak: new Path([lv, VAL.mitral.c, la.clone().add(V(0, 0.02, 0.06))], [0.05, 0.02, 0.08]),
    vsd: new Path([lv, GEO.septumHole, rv.clone().add(V(0, 0.05, 0))], [0.04, 0.012, 0.07]),
  };
}

export class Blood {
  /** heart: a Heart (for the coronary artery path); parent: the heart's model group. */
  constructor(heart, parent, { count = 70 } = {}) {
    this.heart = heart;
    this.group = new THREE.Group();
    parent.add(this.group);
    this.paths = paths();
    this.lad = new Path(heart.ladPts, heart.ladPts.map(() => 0.004));
    const dot = new THREE.SphereGeometry(0.017, 8, 6);
    const make = (kind, n, color, size = 1) => {
      const mesh = new THREE.InstancedMesh(size === 1 ? dot : new THREE.SphereGeometry(0.017 * size, 6, 5), new THREE.MeshBasicMaterial({ color, toneMapped: false }), n);
      mesh.frustumCulled = false;
      this.group.add(mesh);
      const cells = [];
      for (let i = 0; i < n; i++) {
        const off = new THREE.Vector3().randomDirection().multiplyScalar(Math.cbrt(Math.random()));
        cells.push({ u: Math.random(), path: null, off, hold: Math.random(), on: kind !== 'leak' && kind !== 'vsd' });
      }
      return { kind, mesh, cells };
    };
    this.sets = {
      deoxy: make('deoxy', count, COLORS.deoxy),
      oxy: make('oxy', count, COLORS.oxy),
      leak: make('leak', 18, COLORS.oxy),
      vsd: make('vsd', 18, COLORS.mix),
      coronary: make('coronary', 26, 0xff4040, 0.45),
    };
    for (const s of [this.sets.deoxy, this.sets.oxy]) {
      for (const c of s.cells) c.path = this.paths[s.kind][Math.floor(Math.random() * this.paths[s.kind].length)];
    }
    for (const c of this.sets.leak.cells) c.path = this.paths.leak;
    for (const c of this.sets.vsd.cells) c.path = this.paths.vsd;
    for (const c of this.sets.coronary.cells) c.path = this.lad;
    this.show = 'none'; // 'none' | 'deoxy' | 'oxy' | 'both'
    this.coronary = false;
    this.m = new THREE.Matrix4();
    this.p = new THREE.Vector3();
  }

  /** dt: seconds of heart time (already slowed down); f: phase of the beat; cond: the condition shown. */
  update(dt, f, cond) {
    const show = this.show;
    const sys = f > T.avClose && f < T.slClose; // ventricles squeezing
    this.sets.deoxy.mesh.visible = show === 'deoxy' || show === 'both';
    this.sets.oxy.mesh.visible = show === 'oxy' || show === 'both';
    this.sets.leak.mesh.visible = show !== 'none' && cond === 'mitral';
    this.sets.vsd.mesh.visible = show !== 'none' && cond === 'vsd';
    this.sets.coronary.mesh.visible = this.coronary;
    const avOpen = f < T.avClose || f > T.avOpen;
    const slOpen = f > T.slOpen && f < T.slClose;

    for (const kind of ['deoxy', 'oxy']) {
      const s = this.sets[kind];
      if (!s.mesh.visible) continue;
      for (const c of s.cells) {
        const g = c.path.gates;
        let v;
        if (c.u < g.av) v = 0.16; // veins and atrium: steady inflow
        else if (c.u < g.sl) v = sys ? 0.5 : 0.22; // in the ventricle
        else v = slOpen ? 0.9 : 0.12; // in the artery: surges with each beat
        let u = c.u + v * dt * (0.3 / c.path.len);
        // valves: wait behind a shut one (spread out, so they fill the chamber rather than one spot)
        if (c.u < g.av && u >= g.av - 0.01 && !avOpen) u = Math.min(u, g.av - 0.01 - c.hold * 0.12);
        else if (c.u < g.sl && c.u >= g.av && u >= g.sl - 0.01 && !slOpen) u = Math.min(u, g.sl - 0.01 - c.hold * 0.16);
        c.u = Math.max(c.u, u);
        if (c.u >= 1) {
          c.u = 0;
          c.path = this.paths[kind][Math.floor(Math.random() * this.paths[kind].length)];
        }
        this.place(s, c);
      }
      s.mesh.instanceMatrix.needsUpdate = true;
    }

    // backflow (leaky mitral valve) and flow through the hole in the septum: while the ventricles squeeze
    for (const kind of ['leak', 'vsd']) {
      const s = this.sets[kind];
      if (!s.mesh.visible) continue;
      s.cells.forEach((c, i) => {
        if (sys && !c.on && Math.random() < dt * 18) {
          c.on = true;
          c.u = 0;
        }
        if (c.on) c.u += dt * 1.6 * (0.6 + c.hold * 0.8);
        if (c.u >= 1) c.on = false;
        if (!c.on) this.m.makeScale(0, 0, 0);
        this.place(s, c, !c.on);
        void i;
      });
      s.mesh.instanceMatrix.needsUpdate = true;
    }

    // the coronary artery: blood slows at the narrowing; a clot stops it altogether
    const s = this.sets.coronary;
    if (s.mesh.visible) {
      const stop = 0.38;
      for (const c of s.cells) {
        const past = c.u > stop;
        const slow = (cond === 'chd' || cond === 'attack') && !past ? 0.35 : 1;
        let u = c.u + dt * 0.35 * slow * (0.6 + c.hold * 0.8);
        if (cond === 'attack' && c.u < stop) u = Math.min(u, stop - 0.02 - c.hold * 0.12);
        c.u = u >= 1 ? 0 : u;
        // beyond a full blockage there is no blood
        this.place(s, c, cond === 'attack' && c.u > stop);
      }
      s.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  place(s, c, hide = false) {
    const i = s.cells.indexOf(c);
    if (hide) {
      this.m.makeScale(0, 0, 0);
    } else {
      c.path.curve.getPointAt(Math.min(1, c.u), this.p);
      this.p.addScaledVector(c.off, c.path.radius(c.u));
      this.m.makeTranslation(this.p.x, this.p.y, this.p.z);
    }
    s.mesh.setMatrixAt(i, this.m);
  }
}
