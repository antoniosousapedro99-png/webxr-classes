import * as THREE from 'three';
import { makeLabel } from '../../../../shared/ui/labels.js';
import { FACTORS, V_MAX, RUN, volumeAt } from '../data/kinetics.js';

// The bench changes with the factor being investigated.
//
// Timing rig (temperature, surface area), as in the original lesson: a row of conical flasks of acid, each
// with its own timer. Drop a magnesium strip (or a piece of marble) into a flask: its timer starts, the solid
// fizzes and shrinks, and the timer stops when it has completely gone.
//
// Gas syringe rig (concentration, catalyst): one flask joined to a gas syringe. Choose the acid (or put in a
// catalyst), add the reactant, and the plunger is pushed out by the gas for 30 s.

export const TOP = -0.3;
const ROW_Z = -0.03;
const TRAY_Z = 0.15;
const FLASK_H = 0.11;
const GAS_FLASK = new THREE.Vector3(-0.12, TOP, -0.03);
const SYRINGE = new THREE.Vector3(0.1, TOP + 0.12, -0.05);
const SYR_LEN = 0.2; // 0 → 100 cm³
const SYR_MAX = 100;

const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.5, ...o });
const glass = new THREE.MeshStandardMaterial({ color: 0xd8eeff, transparent: true, opacity: 0.25, roughness: 0.05, side: THREE.DoubleSide, depthWrite: false });

function flaskMesh(liquid = 0xbfe6ff) {
  const pts = [[0, 0], [0.038, 0], [0.04, 0.006], [0.037, 0.018], [0.013, 0.08], [0.011, 0.088], [0.011, FLASK_H]].map(([r, y]) => new THREE.Vector2(r, y));
  const g = new THREE.Group();
  const f = new THREE.Mesh(new THREE.LatheGeometry(pts, 28), glass);
  f.renderOrder = 3;
  const lp = [[0, 0.002], [0.036, 0.002], [0.037, 0.006], [0.034, 0.02], [0.022, 0.05], [0, 0.05]].map(([r, y]) => new THREE.Vector2(r, y));
  const l = new THREE.Mesh(new THREE.LatheGeometry(lp, 28), new THREE.MeshStandardMaterial({ color: liquid, transparent: true, opacity: 0.55, roughness: 0.1 }));
  g.add(l, f);
  g.userData.liquid = l;
  return g;
}

function screen(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return { c, t };
}

