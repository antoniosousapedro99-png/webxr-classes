import * as THREE from 'three';
import { PARTS, CASES, CATEGORIES, layoutOf, partsIn } from '../data/parts.js';
import { canInstall, emptyBuild } from '../data/rules.js';
import { caseMesh, partMesh, ghostOf, radiatorMesh } from './parts3d.js';
import { makeLabel } from '../../../../shared/ui/labels.js';
import { sound } from '../../../../shared/util/sound.js';
import * as T from '../ui/explain.js';

// The computer on the workbench: the case, everything installed in it, the slots parts can snap into,
// and the hands-on assembly (Lego-style): take a part from the tray, bring it to its slot, let go.

export const CASE_POS = new THREE.Vector3(0, 0.02, -0.05);
const SNAP = 0.11; // how close (m) a part's centre must be to a slot to snap in

/** Which slot types each kind of part can try. */
const SLOT_TYPES = { board: ['board'], cpu: ['cpu'], cooler: ['cooler'], ram: ['ram'], storage: ['m2', 'bay'], gpu: ['pcie'], psu: ['psu'] };

function centreOf(obj) {
  obj.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(obj).getCenter(new THREE.Vector3());
}

export class PCBuild {
  constructor(app) {
    this.app = app;
    this.group = new THREE.Group();
    this.group.position.copy(CASE_POS);
    this.content = new THREE.Group();
    this.group.add(this.content);
    this.fans = [];
    this.leds = [];
    this.slots = [];
    this.objects = new Map(); // slotId → installed part group
    this.preview = null;
    this.markers = new THREE.Group();
    this.group.add(this.markers);
    this.labels = new THREE.Group();
    this.group.add(this.labels);
    this.centres = new Map(); // partId → centre offset of its model
  }

  get build() {
    return this.app.state.build;
  }

  // ───────────── slot bookkeeping ─────────────

  get(slotId) {
    const b = this.build;
    if (slotId.startsWith('ram')) return b.ram[+slotId.slice(3)] ?? null;
    if (slotId.startsWith('m2-')) return b.m2[+slotId.slice(3)] ?? null;
    if (slotId.startsWith('bay')) return b.bays[+slotId.slice(3)] ?? null;
    return { board: b.board, cpu: b.cpu, cooler: b.cooler, pcie: b.gpu, psu: b.psu }[slotId] ?? null;
  }

  setSlot(slotId, id) {
    const b = this.build;
    if (slotId.startsWith('ram')) b.ram[+slotId.slice(3)] = id;
    else if (slotId.startsWith('m2-')) b.m2[+slotId.slice(3)] = id;
    else if (slotId.startsWith('bay')) b.bays[+slotId.slice(3)] = id;
    else if (slotId === 'pcie') b.gpu = id;
    else b[slotId] = id;
    if (slotId === 'board') {
      if (id) {
        const L = layoutOf(id);
        b.ram = L.ram.map(() => null);
        b.m2 = L.m2.map(() => null);
      } else {
        b.ram = [];
        b.m2 = [];
      }
    }
  }

  /** Parts that come out together with this one (they are attached to it). */
  dependents(slotId) {
    const b = this.build;
    if (slotId === 'board') {
      return [['cpu', b.cpu], ['cooler', b.cooler], ...b.ram.map((r, i) => [`ram${i}`, r]), ...b.m2.map((m, i) => [`m2-${i}`, m]), ['pcie', b.gpu]].filter(([, id]) => id);
    }
    if (slotId === 'cpu' && b.cooler) return [['cooler', b.cooler]];
    return [];
  }

  /** All slots that exist right now (a slot only exists once the part it lives on is installed). */
  computeSlots() {
    const b = this.build;
    const c = CASES[b.case];
    const z0 = -c.d / 2 + 0.022;
    const A = new THREE.Vector3(c.anchor[0], c.anchor[1], z0);
    const slots = [{ id: 'board', type: 'board', pos: A.clone() }];
    slots.push({ id: 'psu', type: 'psu', pos: new THREE.Vector3(c.psu[0], c.psu[1], 0) });
    c.bays.forEach((bay, i) => slots.push({ id: `bay${i}`, type: 'bay', size: bay.size, pos: new THREE.Vector3(bay.pos[0], bay.pos[1], 0) }));
    if (b.board) {
      const L = layoutOf(b.board);
      const on = (x, y, z = 0.0016) => A.clone().add(new THREE.Vector3(x, y, z));
      slots.push({ id: 'cpu', type: 'cpu', pos: on(L.cpu[0], L.cpu[1]) });
      if (b.cpu) slots.push({ id: 'cooler', type: 'cooler', pos: on(L.cpu[0], L.cpu[1], 0.0062) });
      L.ram.forEach((x, i) => slots.push({ id: `ram${i}`, type: 'ram', pos: on(x, L.ramY, 0.003) }));
      L.m2.forEach(([x, y], i) => slots.push({ id: `m2-${i}`, type: 'm2', pos: on(x, y, 0.002) }));
      slots.push({ id: 'pcie', type: 'pcie', pos: on(0.02, L.pcieY + 0.004, 0.0016) });
    }
    this.slots = slots;
  }

