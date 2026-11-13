import * as THREE from 'three';
import { makeLabel } from '../../../../shared/ui/labels.js';
import { ORGANS, CARDS, SYSTEMS, organsFor, cardsFor } from '../data/organs.js';

// Each student's own life-size skeleton, standing on the floor beside their desk, and the organs on the desk
// (shown at 60% size so they fit; they grow to life size when picked up). Put each organ in its place:
//   Core     – it snaps in when it is close to the right place; a clearly wrong place counts as a mistake and
//              the organ goes back to the desk. Hints show a ghost of the organ where it belongs.
//   Advanced – organs stay wherever you put them (no names on the desk); "Check my body" marks them, and the
//              wrong ones go back to the desk.
// Then function cards: drag each card onto the organ that does that job; it becomes a label beside the body.
// The skull cap hinges open for the brain; the ribcage can be solid, see-through or hidden.
//
// Model: BodyParts3D (CC BY-SA 2.1 Japan), see ../../CREDITS.md. Body coordinates: metres, x = the body's left,
// y = up from the soles of the feet, z = forward; every organ's mesh already sits in its real place.

export const TOP = -0.3;
const DESK = new THREE.Vector3(-0.4, TOP, 0.06);
const DESK_W = 0.72;
const DESK_D = 0.5;
const DESK_SCALE = 0.6;
export const SKEL = new THREE.Vector3(0.36, 0, -0.06); // y is set from the real floor each frame
export const SKEL_YAW = -0.3; // turned a little towards the student
const SNAP = 0.07; // Core: how close (m) counts as "in the right place"
const CHECK = 0.05; // Advanced: how close counts as right when checked
const WRONG = 0.08; // dropped this close to another organ's place: a mistake
const TORSO = { min: new THREE.Vector3(-0.3, 0.7, -0.25), max: new THREE.Vector3(0.3, 1.75, 0.3) };

/** Opacity, switching the material to transparent (and back) only when it changes. */
function setOpacity(mat, o) {
  const t = o < 1;
  if (mat.transparent !== t) {
    mat.transparent = t;
    mat.depthWrite = !t;
    mat.needsUpdate = true;
  }
  mat.opacity = o;
}

const boneMat = () => new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.72, metalness: 0 });

/** Load the GLB: { id → geometry in body coordinates }. */
export async function loadBody(url) {
  const [{ GLTFLoader }, { MeshoptDecoder }] = await Promise.all([
    import('three/addons/loaders/GLTFLoader.js'),
    import('three/addons/libs/meshopt_decoder.module.js'),
  ]);
  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(url);
  // compressed meshes keep small integers plus a scale/offset on their node: bake that into plain geometry
  const geos = {};
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    const src = o.geometry;
    const g = new THREE.BufferGeometry();
    for (const name of ['position', 'normal']) {
      const a = src.getAttribute(name);
      if (!a) continue;
      const arr = new Float32Array(a.count * 3);
      for (let i = 0; i < a.count; i++) arr.set([a.getX(i), a.getY(i), a.getZ(i)], i * 3);
      g.setAttribute(name, new THREE.BufferAttribute(arr, 3));
    }
    g.setIndex(src.index);
    g.applyMatrix4(o.matrixWorld);
    if (!g.getAttribute('normal')) g.computeVertexNormals();
    else {
      const n = g.getAttribute('normal');
      const v = new THREE.Vector3();
      for (let i = 0; i < n.count; i++) {
        v.fromBufferAttribute(n, i).normalize();
        n.setXYZ(i, v.x, v.y, v.z);
      }
    }
    geos[o.name || o.parent.name] = g;
  });
  return geos;
}

