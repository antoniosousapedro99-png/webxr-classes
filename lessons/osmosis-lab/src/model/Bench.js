import * as THREE from 'three';
import { makeLabel } from '../../../../shared/ui/labels.js';
import { CONCENTRATIONS, BASE_MASS, SOAK_HOURS, pctAt } from '../data/osmosis.js';

// The bench: a potato and a scalpel on a cutting board, a paper towel, a digital balance, five beakers of
// salt solution (one per concentration), and a timer with play / reset buttons, as in the original lesson.
//
// One piece at a time: cut it from the potato, dry it, weigh it (its starting mass), drop it in a beaker.
// Once every cut piece is in a beaker, press play: the timer runs through a simulated 24-hour soak. Then take
// each piece out, dry it and weigh it again. The mass it settles to really depends on time (fast at first,
// slower later), so watching the clock run matters, not just pressing play and skipping ahead.

export const TOP = -0.3;
const BOARD = new THREE.Vector3(-0.36, TOP, 0.14);
const TOWEL = new THREE.Vector3(-0.2, TOP, 0.16);
const BALANCE = new THREE.Vector3(-0.04, TOP, 0.1);
const BEAKER_Z = -0.04;
const BEAKER_X0 = 0.1;
const BEAKER_GAP = 0.09;
const TIMER = new THREE.Vector3(0.08, TOP + 0.16, -0.17);
const TRAY_Z = 0.22;
const POTATO_LEN = 0.11;

const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...o });
const skin = mat(0xc49a5a, { roughness: 0.75 });
const flesh = mat(0xf2e6c2, { roughness: 0.55 });

function beakerX(i) {
  return BEAKER_X0 + i * BEAKER_GAP;
}

function makeBeaker(r, h) {
  const g = new THREE.Group();
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.94, h, 24, 1, true), new THREE.MeshStandardMaterial({ color: 0xd8eeff, transparent: true, opacity: 0.28, roughness: 0.08, side: THREE.DoubleSide, depthWrite: false }));
  glass.position.y = h / 2;
  const base = new THREE.Mesh(new THREE.CircleGeometry(r * 0.94, 24).rotateX(-Math.PI / 2), glass.material);
  base.position.y = 0.001;
  g.add(glass, base);
  return g;
}

/** The potato: one horizontal cylinder, shortened from the cutting end each time a piece is cut. */
function makePotato(len) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, len, 20).rotateZ(Math.PI / 2), skin);
  g.add(body);
  g.userData.body = body;
  g.userData.len = len;
  return g;
}