  centreOffset(id) {
    if (!this.centres.has(id)) this.centres.set(id, centreOf(partMesh(id)));
    return this.centres.get(id);
  }

  // ───────────── drawing ─────────────

  rebuild() {
    for (const o of [...this.content.children]) this.content.remove(o);
    this.objects.clear();
    this.fans = [];
    this.leds = [];
    const b = this.build;
    const c = CASES[b.case];
    const shell = caseMesh(b.case);
    this.content.add(shell);
    shell.traverse((o) => {
      if (o.userData.powerButton) {
        Object.assign(o.userData, { handler: this, tapOnly: true, power: true });
        this.powerButton = o;
      }
    });
    this.computeSlots();
    for (const slot of this.slots) {
      const id = this.get(slot.id);
      if (!id) continue;
      const m = partMesh(id);
      m.position.copy(slot.pos);
      this.content.add(m);
      this.objects.set(slot.id, m);
      m.traverse((o) => {
        if (o.isMesh) Object.assign(o.userData, { handler: this, slotId: slot.id, partId: id });
      });
      if (PARTS[id].kind === 'aio') this.content.add(radiatorMesh(c, slot.pos, PARTS[id].radiator));
    }
    this.content.traverse((o) => {
      if (o.userData.spin) this.fans.push(o);
      if (o.userData.led) this.leds.push(o);
    });
    this.drawLabels();
  }

  /** Name tags on every installed part (the "Labels" switch). */
  drawLabels() {
    for (const o of [...this.labels.children]) {
      o.userData.dispose?.();
      this.labels.remove(o);
    }
    if (!this.app.state.labels) return;
    for (const [slotId, obj] of this.objects) {
      const id = this.get(slotId);
      const p = PARTS[id];
      const tag = makeLabel(`${CATEGORIES[p.cat].name}\n${p.short}`, { height: 0.034, size: 40 });
      const box = new THREE.Box3().setFromObject(obj);
      const c = box.getCenter(new THREE.Vector3());
      this.group.worldToLocal(c);
      tag.position.set(c.x, c.y, CASES[this.build.case].d / 2 + 0.03);
      tag.material.depthTest = false;
      tag.renderOrder = 6;
      this.labels.add(tag);
    }
  }

  /** Outlines on every free slot a held part could go into (green = fits, red = won't). */
  showMarkers(partId) {
    for (const o of [...this.markers.children]) this.markers.remove(o);
    if (!partId) return;
    const types = SLOT_TYPES[PARTS[partId].cat];
    for (const slot of this.slots) {
      if (!types.includes(slot.type) || this.get(slot.id)) continue;
      const ok = canInstall(partId, slot, this.build).ok;
      const g = ghostOf(partId, ok);
      g.position.copy(slot.pos);
      g.traverse((o) => {
        if (o.isMesh) o.material = o.material.clone();
        if (o.isMesh) o.material.opacity = 0.12;
      });
      g.userData.slotId = slot.id;
      this.markers.add(g);
    }
  }

  // ───────────── grabbing (called by Interaction) ─────────────

  describe(object) {
    const u = object.userData;
    if (u.power) return this.app.state.power === 'off' ? 'Power button · tap to switch on' : 'Power button · tap to switch off';
    const id = u.trayPart ?? u.partId;
    if (!id) return '';
    return `${CATEGORIES[PARTS[id].cat].name}: ${PARTS[id].short}`;
  }

  tap(object) {
    if (object.userData.power) this.app.togglePower();
  }