function cardTexture(card, matched, wrong) {
  const c = document.createElement('canvas');
  c.width = 384;
  c.height = 192;
  const x = c.getContext('2d');
  x.fillStyle = wrong ? '#ffd9d9' : matched ? '#e3f7e9' : '#fff7d6';
  x.fillRect(0, 0, 384, 192);
  x.strokeStyle = wrong ? '#d04848' : matched ? '#3aa860' : '#d8b440';
  x.lineWidth = 8;
  x.strokeRect(4, 4, 376, 184);
  x.fillStyle = '#1d2236';
  x.textAlign = 'center';
  let y = 34;
  if (matched) {
    x.font = '800 40px system-ui, sans-serif';
    x.fillText(card.name, 192, 52);
    y = 98;
  }
  x.font = `600 ${matched ? 28 : 33}px system-ui, sans-serif`;
  const words = card.text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const t = line ? `${line} ${w}` : w;
    if (line && x.measureText(t).width > 350) {
      lines.push(line);
      line = w;
    } else line = t;
  }
  lines.push(line);
  const lh = matched ? 32 : 40;
  if (!matched) y = 96 - ((lines.length - 1) * lh) / 2 + 12;
  lines.forEach((l, i) => x.fillText(l, 192, y + i * lh));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Body {
  constructor(app, geos) {
    this.app = app;
    this.group = new THREE.Group();
    app.lab.add(this.group);
    this.level = 'core';
    this.ribs = 'solid';
    this.capOpen = true;
    this.hint = null; // organ id whose ghost is showing
    this.showAnswers = false;
    this.system = null; // highlighted system (plenary)
    this.complete = false; // plenary: every organ shown in place
    this.wrong = 0;
    this.hints = 0;
    this.cardWrong = 0;
    this.tmp = new THREE.Vector3();

    // ── the desk ──
    const top = new THREE.Mesh(new THREE.BoxGeometry(DESK_W, 0.014, DESK_D), new THREE.MeshStandardMaterial({ color: 0xe9ecf2, roughness: 0.45 }));
    top.position.set(DESK.x, TOP - 0.007, DESK.z);
    const tray = new THREE.Mesh(new THREE.BoxGeometry(DESK_W - 0.03, 0.004, DESK_D - 0.03), new THREE.MeshStandardMaterial({ color: 0x2d6f6a, roughness: 0.8 }));
    tray.position.set(DESK.x, TOP + 0.002, DESK.z);
    this.group.add(top, tray);

    // ── the skeleton ──
    this.skel = new THREE.Group();
    this.skel.position.copy(SKEL);
    this.skel.rotation.y = SKEL_YAW;
    this.group.add(this.skel);
    this.boneMat = boneMat();
    this.ribMat = boneMat();
    this.bones = new THREE.Mesh(geos.bones, this.boneMat);
    this.ribcage = new THREE.Mesh(geos.ribcage, this.ribMat);
    this.skel.add(this.bones, this.ribcage);
    // the skull cap hinges at the back of the skull
    geos.skullcap.computeBoundingBox();
    const cb = geos.skullcap.boundingBox;
    this.capPivot = new THREE.Group();
    this.capPivot.position.set(0, cb.min.y, cb.min.z);
    const cap = new THREE.Mesh(geos.skullcap.clone().translate(0, -cb.min.y, -cb.min.z), this.boneMat);
    this.capPivot.add(cap);
    this.skel.add(this.capPivot);
    this.capBase = this.capPivot.position.clone();
    this.capT = 1; // 0 = on the skull, 1 = lifted off

    // ── the organs ──
    this.pieces = ORGANS.map((o) => {
      const geo = geos[o.id].clone();
      geo.computeBoundingBox();
      const home = geo.boundingBox.getCenter(new THREE.Vector3());
      geo.translate(-home.x, -home.y, -home.z);
      geo.computeBoundingBox();
      const size = geo.boundingBox.getSize(new THREE.Vector3());
      const mat = new THREE.MeshStandardMaterial({ color: o.color, roughness: 0.55, metalness: 0, transparent: false });
      const mesh = new THREE.Mesh(geo, mat);
      const group = new THREE.Group();
      group.add(mesh);
      mesh.userData = { handler: this, organ: o.id };
      const ghost = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: o.color, transparent: true, opacity: 0.32, depthWrite: false }));
      ghost.position.copy(home);
      ghost.visible = false;
      this.skel.add(ghost);
      const tag = makeLabel(o.name, { height: 0.016, size: 40 });
      this.group.add(tag);
      return { id: o.id, o, group, mesh, mat, ghost, tag, home, size, where: 'desk', ok: false, target: null, flash: 0 };
    });
    this.layoutDesk();

    // ── function cards ──
    this.cards = CARDS.map((c) => {
      const mat = new THREE.MeshBasicMaterial({ map: cardTexture(c, false), toneMapped: false, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.07), mat);
      const group = new THREE.Group();
      group.add(mesh);
      mesh.userData = { handler: this, card: c.id };
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 }));
      line.visible = false;
      this.skel.add(line);
      return { id: c.id, c, group, mesh, mat, line, where: 'off', matched: false, target: null, wrongFlash: 0 };
    });
    this.reset();
  }

  // ───────────── layout ─────────────

  /** Pieces for this level, laid out in rows on the desk (back row first). */
  layoutDesk() {
    const list = organsFor(this.level).map((o) => this.piece(o.id));
    const rows = [[]];
    let w = 0;
    const gap = 0.025;
    for (const p of list) {
      const pw = p.size.x * DESK_SCALE;
      if (w + pw > DESK_W - 0.06 && rows.at(-1).length) {
        rows.push([]);
        w = 0;
      }
      rows.at(-1).push(p);
      w += pw + gap;
    }
    const depths = rows.map((row) => Math.max(...row.map((p) => p.size.z * DESK_SCALE)));
    const free = DESK_D - 0.06 - depths.reduce((a, d) => a + d + 0.03, 0);
    const rowGap = 0.03 + Math.max(0, free / rows.length);
    let z = DESK.z - DESK_D / 2 + 0.03;
    for (const row of rows) {
      const depth = Math.max(...row.map((p) => p.size.z * DESK_SCALE));
      const width = row.reduce((a, p) => a + p.size.x * DESK_SCALE, 0) + gap * (row.length - 1);
      let x = DESK.x - width / 2;
      for (const p of row) {
        const pw = p.size.x * DESK_SCALE;
        p.deskPos = new THREE.Vector3(x + pw / 2, TOP + 0.004 + (p.size.y * DESK_SCALE) / 2, z + depth / 2);
        p.tagPos = new THREE.Vector3(x + pw / 2, TOP + 0.012, z + depth + 0.012);
        x += pw + gap;
      }
      z += depth + rowGap;
    }
    this.deskDepth = z - (DESK.z - DESK_D / 2);
  }

  /** Function cards in a grid on the desk. */
  layoutCards() {
    const list = cardsFor(this.level).map((c) => this.card(c.id));
    const cols = 4;
    list.forEach((k, i) => {
      const r = Math.floor(i / cols);
      const col = i % cols;
      k.deskPos = new THREE.Vector3(DESK.x - DESK_W / 2 + 0.09 + col * 0.18, TOP + 0.04, DESK.z - DESK_D / 2 + 0.065 + r * 0.095);
    });
    // label slots beside the body, on the side of each organ, at its height, spread so they don't overlap
    for (const k of list) {
      const ps = this.cardPieces(k.id);
      // a pair (lungs, kidneys) points at the one on the body's left
      const p = ps.length > 1 ? ps.reduce((a, q) => (q.home.x > a.home.x ? q : a)) : ps[0];
      k.anchor = p.home.clone();
    }
    // the half of the cards for organs furthest to the body's right go on that side, the rest on its left
    const byX = [...list].sort((a, b) => a.anchor.x - b.anchor.x || a.anchor.y - b.anchor.y);
    const half = Math.floor(byX.length / 2);
    const slots = { '-1': byX.slice(0, half), 1: byX.slice(half) };
    for (const [side, ks] of Object.entries(slots)) {
      ks.sort((a, b) => b.anchor.y - a.anchor.y);
      let y = Infinity;
      for (const k of ks) {
        y = Math.min(k.anchor.y, y - 0.08);
        k.slot = new THREE.Vector3(Number(side) * 0.32, y, 0.1);
      }
    }
  }

  piece(id) {
    return this.pieces.find((p) => p.id === id);
  }

  card(id) {
    return this.cards.find((k) => k.id === id);
  }

  cardPieces(cardId) {
    return this.pieces.filter((p) => p.o.card === cardId);
  }

  get active() {
    return organsFor(this.level).map((o) => this.piece(o.id));
  }

  get activeCards() {
    return cardsFor(this.level).map((c) => this.card(c.id));
  }

  // ───────────── state ─────────────

  setLevel(level) {
    this.level = level;
    this.layoutDesk();
    this.layoutCards();
    for (const p of this.pieces) {
      const on = this.active.includes(p);
      if (!on && p.where !== 'off') this.toOff(p);
      else if (on && p.where === 'off') this.toDesk(p, true);
      else if (on && p.where === 'desk') this.toDesk(p);
      else if (on && p.where === 'body' && level === 'core' && !p.ok) this.toDesk(p);
    }
    this.layoutCardsInPlace();
  }

  reset() {
    this.wrong = 0;
    this.hints = 0;
    this.cardWrong = 0;
    this.hint = null;
    this.layoutDesk();
    this.layoutCards();
    for (const p of this.pieces) {
      p.ok = false;
      if (this.active.includes(p)) this.toDesk(p, true);
      else this.toOff(p);
    }
    for (const k of this.cards) {
      k.matched = false;
      this.paintCard(k);
      this.cardOff(k);
    }
    this.capOpen = true;
  }

  resetCards() {
    this.cardWrong = 0;
    for (const k of this.cards) {
      k.matched = false;
      this.paintCard(k);
      if (this.cardsOut) this.cardToDesk(k, true);
    }
  }

  showCards(on) {
    this.cardsOut = on;
    this.layoutCards();
    for (const k of this.cards) {
      const active = this.activeCards.includes(k);
      if (!on || !active) {
        if (k.matched && active) this.cardToSlot(k);
        else this.cardOff(k);
      } else if (k.matched) this.cardToSlot(k);
      else this.cardToDesk(k, k.where === 'off');
    }
    // with the cards out, the organs that are still on the desk sit at the back out of the way
    for (const p of this.active) if (p.where === 'desk') p.group.visible = !on;
    for (const p of this.active) p.tag.visible = p.where === 'desk' && !on && this.level === 'core';
  }

  layoutCardsInPlace() {
    for (const k of this.cards) {
      if (!this.activeCards.includes(k)) this.cardOff(k);
      else if (k.matched) this.cardToSlot(k);
      else if (this.cardsOut) this.cardToDesk(k);
    }
  }

  /** Plenary: everything in place (without counting as the student's own work). */
  setComplete(on) {
    this.complete = on;
    for (const p of this.active) {
      if (on && p.where !== 'body') {
        p.wasDesk = true;
        this.toBody(p);
      } else if (!on && p.wasDesk) {
        p.wasDesk = false;
        if (!p.ok) this.toDesk(p);
      }
    }
    if (on) this.capOpen = false;
  }

  // ───────────── moving things ─────────────

  animate(obj, parent, pos, scale, rotY = 0) {
    if (obj.parent !== parent) parent.attach(obj);
    obj.userData.target = { pos: pos.clone(), scale, rot: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY) };
  }

  toDesk(p, instant = false) {
    p.where = 'desk';
    p.ok = false;
    p.group.visible = !this.cardsOut;
    this.animate(p.group, this.group, p.deskPos, DESK_SCALE);
    if (instant) this.finish(p.group);
    p.tag.position.copy(p.tagPos);
    p.tag.visible = this.level === 'core' && !this.cardsOut;
  }

  toBody(p, at = p.home) {
    p.where = 'body';
    p.group.visible = true;
    p.tag.visible = false;
    this.animate(p.group, this.skel, at, 1);
  }

  toOff(p) {
    p.where = 'off';
    p.ok = false;
    p.group.visible = false;
    p.tag.visible = false;
    p.group.removeFromParent();
  }

  cardToDesk(k, instant = false) {
    k.where = 'desk';
    k.group.visible = true;
    k.line.visible = false;
    const q = -1.0; // tilted up towards the student
    this.animate(k.group, this.group, k.deskPos, 1);
    k.group.userData.target.rot.setFromEuler(new THREE.Euler(q, 0, 0));
    if (instant) this.finish(k.group);
  }

  cardToSlot(k) {
    k.where = 'slot';
    k.group.visible = true;
    this.animate(k.group, this.skel, k.slot, 1);
    const pts = [new THREE.Vector3(k.slot.x - Math.sign(k.slot.x) * 0.07, k.slot.y, k.slot.z), k.anchor.clone().setZ(Math.max(k.anchor.z, 0.02))];
    k.line.geometry.setFromPoints(pts);
    k.line.visible = true;
  }

  cardOff(k) {
    k.where = 'off';
    k.group.visible = false;
    k.line.visible = false;
    k.group.removeFromParent();
  }

  finish(obj) {
    const t = obj.userData.target;
    if (!t) return;
    obj.position.copy(t.pos);
    obj.scale.setScalar(t.scale);
    obj.quaternion.copy(t.rot);
    obj.userData.target = null;
  }

  paintCard(k, wrong = false) {
    k.mat.map?.dispose();
    k.mat.map = cardTexture(k.c, k.matched, wrong);
    k.mat.needsUpdate = true;
  }

  // ───────────── where things are ─────────────

  /** Distance (m) between two world points: in 3D in a headset; across the screen (at b's depth) on a screen. */
  dist(a, b) {
    if (this.app.presenting) return a.distanceTo(b);
    const cam = this.app.camera;
    const pa = a.clone().project(cam);
    const pb = b.clone().project(cam);
    const h = 2 * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2) * cam.position.distanceTo(b);
    return (Math.hypot((pa.x - pb.x) * cam.aspect, pa.y - pb.y) * h) / 2;
  }

  homeWorld(p) {
    return this.skel.localToWorld(p.home.clone());
  }

  /** The nearest place (of the organs not yet in place, plus `self`) to a world point. */
  nearestHome(world, self) {
    let best = null;
    for (const p of this.active) {
      if (p !== self && p.where === 'body' && (p.ok || this.level === 'advanced')) continue;
      const d = this.dist(world, this.homeWorld(p));
      if (!best || d < best.d) best = { p, d };
    }
    return best;
  }

  overBody(world) {
    if (!this.app.presenting) {
      // on a screen: within the torso's outline
      const centre = this.skel.localToWorld(new THREE.Vector3(0, 1.2, 0));
      const local = this.skel.worldToLocal(world.clone());
      return this.dist(world, centre) < 0.5 && local.x > TORSO.min.x - 0.1 && local.x < TORSO.max.x + 0.1;
    }
    const l = this.skel.worldToLocal(world.clone());
    return l.x > TORSO.min.x && l.x < TORSO.max.x && l.y > TORSO.min.y && l.y < TORSO.max.y && l.z > TORSO.min.z && l.z < TORSO.max.z;
  }

  // ───────────── interaction ─────────────

  get targets() {
    const t = [];
    const mode = this.app.state.mode;
    if (mode === 'build') for (const p of this.active) if (p.where === 'desk' || (p.where === 'body' && this.level === 'advanced' && !p.ok)) t.push(p.mesh);
    if (mode === 'functions') for (const k of this.activeCards) if (k.where === 'desk') t.push(k.mesh);
    if (mode === 'build' || mode === 'functions' || mode === 'systems') for (const p of this.active) if (p.where === 'body' && (p.ok || this.complete)) t.push(p.mesh);
    return t;
  }

  describe(o) {
    const u = o.userData;
    if (u.card) return 'Function card · drag it onto the organ that does this job';
    const p = this.piece(u.organ);
    if (p.where === 'body' && (p.ok || this.complete)) return p.o.name;
    if (this.level === 'advanced') return p.where === 'body' ? 'Placed · press “Check my body” when you are ready' : 'An organ: which one is it, and where does it go?';
    return `${p.o.name} · put it in the skeleton`;
  }

  tap(o) {
    const u = o.userData;
    if (u.organ) this.app.onOrganTapped(this.piece(u.organ));
  }

  grab(o, mode, world) {
    const u = o.userData;
    if (u.card) return this.grabCard(this.card(u.card), world);
    const p = this.piece(u.organ);
    if (this.app.state.mode !== 'build' || p.ok || this.complete) return null; // placed for good: tap only
    this.group.attach(p.group);
    p.group.userData.target = null;
    const off = p.group.position.clone().sub(this.group.worldToLocal(world.clone()));
    p.where = 'held';
    p.tag.visible = false;
    p.held = true;
    if (p.id === 'brain') this.capOpen = true;
    this.app.onPicked(p);
    return {
      move: (w) => {
        p.group.position.copy(this.group.worldToLocal(w.clone())).add(off);
        if (Math.abs(p.group.position.x - DESK.x) < DESK_W / 2 && Math.abs(p.group.position.z - DESK.z) < DESK_D / 2) p.group.position.y = Math.max(TOP + 0.01, p.group.position.y); // not through the desk
      },
      release: () => {
        p.held = false;
        this.drop(p);
      },
    };
  }

  drop(p) {
    const world = p.group.getWorldPosition(new THREE.Vector3());
    const own = this.dist(world, this.homeWorld(p));
    if (this.level === 'core') {
      const near = this.nearestHome(world, p);
      if (own < SNAP && (near?.p === p || own < SNAP / 2)) {
        p.ok = true;
        this.toBody(p);
        if (this.hint === p.id) this.hint = null;
        if (p.id === 'brain') this.capOpen = false;
        this.app.onPlaced(p, true);
      } else if (near && near.p !== p && near.d < WRONG && this.overBody(world)) {
        this.wrong++;
        p.flash = 1;
        this.toDesk(p);
        this.app.onWrong(p, near.p);
      } else {
        this.toDesk(p);
        if (this.overBody(world)) this.app.onNotQuite(p);
      }
      return;
    }
    // advanced: it stays where it was put (if that is in the body)
    if (this.overBody(world)) {
      const at = this.skel.worldToLocal(world.clone());
      if (!this.app.presenting) at.z = p.home.z; // a mouse can't set the depth
      this.toBody(p, at);
      this.finish(p.group);
      this.app.onPlaced(p, null);
    } else this.toDesk(p);
  }

  /** Advanced: mark every organ in the body; wrong ones go back to the desk. */
  check() {
    let right = 0;
    let wrongNow = 0;
    for (const p of this.active) {
      if (p.where !== 'body' || p.ok) continue;
      const d = this.dist(p.group.getWorldPosition(new THREE.Vector3()), this.homeWorld(p));
      if (d < CHECK) {
        p.ok = true;
        right++;
        this.toBody(p);
      } else {
        wrongNow++;
        p.flash = 1;
        this.toDesk(p);
      }
    }
    this.wrong += wrongNow;
    if (this.piece('brain').ok) this.capOpen = false;
    return { right, wrong: wrongNow };
  }

  grabCard(k, world) {
    if (k.matched) return null;
    this.group.attach(k.group);
    k.group.userData.target = null;
    const off = k.group.position.clone().sub(this.group.worldToLocal(world.clone()));
    return {
      move: (w) => {
        k.group.position.copy(this.group.worldToLocal(w.clone())).add(off);
        k.group.lookAt(this.app.viewCamera().getWorldPosition(new THREE.Vector3()));
      },
      release: () => {
        const at = k.group.getWorldPosition(new THREE.Vector3());
        let best = null;
        for (const p of this.active) {
          const d = this.dist(at, (p.where === 'body' ? p.group : p.ghost).getWorldPosition(new THREE.Vector3()));
          if (!best || d < best.d) best = { p, d };
        }
        if (best && best.d < WRONG && best.p.o.card === k.id) {
          k.matched = true;
          this.paintCard(k);
          this.cardToSlot(k);
          for (const p of this.cardPieces(k.id)) if (p.where !== 'body' && this.active.includes(p)) {
            p.wasDesk = true;
            this.toBody(p);
          }
          this.app.onCardMatched(k);
        } else if (best && best.d < WRONG && this.overBody(at)) {
          this.cardWrong++;
          k.wrongFlash = 1.2;
          this.paintCard(k, true);
          this.cardToDesk(k);
          this.app.onCardWrong(k, best.p);
        } else this.cardToDesk(k);
      },
    };
  }

  // ───────────── progress ─────────────

  get placed() {
    return this.active.filter((p) => p.ok).length;
  }

  get matched() {
    return this.activeCards.filter((k) => k.matched).length;
  }

  // ───────────── every frame ─────────────

  update(dt, floorY) {
    this.skel.position.y = floorY;
    const k = 1 - Math.exp(-dt * 12);
    for (const obj of [...this.pieces.map((p) => p.group), ...this.cards.map((c) => c.group)]) {
      const t = obj.userData.target;
      if (!t) continue;
      obj.position.lerp(t.pos, k);
      obj.scale.setScalar(THREE.MathUtils.lerp(obj.scale.x, t.scale, k));
      obj.quaternion.slerp(t.rot, k);
      if (obj.position.distanceTo(t.pos) < 0.0005 && Math.abs(obj.scale.x - t.scale) < 0.002) this.finish(obj);
    }
    // held organs grow to life size and turn to match the skeleton
    for (const p of this.pieces) {
      if (!p.held) continue;
      p.group.scale.setScalar(THREE.MathUtils.lerp(p.group.scale.x, 1, k));
      p.group.quaternion.slerp(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), SKEL_YAW), k);
    }
    // skull cap
    this.capT += ((this.capOpen ? 1 : 0) - this.capT) * Math.min(1, dt * 5);
    this.capPivot.position.copy(this.capBase).add(this.tmp.set(0, 0.14 * this.capT, -0.03 * this.capT));
    this.capPivot.rotation.x = -0.55 * this.capT;
    // ribcage
    const ribOp = this.ribs === 'clear' ? 0.28 : 1;
    this.ribcage.visible = this.ribs !== 'hidden';
    setOpacity(this.ribMat, ribOp);
    // ghosts: a hint, or every answer
    for (const p of this.pieces) {
      const on = this.active.includes(p) && p.where !== 'body' && (this.hint === p.id || this.showAnswers);
      p.ghost.visible = on;
      if (on) p.ghost.material.opacity = 0.22 + 0.14 * Math.sin(performance.now() / 260);
    }
    // systems: the system's organs bright, everything else faded
    const sys = this.system ? SYSTEMS.find((s) => s.id === this.system) : null;
    const t = performance.now() / 1000;
    for (const p of this.pieces) {
      const lit = !sys || sys.organs.includes(p.id);
      const fade = sys && !lit;
      setOpacity(p.mat, fade ? 0.13 : 1);
      const glow = sys && lit ? 0.18 + 0.12 * Math.sin(t * 3) : 0;
      p.flash = Math.max(0, p.flash - dt * 1.5);
      p.mat.emissive.setRGB(glow + p.flash * 0.8, glow * 0.7, glow * 0.5);
    }
    setOpacity(this.boneMat, sys ? 0.45 : 1);
    if (!sys && this.ribs === 'solid') setOpacity(this.ribMat, 1);
    else if (sys) setOpacity(this.ribMat, Math.min(ribOp, 0.45));
    for (const c of this.cards) {
      if (c.wrongFlash > 0) {
        c.wrongFlash -= dt;
        if (c.wrongFlash <= 0) this.paintCard(c);
      }
    }
  }
}

