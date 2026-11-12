import * as THREE from 'three';
import { makeLabel } from '../../../../shared/ui/labels.js';
import { sound } from '../../../../shared/util/sound.js';
import { LETTERS, PAPERS, paperColor } from '../data/acid.js';

// The lab bench: six beakers of unknown solutions (A–F), a white tile in front of each for used test papers,
// three paper dispensers (red litmus, blue litmus, universal indicator), a digital pH meter, a beaker of
// distilled water for rinsing the probe and (advanced) a pH 7.00 buffer for calibrating it.
//
// The meter behaves like a real one: the reading takes a couple of seconds to settle, drifts towards the last
// sample if the probe wasn't rinsed, and (advanced) reads wrongly until it has been calibrated.

export const TOP = -0.3; // bench top (lab coordinates): sits on a real table when the lab is placed on one
const BEAKER_R = 0.03;
const BEAKER_H = 0.085;
const ROW_Z = -0.02;
const TOOLS_Z = 0.19;
const SLOT_X = { red: -0.03, blue: 0, ui: 0.03 };

const glassMat = new THREE.MeshStandardMaterial({ color: 0xd4ecff, transparent: true, opacity: 0.28, roughness: 0.1, metalness: 0, side: THREE.DoubleSide, depthWrite: false });

function makeBeaker(r, h, color, fill = 0.62) {
  const g = new THREE.Group();
  const liquid = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.93, r * 0.9, h * fill, 28),
    new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.82, roughness: 0.15 }));
  liquid.position.y = (h * fill) / 2 + 0.002;
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.96, h, 28, 1, true), glassMat);
  glass.position.y = h / 2;
  glass.renderOrder = 2;
  const base = new THREE.Mesh(new THREE.CircleGeometry(r * 0.96, 28), glassMat);
  base.rotation.x = -Math.PI / 2;
  base.position.y = 0.001;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.0012, 6, 32), new THREE.MeshStandardMaterial({ color: 0xeaf6ff, roughness: 0.2 }));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = h;
  g.add(liquid, glass, base, rim);
  g.userData = { glass, liquid, r, liquidTop: h * fill };
  return g;
}

function makeStrip(type) {
  const g = new THREE.Group();
  const paper = new THREE.Mesh(new THREE.BoxGeometry(0.009, 0.056, 0.0006), new THREE.MeshStandardMaterial({ color: PAPERS[type].dry, roughness: 0.9 }));
  paper.position.y = -0.028;
  // the end that gets dipped
  const wet = new THREE.Mesh(new THREE.BoxGeometry(0.0092, 0.026, 0.0008), new THREE.MeshStandardMaterial({ color: PAPERS[type].dry, roughness: 0.6 }));
  wet.position.y = -0.043;
  wet.visible = false;
  g.add(paper, wet);
  g.userData = { type, wet };
  return g;
}