  grab(object, mode, world) {
    const u = object.userData;
    if (u.power) return null;
    const app = this.app;
    const wasOn = app.state.power !== 'off';
    if (wasOn) app.powerOff();

    let id = u.trayPart;
    let stash = null; // parts that came out with it — put back if it goes straight back in
    let from = null;
    if (!id && u.slotId) {
      from = u.slotId;
      id = this.get(from);
      stash = this.dependents(from);
      for (const [s] of stash) this.setSlot(s, null);
      this.setSlot(from, null);
      if (from === 'board') this.setSlot('board', null);
    }
    if (!id) return null;
    if (from) app.state.booted = false;

    this.rebuild();
    const types = SLOT_TYPES[PARTS[id].cat];
    const anySlot = this.slots.some((s) => types.includes(s.type));
    app.netHolding = { label: PARTS[id].short, part: id }; // colleagues see it in your hand
    const e = T.picked(id, !!from, stash, anySlot);
    if (wasOn) e.text = `${T.SAFETY.title}: ${T.SAFETY.text} ${e.text}`;
    app.explain(e);

    // The part in your hand, at real size, held by its middle.
    const held = new THREE.Group();
    const model = partMesh(id);
    model.position.copy(this.centreOffset(id)).negate();
    held.add(model);
    held.position.copy(this.group.worldToLocal(world.clone()));
    this.group.add(held);
    this.showMarkers(id);

    let target = null;
    return {
      move: (w) => {
        const p = this.group.worldToLocal(w.clone());
        held.position.copy(p);
        // Nearest free slot this part could go into
        let best = null;
        let bestD = SNAP;
        for (const slot of this.slots) {
          if (!types.includes(slot.type) || this.get(slot.id)) continue;
          const d = slot.pos.clone().add(this.centreOffset(id)).distanceTo(p);
          if (d < bestD) {
            best = slot;
            bestD = d;
          }
        }
        if (best !== target) {
          target = best;
          if (this.preview) this.group.remove(this.preview);
          this.preview = null;
          if (best) {
            const ok = canInstall(id, best, this.build).ok;
            this.preview = ghostOf(id, ok);
            this.preview.position.copy(best.pos);
            this.group.add(this.preview);
            app.interaction.pulse(ok ? 0.3 : 0.6, 25);
          }
        }
      },
      release: () => {
        app.netHolding = null;
        this.group.remove(held);
        if (this.preview) this.group.remove(this.preview);
        this.preview = null;
        this.showMarkers(null);
        if (!target) {
          if (from) app.explain(T.removed(id, stash));
          this.rebuild();
          app.refresh();
          return;
        }
        const res = canInstall(id, target, this.build);
        if (!res.ok) {
          sound.refuse();
          app.interaction.pulse(0.8, 120);
          app.explain(T.refused(id, res.reason));
          this.rebuild();
          app.refresh();
          return;
        }
        this.setSlot(target.id, id);
        // Put back whatever came out with it, if it went straight back into the same place.
        if (stash && target.id === from) {
          for (const [s, sid] of stash) {
            this.computeSlots();
            const slot = this.slots.find((x) => x.id === s);
            if (slot && canInstall(sid, slot, this.build).ok) this.setSlot(s, sid);
          }
          stash = null;
        }
        sound.click();
        setTimeout(() => sound.click(), 60);
        app.interaction.pulse(0.6, 40);
        app.state.booted = false;
        this.rebuild();
        app.explain(T.installed(id, target, this.build));
      },
    };
  }

  get grabTargets() {
    const t = [];
    this.content.traverse((o) => {
      if (o.isMesh && o.userData.handler) t.push(o);
    });
    return t;
  }

  /** Change the case, keeping every part that still fits. Returns the parts that didn't. */
  changeCase(caseId) {
    const old = this.build;
    const fresh = emptyBuild(caseId);
    this.app.state.build = fresh;
    const dropped = [];
    const tryPut = (slotId, id) => {
      if (!id) return;
      this.computeSlots();
      const slot = this.slots.find((s) => s.id === slotId) ?? this.slots.find((s) => s.type === 'bay' && !this.get(s.id));
      if (slot && !this.get(slot.id) && canInstall(id, slot, fresh).ok) this.setSlot(slot.id, id);
      else dropped.push(id);
    };
    tryPut('board', old.board);
    tryPut('psu', old.psu);
    if (fresh.board) {
      tryPut('cpu', old.cpu);
      if (fresh.cpu) tryPut('cooler', old.cooler);
      else if (old.cooler) dropped.push(old.cooler);
      old.ram.forEach((r, i) => tryPut(`ram${i}`, r));
      old.m2.forEach((m, i) => tryPut(`m2-${i}`, m));
      tryPut('pcie', old.gpu);
    } else {
      dropped.push(...[old.cpu, old.cooler, ...old.ram, ...old.m2, old.gpu].filter(Boolean));
    }
    old.bays.forEach((d) => tryPut('bay', d)); // any free bay
    this.rebuild();
    return dropped;
  }

  /** Where each kind of part is (lab space), for the "how it works" tour. */
  locate(what) {
    const slotId = { cpu: 'cpu', cooler: 'cooler', board: 'board', gpu: 'pcie', psu: 'psu' }[what];
    let obj = null;
    if (slotId) obj = this.objects.get(slotId);
    if (what === 'ram') obj = [...this.objects.entries()].find(([s]) => s.startsWith('ram'))?.[1];
    if (what === 'storage') obj = [...this.objects.entries()].find(([s]) => s.startsWith('m2') || s.startsWith('bay'))?.[1];
    if (!obj) return null;
    return this.app.lab.worldToLocal(new THREE.Box3().setFromObject(obj).getCenter(new THREE.Vector3()));
  }

  partsInTray(cat) {
    return partsIn(cat);
  }

  animate(dt, powered) {
    if (powered) for (const f of this.fans) f.rotation.z += dt * 25;
    for (const l of this.leds) l.material.emissive.setHex(powered ? 0x30ff70 : 0x000000);
    if (this.powerButton) this.powerButton.material.emissive.setHex(powered ? 0x2a7cff : 0x000000);
  }
}