function syringeScale() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 96;
  const x = c.getContext('2d');
  x.fillStyle = '#ffffff';
  x.font = '700 30px system-ui, sans-serif';
  x.textAlign = 'center';
  for (let v = 0; v <= SYR_MAX; v += 2) {
    const px = 12 + (1000 * v) / SYR_MAX;
    const big = v % 10 === 0;
    x.fillRect(px - 1.5, 0, 3, big ? 36 : 18);
    if (big) x.fillText(String(v), px, 72);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Bench {
  constructor(app) {
    this.app = app;
    this.group = new THREE.Group();
    app.lab.add(this.group);
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.012, 0.4), mat(0xe9ecf2, { roughness: 0.4 }));
    top.position.set(0, TOP - 0.006, 0.06);
    this.group.add(top);
    this.rig = new THREE.Group();
    this.group.add(this.rig);

    // bubbles
    const n = 300;
    this.fx = { pos: new Float32Array(n * 3), life: new Float32Array(n), stop: new Float32Array(n), n };
    this.bubbles = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(this.fx.pos, 3)), new THREE.PointsMaterial({ color: 0xffffff, size: 0.003, transparent: true, opacity: 0.9, depthWrite: false }));
    this.bubbles.frustumCulled = false;
    this.group.add(this.bubbles);
    this.targetsList = [];
    this.runs = []; // timing runs in progress
    this.gas = null; // the gas syringe run in progress
  }

  // ───────────── building the rig for a factor ─────────────

  setFactor(id) {
    this.factor = id;
    for (const c of [...this.rig.children]) {
      this.rig.remove(c);
      c.traverse((o) => { o.geometry?.dispose?.(); });
    }
    this.targetsList = [];
    this.runs = [];
    this.gas = null;
    this.fx.life.fill(0);
    const f = FACTORS[id];
    if (f.method === 'timing') this.buildTiming(f);
    else this.buildGas(f);
  }

  buildTiming(f) {
    const n = f.options.length;
    this.flasks = f.options.map(([opt, label], i) => {
      const x = (i - (n - 1) / 2) * 0.12 + 0.06;
      const g = flaskMesh(this.factor === 'temperature' ? new THREE.Color().lerpColors(new THREE.Color(0xbfe6ff), new THREE.Color(0xffd0b0), i / (n - 1)).getHex() : 0xbfe6ff);
      g.position.set(x, TOP, ROW_Z);
      const tag = makeLabel(this.factor === 'temperature' ? label : 'Acid', { height: 0.016, size: 40, color: this.factor === 'temperature' ? '#ffb070' : '#ffffff' });
      tag.position.set(0, FLASK_H + 0.02, 0);
      g.add(tag);
      const scr = screen(256, 96);
      const s = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.026), new THREE.MeshBasicMaterial({ map: scr.t, toneMapped: false }));
      s.position.set(0, FLASK_H + 0.05, 0);
      g.add(s);
      this.rig.add(g);
      const flask = { i, opt: this.factor === 'temperature' ? opt : null, group: g, scr, pos: new THREE.Vector3(x, TOP, ROW_Z), run: null, done: null };
      this.drawTimer(flask);
      return flask;
    });
    // the solids to drop in
    this.solids = [];
    if (this.factor === 'temperature') {
      for (let i = 0; i < 6; i++) this.addSolid('mg', null, new THREE.Vector3(-0.38 + i * 0.03, TOP + 0.002, TRAY_Z));
      const t = makeLabel('Magnesium strips', { height: 0.012, size: 36 });
      t.position.set(-0.305, TOP + 0.03, TRAY_Z + 0.04);
      this.rig.add(t);
    } else {
      f.options.forEach(([opt, label], i) => {
        for (let k = 0; k < 2; k++) this.addSolid('marble', opt, new THREE.Vector3(-0.4 + i * 0.09 + k * 0.035, TOP + 0.002, TRAY_Z));
        const t = makeLabel(label, { height: 0.012, size: 36 });
        t.position.set(-0.382 + i * 0.09, TOP + 0.04, TRAY_Z + 0.04);
        this.rig.add(t);
      });
    }
  }

  addSolid(kind, opt, home) {
    let mesh;
    if (kind === 'mg') {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.0012, 0.05), mat(0xc4c8cf, { metalness: 0.7, roughness: 0.3 }));
      mesh.position.copy(home).add(new THREE.Vector3(0, 0.0006, 0));
    } else if (opt === 'lump') {
      mesh = new THREE.Mesh(new THREE.DodecahedronGeometry(0.011, 0), mat(0xf1efe8, { roughness: 0.9 }));
      mesh.position.copy(home).add(new THREE.Vector3(0, 0.009, 0));
    } else if (opt === 'chips') {
      mesh = new THREE.Group();
      for (let i = 0; i < 6; i++) {
        const m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.004, 0), mat(0xf1efe8, { roughness: 0.9 }));
        m.position.set((i % 3) * 0.007 - 0.007, 0.004, Math.floor(i / 3) * 0.007 - 0.0035);
        mesh.add(m);
      }
      mesh.position.copy(home);
    } else {
      mesh = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.007, 20), mat(0xf6f4ee, { roughness: 1 }));
      mesh.position.copy(home).add(new THREE.Vector3(0, 0.0035, 0));
    }
    const solid = { kind, opt, mesh, home: mesh.position.clone(), used: false };
    mesh.traverse((o) => { if (o.isMesh) { o.userData = { handler: this, solid }; this.targetsList.push(o); } });
    this.rig.add(mesh);
    this.solids.push(solid);
    return solid;
  }

  buildGas(f) {
    // flask with bung, tube, and a horizontal gas syringe on a stand
    this.gasFlask = flaskMesh(this.factor === 'catalyst' ? 0xe6f4ff : 0xbfe6ff);
    this.gasFlask.position.copy(GAS_FLASK);
    const bung = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.011, 0.016, 16), mat(0x7a2f2f));
    bung.position.set(0, FLASK_H + 0.004, 0);
    this.gasFlask.add(bung);
    this.rig.add(this.gasFlask);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
      new THREE.Vector3(GAS_FLASK.x, TOP + FLASK_H + 0.012, GAS_FLASK.z),
      new THREE.Vector3(GAS_FLASK.x, SYRINGE.y + 0.02, GAS_FLASK.z),
      new THREE.Vector3(SYRINGE.x - SYR_LEN / 2 - 0.03, SYRINGE.y, SYRINGE.z),
    ]), 24, 0.003, 8), new THREE.MeshStandardMaterial({ color: 0xf4f7ff, transparent: true, opacity: 0.6 }));
    this.rig.add(tube);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, SYR_LEN + 0.02, 24, 1, true).rotateZ(Math.PI / 2), glass);
    barrel.position.copy(SYRINGE);
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.02, 12).rotateZ(Math.PI / 2), glass);
    nozzle.position.set(SYRINGE.x - SYR_LEN / 2 - 0.02, SYRINGE.y, SYRINGE.z);
    const scale = new THREE.Mesh(new THREE.PlaneGeometry(SYR_LEN * 1.02, 0.02), new THREE.MeshBasicMaterial({ map: syringeScale(), transparent: true, toneMapped: false }));
    scale.position.set(SYRINGE.x, SYRINGE.y + 0.026, SYRINGE.z);
    const stand = new THREE.Mesh(new THREE.BoxGeometry(0.01, SYRINGE.y - TOP, 0.01), mat(0x5d6577));
    stand.position.set(SYRINGE.x, (SYRINGE.y + TOP) / 2, SYRINGE.z - 0.02);
    this.plunger = new THREE.Group();
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.006, 20).rotateZ(Math.PI / 2), mat(0x2b2f3a));
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, SYR_LEN, 10).rotateZ(Math.PI / 2), mat(0xdfe3ea));
    rod.position.x = SYR_LEN / 2;
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.004, 20).rotateZ(Math.PI / 2), mat(0x2b2f3a));
    grip.position.x = SYR_LEN;
    this.plunger.add(head, rod, grip);
    this.plunger.position.set(SYRINGE.x - SYR_LEN / 2, SYRINGE.y, SYRINGE.z);
    const sTag = makeLabel('Gas syringe (cm³)', { height: 0.012, size: 36 });
    sTag.position.set(SYRINGE.x, SYRINGE.y + 0.06, SYRINGE.z);
    this.rig.add(barrel, nozzle, scale, stand, this.plunger, sTag);
    this.gasScreen = screen(256, 96);
    const s = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.03), new THREE.MeshBasicMaterial({ map: this.gasScreen.t, toneMapped: false }));
    s.position.set(GAS_FLASK.x, TOP + FLASK_H + 0.06, GAS_FLASK.z);
    this.rig.add(s);
    this.volume = 0;
    this.gasOpt = f.options[this.factor === 'concentration' ? 1 : 0][0];
    this.drawGas();

    // what to choose and add: acid bottles (tap to fill the flask), or catalyst dishes (drag into the flask)
    this.choices = f.options.map(([opt, label], i) => {
      const g = new THREE.Group();
      const x = -0.4 + i * (this.factor === 'concentration' ? 0.07 : 0.1);
      g.position.set(x, TOP, TRAY_Z);
      let pick;
      if (this.factor === 'concentration') {
        pick = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.05, 16), new THREE.MeshStandardMaterial({ color: new THREE.Color().lerpColors(new THREE.Color(0xe6f4ff), new THREE.Color(0x8fc3ff), i / 4), transparent: true, opacity: 0.8 }));
        pick.position.y = 0.025;
      } else if (opt === 'none') {
        pick = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.006, 20), mat(0x3d8bd9));
        pick.position.y = 0.003;
      } else {
        pick = new THREE.Group();
        const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.018, 0.006, 20), mat(0xe8eef4, { transparent: true, opacity: 0.7 }));
        const powder = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.006, 16), mat(opt === 'mno2' ? 0x2a2522 : 0x1d1d1f, { roughness: 1 }));
        powder.position.y = 0.006;
        pick.add(dish, powder);
        pick.position.y = 0.003;
      }
      g.add(pick);
      const tag = makeLabel(this.factor === 'concentration' ? `${label} acid` : opt === 'none' ? 'Start: no catalyst' : label, { height: 0.011, size: 36 });
      tag.position.set(0, 0.075, 0.02);
      g.add(tag);
      this.rig.add(g);
      const choice = { opt, group: g, home: g.position.clone() };
      g.traverse((o) => { if (o.isMesh) { o.userData = { handler: this, choice, tapOnly: this.factor === 'concentration' || opt === 'none' }; this.targetsList.push(o); } });
      return choice;
    });
    if (this.factor === 'concentration') {
      this.solids = [];
      const chips = this.addSolid('marble', 'chips', new THREE.Vector3(0.3, TOP + 0.002, TRAY_Z));
      chips.gasChips = true;
      const t = makeLabel('Marble chips', { height: 0.012, size: 36 });
      t.position.set(0.3, TOP + 0.04, TRAY_Z + 0.04);
      this.rig.add(t);
    }
  }

  get targets() {
    return this.targetsList.filter((o) => {
      const s = o.userData.solid;
      return !s || !s.used;
    });
  }

  near(p, target, r) {
    if (this.app.presenting) return p.distanceTo(target) < r;
    const cam = this.app.camera;
    const a = this.group.localToWorld(p.clone()).project(cam);
    const b = this.group.localToWorld(target.clone()).project(cam);
    return Math.hypot((a.x - b.x) * cam.aspect, a.y - b.y) < r * 2.2;
  }

  describe(o) {
    const u = o.userData;
    if (u.solid) return u.solid.kind === 'mg' ? 'Magnesium strip · drop it into a flask' : 'Marble · drop it into a flask';
    if (u.choice) {
      const label = FACTORS[this.factor].options.find(([id]) => id === u.choice.opt)[1];
      if (this.factor === 'concentration') return `${label} acid · tap to fill the flask`;
      return u.choice.opt === 'none' ? 'Tap to start with no catalyst' : `${label} · drag it into the flask`;
    }
    return '';
  }

  tap(o) {
    const c = o.userData.choice;
    if (!c) return;
    if (this.factor === 'concentration') this.app.chooseAcid(c.opt);
    else if (c.opt === 'none') this.startGas('none');
  }

  grab(o, mode, world) {
    const u = o.userData;
    const obj = u.solid ? u.solid.mesh : u.choice?.group;
    if (!obj || (u.solid && u.solid.used) || u.tapOnly) return null;
    if (u.choice && this.gas) return null;
    const home = obj.position.clone();
    const off = obj.position.clone().sub(this.group.worldToLocal(world.clone()));
    return {
      move: (w) => {
        obj.position.copy(this.group.worldToLocal(w.clone())).add(off);
        obj.position.y = Math.max(TOP + 0.002, obj.position.y);
      },
      release: () => {
        const p = obj.position.clone();
        obj.position.copy(home);
        if (u.solid && FACTORS[this.factor].method === 'timing') {
          const f = this.flasks.find((fl) => this.near(p, fl.pos.clone().setY(TOP + 0.06), 0.05));
          if (f) this.startTiming(f, u.solid);
        } else if (u.solid?.gasChips) {
          if (this.near(p, GAS_FLASK.clone().setY(TOP + 0.06), 0.06)) this.startGas(this.gasOpt);
        } else if (u.choice && this.near(p, GAS_FLASK.clone().setY(TOP + 0.06), 0.06)) this.startGas(u.choice.opt);
      },
    };
  }

  // ───────────── timing runs ─────────────

  startTiming(flask, solid) {
    if (flask.run) {
      this.app.busyFlask();
      return;
    }
    const opt = this.factor === 'temperature' ? flask.opt : solid.opt;
    const f = FACTORS[this.factor];
    const dur = f.seconds(opt) * (1 + (Math.random() - 0.5) * 0.1);
    // a fresh solid in the flask (the one on the tray is replaced)
    solid.used = true;
    solid.mesh.visible = false;
    const copy = this.addSolid(solid.kind, solid.opt, solid.home.clone());
    copy.used = true;
    copy.mesh.position.set(flask.pos.x, TOP + 0.006, flask.pos.z);
    copy.mesh.rotation.y = Math.random() * 3;
    if (solid.kind === 'mg') copy.mesh.rotation.x = 0.3;
    flask.run = { t: 0, dur, opt, solid: copy, kind: solid.kind };
    flask.done = null;
    // put the tray's piece back for another go
    setTimeout(() => { solid.used = false; solid.mesh.visible = true; }, 400);
    this.app.onStarted(opt);
  }

  drawTimer(flask) {
    const { c, t } = flask.scr;
    const x = c.getContext('2d');
    x.fillStyle = '#132416';
    x.fillRect(0, 0, 256, 96);
    const v = flask.run ? flask.run.t : flask.done;
    x.fillStyle = flask.run ? '#ffd166' : flask.done != null ? '#7eff9e' : '#3d6b55';
    x.font = '700 58px ui-monospace, Consolas, monospace';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(v == null ? '--.- s' : `${v.toFixed(1)} s`, 128, 50);
    t.needsUpdate = true;
  }

  // ───────────── gas syringe runs ─────────────

  chooseAcid(opt) {
    if (this.gas) return false;
    this.gasOpt = opt;
    const i = FACTORS.concentration.options.findIndex(([id]) => id === opt);
    this.gasFlask.userData.liquid.material.color.lerpColors(new THREE.Color(0xe6f4ff), new THREE.Color(0x8fc3ff), i / 4);
    this.volume = 0;
    this.plunger.position.x = SYRINGE.x - SYR_LEN / 2;
    this.drawGas();
    return true;
  }

  startGas(opt) {
    if (this.gas) {
      this.app.busyFlask();
      return;
    }
    const f = FACTORS[this.factor];
    this.gasOpt = opt;
    this.volume = 0;
    this.gas = { opt, t: 0, k: f.k(opt) * (1 + (Math.random() - 0.5) * 0.1), points: [[0, 0]] };
    this.app.onStarted(opt);
  }

  drawGas() {
    const { c, t } = this.gasScreen;
    const x = c.getContext('2d');
    x.fillStyle = '#132416';
    x.fillRect(0, 0, 256, 96);
    x.fillStyle = this.gas ? '#ffd166' : '#7eff9e';
    x.font = '700 44px ui-monospace, Consolas, monospace';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(`${(this.gas ? this.gas.t : this.lastT ?? 0).toFixed(1)} s`, 128, 48);
    t.needsUpdate = true;
  }

  // ───────────── every frame ─────────────

  bubble(p, top, rate, dt) {
    this.acc = (this.acc ?? 0) + rate * dt;
    const f = this.fx;
    while (this.acc >= 1) {
      this.acc--;
      for (let i = 0; i < f.n; i++) {
        if (f.life[i] > 0) continue;
        f.life[i] = 1;
        f.stop[i] = top;
        f.pos.set([p.x + (Math.random() - 0.5) * 0.02, p.y, p.z + (Math.random() - 0.5) * 0.02], i * 3);
        break;
      }
    }
  }

  update(dt) {
    if (this.flasks && FACTORS[this.factor].method === 'timing') {
      for (const fl of this.flasks) {
        const r = fl.run;
        if (!r) continue;
        r.t += dt;
        const k = Math.min(1, r.t / r.dur);
        r.solid.mesh.scale.setScalar(Math.max(0.02, 1 - k));
        this.bubble(new THREE.Vector3(fl.pos.x, TOP + 0.008, fl.pos.z), TOP + 0.05, (12 / r.dur) * 25 * (1 - k * 0.5), dt);
        if (r.t >= r.dur) {
          fl.done = Math.round(r.t * 10) / 10;
          fl.run = null;
          r.solid.mesh.removeFromParent();
          this.app.onTimed(r.opt, fl.done);
        }
        this.drawTimer(fl);
      }
    }
    if (this.gas) {
      const g = this.gas;
      g.t = Math.min(RUN, g.t + dt);
      const v = volumeAt(g.k, g.t);
      this.volume = v;
      if (g.points.length === 0 || g.t - g.points[g.points.length - 1][0] >= 1) g.points.push([Math.round(g.t), Math.round(v * 10) / 10]);
      this.plunger.position.x = SYRINGE.x - SYR_LEN / 2 + (SYR_LEN * Math.min(SYR_MAX, v)) / SYR_MAX;
      this.bubble(new THREE.Vector3(GAS_FLASK.x, TOP + 0.008, GAS_FLASK.z), TOP + 0.05, Math.min(60, g.k * V_MAX * 25 * Math.exp(-g.k * g.t) + 1), dt);
      this.drawGas();
      if (g.t >= RUN) {
        this.gas = null;
        this.lastT = RUN;
        this.app.onGas(g.opt, Math.round(v * 10) / 10, g.points);
        this.drawGas();
      }
    }
    const f = this.fx;
    for (let i = 0; i < f.n; i++) {
      if (f.life[i] <= 0) {
        f.pos[i * 3 + 1] = -100;
        continue;
      }
      f.pos[i * 3 + 1] += dt * 0.06;
      if (f.pos[i * 3 + 1] > f.stop[i]) f.life[i] = 0;
    }
    this.bubbles.geometry.attributes.position.needsUpdate = true;
  }

  /** Without the mouse (buttons and tests). */
  quick(opt) {
    if (FACTORS[this.factor].method === 'timing') {
      const flask = this.factor === 'temperature' ? this.flasks.find((fl) => fl.opt === opt) : this.flasks.find((fl) => !fl.run);
      const solid = this.solids.find((s) => !s.used && (this.factor === 'temperature' || s.opt === opt));
      if (flask && solid) this.startTiming(flask, solid);
    } else {
      if (this.factor === 'concentration') this.chooseAcid(opt);
      this.startGas(opt);
    }
  }
}