export class Bench {
  constructor(app) {
    this.app = app;
    this.group = new THREE.Group();
    app.lab.add(this.group);
    this.mode = 'paper';
    this.level = 'core';

    const top = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.012, 0.36), new THREE.MeshStandardMaterial({ color: 0x2a3348, roughness: 0.7 }));
    top.position.set(0, TOP - 0.006, 0.07);
    this.group.add(top);

    // beakers A–F, each with its letter, a selection ring and a white tile for used papers
    this.beakers = [];
    this.kit = new THREE.Group(); // everything used for testing (hidden in the pH-scale activity)
    this.group.add(this.kit);
    LETTERS.forEach((letter, i) => {
      const x = (i - 2.5) * 0.115;
      const g = makeBeaker(BEAKER_R, BEAKER_H, 0xdcecf5);
      g.position.set(x, TOP, ROW_Z);
      const tag = makeLabel(letter, { height: 0.026, size: 60 });
      tag.position.set(0, BEAKER_H + 0.024, 0);
      g.add(tag);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(BEAKER_R + 0.008, 0.0025, 8, 40), new THREE.MeshBasicMaterial({ color: 0x7ee2ff, toneMapped: false }));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.003;
      ring.visible = false;
      g.add(ring);
      const tile = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.003, 0.07), new THREE.MeshStandardMaterial({ color: 0xf4f6f8, roughness: 0.5 }));
      tile.position.set(x, TOP + 0.0015, ROW_Z + 0.085);
      this.kit.add(g, tile);
      const b = { id: letter, letter, group: g, ring, x, z: ROW_Z, ph: 7, strips: {} };
      Object.assign(g.userData.glass.userData, { handler: this, beaker: b, tapOnly: true });
      this.beakers.push(b);
    });

    // paper dispensers
    this.papers = new THREE.Group();
    this.kit.add(this.papers);
    this.dispensers = [];
    [['red', -0.32], ['blue', -0.22], ['ui', -0.12]].forEach(([type, x]) => {
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.022, 0.05), new THREE.MeshStandardMaterial({ color: PAPERS[type].dry, roughness: 0.8 }));
      box.position.set(x, TOP + 0.011, TOOLS_Z);
      box.userData = { handler: this, paper: type };
      const tag = makeLabel({ red: 'Red litmus', blue: 'Blue litmus', ui: 'Indicator' }[type], { height: 0.015, size: 40 });
      tag.position.set(x, TOP + 0.046, TOOLS_Z);
      this.papers.add(box, tag);
      this.dispensers.push(box);
    });

    // rinse water and buffer
    const pot = (id, x, name, ph, color) => {
      const g = makeBeaker(0.034, 0.075, color);
      g.position.set(x, TOP, TOOLS_Z);
      const tag = makeLabel(name, { height: 0.015, size: 40 });
      tag.position.set(0, 0.075 + 0.02, 0);
      g.add(tag);
      return { id, group: g, x, z: TOOLS_Z, ph, r: 0.034 };
    };
    this.meterKit = new THREE.Group();
    this.kit.add(this.meterKit);
    this.rinse = pot('rinse', 0.21, 'Distilled water', 7.0, 0xe6f4fb);
    this.buffer = pot('buffer', 0.32, 'Buffer pH 7.00', 7.0, 0xbfe6c2);
    this.meterKit.add(this.rinse.group, this.buffer.group);

    // the meter
    this.meter = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.1, 0.016), new THREE.MeshStandardMaterial({ color: 0x1f2a44, roughness: 0.5 }));
    const probe = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.06, 12), new THREE.MeshStandardMaterial({ color: 0xcfd8e6, roughness: 0.3 }));
    probe.position.y = -0.08;
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.0065, 12, 10), new THREE.MeshStandardMaterial({ color: 0x9ad0ff, transparent: true, opacity: 0.8 }));
    bulb.position.y = -0.112;
    this.screen = document.createElement('canvas');
    this.screen.width = 256;
    this.screen.height = 128;
    this.screenTex = new THREE.CanvasTexture(this.screen);
    this.screenTex.colorSpace = THREE.SRGBColorSpace;
    const display = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.015), new THREE.MeshBasicMaterial({ map: this.screenTex, toneMapped: false }));
    display.position.set(0, 0.028, 0.0085);
    // a big copy of the display that floats above the meter, so the reading is easy to see
    this.readout = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.screenTex, toneMapped: false, depthTest: false }));
    this.readout.scale.set(0.11, 0.055, 1);
    this.readout.position.set(0, 0.105, 0);
    this.readout.renderOrder = 7;
    this.meter.add(body, probe, bulb, display, this.readout);
    for (const m of [body, probe, bulb]) m.userData = { handler: this, meter: true };
    this.meterHome = new THREE.Vector3(0.08, TOP + 0.125, TOOLS_Z);
    this.meter.position.copy(this.meterHome);
    this.meterKit.add(this.meter);
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.02, 20), new THREE.MeshStandardMaterial({ color: 0x3a4666, roughness: 0.6 }));
    stand.position.set(0.08, TOP + 0.01, TOOLS_Z);
    this.meterKit.add(stand);
    this.meterTip = 0.118; // from the meter's middle down to the tip of the probe

    this.resetMeter(0);
    this.strips = []; // loose strips being carried
    this.selected = null;
    this.drawScreen();
  }

  // ───────────── setting up ─────────────

  /** list: [{ letter, id, ph }]. Clears the tiles. */
  setUnknowns(list) {
    list.forEach((u, i) => {
      const b = this.beakers[i];
      b.ph = u.ph;
      b.substance = u.id;
      for (const s of Object.values(b.strips)) this.kit.remove(s);
      b.strips = {};
    });
  }

  /** calOffset: how far out the meter reads until it is calibrated (advanced). */
  resetMeter(calOffset) {
    this.m = { in: null, reading: null, target: 7, stable: 0, probe: 'clean', contaminated: false, cal: calOffset, calibrated: calOffset === 0, held: false, rest: null };
  }

  setMode(mode, level) {
    this.mode = mode;
    this.level = level;
    this.kit.visible = mode !== 'scale';
    this.papers.visible = mode === 'paper';
    this.meterKit.visible = mode === 'meter';
    this.buffer.group.visible = level === 'advanced';
    if (mode !== 'meter') {
      this.m.rest = null;
      this.m.in = null;
      this.meter.position.copy(this.meterHome);
    }
  }

  select(letter) {
    this.selected = letter;
    for (const b of this.beakers) b.ring.visible = b.letter === letter;
  }

  get grabTargets() {
    if (!this.kit.visible) return [];
    const t = this.beakers.map((b) => b.group.userData.glass);
    if (this.mode === 'paper') t.push(...this.dispensers);
    if (this.mode === 'meter') this.meter.traverse((o) => { if (o.isMesh && o.userData.meter) t.push(o); });
    return t;
  }

  // ───────────── Interaction handler ─────────────

  describe(o) {
    if (o.userData.beaker) return `Solution ${o.userData.beaker.letter}`;
    if (o.userData.paper) return `${PAPERS[o.userData.paper].name} · take a strip and dip it`;
    if (o.userData.meter) return 'pH meter · dip the probe in a solution';
    return '';
  }

  tap(o) {
    if (o.userData.beaker) this.app.selectSolution(o.userData.beaker.letter);
  }

  grab(o, mode, world) {
    if (o.userData.paper) return this.grabPaper(o.userData.paper, world);
    if (o.userData.meter) return this.grabMeter(world);
    return null;
  }

  /** The liquid (beaker, rinse water or buffer) a point is in, if any. */
  liquidAt(p) {
    const pots = [...this.beakers.map((b) => ({ ...b, r: BEAKER_R, top: b.group.userData.liquidTop, ref: b })), ...(this.mode === 'meter' ? [this.rinse, ...(this.level === 'advanced' ? [this.buffer] : [])].map((b) => ({ ...b, top: b.group.userData.liquidTop, ref: b })) : [])];
    for (const b of pots) {
      const dx = (p.x - b.x) / (b.r + 0.014);
      const dz = (p.z - b.z) / 0.075; // generous front-to-back, so it also works with a mouse
      if (dx * dx + dz * dz < 1 && p.y < TOP + b.top + 0.006 && p.y > TOP - 0.03) return b.ref;
    }
    return null;
  }

  grabPaper(type, world) {
    if (!this.app.gogglesOn()) return null;
    const lab = this.app.lab;
    const strip = makeStrip(type);
    this.kit.add(strip);
    const held = { strip, dipped: null, over: null, since: 0 };
    this.heldStrip = held;
    const place = (w) => {
      strip.position.copy(lab.worldToLocal(w.clone()));
      strip.position.y += 0.035;
    };
    place(world);
    return {
      move: place,
      release: () => {
        this.heldStrip = null;
        if (!held.dipped) this.checkDip(held, true); // let go while it is in a solution
        if (!held.dipped) {
          this.kit.remove(strip);
          return;
        }
        this.layOnTile(strip, held.dipped);
        this.app.onPaperTested(held.dipped.letter, type);
      },
    };
  }

  /** Is the carried strip in a solution? It reacts after a short pause there (or at once when let go). */
  checkDip(held, now = false) {
    if (held.dipped) return;
    const tip = held.strip.position.clone();
    tip.y -= 0.056;
    const b = this.liquidAt(tip);
    const over = b?.letter ? b : null;
    if (over !== held.over) {
      held.over = over;
      held.since = performance.now();
    }
    if (over && (now || performance.now() - held.since > 250)) {
      held.dipped = over;
      this.react(held.strip, over.ph);
      sound.click();
      this.app.interaction.pulse(0.5, 40);
    }
  }

  react(strip, ph) {
    const wet = strip.userData.wet;
    wet.material.color.set(paperColor(strip.userData.type, ph));
    wet.visible = true;
  }

  /** A used strip lies on the tile in front of its beaker (replacing an older one of the same kind). */
  layOnTile(strip, b) {
    const type = strip.userData.type;
    if (b.strips[type]) this.kit.remove(b.strips[type]);
    b.strips[type] = strip;
    strip.position.set(b.x + SLOT_X[type], TOP + 0.004, ROW_Z + 0.055);
    strip.rotation.set(-Math.PI / 2, 0, 0);
  }

  /** Test a solution with a paper without carrying it (used by tests, and to restore a saved bench). */
  testWith(type, letter) {
    const b = this.beakers.find((x) => x.letter === letter);
    const strip = makeStrip(type);
    this.kit.add(strip);
    this.react(strip, b.ph);
    this.layOnTile(strip, b);
    this.app.onPaperTested(letter, type);
  }

  grabMeter(world) {
    if (!this.app.gogglesOn()) return null;
    const lab = this.app.lab;
    const off = this.meter.position.clone().sub(lab.worldToLocal(world.clone()));
    this.m.held = true;
    this.m.rest = null;
    return {
      move: (w) => this.meter.position.copy(lab.worldToLocal(w.clone())).add(off),
      release: () => {
        this.m.held = false;
        const b = this.liquidAt(this.tip());
        if (b) this.restIn(b);
      },
    };
  }

  tip() {
    const p = this.meter.position.clone();
    p.y -= this.meterTip;
    return p;
  }

  /** Stand the meter in a beaker (so the reading can be recorded hands-free). */
  restIn(b) {
    this.m.rest = b;
    this.meter.position.set(b.x, TOP + 0.012 + this.meterTip, b.z);
  }

  /** Put the meter in a beaker / the rinse water / the buffer by id (used by tests). */
  putMeterIn(id) {
    const b = id === 'rinse' ? this.rinse : id === 'buffer' ? this.buffer : this.beakers.find((x) => x.letter === id);
    this.m.held = false;
    if (b) this.restIn(b);
    else this.m.rest = null;
  }

  calibrate() {
    const m = this.m;
    if (m.in !== 'buffer' || m.stable < 1) return false;
    m.cal = 0;
    m.calibrated = true;
    m.reading = 7;
    m.target = 7;
    sound.bond();
    return true;
  }

  // ───────────── every frame ─────────────

  update(dt) {
    if (this.heldStrip) this.checkDip(this.heldStrip);
    if (this.mode !== 'meter') return;
    const m = this.m;
    // glide back to the stand when let go outside a beaker
    if (!m.held && !m.rest) this.meter.position.lerp(this.meterHome, Math.min(1, dt * 6));
    let b = m.held || m.rest ? this.liquidAt(this.tip()) : null;
    // carried past a beaker without stopping: that isn't a dip
    const over = b ? b.id : null;
    if (over !== m.over) {
      m.over = over;
      m.overSince = performance.now();
    }
    if (b && !m.rest && over !== m.in && performance.now() - m.overSince < 250) b = null;
    const id = b ? b.id : null;
    if (id !== m.in) {
      // leaving a sample leaves drops of it on the probe
      if (m.in && m.in !== 'rinse') {
        const prev = m.in === 'buffer' ? this.buffer : this.beakers.find((x) => x.letter === m.in);
        m.probe = { id: m.in, ph: prev.ph };
      }
      m.in = id;
      m.stable = 0;
      m.contaminated = false;
      if (id === 'rinse') {
        if (m.probe !== 'clean') this.app.onRinsed();
        m.probe = 'clean';
      }
      if (id) {
        let target = b.ph + m.cal;
        if (id !== 'rinse' && m.probe !== 'clean' && m.probe.id !== id) {
          // carried over from the last sample: the reading is pulled towards it
          target += THREE.MathUtils.clamp((m.probe.ph - b.ph) * 0.08, -0.7, 0.7);
          m.contaminated = true;
          this.app.onContaminated();
        }
        m.target = target;
        if (m.reading == null) m.reading = 7 + (Math.random() - 0.5);
        if (b.letter) this.app.selectSolution(b.letter, true);
        sound.click();
      } else {
        m.reading = null;
      }
      this.app.refresh();
    }
    if (id) {
      m.reading += (m.target - m.reading) * (1 - Math.exp(-dt * 1.9));
      const settled = Math.abs(m.target - m.reading) < 0.012;
      const was = m.stable >= 1;
      m.stable = settled ? m.stable + dt : 0;
      if (!was && m.stable >= 1) {
        sound.beep();
        this.app.refresh();
      }
    }
    this.drawScreen();
  }

  /** The number on the display (what a student would write down). */
  get shown() {
    const m = this.m;
    return m.reading == null ? null : Math.round(m.reading * 100) / 100;
  }

  drawScreen() {
    const m = this.m;
    const text = m.reading == null ? '--.--' : m.reading.toFixed(2);
    const key = `${text}|${m.stable >= 1}|${m.calibrated}`;
    if (key === this.screenKey) return;
    this.screenKey = key;
    const c = this.screen.getContext('2d');
    c.fillStyle = '#0b1f16';
    c.fillRect(0, 0, 256, 128);
    c.fillStyle = m.stable >= 1 ? '#7dffb0' : '#e9f5c9';
    c.font = '700 74px ui-monospace, Menlo, Consolas, monospace';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(text, 128, 76);
    c.font = '700 24px system-ui, sans-serif';
    c.textAlign = 'left';
    c.fillStyle = '#9fd8b8';
    c.fillText('pH', 12, 20);
    c.textAlign = 'right';
    c.fillStyle = m.stable >= 1 ? '#7dffb0' : '#ffd166';
    c.fillText(m.reading == null ? '' : m.stable >= 1 ? 'STABLE' : 'settling…', 244, 20);
    if (!m.calibrated) {
      c.textAlign = 'center';
      c.fillStyle = '#ff8a8a';
      c.fillText('NOT CALIBRATED', 128, 116);
    }
    this.screenTex.needsUpdate = true;
  }
}
