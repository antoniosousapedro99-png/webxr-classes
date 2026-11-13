import * as THREE from 'three';
import { makeLabel } from '../../../../shared/ui/labels.js';
import { SOURCES, LAB_IDS, HOME_IDS, ABSORBERS, BACKGROUND, D0, PA, HALF_LIFE } from '../data/radiation.js';

// The lab bench: a lead box with the four sealed school sources, a tray of everyday things, a test stand
// (source holder, absorber slot and the clip that holds the Geiger probe 3 cm away), a rack of absorbers,
// the tongs, and the Geiger counter with its probe on a cable.
//
// The counter really counts: every frame, the number of clicks is drawn at random (a Poisson process) from the
// count rate at the probe's window, which comes from background radiation plus every source that is out of
// the lead box: alpha only reaches a few centimetres, beta and gamma fall off with the square of the distance,
// and an absorber in the slot stops some of each.

export const TOP = -0.3; // bench top (lab coordinates)
export const HOLDER = new THREE.Vector3(-0.02, TOP + 0.04, -0.07);
export const SLOT_X = HOLDER.x + 0.015;
const WINDOW = new THREE.Vector3(HOLDER.x + D0, HOLDER.y, HOLDER.z); // probe window, in the clip
const BOX = new THREE.Vector3(-0.31, TOP, -0.07);
const TRAY_Z = 0.15;
const COUNTER = new THREE.Vector3(0.29, TOP, -0.07);
const TONGS = new THREE.Vector3(0.38, TOP + 0.006, 0.16);
const RACK = { paper: 0.13, al: 0.2, lead: 0.27 };

const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...o });

function poisson(l) {
  if (l <= 0) return 0;
  if (l > 30) return Math.max(0, Math.round(l + Math.sqrt(l) * Math.sqrt(-2 * Math.log(Math.random())) * Math.cos(2 * Math.PI * Math.random())));
  const L = Math.exp(-l);
  let k = 0;
  let p = 1;
  do { k++; p *= Math.random(); } while (p > L);
  return k - 1;
}

/** A sealed school source: a small capsule on the end of a handling rod. Its origin is the active face. */
function labSource(color) {
  const g = new THREE.Group();
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.014, 20).rotateZ(Math.PI / 2), mat(0xb8bcc6, { metalness: 0.6, roughness: 0.3 }));
  cap.position.x = -0.007;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.0095, 0.0095, 0.004, 20).rotateZ(Math.PI / 2), mat(color, { emissive: color, emissiveIntensity: 0.25 }));
  band.position.x = -0.012;
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.0065, 20).rotateY(Math.PI / 2), mat(0x222222));
  face.position.x = 0.0002;
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.08, 10).rotateZ(Math.PI / 2), mat(0x8a8f99, { metalness: 0.5 }));
  rod.position.x = -0.054;
  g.add(cap, band, face, rod);
  return { group: g, hw: 0, picks: [cap, band, rod] };
}

