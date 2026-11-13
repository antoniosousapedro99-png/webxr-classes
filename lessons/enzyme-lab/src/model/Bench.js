import * as THREE from 'three';
import { makeLabel } from '../../../../shared/ui/labels.js';
import { V_MAX, CYL, RUN, MARKS, rateConstant } from '../data/enzymes.js';

// The bench, set up as in the original lesson: a piece of liver and a scalpel on a white tile, a conical
// flask of hydrogen peroxide on a hot plate (− / + buttons), a stopper whose delivery tube runs to an
// upside-down measuring cylinder standing in a trough of water.
//
// Cut the liver, drop half of it in the flask, put the stopper on: the oxygen made by the catalase bubbles
// across and pushes the water down the cylinder. The stopwatch starts when the stopper goes on; every 30 s a
// red ring marks the water level on the cylinder, for students to read.

export const TOP = -0.3;
const TILE = new THREE.Vector3(-0.3, TOP, 0.1);
const PLATE = new THREE.Vector3(-0.07, TOP, -0.04);
const PLATE_H = 0.04;
const FLASK_H = 0.13;
const MOUTH = new THREE.Vector3(PLATE.x, TOP + PLATE_H + FLASK_H, PLATE.z);
const FLASK_MID = new THREE.Vector3(PLATE.x, TOP + PLATE_H + 0.06, PLATE.z);
const STOPPER_HOME = new THREE.Vector3(0.06, TOP + 0.011, 0.13);
const TROUGH = new THREE.Vector3(0.24, TOP, -0.03);
const TROUGH_H = 0.06;
const CYL_R = 0.013;
const CYL_BOTTOM = TOP + 0.012; // open end, under water
const CYL_LEN = 0.16;
const SCALE_TOP = CYL_BOTTOM + CYL_LEN - 0.012; // 0 cm³ (the closed end is at the top)
const SCALE_LEN = 0.12; // 0 → 50 cm³

const glass = new THREE.MeshStandardMaterial({ color: 0xd8eeff, transparent: true, opacity: 0.25, roughness: 0.05, side: THREE.DoubleSide, depthWrite: false });
const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.5, ...o });

function flaskProfile(scale = 1) {
  const pts = [[0, 0], [0.045, 0], [0.047, 0.006], [0.044, 0.02], [0.016, 0.095], [0.013, 0.105], [0.013, 0.13]];
  return pts.map(([r, y]) => new THREE.Vector2(r * scale, y));
}

/** Radius of the flask's inside at height y (for the liquid). */
function flaskR(y) {
  const p = flaskProfile();
  for (let i = 1; i < p.length; i++) if (y <= p[i].y) return p[i - 1].x + ((p[i].x - p[i - 1].x) * (y - p[i - 1].y)) / (p[i].y - p[i - 1].y);
  return 0.013;
}

function scaleTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 1024;
  const x = c.getContext('2d');
  x.clearRect(0, 0, 128, 1024);
  const top = 40;
  const len = 1024 - 80;
  x.fillStyle = '#ffffff';
  x.font = '700 40px system-ui, sans-serif';
  x.textBaseline = 'middle';
  for (let v = 0; v <= CYL; v++) {
    const y = top + (len * v) / CYL;
    const w = v % 10 === 0 ? 50 : v % 5 === 0 ? 34 : 20;
    x.fillRect(0, y - (v % 10 === 0 ? 2.5 : 1.5), w, v % 10 === 0 ? 5 : 3);
    if (v % 10 === 0) x.fillText(String(v), 58, y);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return { tex: t, pad: top / 1024 };
}

function panelTexture(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return { c, t };
}