/** A cut piece: a short potato cylinder, flesh visible on both cut faces. */
function makePiece(len) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, len, 20).rotateZ(Math.PI / 2), flesh);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.0175, 0.0175, len * 0.22, 20).rotateZ(Math.PI / 2), skin);
  g.add(body, rim);
  g.userData.body = body;
  return g;
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

    const top = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.012, 0.42), mat(0xe9ecf2, { roughness: 0.4 }));
    top.position.set(0, TOP - 0.006, 0.07);
    this.group.add(top);

    // cutting board
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.006, 0.09), mat(0xc9a06a, { roughness: 0.7 }));
    board.position.set(BOARD.x, TOP + 0.003, BOARD.z);
    this.group.add(board);

    // scalpel: handle + blade, origin at the blade's tip
    this.scalpel = new THREE.Group();
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.006, 0.009), mat(0x2f6bd8));
    handle.position.x = -0.058;
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.0015, 0.008), mat(0xdfe3ea, { metalness: 0.9, roughness: 0.2 }));
    blade.position.x = -0.012;
    this.scalpel.add(handle, blade);
    for (const m of [handle, blade]) m.userData = { handler: this, scalpel: true };
    this.scalpelPicks = [handle, blade];
    this.scalpelHome = new THREE.Vector3(BOARD.x + 0.02, TOP + 0.009, BOARD.z + 0.05);
    this.scalpel.position.copy(this.scalpelHome);
    this.group.add(this.scalpel);

    // paper towel
    const towel = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.003, 0.07), mat(0xf6f3ea, { roughness: 0.95 }));
    towel.position.set(TOWEL.x, TOP + 0.0015, TOWEL.z);
    const tTag = makeLabel('Paper towel', { height: 0.011, size: 36 });
    tTag.position.set(TOWEL.x, TOP + 0.03, TOWEL.z + 0.045);
    this.group.add(towel, tTag);

    // balance
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.01, 0.06), mat(0xb9bec8, { metalness: 0.6, roughness: 0.3 }));
    pad.position.set(BALANCE.x, TOP + 0.005, BALANCE.z);
    this.balancePan = new THREE.Vector3(BALANCE.x, TOP + 0.011, BALANCE.z);
    this.display = panelTexture(256, 96);
    const disp = new THREE.Mesh(new THREE.PlaneGeometry(0.055, 0.0206), new THREE.MeshBasicMaterial({ map: this.display.t, toneMapped: false }));
    disp.position.set(BALANCE.x, TOP + 0.011, BALANCE.z + 0.034);
    disp.rotation.x = -1.0;
    this.group.add(pad, disp);
    this.drawDisplay(null);

    // five beakers of salt solution
    this.beakers = CONCENTRATIONS.map((C, i) => {
      const g = makeBeaker(0.021, 0.05);
      g.position.set(beakerX(i), TOP, BEAKER_Z);
      const liquid = new THREE.Mesh(new THREE.CylinderGeometry(0.0196, 0.0188, 0.034, 20), new THREE.MeshStandardMaterial({ color: new THREE.Color().lerpColors(new THREE.Color(0xdff2ff), new THREE.Color(0x9fd0e8), C), transparent: true, opacity: 0.55, roughness: 0.15 }));
      liquid.position.y = 0.019;
      g.add(liquid);
      const tag = makeLabel(`${C.toFixed(2)} M`, { height: 0.011, size: 36 });
      tag.position.set(0, 0.065, 0);
      g.add(tag);
      this.group.add(g);
      return { C, group: g, occupied: null };
    });

    // timer with play / reset, as in the original lesson
    this.timerGroup = new THREE.Group();
    this.timerGroup.position.copy(TIMER);
    this.group.add(this.timerGroup);
    const tScreen = panelTexture(320, 110);
    this.clockDisplay = tScreen;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.038), new THREE.MeshBasicMaterial({ map: tScreen.t, toneMapped: false }));
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.046, 0.006), mat(0x2a3560));
    back.position.z = -0.004;
    this.timerGroup.add(back, face);
    this.playBtn = new THREE.Mesh(new THREE.CircleGeometry(0.01, 24), mat(0x2f6bd8));
    this.playBtn.position.set(-0.016, -0.03, 0.001);
    this.playBtn.userData = { handler: this, play: true, tapOnly: true };
    const playTag = makeLabel('▶', { height: 0.013, size: 44, bg: null });
    playTag.position.copy(this.playBtn.position).add(new THREE.Vector3(0, 0, 0.004));
    this.resetBtn = new THREE.Mesh(new THREE.CircleGeometry(0.01, 24), mat(0x3b4664));
    this.resetBtn.position.set(0.016, -0.03, 0.001);
    this.resetBtn.userData = { handler: this, reset: true, tapOnly: true };
    const resetTag = makeLabel('↺', { height: 0.013, size: 44, bg: null });
    resetTag.position.copy(this.resetBtn.position).add(new THREE.Vector3(0, 0, 0.004));
    this.timerGroup.add(this.playBtn, playTag, this.resetBtn, resetTag);

    this.pieces = [];
    this.onPan = null; // the piece currently on the balance, if any
    this.shownKey = null;
    this.clock = 0; // simulated hours, 0–24
    this.running = false;
    this.seed = Math.floor(Math.random() * 1e9);
    this.reset(true);
  }

  // ───────────── a fresh potato (new trial) ─────────────

  reset(newPotato = false) {
    for (const p of this.pieces) {
      p.group.removeFromParent();
      p.group.traverse((o) => { o.geometry?.dispose?.(); });
    }
    this.pieces = [];
    this.onPan = null;
    this.shownKey = null;
    this.clock = 0;
    this.running = false;
    this.drawClock();
    for (const b of this.beakers) b.occupied = null;
    if (newPotato || !this.potato) {
      this.seed = Math.floor(Math.random() * 1e9);
      if (this.potato) this.potato.removeFromParent();
      this.potato = makePotato(POTATO_LEN);
      this.potato.position.set(BOARD.x, TOP + 0.019, BOARD.z - 0.01);
      this.potato.userData.left = POTATO_LEN;
      this.group.add(this.potato);
    }
    this.drawDisplay(null);
  }

  get targets() {
    const t = [...this.scalpelPicks, this.playBtn, this.resetBtn];
    for (const p of this.pieces) if (p.where !== 'beaker' || this.clock >= SOAK_HOURS) t.push(...p.picks);
    return t;
  }

  // ───────────── cutting ─────────────

  near(p, target, r) {
    if (this.app.presenting) return p.distanceTo(target) < r;
    const cam = this.app.camera;
    const a = this.group.localToWorld(p.clone()).project(cam);
    const b = this.group.localToWorld(target.clone()).project(cam);
    return Math.hypot((a.x - b.x) * cam.aspect, a.y - b.y) < r * 2.2;
  }

  follow(obj, world) {
    const off = obj.position.clone().sub(this.group.worldToLocal(world.clone()));
    return (w) => {
      obj.position.copy(this.group.worldToLocal(w.clone())).add(off);
      obj.position.y = Math.max(TOP + 0.002, obj.position.y);
    };
  }

  describe(o) {
    const u = o.userData;
    if (u.scalpel) return this.pieces.length >= 5 ? 'Scalpel' : 'Scalpel · drag the blade across the potato to cut a piece';
    if (u.play) return this.running ? 'Soaking…' : 'Play: start the 24-hour soak';
    if (u.reset) return 'Reset the clock';
    if (u.piece) return this.pieceHint(u.piece);
    return '';
  }

  pieceHint(p) {
    if (p.where === 'beaker') return this.clock >= SOAK_HOURS ? 'Take it out to weigh it again' : 'Still soaking';
    if (p.finalMass != null) return 'Done';
    if (p.initialMass == null) return p.dried ? 'Weigh it' : 'Dry it on the towel first';
    if (p.conc == null) return 'Put it in a beaker';
    return p.dried ? 'Weigh it again' : 'Dry it again first';
  }

  tap(o) {
    const u = o.userData;
    if (u.play) this.app.pressPlay();
    else if (u.reset) this.app.pressReset();
  }

  grab(o, mode, world) {
    const u = o.userData;
    if (u.scalpel) {
      const move = this.follow(this.scalpel, world);
      return {
        move: (w) => {
          move(w);
          if (this.pieces.length < 5) {
            const along = this.app.presenting ? [0, -0.012, -0.024] : [0, -0.015, -0.03, -0.045, -0.06];
            if (along.some((dx) => this.near(this.scalpel.position.clone().add(new THREE.Vector3(dx, 0, 0)), this.potato.position, 0.02))) this.cut();
          }
        },
        release: () => this.scalpel.position.copy(this.scalpelHome),
      };
    }
    if (u.piece) {
      const p = u.piece;
      if (p.where === 'beaker' && this.clock < SOAK_HOURS) return null;
      if (this.onPan === p) this.onPan = null;
      p.home.copy(p.group.position); // snap back here if the drop isn't valid
      const was = p.where;
      const move = this.follow(p.group, world);
      p.where = 'held';
      return {
        move,
        release: () => {
          if (this.near(p.group.position, TOWEL, 0.045)) this.dry(p);
          else if (this.near(p.group.position, this.balancePan, 0.04) && !this.onPan) this.toBalance(p);
          else {
            const bi = this.beakers.findIndex((b) => this.near(p.group.position, b.group.position, 0.035));
            if (bi >= 0 && p.initialMass != null && p.conc == null && !this.beakers[bi].occupied) this.toBeaker(p, bi);
            else {
              p.where = was;
              p.group.position.copy(p.home);
            }
          }
        },
      };
    }
    return null;
  }

  cut() {
    const i = this.pieces.length;
    this.potato.userData.left -= POTATO_LEN / 5;
    this.potato.position.x -= POTATO_LEN / 10;
    this.potato.userData.body.scale.x = Math.max(0.02, this.potato.userData.body.scale.x - 0.2);
    const r = rngFor(this.seed * 7 + i * 101);
    const uneven = r() < 0.18;
    const mass = BASE_MASS * (1 + 0.04 * gauss(r)) * (uneven ? 1 + (r() < 0.5 ? -1 : 1) * (0.15 + r() * 0.1) : 1);
    // natural piece-to-piece variation in how much water moves, on top of the underlying model; an unevenly
    // cut piece (a different surface area for its volume) soaks a little differently too
    const noise = 1 + 0.08 * gauss(r) + (uneven ? (r() < 0.5 ? -1 : 1) * (0.08 + r() * 0.08) : 0);
    const g = makePiece(POTATO_LEN / 5.6);
    const home = new THREE.Vector3(BOARD.x + 0.01 + i * 0.027, TOP + 0.009, TRAY_Z);
    g.position.copy(home);
    const piece = { id: i, group: g, home, where: 'tray', dried: false, mass0: mass, noise, initialMass: null, finalMass: null, conc: null, wet0: false, wet1: false, cause: uneven ? 'uneven' : null };
    g.userData.piece = piece;
    const picks = [g.userData.body];
    for (const m of g.children) m.userData = { handler: this, piece };
    piece.picks = picks.length ? picks : g.children;
    this.group.add(g);
    this.pieces.push(piece);
    this.app.onCut(piece);
  }

  // ───────────── drying and weighing ─────────────

  dry(p) {
    p.dried = true;
    p.where = 'tray';
    p.group.position.set(TOWEL.x + (this.pieces.indexOf(p) % 3) * 0.02 - 0.02, TOP + 0.006, TOWEL.z);
    p.home.copy(p.group.position);
    this.app.onDried(p);
  }

  toBalance(p) {
    p.where = 'balance';
    p.group.position.copy(this.balancePan);
    this.onPan = p;
    this.app.onWeighing(p);
  }

  /** The reading the balance currently shows for whichever piece is on it (grams, with a drying error if wet). */
  shownMass() {
    const p = this.onPan;
    if (!p) return null;
    const trueMass = p.conc == null ? p.mass0 : p.mass0 * (1 + this.liveFraction(p) / 100);
    return p.dried ? trueMass : trueMass * 1.07;
  }

  /** Record the balance's current reading. */
  record() {
    const p = this.onPan;
    if (!p) return;
    const value = Math.round(this.shownMass() * 100) / 100;
    const wet = !p.dried;
    if (p.initialMass == null) {
      p.initialMass = value;
      p.wet0 = wet;
      p.where = 'tray';
      p.group.position.set(BOARD.x + 0.01 + p.id * 0.027, TOP + 0.009, TRAY_Z);
      p.home.copy(p.group.position);
      this.onPan = null;
      this.app.onRecorded(p, 'initial');
    } else if (p.finalMass == null && p.conc != null && this.clock >= SOAK_HOURS) {
      p.finalMass = value;
      p.wet1 = wet;
      p.where = 'done';
      p.group.position.set(BOARD.x + 0.01 + p.id * 0.027, TOP + 0.009, TRAY_Z + 0.07);
      this.onPan = null;
      this.app.onRecorded(p, 'final');
    }
  }

  toBeaker(p, bi) {
    const b = this.beakers[bi];
    p.conc = b.C;
    p.dried = false;
    b.occupied = p;
    p.where = 'beaker';
    p.group.position.set(b.group.position.x, TOP + 0.012, b.group.position.z);
    this.app.onPlaced(p);
  }

  // ───────────── the clock ─────────────

  startClock() {
    if (this.running || this.clock >= SOAK_HOURS) return false;
    this.running = true;
    return true;
  }

  resetClock() {
    this.clock = 0;
    this.running = false;
    this.drawClock();
  }

  /** The live % change (not yet final) a piece in a beaker shows right now. */
  liveFraction(p) {
    return p.conc == null ? 0 : pctAt(p.conc, this.clock) * (p.noise ?? 1);
  }

  update(dt) {
    if (this.running) {
      this.clock += dt * (SOAK_HOURS / 7); // a 24-hour soak plays out over about 7 real seconds
      if (this.clock >= SOAK_HOURS) {
        this.clock = SOAK_HOURS;
        this.running = false;
        this.app.onSoakDone();
      }
      this.drawClock();
    }
    for (const p of this.pieces) {
      if (p.where !== 'beaker') continue;
      const pct = this.liveFraction(p);
      const s = THREE.MathUtils.clamp(1 + (pct / 100) * 0.8, 0.82, 1.2);
      p.group.scale.setScalar(s);
      const c = p.group.userData.body.material;
      c.color.set(pct >= 0 ? 0xf2e6c2 : 0xd9c48a).lerp(new THREE.Color(pct >= 0 ? 0xfff6da : 0xb89a5c), Math.min(1, Math.abs(pct) / 20));
    }
    if (this.onPan) {
      const shown = this.shownMass();
      if (shown !== this.shownKey) {
        this.shownKey = shown;
        this.drawDisplay(shown);
      }
    } else if (this.shownKey !== null) {
      this.shownKey = null;
      this.drawDisplay(null);
    }
  }

  drawClock() {
    const { c, t } = this.clockDisplay;
    const x = c.getContext('2d');
    x.fillStyle = '#10162c';
    x.fillRect(0, 0, 320, 110);
    x.fillStyle = this.running ? '#ffd166' : '#7ee2a8';
    x.font = '700 56px ui-monospace, Consolas, monospace';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(`${this.clock.toFixed(1)} h`, 160, 44);
    x.font = '400 22px system-ui, sans-serif';
    x.fillStyle = '#aab3d8';
    x.fillText(this.clock >= SOAK_HOURS ? 'soak complete' : this.running ? 'soaking…' : 'paused', 160, 80);
    t.needsUpdate = true;
  }

  drawDisplay(mass) {
    const { c, t } = this.display;
    const x = c.getContext('2d');
    x.fillStyle = '#10141c';
    x.fillRect(0, 0, 256, 96);
    x.fillStyle = mass == null ? '#3d6b55' : '#7eff9e';
    x.font = '700 48px ui-monospace, Consolas, monospace';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(mass == null ? '--.-- g' : `${mass.toFixed(2)} g`, 128, 52);
    t.needsUpdate = true;
  }

  // ───────────── quick steps (for tests, or anyone who can't reach) ─────────────

  quickCutAll() {
    while (this.pieces.length < 5) this.cut();
  }
}

function rngFor(seed) {
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