/** The everyday things, made from simple shapes. hw: half their width (the face is at +x). */
function homeItem(id) {
  const g = new THREE.Group();
  let hw = 0.02;
  const add = (m, x = 0, y = 0, z = 0) => { m.position.set(x, y, z); g.add(m); return m; };
  if (id === 'smoke') {
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.034, 0.016, 32), mat(0xf2f2ee)));
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.004, 16), mat(0xd04040, { emissive: 0x401010 })), 0.015, 0.009, 0);
    hw = 0.033;
  } else if (id === 'watch') {
    add(new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.004, 0.07), mat(0x5a3b25)));
    const face = add(new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.007, 28), mat(0xd9c27a, { metalness: 0.7, roughness: 0.3 })), 0, 0.004, 0);
    void face;
    add(new THREE.Mesh(new THREE.CircleGeometry(0.013, 24).rotateX(-Math.PI / 2), mat(0x1c2a20, { emissive: 0x4dff88, emissiveIntensity: 0.35 })), 0, 0.0081, 0);
    hw = 0.016;
  } else if (id === 'uglass') {
    add(new THREE.Mesh(new THREE.SphereGeometry(0.026, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat(0xc9ff4d, { emissive: 0x7dff2a, emissiveIntensity: 0.45, transparent: true, opacity: 0.8, side: THREE.DoubleSide })), 0, 0.026, 0);
    hw = 0.026;
  } else if (id === 'granite') {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d');
    x.fillStyle = '#b9a9a2';
    x.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 500; i++) {
      x.fillStyle = ['#3a3433', '#e9e1dc', '#c2827a', '#6e6462'][i % 4];
      x.fillRect(Math.random() * 128, Math.random() * 128, 2 + Math.random() * 4, 2 + Math.random() * 4);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.04), new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 })), 0, 0.015, 0);
    hw = 0.025;
  } else if (id === 'banana') {
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-0.045, 0.02, 0), new THREE.Vector3(0, 0.0, 0.03), new THREE.Vector3(0.045, 0.02, 0));
    add(new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.011, 10), mat(0xf2d33a)), 0, 0.006, -0.012);
    hw = 0.045;
  } else {
    // salt substitute and table salt: little tubs with a label
    const salt = id === 'salt';
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.045, 24), mat(salt ? 0xf4f6fb : 0xffffff)), 0, 0.0225, 0);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.0225, 0.0225, 0.018, 24, 1, true), mat(salt ? 0x2f6bd8 : 0x23a35a)), 0, 0.024, 0);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.023, 0.023, 0.006, 24), mat(salt ? 0x2f6bd8 : 0x23a35a)), 0, 0.047, 0);
    hw = 0.022;
  }
  return { group: g, hw, picks: g.children.filter((m) => m.isMesh) };
}

function counterScreen() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return { canvas: c, tex: t };
}

let audio = null;
function click() {
  if (!audio) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.004), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    audio = { ctx, buf, last: 0 };
  }
  const a = audio;
  if (a.ctx.state === 'suspended') a.ctx.resume();
  if (a.ctx.currentTime - a.last < 0.004) return;
  a.last = a.ctx.currentTime;
  const s = a.ctx.createBufferSource();
  s.buffer = a.buf;
  const g = a.ctx.createGain();
  g.gain.value = 0.5;
  s.connect(g).connect(a.ctx.destination);
  s.start();
}