export class Bench {
  constructor(app) {
    this.app = app;
    this.group = new THREE.Group();
    app.lab.add(this.group);

    const top = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.012, 0.38), mat(0xe9ecf2, { roughness: 0.4 }));
    top.position.set(0, TOP - 0.006, 0.05);
    const tile = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.004, 0.12), mat(0xffffff, { roughness: 0.3 }));
    tile.position.set(TILE.x, TOP + 0.002, TILE.z);
    this.group.add(top, tile);

    // scalpel (its origin is the tip of the blade)
    this.scalpel = new THREE.Group();
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.007, 0.011), mat(0x2f6bd8));
    handle.position.x = -0.068;
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.002, 0.009), mat(0xdfe3ea, { metalness: 0.9, roughness: 0.2 }));
    blade.position.x = -0.014;
    this.scalpel.add(handle, blade);
    for (const m of [handle, blade]) m.userData = { handler: this, scalpel: true };
    this.scalpelPicks = [handle, blade];
    this.scalpelHome = new THREE.Vector3(TILE.x + 0.05, TOP + 0.008, TILE.z + 0.075);
    this.scalpel.position.copy(this.scalpelHome);
    this.group.add(this.scalpel);

    // liver
    this.liverMat = mat(0x6e1a1c, { roughness: 0.35 });
    this.whole = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 14), this.liverMat);
    this.whole.scale.set(0.05, 0.016, 0.032);
    this.whole.position.set(TILE.x - 0.01, TOP + 0.016, TILE.z - 0.005);
    this.whole.userData = { handler: this, whole: true, tapOnly: true };
    this.group.add(this.whole);
    this.halves = [];

    // hot plate
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.15, PLATE_H, 0.15), mat(0x2f6bd8));
    plate.position.set(PLATE.x, TOP + PLATE_H / 2, PLATE.z);
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.004, 0.13), mat(0xb9bec8, { metalness: 0.6, roughness: 0.3 }));
    pad.position.set(PLATE.x, TOP + PLATE_H + 0.002, PLATE.z);
    this.group.add(plate, pad);
    this.display = panelTexture(256, 96);
    const disp = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.0225), new THREE.MeshBasicMaterial({ map: this.display.t, toneMapped: false }));
    disp.position.set(PLATE.x, TOP + PLATE_H / 2, PLATE.z + 0.0755);
    this.group.add(disp);
    this.buttons = [-1, 1].map((d) => {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.006, 20).rotateX(Math.PI / 2), mat(d > 0 ? 0xd94b4b : 0x3d8bd9));
      b.position.set(PLATE.x + d * 0.05, TOP + PLATE_H / 2, PLATE.z + 0.078);
      b.userData = { handler: this, plate: d, tapOnly: true };
      const l = makeLabel(d > 0 ? '+' : '−', { height: 0.014, size: 48, bg: null });
      l.position.set(b.position.x, b.position.y, b.position.z + 0.006);
      this.group.add(b, l);
      return b;
    });

    // flask of hydrogen peroxide
    const flask = new THREE.Mesh(new THREE.LatheGeometry(flaskProfile(), 32), glass);
    flask.position.set(PLATE.x, TOP + PLATE_H + 0.004, PLATE.z);
    flask.renderOrder = 3;
    this.flaskBase = TOP + PLATE_H + 0.004;
    const fill = 0.045;
    const lp = flaskProfile(0.94).filter((p) => p.y < fill);
    lp.push(new THREE.Vector2(flaskR(fill) * 0.94, fill), new THREE.Vector2(0, fill));
    this.liquid = new THREE.Mesh(new THREE.LatheGeometry(lp, 32), new THREE.MeshStandardMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.55, roughness: 0.1 }));
    this.liquid.position.copy(flask.position);
    this.liquidTop = this.flaskBase + fill;
    const fTag = makeLabel('Hydrogen peroxide', { height: 0.012, size: 36 });
    fTag.position.set(PLATE.x, TOP + PLATE_H + FLASK_H + 0.05, PLATE.z);
    this.group.add(this.liquid, flask, fTag);

    // stopper and delivery tube
    this.stopper = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.011, 0.022, 20), mat(0xf2c12e, { roughness: 0.7 }));
    this.stopper.userData = { handler: this, stopper: true };
    this.stopper.position.copy(STOPPER_HOME);
    this.group.add(this.stopper);
    this.tubeMat = new THREE.MeshStandardMaterial({ color: 0xf4f7ff, transparent: true, opacity: 0.6, roughness: 0.2 });
    this.tube = new THREE.Mesh(new THREE.BufferGeometry(), this.tubeMat);
    this.group.add(this.tube);
    this.tubeKey = '';

    // trough and upside-down measuring cylinder
    const water = mat(0x6fb8ff, { transparent: true, opacity: 0.35, depthWrite: false });
    const troughWater = new THREE.Mesh(new THREE.BoxGeometry(0.15, TROUGH_H - 0.01, 0.13), water);
    troughWater.position.set(TROUGH.x, TOP + (TROUGH_H - 0.01) / 2, TROUGH.z);
    const troughGlass = new THREE.Mesh(new THREE.BoxGeometry(0.16, TROUGH_H, 0.14), glass);
    troughGlass.position.set(TROUGH.x, TOP + TROUGH_H / 2, TROUGH.z);
    troughGlass.renderOrder = 3;
    this.group.add(troughWater, troughGlass);
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(CYL_R, CYL_R, CYL_LEN, 28, 1, true), glass);
    cyl.position.set(TROUGH.x, CYL_BOTTOM + CYL_LEN / 2, TROUGH.z);
    cyl.renderOrder = 3;
    const cap = new THREE.Mesh(new THREE.CircleGeometry(CYL_R, 28).rotateX(-Math.PI / 2), glass);
    cap.position.set(TROUGH.x, CYL_BOTTOM + CYL_LEN, TROUGH.z);
    const clamp = new THREE.Mesh(new THREE.BoxGeometry(0.008, CYL_LEN + 0.04, 0.008), mat(0x5d6577));
    clamp.position.set(TROUGH.x + 0.06, TOP + (CYL_LEN + 0.04) / 2, TROUGH.z - 0.05);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.006, 0.006), mat(0x5d6577));
    arm.position.set(TROUGH.x + 0.03, CYL_BOTTOM + CYL_LEN * 0.7, TROUGH.z - 0.025);
    arm.rotation.y = 0.7;
    this.group.add(cyl, cap, clamp, arm);
    this.cylWater = new THREE.Mesh(new THREE.CylinderGeometry(CYL_R * 0.92, CYL_R * 0.92, 1, 24), mat(0x6fb8ff, { transparent: true, opacity: 0.55, depthWrite: false }));
    this.group.add(this.cylWater);
    const sc = scaleTexture();
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(0.026, SCALE_LEN / (1 - 2 * sc.pad)), new THREE.MeshBasicMaterial({ map: sc.tex, transparent: true, toneMapped: false }));
    strip.position.set(TROUGH.x + 0.003, SCALE_TOP - SCALE_LEN / 2, TROUGH.z + CYL_R + 0.0015);
    strip.renderOrder = 4;
    const cTag = makeLabel('cm³ of gas', { height: 0.011, size: 36 });
    cTag.position.set(TROUGH.x, CYL_BOTTOM + CYL_LEN + 0.025, TROUGH.z);
    this.group.add(strip, cTag);
    this.marks = new THREE.Group();
    this.group.add(this.marks);

    // bubbles
    const n = 220;
    this.bub = { pos: new Float32Array(n * 3), life: new Float32Array(n), kind: new Uint8Array(n), n, acc: 0, acc2: 0 };
    const geo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(this.bub.pos, 3));
    this.bubbles = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.0035, transparent: true, opacity: 0.85, depthWrite: false }));
    this.bubbles.frustumCulled = false;
    this.group.add(this.bubbles);

    this.T = 30;
    this.reset(true);
  }

  get targets() {
    const t = [...this.buttons, ...this.scalpelPicks, this.stopper];
    if (this.whole.visible) t.push(this.whole);
    for (const h of this.halves) if (h.userData.where !== 'flask') t.push(h);
    return t;
  }

  /** A fresh flask of peroxide, a refilled cylinder, the stopper off. Keeps a half liver if there is one. */
  reset(newLiver = false) {
    for (const h of [...this.halves]) {
      if (h.userData.where === 'flask' || newLiver) {
        this.group.remove(h);
        this.halves.splice(this.halves.indexOf(h), 1);
      }
    }
    if (newLiver || !this.halves.length) {
      this.whole.visible = true;
      this.halves = [];
    }
    this.x = 0; // share of the peroxide used up
    this.x0 = 0; // … when the stopper went on
    this.inFlask = false;
    this.stopperOn = false;
    this.t = 0;
    this.timing = false;
    this.readings = [];
    this.stopper.position.copy(STOPPER_HOME);
    this.stopper.rotation.set(0, 0, 0);
    for (const m of [...this.marks.children]) this.marks.remove(m);
    this.bub.life.fill(0);
    this.drawDisplay();
  }

  /** cm³ of oxygen in the cylinder. */
  get volume() {
    return this.stopperOn ? V_MAX * (this.x - this.x0) : 0;
  }

  setT(T) {
    this.T = T;
    this.drawDisplay();
  }

  drawDisplay() {
    const { c, t } = this.display;
    const x = c.getContext('2d');
    x.fillStyle = '#10141c';
    x.fillRect(0, 0, 256, 96);
    x.fillStyle = '#ff6b5a';
    x.font = '700 64px ui-monospace, Consolas, monospace';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(`${this.T}°C`, 128, 52);
    t.needsUpdate = true;
  }

  // ───────────── handling ─────────────

  describe(o) {
    const u = o.userData;
    if (u.scalpel) return 'Scalpel · drag the blade across the liver';
    if (u.whole) return 'Liver · cut it in half with the scalpel';
    if (u.half) return 'Half of the liver · put it in the flask';
    if (u.stopper) return this.stopperOn ? 'Stopper (on the flask)' : 'Stopper · put it on the flask';
    if (u.plate) return u.plate > 0 ? 'Hotter' : 'Colder';
    return '';
  }

  tap(o) {
    const u = o.userData;
    if (u.plate) this.app.nudgeT(u.plate);
  }

  /** Close enough? In the headset, really close; on a screen, close on the screen. */
  near(p, target, r) {
    if (this.app.presenting) return p.distanceTo(target) < r;
    const cam = this.app.camera;
    const a = this.group.localToWorld(p.clone()).project(cam);
    const b = this.group.localToWorld(target.clone()).project(cam);
    return Math.hypot((a.x - b.x) * cam.aspect, a.y - b.y) < r * 1.6;
  }

  follow(obj, world) {
    const off = obj.position.clone().sub(this.group.worldToLocal(world.clone()));
    return (w) => {
      obj.position.copy(this.group.worldToLocal(w.clone())).add(off);
      obj.position.y = Math.max(TOP + 0.004, obj.position.y);
    };
  }

  grab(o, mode, world) {
    const u = o.userData;
    if (u.scalpel) {
      const move = this.follow(this.scalpel, world);
      return {
        move: (w) => {
          move(w);
          // any part of the blade over the liver cuts it
          // (on a screen, where depth is hard to judge, any part of the scalpel over the liver will do)
          const along = this.app.presenting ? [0, -0.014, -0.028] : [0, -0.02, -0.04, -0.06, -0.08, -0.1];
          if (this.whole.visible && along.some((x) => this.near(this.scalpel.position.clone().add(new THREE.Vector3(x, 0, 0)), this.whole.position, 0.045))) this.cut();
        },
        release: () => {
          this.scalpel.position.copy(this.scalpelHome);
        },
      };
    }
    if (u.half) {
      if (u.where === 'flask') return null;
      const move = this.follow(o, world);
      u.where = 'held';
      return {
        move,
        release: () => {
          const over = this.near(o.position, MOUTH, 0.07) || this.near(o.position, FLASK_MID, 0.07);
          if (over && !this.inFlask && !this.stopperOn) this.liverIn(o);
          else {
            u.where = 'tile';
            o.position.copy(u.home);
            if (this.inFlask) this.app.oneAtATime();
          }
        },
      };
    }
    if (u.stopper) {
      if (this.stopperOn) return null;
      const move = this.follow(this.stopper, world);
      return {
        move,
        release: () => {
          const over = this.near(this.stopper.position, MOUTH, 0.06) || this.near(this.stopper.position, FLASK_MID, 0.06);
          if (over && this.inFlask) this.stopperIn();
          else {
            this.stopper.position.copy(STOPPER_HOME);
            if (over) this.app.liverFirst();
          }
        },
      };
    }
    return null;
  }

  cut() {
    this.whole.visible = false;
    const base = this.whole.position;
    this.halves = [-1, 1].map((d) => {
      const h = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), this.liverMat);
      h.scale.set(0.024, 0.015, 0.03);
      const home = new THREE.Vector3(base.x + d * 0.034, base.y, base.z);
      h.position.copy(home);
      h.userData = { handler: this, half: true, where: 'tile', home };
      this.group.add(h);
      return h;
    });
    this.app.onStep('cut');
  }

  liverIn(h) {
    h.userData.where = 'flask';
    h.position.set(PLATE.x + 0.006, this.flaskBase + 0.012, PLATE.z);
    h.scale.multiplyScalar(0.8);
    this.inFlask = true;
    this.app.onStep('liver');
  }

  stopperIn() {
    this.stopperOn = true;
    this.stopper.position.set(MOUTH.x, MOUTH.y + 0.002, MOUTH.z);
    this.x0 = this.x;
    this.t = 0;
    this.timing = true;
    this.app.onStep('stopper');
  }

  /** The three steps by button (for tests and for anyone who can't reach). */
  quickCut() {
    if (this.whole.visible) this.cut();
  }

  quickLiver() {
    const h = this.halves.find((x) => x.userData.where === 'tile');
    if (h && !this.inFlask) this.liverIn(h);
  }

  quickStopper() {
    if (this.inFlask && !this.stopperOn) this.stopperIn();
  }

  // ───────────── every frame ─────────────

  update(dt) {
    // the reaction
    const k = this.inFlask ? rateConstant(this.T) * (this.app.jitter ?? 1) : 0;
    const dx = k * (1 - this.x) * dt;
    this.x = Math.min(1, this.x + dx);
    if (this.timing) {
      const before = this.t;
      this.t = Math.min(RUN, this.t + dt);
      for (const m of MARKS) if (before < m && this.t >= m) this.mark(m);
      if (this.t >= RUN) {
        this.timing = false;
        this.app.onRunDone();
      }
    }
    // water level in the cylinder
    const v = Math.min(CYL + 4, this.volume);
    const level = SCALE_TOP - (SCALE_LEN * v) / CYL;
    const h = Math.max(0.001, level - CYL_BOTTOM);
    this.cylWater.scale.y = h;
    this.cylWater.position.set(TROUGH.x, CYL_BOTTOM + h / 2, TROUGH.z);
    this.updateTube();
    this.updateBubbles(dt, (dx / Math.max(dt, 1e-6)) * V_MAX, level);
  }

  /** A red ring at the water level, for reading later. */
  mark(t) {
    const v = this.volume;
    this.readings.push({ t, v });
    const y = SCALE_TOP - (SCALE_LEN * Math.min(CYL + 4, v)) / CYL;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(CYL_R + 0.0012, 0.0009, 6, 32).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff3b3b }));
    ring.position.set(TROUGH.x, y, TROUGH.z);
    const l = makeLabel(`${t} s`, { height: 0.009, size: 36, color: '#ff9a9a' });
    l.position.set(TROUGH.x - CYL_R - 0.016, y, TROUGH.z);
    this.marks.add(ring, l);
    this.app.onMark(t, v);
  }

  updateTube() {
    const s = this.stopper.position;
    const key = `${s.x.toFixed(3)}|${s.y.toFixed(3)}|${s.z.toFixed(3)}`;
    if (key === this.tubeKey) return;
    this.tubeKey = key;
    const end = new THREE.Vector3(TROUGH.x, CYL_BOTTOM + 0.012, TROUGH.z);
    const pts = [
      new THREE.Vector3(s.x, s.y + 0.011, s.z),
      new THREE.Vector3(s.x, s.y + 0.06, s.z),
      new THREE.Vector3((s.x + TROUGH.x - 0.08) / 2, Math.max(s.y, TOP + TROUGH_H) + 0.07, (s.z + TROUGH.z) / 2),
      new THREE.Vector3(TROUGH.x - 0.07, TOP + TROUGH_H + 0.02, TROUGH.z),
      new THREE.Vector3(TROUGH.x - 0.06, TOP + 0.01, TROUGH.z),
      new THREE.Vector3(TROUGH.x - 0.02, TOP + 0.006, TROUGH.z),
      end,
    ];
    this.tube.geometry.dispose();
    this.tube.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.0028, 8);
  }

  updateBubbles(dt, cm3PerS, level) {
    const b = this.bub;
    const flaskY = this.liquidTop;
    if (this.inFlask) b.acc += Math.min(60, cm3PerS * 40) * dt;
    if (this.stopperOn) b.acc2 += Math.min(40, cm3PerS * 30) * dt;
    const spawn = (kind) => {
      for (let i = 0; i < b.n; i++) {
        if (b.life[i] > 0) continue;
        b.life[i] = 1;
        b.kind[i] = kind;
        if (kind === 0) b.pos.set([PLATE.x + (Math.random() - 0.5) * 0.03, this.flaskBase + 0.012, PLATE.z + (Math.random() - 0.5) * 0.02], i * 3);
        else b.pos.set([TROUGH.x + (Math.random() - 0.5) * 0.008, CYL_BOTTOM + 0.014, TROUGH.z + (Math.random() - 0.5) * 0.008], i * 3);
        return;
      }
    };
    while (b.acc >= 1) { b.acc--; spawn(0); }
    while (b.acc2 >= 1) { b.acc2--; spawn(1); }
    for (let i = 0; i < b.n; i++) {
      if (b.life[i] <= 0) {
        b.pos[i * 3 + 1] = -100;
        continue;
      }
      b.pos[i * 3 + 1] += dt * (b.kind[i] ? 0.12 : 0.05);
      b.pos[i * 3] += (Math.random() - 0.5) * 0.0006;
      const stop = b.kind[i] ? level : flaskY;
      if (b.pos[i * 3 + 1] >= stop) b.life[i] = 0;
    }
    this.bubbles.geometry.attributes.position.needsUpdate = true;
  }
}
