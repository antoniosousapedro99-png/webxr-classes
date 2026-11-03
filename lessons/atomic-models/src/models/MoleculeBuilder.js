import * as THREE from 'three';
import { bySymbol, VDW_RADII } from '../data/elements.js';
import { BUILD_ATOMS, bondLength, bondEnergy, idealAngle, formulaOf, formulaKey, KNOWN } from '../data/bonding.js';
import { sound } from '../util/sound.js';
import * as X from '../chemist/explain.js';

// Hands-on, editable ball-and-stick molecules.
//  • pull an atom away from its molecule → the bond stretches and breaks
//  • let go of an atom close to another → they bond (if both have a free bonding site)
//  • tap a bond → single → double → triple
//  • drop an atom in the bin → removed; take new atoms from the tray
//  • grip (or Shift-drag on screen) moves a whole molecule
// A small position-based solver keeps bond lengths and VSEPR bond angles, so shapes settle naturally.

const S = 0.1; // metres per ångström (magnified one billion times)
const BALL_R = { H: 0.022, default: 0.032 };
const BOND_R = 0.0065;
const SNAP = 1.45; // bond on release when closer than 1.45× the bond length
const UP = new THREE.Vector3(0, 1, 0);
const E = (a, b, order) => (order ? bondEnergy(a, b, order) ?? 350 * order : 0);

/** Stronger bonds have to be pulled further before they snap (H–H ≈ 2.1×, N≡N ≈ 2.9× their length). */
const breakStretch = (bond) => 1.5 + E(bond.a.sym, bond.b.sym, bond.order) / 700;

function ringTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  ctx.strokeStyle = '#ffd166';
  ctx.lineWidth = 8;
  ctx.setLineDash([14, 10]);
  ctx.beginPath();
  ctx.arc(64, 64, 54, 0, Math.PI * 2);
  ctx.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class MoleculeBuilder {
  constructor(app) {
    this.app = app;
    this.group = new THREE.Group();
    this.group.name = 'builder';
    this.content = new THREE.Group();
    this.group.add(this.content);

    this.atoms = [];
    this.bonds = [];
    this.nextId = 1;
    this.style = 'ball';
    this.single = new Set(); // atoms held on their own
    this.held = new Set(); // every atom currently held (single or whole-molecule)
    this.components = [];
    this.completeIds = new Set();
    this.rules = { tray: true, bin: true }; // reactions turn both off: atoms can't be created or destroyed
    this.energy = { in: 0, out: 0 }; // kJ/mol taken in breaking bonds / given out making bonds
    this.heat = 0; // after a reaction the products vibrate
    this.showElectrons = true;
    this.lastPulse = 0;

    this.sphere = new THREE.SphereGeometry(1, 32, 20);
    this.cylinder = new THREE.CylinderGeometry(1, 1, 1, 12);
    this.mats = new Map();
    this.bondMat = new THREE.MeshStandardMaterial({ color: 0xd8dbe8, roughness: 0.5 });
    this.strainMat = new THREE.MeshStandardMaterial({ color: 0xff8a5c, emissive: 0x802000, roughness: 0.5 });
    this.pairGeo = new THREE.SphereGeometry(0.0055, 12, 8);
    this.pairMat = new THREE.MeshStandardMaterial({ color: 0x4cc9ff, emissive: 0x1a8fd0, emissiveIntensity: 1.2 });
    this.haloMat = new THREE.SpriteMaterial({ map: ringTexture(), transparent: true, depthWrite: false, toneMapped: false });

    // Preview of a bond about to form (or not) when an atom is held near another.
    this.preview = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
      new THREE.LineDashedMaterial({ color: 0x7ee2a8, dashSize: 0.01, gapSize: 0.008 }),
    );
    this.preview.visible = false;
    this.target = new THREE.Mesh(this.sphere, new THREE.MeshBasicMaterial({ color: 0x7ee2a8, transparent: true, opacity: 0.25, depthWrite: false }));
    this.target.visible = false;
    this.group.add(this.preview, this.target);
    this.candidate = null;
  }

  // ───────────── model ─────────────

  material(sym) {
    if (!this.mats.has(sym)) this.mats.set(sym, new THREE.MeshStandardMaterial({ color: bySymbol(sym).color, roughness: 0.35 }));
    return this.mats.get(sym);
  }

  ballRadius(sym) {
    return this.style === 'space' ? (VDW_RADII[sym] / 100) * S : (BALL_R[sym] ?? BALL_R.default);
  }

  addAtom(sym, pos) {
    const atom = { id: this.nextId++, sym, pos: pos.clone() };
    atom.mesh = new THREE.Mesh(this.sphere, this.material(sym));
    atom.mesh.scale.setScalar(this.ballRadius(sym));
    atom.mesh.position.copy(pos);
    atom.mesh.userData = { handler: this, atom };
    atom.halo = new THREE.Sprite(this.haloMat);
    this.content.add(atom.mesh, atom.halo);
    this.atoms.push(atom);
    return atom;
  }

  removeAtom(atom) {
    for (const b of this.bondsOf(atom)) this.removeBond(b);
    this.content.remove(atom.mesh, atom.halo);
    this.atoms = this.atoms.filter((a) => a !== atom);
    this.single.delete(atom);
    this.held.delete(atom);
  }

  addBond(a, b, order = 1) {
    const bond = { a, b, order, meshes: [] };
    this.bonds.push(bond);
    this.makeBondMeshes(bond);
    return bond;
  }

  makeBondMeshes(bond) {
    for (const m of bond.meshes) this.content.remove(m);
    for (const m of bond.pairs ?? []) this.content.remove(m);
    bond.meshes = [];
    bond.pairs = [];
    for (let i = 0; i < bond.order; i++) {
      const m = new THREE.Mesh(this.cylinder, this.bondMat);
      m.userData = { handler: this, bond, tapOnly: true }; // tapped with a ray/click, never grabbed by reach
      m.visible = this.style !== 'space';
      this.content.add(m);
      bond.meshes.push(m);
      // Each shared pair of electrons, drawn where it sits: closer to the atom that pulls harder.
      const pair = new THREE.Mesh(this.pairGeo, this.pairMat);
      this.content.add(pair);
      bond.pairs.push(pair);
    }
  }

  removeBond(bond) {
    for (const m of bond.meshes) this.content.remove(m);
    for (const m of bond.pairs) this.content.remove(m);
    this.bonds = this.bonds.filter((b) => b !== bond);
  }

  bondsOf(atom) {
    return this.bonds.filter((b) => b.a === atom || b.b === atom);
  }

  neighbours(atom) {
    return this.bondsOf(atom).map((b) => (b.a === atom ? b.b : b.a));
  }

  bondBetween(a, b) {
    return this.bonds.find((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a));
  }

  used(atom) {
    return this.bondsOf(atom).reduce((s, b) => s + b.order, 0);
  }

  free(atom) {
    return BUILD_ATOMS[atom.sym].valence - this.used(atom);
  }

  restLength(bond) {
    return bondLength(bond.a.sym, bond.b.sym, bond.order) * S;
  }

  clear() {
    for (const a of [...this.atoms]) this.removeAtom(a);
    this.nextId = 1;
  }

  /** Load a ready-made molecule from molecules.js onto the workbench. */
  load(def) {
    this.loadSet([[def, new THREE.Vector3()]]);
  }

  /** Load several molecules, each at an offset (metres). */
  loadSet(list) {
    this.clear();
    this.energy = { in: 0, out: 0 };
    this.heat = 0;
    for (const [def, offset] of list) this.addMolecule(def, offset);
    this.analyze();
    for (const comp of this.components) comp.justCompleted = false;
  }

  addMolecule(def, offset) {
    const c = new THREE.Vector3();
    def.atoms.forEach(([, x, y, z]) => c.add(new THREE.Vector3(x, y, z)));
    c.divideScalar(def.atoms.length);
    const made = def.atoms.map(([sym, x, y, z]) => this.addAtom(sym, new THREE.Vector3(x, y, z).sub(c).multiplyScalar(S).add(offset)));
    for (const [i, j, order] of def.bonds) this.addBond(made[i], made[j], order);
  }

  setStyle(style) {
    this.style = style;
    for (const a of this.atoms) a.mesh.scale.setScalar(this.ballRadius(a.sym));
    for (const b of this.bonds) for (const m of b.meshes) m.visible = style !== 'space';
  }

  get grabTargets() {
    const t = this.atoms.map((a) => a.mesh);
    if (this.style !== 'space') for (const b of this.bonds) t.push(...b.meshes);
    return t;
  }

  // ───────────── recognising what was built ─────────────

  component(atom) {
    const seen = new Set([atom]);
    const queue = [atom];
    while (queue.length) for (const n of this.neighbours(queue.shift())) if (!seen.has(n)) { seen.add(n); queue.push(n); }
    return [...seen];
  }

  analyze() {
    const done = new Set();
    const comps = [];
    for (const atom of this.atoms) {
      if (done.has(atom)) continue;
      const atoms = this.component(atom);
      atoms.forEach((a) => done.add(a));
      const counts = {};
      const needs = {};
      for (const a of atoms) {
        counts[a.sym] = (counts[a.sym] || 0) + 1;
        const f = this.free(a);
        if (f > 0) needs[a.sym] = (needs[a.sym] || 0) + f;
      }
      const id = atoms.map((a) => a.id).sort((x, y) => x - y).join(',');
      const complete = Object.keys(needs).length === 0;
      comps.push({
        id, atoms, counts, complete,
        formula: formulaOf(counts),
        known: KNOWN[formulaKey(counts)] ?? null,
        needs: Object.entries(needs),
        justCompleted: complete && !this.completeIds.has(id),
      });
    }
    this.completeIds = new Set(comps.filter((c) => c.complete).map((c) => c.id));
    this.components = comps.sort((a, b) => b.atoms.length - a.atoms.length);
    return this.components;
  }

  /** A single complete molecule that matches one of the ready-made models. */
  get presetMatch() {
    const multi = this.components.filter((c) => c.atoms.length > 1);
    return multi.length === 1 && multi[0].complete && multi[0].known?.preset ? multi[0].known.preset : null;
  }

  // ───────────── grabbing (called by Interaction) ─────────────

  describe(object) {
    const { atom, bond } = object.userData;
    if (atom) return `${bySymbol(atom.sym).name} · ${this.used(atom)}/${BUILD_ATOMS[atom.sym].valence} bonds`;
    if (bond) return `${['', 'Single', 'Double', 'Triple'][bond.order]} bond · tap to change`;
    return '';
  }

  grab(object, mode, world) {
    if (object.userData.trayItem) {
      const sym = object.userData.trayItem;
      const atom = this.addAtom(sym, this.content.worldToLocal(world.clone()));
      this.app.explain(X.atomPicked(sym, 0, true));
      return this.holdSingle(atom);
    }
    const atom = object.userData.atom;
    if (!atom) return null;
    if (mode === 'group') {
      const comp = this.component(atom);
      this.app.explain(X.movedWhole(formulaOf(comp.reduce((c, a) => ({ ...c, [a.sym]: (c[a.sym] || 0) + 1 }), {}))));
      return this.holdGroup(comp, world);
    }
    this.app.explain(X.atomPicked(atom.sym, this.used(atom), false));
    return this.holdSingle(atom);
  }

  holdSingle(atom) {
    this.single.add(atom);
    this.held.add(atom);
    const tray = this.app.tray;
    let broke = false; // keep the "bond broken" explanation if nothing new happens on release
    return {
      move: (world) => {
        atom.pos.copy(this.content.worldToLocal(world.clone()));
        // Stretch too far and the bond snaps.
        let strain = 0;
        for (const b of this.bondsOf(atom)) {
          const stretch = b.a.pos.distanceTo(b.b.pos) / this.restLength(b);
          const limit = breakStretch(b);
          if (stretch > limit) {
            const [p, q] = b.a === atom ? [b.a, b.b] : [b.b, b.a];
            this.removeBond(b);
            broke = true;
            this.energy.in += E(p.sym, q.sym, b.order);
            this.app.interaction.pulse(1, 80);
            sound.snap();
            this.changed(X.bondBroken(p.sym, q.sym, b.order));
          } else {
            // How hard the bond is pulling back, scaled by how strong it is.
            const s = Math.max(0, (stretch - 1) / (limit - 1));
            strain = Math.max(strain, s * Math.min(1, E(b.a.sym, b.b.sym, b.order) / 600));
          }
        }
        // Feel the bond resisting: buzz harder the more you stretch a stronger bond.
        const now = performance.now();
        if (strain > 0.05 && now - this.lastPulse > 45) {
          this.lastPulse = now;
          this.app.interaction.pulse(0.1 + 0.9 * strain, 40);
        }
        this.findCandidate(atom);
        tray.highlightBin(tray.binContains(world));
      },
      release: (world) => {
        this.single.delete(atom);
        this.held.delete(atom);
        tray.highlightBin(false);
        const cand = this.candidate;
        this.candidate = null;
        if (tray.binContains(world) && !this.rules.bin) {
          sound.refuse();
          this.app.explain(X.cannotDestroy(atom.sym));
          atom.pos.add(new THREE.Vector3(0, 0.15, -0.1)); // bounce it back out of the bin
        } else if (tray.binContains(world)) {
          this.removeAtom(atom);
          sound.thud();
          this.changed(X.atomRemoved(atom.sym));
        } else if (cand) {
          if (this.free(atom) > 0 && this.free(cand) > 0) {
            this.addBond(atom, cand, 1);
            this.energy.out += E(atom.sym, cand.sym, 1);
            this.app.interaction.pulse(0.5, 40);
            sound.bond();
            this.changed(X.bondFormed(atom.sym, cand.sym));
          } else if (!broke) {
            sound.refuse();
            this.app.explain(X.bondFull(this.free(atom) > 0 ? cand.sym : atom.sym));
          }
        } else {
          this.changed(null);
        }
      },
    };
  }

  holdGroup(atoms, startWorld) {
    atoms.forEach((a) => this.held.add(a));
    const start = this.content.worldToLocal(startWorld.clone());
    const starts = atoms.map((a) => a.pos.clone());
    const tray = this.app.tray;
    return {
      move: (world) => {
        const d = this.content.worldToLocal(world.clone()).sub(start);
        atoms.forEach((a, i) => a.pos.copy(starts[i]).add(d));
        tray.highlightBin(tray.binContains(world));
      },
      release: (world) => {
        atoms.forEach((a) => this.held.delete(a));
        tray.highlightBin(false);
        if (tray.binContains(world) && !this.rules.bin) {
          sound.refuse();
          atoms.forEach((a) => a.pos.add(new THREE.Vector3(0, 0.15, -0.1)));
          this.app.explain(X.cannotDestroy(null));
        } else if (tray.binContains(world)) {
          const formula = formulaOf(atoms.reduce((c, a) => ({ ...c, [a.sym]: (c[a.sym] || 0) + 1 }), {}));
          atoms.forEach((a) => this.removeAtom(a));
          this.changed({ title: `${formula} removed`, text: 'The whole molecule went in the bin.' });
        }
      },
    };
  }

  /** Tapping a bond cycles single → double → triple → single. */
  tap(object) {
    const bond = object.userData.bond;
    if (!bond) return;
    const { a, b } = bond;
    if (bond.order < 3 && this.free(a) > 0 && this.free(b) > 0) {
      this.energy.out += E(a.sym, b.sym, bond.order + 1) - E(a.sym, b.sym, bond.order);
      sound.bond();
      bond.order += 1;
      this.makeBondMeshes(bond);
      this.changed(X.bondOrderChanged(a.sym, b.sym, bond.order, false));
    } else if (bond.order > 1) {
      this.energy.in += E(a.sym, b.sym, bond.order) - E(a.sym, b.sym, 1);
      sound.click();
      bond.order = 1;
      this.makeBondMeshes(bond);
      this.changed(X.bondOrderChanged(a.sym, b.sym, 1, false));
    } else {
      const info = X.bondTapped(a.sym, b.sym, 1);
      this.app.explain({ title: info.title, text: `${info.text} (To make it double, both atoms need a spare bonding site.)` });
    }
  }

  /** The atom a held atom would bond to if let go now — atoms with a free bonding site win. */
  findCandidate(atom) {
    let best = null;
    let bestScore = Infinity;
    for (const other of this.atoms) {
      if (other === atom || this.held.has(other) || this.bondBetween(atom, other)) continue;
      const d = atom.pos.distanceTo(other.pos);
      if (d > bondLength(atom.sym, other.sym, 1) * S * SNAP) continue;
      const score = d + (this.free(other) > 0 ? 0 : 10);
      if (score < bestScore) {
        best = other;
        bestScore = score;
      }
    }
    this.candidate = best;
  }

  /** Something changed: work out what is on the bench and tell the student. */
  changed(explanation) {
    const comps = this.analyze();
    const status = X.statusLine(comps);
    this.app.onWorkbenchChanged(status ?? explanation);
  }

  // ───────────── simulation + drawing ─────────────

  relax() {
    const w = (a) => (this.held.has(a) ? 0 : 1);
    const nudge = (p, q, target, k) => {
      const wp = w(p);
      const wq = w(q);
      if (wp + wq === 0) return;
      const d = q.pos.clone().sub(p.pos);
      const len = d.length() || 1e-6;
      const c = d.multiplyScalar(((len - target) / len) * k / (wp + wq));
      p.pos.addScaledVector(c, wp);
      q.pos.addScaledVector(c, -wq);
    };

    // Heat = faster-moving atoms: jiggle everything after a reaction.
    if (this.heat > 0.01) {
      for (const a of this.atoms) {
        if (this.held.has(a)) continue;
        a.pos.x += (Math.random() - 0.5) * this.heat * 0.012;
        a.pos.y += (Math.random() - 0.5) * this.heat * 0.012;
        a.pos.z += (Math.random() - 0.5) * this.heat * 0.012;
      }
    }

    for (let it = 0; it < 6; it++) {
      // Bond lengths (bonds of a hand-held atom are allowed to stretch, so you can pull it off).
      for (const b of this.bonds) {
        if (this.single.has(b.a) || this.single.has(b.b)) continue;
        nudge(b.a, b.b, this.restLength(b), 0.6);
      }
      // Bond angles from VSEPR: keep the right distance between two atoms bonded to the same centre.
      for (const c of this.atoms) {
        if (this.single.has(c)) continue;
        const nb = this.neighbours(c);
        if (nb.length < 2) continue;
        const used = this.used(c);
        const info = BUILD_ATOMS[c.sym];
        const free = Math.max(0, info.valence - used);
        const lone = Math.max(0, (info.outer - used - free) / 2);
        const theta = idealAngle(nb.length, lone, free);
        for (let i = 0; i < nb.length; i++) {
          for (let j = i + 1; j < nb.length; j++) {
            const [p, q] = [nb[i], nb[j]];
            if (this.single.has(p) || this.single.has(q)) continue;
            const r1 = this.restLength(this.bondBetween(c, p));
            const r2 = this.restLength(this.bondBetween(c, q));
            nudge(p, q, Math.sqrt(r1 * r1 + r2 * r2 - 2 * r1 * r2 * Math.cos(theta)), 0.3);
          }
        }
      }
      // Keep unrelated atoms from overlapping.
      for (let i = 0; i < this.atoms.length; i++) {
        for (let j = i + 1; j < this.atoms.length; j++) {
          const p = this.atoms[i];
          const q = this.atoms[j];
          if (this.bondBetween(p, q)) continue;
          const min = ((BALL_R[p.sym] ?? BALL_R.default) + (BALL_R[q.sym] ?? BALL_R.default)) * 2;
          if (p.pos.distanceTo(q.pos) < min) nudge(p, q, min, 0.5);
        }
      }
    }
  }

  draw() {
    for (const a of this.atoms) {
      a.mesh.position.copy(a.pos);
      const free = this.free(a);
      a.halo.visible = free > 0;
      a.halo.position.copy(a.pos);
      a.halo.scale.setScalar(this.ballRadius(a.sym) * 3.2);
    }
    for (const b of this.bonds) {
      const pa = b.a.pos;
      const pb = b.b.pos;
      const dir = pb.clone().sub(pa);
      const len = dir.length();
      dir.normalize();
      const ref = Math.abs(dir.y) < 0.9 ? UP : new THREE.Vector3(1, 0, 0);
      const side = new THREE.Vector3().crossVectors(dir, ref).normalize();
      const strained = len > this.restLength(b) * 1.15;
      const r = b.order > 1 ? BOND_R * 0.75 : BOND_R;
      // Shared electrons sit closer to the more electronegative atom.
      const dChi = BUILD_ATOMS[b.b.sym].chi - BUILD_ATOMS[b.a.sym].chi;
      const t = 0.5 + Math.max(-0.3, Math.min(0.3, dChi * 0.22));
      b.meshes.forEach((m, i) => {
        const offset = (i - (b.order - 1) / 2) * 0.014;
        m.position.copy(pa).add(pb).multiplyScalar(0.5).addScaledVector(side, offset);
        m.quaternion.setFromUnitVectors(UP, dir);
        m.scale.set(r, len, r);
        m.material = strained ? this.strainMat : this.bondMat;
        const pair = b.pairs[i];
        pair.visible = this.showElectrons && this.style !== 'space';
        pair.position.copy(pa).lerp(pb, t).addScaledVector(side, offset);
      });
    }
    // Bond preview while holding an atom near another.
    const held = [...this.single][0];
    const cand = this.candidate;
    this.preview.visible = this.target.visible = !!(held && cand);
    if (held && cand) {
      const ok = this.free(held) > 0 && this.free(cand) > 0;
      const color = ok ? 0x7ee2a8 : 0xff6b6b;
      this.preview.material.color.setHex(color);
      this.target.material.color.setHex(color);
      this.preview.geometry.setFromPoints([held.pos, cand.pos]);
      this.preview.computeLineDistances();
      this.target.position.copy(cand.pos);
      this.target.scale.setScalar(this.ballRadius(cand.sym) * 1.6);
    }
  }

  animate(dt = 0.016) {
    this.heat = Math.max(0, this.heat - dt * 0.25);
    this.relax();
    this.draw();
  }
}