export class Bench {
  constructor(app) {
    this.app = app;
    this.group = new THREE.Group();
    app.lab.add(this.group);

    const top = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.012, 0.38), mat(0x2a3348, { roughness: 0.7 }));
    top.position.set(0, TOP - 0.006, 0.05);
    const tray = new THREE.Mesh(new THREE.BoxGeometry(0.57, 0.006, 0.09), mat(0x3b4664));
    tray.position.set(-0.19, TOP + 0.003, TRAY_Z);
    this.group.add(top, tray);

    // the lead box (lid open)
    const lead = mat(0x55595f, { roughness: 0.5, metalness: 0.3 });
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.1), lead);
    box.position.set(BOX.x, TOP + 0.025, BOX.z);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.012, 0.1), lead);
    lid.position.set(BOX.x, TOP + 0.1, BOX.z - 0.055);
    lid.rotation.x = Math.PI / 2;
    const sign = makeLabel('☢ Lead box', { height: 0.018, size: 40, color: '#ffd166' });
    sign.position.set(BOX.x, TOP + 0.07, BOX.z + 0.06);
    this.group.add(box, lid, sign);

    // the sources
    this.sources = {};
    LAB_IDS.forEach((id, i) => {
      const s = SOURCES[id];
      const m = labSource(s.color);
      const home = new THREE.Vector3(BOX.x - 0.066 + i * 0.044, TOP + 0.1, BOX.z);
      this.addSource(id, m, home, true);
      const tag = makeLabel(s.short, { height: 0.012, size: 36 });
      tag.position.set(home.x, TOP + 0.13, BOX.z);
      this.group.add(tag);
    });
    HOME_IDS.forEach((id, i) => {
      const m = homeItem(id);
      const home = new THREE.Vector3(-0.44 + i * 0.083, TOP + 0.006, TRAY_Z);
      this.addSource(id, m, home, false);
      const tag = makeLabel(SOURCES[id].short, { height: 0.012, size: 36 });
      tag.position.set(home.x, TOP + 0.075, TRAY_Z + 0.03);
      this.group.add(tag);
    });

    // the test stand: holder, absorber slot, probe clip
    const stand = mat(0x3d4766);
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.008, 0.06), stand);
    base.position.set(HOLDER.x + 0.04, TOP + 0.004, HOLDER.z);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.01, HOLDER.y - TOP - 0.01, 0.01), stand);
    post.position.set(HOLDER.x - 0.035, (HOLDER.y + TOP) / 2, HOLDER.z);
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.006, 0.07), stand);
    slot.position.set(SLOT_X, TOP + 0.011, HOLDER.z);
    const clip = new THREE.Mesh(new THREE.BoxGeometry(0.012, HOLDER.y - TOP - 0.012, 0.012), stand);
    clip.position.set(WINDOW.x + 0.07, (HOLDER.y + TOP) / 2, HOLDER.z);
    const tag = makeLabel('Source · absorber · probe', { height: 0.012, size: 36 });
    tag.position.set(HOLDER.x + 0.04, TOP + 0.1, HOLDER.z);
    this.group.add(base, post, slot, clip, tag);
    this.paBottle = new THREE.Group();
    const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.07, 20), mat(0xdfe8ff, { transparent: true, opacity: 0.45 }));
    const layerTop = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.03, 20), mat(0xf2e3a0, { transparent: true, opacity: 0.85 }));
    layerTop.position.y = 0.015;
    const layerBottom = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.03, 20), mat(0x9fc4ff, { transparent: true, opacity: 0.85 }));
    layerBottom.position.y = -0.018;
    this.paBottle.add(bottle, layerTop, layerBottom);
    this.paBottle.position.set(HOLDER.x - 0.018, HOLDER.y, HOLDER.z);
    this.paBottle.visible = false;
    this.paLabel = makeLabel('Protactinium generator', { height: 0.012, size: 36 });
    this.paLabel.position.set(0, 0.06, 0);
    this.paBottle.add(this.paLabel);
    this.group.add(this.paBottle);
    this.pa = { on: false, t: 0 };

    // absorbers
    this.absorbers = {};
    for (const [id, x] of Object.entries(RACK)) {
      const a = ABSORBERS[id];
      const m = new THREE.Mesh(new THREE.BoxGeometry(a.thick, 0.06, 0.06), mat(a.color, { metalness: id === 'paper' ? 0 : 0.5, roughness: id === 'paper' ? 0.9 : 0.35 }));
      const home = new THREE.Vector3(x, TOP + 0.03, TRAY_Z);
      m.position.copy(home);
      m.userData = { handler: this, absorber: id, tapOnly: true };
      const t = makeLabel(a.short, { height: 0.012, size: 36 });
      t.position.set(x, TOP + 0.075, TRAY_Z);
      this.group.add(m, t);
      this.absorbers[id] = { mesh: m, home };
    }
    this.absorber = 'none';

    // tongs
    this.tongs = new THREE.Group();
    const arm = new THREE.BoxGeometry(0.2, 0.004, 0.006);
    const steel = mat(0xc7ccd6, { metalness: 0.7, roughness: 0.3 });
    const a1 = new THREE.Mesh(arm, steel);
    a1.position.z = -0.006;
    a1.rotation.y = 0.03;
    const a2 = new THREE.Mesh(arm, steel);
    a2.position.z = 0.006;
    a2.rotation.y = -0.03;
    this.tongs.add(a1, a2);
    this.tongs.position.copy(TONGS);
    for (const m of [a1, a2]) m.userData = { handler: this, tongs: true, tapOnly: true };
    this.tongsTag = makeLabel('Tongs', { height: 0.012, size: 36 });
    this.tongsTag.position.set(TONGS.x, TOP + 0.04, TONGS.z);
    this.group.add(this.tongs, this.tongsTag);
    this.held = new THREE.Group(); // tongs drawn holding a source, reaching back towards you
    const heldArm = new THREE.BoxGeometry(0.004, 0.006, 0.2);
    const h1 = new THREE.Mesh(heldArm, steel);
    h1.position.set(-0.006, 0, 0.11);
    const h2 = new THREE.Mesh(heldArm, steel);
    h2.position.set(0.006, 0, 0.11);
    this.held.add(h1, h2);
    this.held.visible = false;
    this.group.add(this.held);

    // the Geiger counter and its probe
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.075, 0.09), mat(0xe8b830, { roughness: 0.5 }));
    body.position.set(COUNTER.x, TOP + 0.0375, COUNTER.z);
    body.userData = { handler: this, counter: true, tapOnly: true };
    this.counterBody = body;
    const scr = counterScreen();
    this.screen = scr;
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.055), new THREE.MeshBasicMaterial({ map: scr.tex, toneMapped: false }));
    screen.position.set(COUNTER.x, TOP + 0.077, COUNTER.z + 0.018);
    screen.rotation.x = -1.0;
    const cTag = makeLabel('Geiger counter', { height: 0.014, size: 36 });
    cTag.position.set(COUNTER.x, TOP + 0.115, COUNTER.z);
    this.group.add(body, screen, cTag);

    this.probe = new THREE.Group();
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.11, 20).rotateZ(Math.PI / 2), mat(0x30343d, { roughness: 0.4 }));
    tube.position.x = 0.055;
    const win = new THREE.Mesh(new THREE.CircleGeometry(0.009, 20).rotateY(-Math.PI / 2), mat(0x8c6b3a, { roughness: 0.3 }));
    win.position.x = -0.0005;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.011, 0.0015, 8, 24).rotateY(Math.PI / 2), mat(0xe8b830));
    this.probe.add(tube, win, ring);
    for (const m of [tube, win, ring]) m.userData = { handler: this, probe: true };
    this.probePicks = [tube, win, ring];
    this.group.add(this.probe);
    this.inClip = true;
    this.probe.position.copy(WINDOW);
    const n = 32;
    this.cable = new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3)), new THREE.LineBasicMaterial({ color: 0x15171c }));
    this.cable.frustumCulled = false;
    this.group.add(this.cable);

    // counting
    this.total = 0; // since the last reset
    this.recent = []; // [time, n] for the rate shown
    this.timer = null; // { left, n }: a 10-second count
    this.last = null; // the last finished 10-second count
    this.clock = 0;
    this.sound = true;
    this.screenKey = '';
  }

  addSource(id, m, home, lab) {
    const s = { id, group: m.group, hw: m.hw, home, lab, where: 'home' };
    m.group.position.copy(home);
    if (lab) m.group.rotation.z = Math.PI / 2; // standing up in the box, face upwards
    for (const p of m.picks) p.userData = { handler: this, source: s };
    s.picks = m.picks;
    this.group.add(m.group);
    this.sources[id] = s;
  }

  get grabTargets() {
    const t = [this.counterBody, ...this.probePicks, ...Object.values(this.absorbers).map((a) => a.mesh)];
    if (!this.app.state.tongs) t.push(...this.tongs.children);
    if (this.app.state.mode !== 'halflife') for (const s of Object.values(this.sources)) t.push(...s.picks);
    return t;
  }

  /** The source in the holder, or null. */
  get inHolder() {
    return Object.values(this.sources).find((s) => s.where === 'holder') ?? null;
  }

  /** Lab sources out of the lead box. */
  get outOfBox() {
    return Object.values(this.sources).filter((s) => s.lab && s.where !== 'home');
  }

  describe(o) {
    const u = o.userData;
    if (u.source) return `${SOURCES[u.source.id].name}${this.app.state.tongs ? ' · drag it to the holder' : ' · pick up the tongs first'}`;
    if (u.absorber) return `${ABSORBERS[u.absorber].name} · tap to put it in the slot`;
    if (u.tongs) return 'Tongs · tap to pick them up';
    if (u.counter) return 'Geiger counter · tap to count for 10 seconds';
    if (u.probe) return this.inClip ? 'Geiger probe · pick it up to explore' : 'Geiger probe · put it back in its clip for a fair test';
    return '';
  }

  tap(o) {
    const u = o.userData;
    if (u.absorber) this.app.setAbsorber(this.absorber === u.absorber ? 'none' : u.absorber);
    else if (u.tongs) this.app.takeTongs();
    else if (u.counter) this.app.startCount();
    else if (u.source) this.app.toHolder(u.source.id);
    else if (u.probe && !this.inClip) this.clipProbe();
  }

  grab(o, mode, world) {
    const u = o.userData;
    const lab = this.group;
    if (u.source) {
      if (!this.app.state.tongs) {
        this.app.needTongs();
        return null;
      }
      const s = u.source;
      const off = s.group.position.clone().sub(lab.worldToLocal(world.clone()));
      s.where = 'held';
      s.group.rotation.set(0, 0, 0);
      return {
        move: (w) => s.group.position.copy(lab.worldToLocal(w.clone())).add(off),
        release: () => {
          if (this.near(s.group.position, HOLDER, 0.08)) this.app.toHolder(s.id);
          else this.putBack(s);
        },
      };
    }
    if (u.probe) {
      const off = this.probe.position.clone().sub(lab.worldToLocal(world.clone()));
      this.inClip = false;
      this.probe.rotation.set(0, 0, 0);
      return {
        move: (w) => {
          this.probe.position.copy(lab.worldToLocal(w.clone())).add(off);
          this.probe.position.y = Math.max(TOP + 0.012, this.probe.position.y);
        },
        release: () => {
          if (this.near(this.probe.position, WINDOW, 0.06)) this.clipProbe();
          this.app.refresh();
        },
      };
    }
    return null;
  }

  /** Close enough to drop into place? (On a screen, where you can't judge depth, close on the screen is enough.) */
  near(p, target, r) {
    if (this.app.presenting) return p.distanceTo(target) < r;
    const cam = this.app.camera;
    const a = this.group.localToWorld(p.clone()).project(cam);
    const b = this.group.localToWorld(target.clone()).project(cam);
    return Math.hypot((a.x - b.x) * cam.aspect, a.y - b.y) < r * 2;
  }

  clipProbe() {
    this.inClip = true;
    this.probe.position.copy(WINDOW);
    this.probe.rotation.set(0, 0, 0);
  }

  /** Put a source in the holder (whatever was there goes back). */
  place(id) {
    const s = this.sources[id];
    const old = this.inHolder;
    if (old && old !== s) this.putBack(old);
    s.where = 'holder';
    s.group.rotation.set(0, 0, 0);
    s.group.position.set(HOLDER.x - s.hw, HOLDER.y - (s.lab ? 0 : 0.012), HOLDER.z);
  }

  putBack(s) {
    s.where = 'home';
    s.group.position.copy(s.home);
    s.group.rotation.set(0, 0, s.lab ? Math.PI / 2 : 0);
  }

  setAbsorber(id) {
    for (const [k, a] of Object.entries(this.absorbers)) {
      if (k === id) a.mesh.position.set(SLOT_X, HOLDER.y, HOLDER.z);
      else a.mesh.position.copy(a.home);
    }
    this.absorber = id;
  }

  /** Where radiation comes from (lab coordinates): every source out of the box, and the protactinium. */
  emitters() {
    const out = [];
    for (const s of Object.values(this.sources)) {
      if (s.lab && s.where === 'home') continue;
      const d = SOURCES[s.id];
      if (!d.a && !d.b && !d.g) continue;
      const p = new THREE.Vector3(s.hw, 0, 0);
      if (s.where === 'home' && !s.lab) p.set(0, 0.015, 0);
      s.group.localToWorld(p);
      this.group.worldToLocal(p);
      out.push({ p, a: d.a, b: d.b, g: d.g, holder: s.where === 'holder' });
    }
    if (this.paBottle.visible) out.push({ p: new THREE.Vector3(HOLDER.x, HOLDER.y, HOLDER.z), a: 0, b: this.paRate(), g: 0, holder: true });
    return out;
  }

  paRate() {
    if (!this.pa.on) return 1.5; // the protactinium is still mixed in with the uranium, at the bottom
    return PA.b * 2 ** (-this.pa.t / HALF_LIFE);
  }

  /** Is the window behind the absorber slot (so that the absorber is between it and the holder)? */
  shielded(w) {
    return this.absorber !== 'none' && w.x > SLOT_X && Math.abs(w.y - HOLDER.y) < 0.035 && Math.abs(w.z - HOLDER.z) < 0.035;
  }

  /** Counts per second at the probe's window. */
  rate() {
    const w = this.probe.position;
    let r = BACKGROUND;
    for (const e of this.emitters()) {
      const d = Math.max(0.012, e.p.distanceTo(w));
      const geo = (D0 / d) ** 2;
      const alphaRange = d < 0.035 ? 1 : d < 0.05 ? (0.05 - d) / 0.015 : 0;
      const t = e.holder && this.shielded(w) ? ABSORBERS[this.absorber].t : ABSORBERS.none.t;
      r += geo * (e.a * alphaRange * t.a + e.b * t.b + e.g * t.g);
    }
    return r;
  }

  startCount(seconds = 10) {
    this.timer = { left: seconds, n: 0, len: seconds };
  }

  resetCount() {
    this.total = 0;
    this.timer = null;
    this.last = null;
  }

  /** Every frame. `speed` makes time pass faster (half-life experiment). Returns a finished count, if any. */
  update(dt, speed = 1) {
    const sim = dt * speed;
    this.clock += sim;
    if (this.pa.on) this.pa.t += sim;
    const n = poisson(this.rate() * sim);
    let done = null;
    if (n) {
      this.total += n;
      this.recent.push([this.clock, n]);
      if (this.sound && speed === 1) for (let i = 0; i < Math.min(n, 3); i++) click();
    }
    while (this.recent.length && this.recent[0][0] < this.clock - 3) this.recent.shift();
    if (this.timer) {
      this.timer.n += n;
      this.timer.left -= sim;
      if (this.timer.left <= 0) {
        done = { count: this.timer.n, len: this.timer.len };
        this.last = done;
        this.timer = null;
      }
    }
    this.updateCable();
    this.updateHeld();
    this.drawScreen();
    return done;
  }

  /** Counts per second over the last 3 seconds. */
  get shownRate() {
    const span = Math.min(3, this.clock);
    return span > 0.5 ? this.recent.reduce((a, [, k]) => a + k, 0) / span : 0;
  }

  updateCable() {
    const a = new THREE.Vector3(COUNTER.x - 0.065, TOP + 0.03, COUNTER.z);
    const b = this.probe.localToWorld(new THREE.Vector3(0.11, 0, 0));
    this.group.worldToLocal(b);
    const pos = this.cable.geometry.attributes.position;
    const sag = Math.max(0.01, 0.06 - Math.abs(a.y - b.y) * 0.3);
    for (let i = 0; i < pos.count; i++) {
      const t = i / (pos.count - 1);
      const p = a.clone().lerp(b, t);
      p.y = Math.max(TOP + 0.002, p.y - sag * Math.sin(Math.PI * t));
      pos.setXYZ(i, p.x, p.y, p.z);
    }
    pos.needsUpdate = true;
  }

  /** Tongs: lying on the bench, or holding a source at arm's length. */
  updateHeld() {
    const s = Object.values(this.sources).find((x) => x.where === 'held');
    this.tongs.visible = !this.app.state.tongs;
    this.tongsTag.visible = !this.app.state.tongs;
    this.held.visible = !!s;
    if (!s) return;
    this.held.position.copy(s.group.position);
    this.held.lookAt(this.app.viewCamera().getWorldPosition(new THREE.Vector3()));
  }

  drawScreen() {
    const t = this.timer;
    const value = t ? t.n : this.last ? this.last.count : this.total;
    const label = t ? `COUNTING… ${Math.ceil(t.left)} s` : this.last ? `COUNT IN ${this.last.len} s` : 'TOTAL COUNT';
    const rate = this.shownRate.toFixed(1);
    const key = `${value}|${label}|${rate}`;
    if (key === this.screenKey) return;
    this.screenKey = key;
    const c = this.screen.canvas.getContext('2d');
    c.fillStyle = '#132416';
    c.fillRect(0, 0, 512, 256);
    c.fillStyle = '#9dff9d';
    c.font = '600 30px ui-monospace, Consolas, monospace';
    c.textBaseline = 'top';
    c.fillText(label, 24, 18);
    c.font = '700 120px ui-monospace, Consolas, monospace';
    c.textAlign = 'right';
    c.fillText(String(value), 488, 62);
    c.textAlign = 'left';
    c.font = '600 30px ui-monospace, Consolas, monospace';
    c.fillStyle = '#6fcf7a';
    c.fillText(`${rate} counts/s`, 24, 206);
    this.screen.tex.needsUpdate = true;
  }
}
