import * as THREE from 'three';
import { makeLabel } from '../../../../shared/ui/labels.js';
import { sound } from '../../../../shared/util/sound.js';
import { SUBSTANCES, SORT_SET, UI_CHART, css, describePH } from '../data/acid.js';
import { TOP } from './Bench.js';

// The pH scale activity: a 0–14 scale across the bench, and a dozen everyday substances in little bottles.
// Drag each bottle to where you think it belongs. Close enough and it clicks into its true place and shows
// its pH; otherwise it comes back with a hint.

const W = 0.74; // length of the scale (m)

/** The scale as a picture: rainbow bar, numbers, and the three zones. */
export function drawScale(c, x, y, w, h, { zones = true, big = false } = {}) {
  const step = w / 15;
  for (let i = 0; i < 15; i++) {
    c.fillStyle = css(UI_CHART[i]);
    c.fillRect(x + i * step, y, step + 1, h);
  }
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillStyle = '#ffffff';
  c.font = `700 ${Math.round(h * 0.5)}px system-ui, sans-serif`;
  for (let i = 0; i < 15; i++) {
    c.fillStyle = i >= 5 && i <= 7 ? '#1a1a1a' : '#ffffff';
    c.fillText(String(i), x + (i + 0.5) * step, y + h / 2 + 1);
  }
  if (!zones) return;
  c.font = `700 ${Math.round(h * (big ? 0.42 : 0.4))}px system-ui, sans-serif`;
  c.fillStyle = '#ff9a8a';
  c.fillText('← more ACIDIC', x + step * 3.3, y + h * 1.5);
  c.fillStyle = '#9fe0a0';
  c.fillText('NEUTRAL', x + step * 7.5, y + h * 1.5);
  c.fillStyle = '#b6a8ff';
  c.fillText('more ALKALINE →', x + step * 11.7, y + h * 1.5);
}

export class Sorter {
  constructor(app) {
    this.app = app;
    this.group = new THREE.Group();
    app.lab.add(this.group);

    const canvas = document.createElement('canvas');
    canvas.width = 1480;
    canvas.height = 200;
    const c = canvas.getContext('2d');
    drawScale(c, 0, 10, 1480, 96);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.scale = new THREE.Mesh(new THREE.PlaneGeometry(W, (W * 200) / 1480), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, transparent: true }));
    this.scale.position.set(0, TOP + 0.13, -0.06);
    this.scale.rotation.x = -0.3;
    this.group.add(this.scale);

    this.items = [];
    this.placed = [];
    this.wrong = 0;
    this.build();
    this.group.visible = false;
  }

  build() {
    for (const it of this.items) this.group.remove(it.group);
    this.items = [];
    this.placed = [];
    this.wrong = 0;
    const ids = [...SORT_SET];
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    ids.forEach((id, i) => {
      const s = SUBSTANCES[id];
      const g = new THREE.Group();
      const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.044, 18), new THREE.MeshStandardMaterial({ color: s.color, roughness: 0.25, transparent: true, opacity: 0.92 }));
      glass.position.y = 0.022;
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.014, 14), glass.material);
      neck.position.y = 0.051;
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.0095, 0.0095, 0.008, 14), new THREE.MeshStandardMaterial({ color: 0x2b3560, roughness: 0.5 }));
      cap.position.y = 0.062;
      const tag = makeLabel(s.short ?? s.name, { height: 0.0135, size: 40 });
      tag.position.y = -0.012;
      tag.material.depthTest = false;
      tag.renderOrder = 6;
      g.add(glass, neck, cap, tag);
      const row = i < 6 ? 0 : 1;
      const col = i % 6;
      const home = new THREE.Vector3((col - 2.5) * 0.125, TOP + 0.014, 0.09 + row * 0.11);
      g.position.copy(home);
      const item = { id, group: g, home, done: false, tag };
      for (const m of [glass, neck, cap]) m.userData = { handler: this, item };
      this.group.add(g);
      this.items.push(item);
    });
  }

  get total() {
    return this.items.length;
  }

  get grabTargets() {
    const t = [];
    for (const it of this.items) it.group.traverse((o) => { if (o.isMesh && o.userData.item) t.push(o); });
    return t;
  }

  describe(o) {
    const it = o.userData.item;
    const s = SUBSTANCES[it.id];
    return it.done ? `${s.name} · pH ${s.ph}` : `${s.name} · drag it onto the scale`;
  }

  tap(o) {
    this.app.showSubstance(o.userData.item.id, o.userData.item.done);
  }

  grab(o, mode, world) {
    const it = o.userData.item;
    if (it.done) return null;
    const lab = this.app.lab;
    const off = it.group.position.clone().sub(lab.worldToLocal(world.clone()));
    const start = it.group.position.clone();
    return {
      move: (w) => it.group.position.copy(lab.worldToLocal(w.clone())).add(off),
      release: () => {
        if (it.group.position.distanceTo(start) < 0.012) {
          it.group.position.copy(it.home);
          this.app.showSubstance(it.id, false);
          return;
        }
        this.drop(it);
      },
    };
  }

  /** The pH at a point (lab coordinates), or null if it isn't over the scale. */
  phAt(p) {
    const local = this.scale.worldToLocal(this.app.lab.localToWorld(p.clone()));
    if (Math.abs(local.y) > 0.11 || Math.abs(local.z) > 0.16 || Math.abs(local.x) > W / 2 + 0.03) return null;
    return THREE.MathUtils.clamp((local.x / W + 0.5) * 15 - 0.5, 0, 14);
  }

  drop(it) {
    const s = SUBSTANCES[it.id];
    const guess = this.phAt(it.group.position);
    if (guess == null) {
      it.group.position.copy(it.home);
      return;
    }
    const tol = this.app.state.level === 'advanced' ? 1.0 : 1.6;
    if (Math.abs(guess - s.ph) <= tol) {
      this.place(it);
      sound.bond();
      this.app.interaction.pulse(0.5, 40);
      this.app.onSorted(it.id, true, guess);
    } else {
      this.wrong++;
      it.group.position.copy(it.home);
      sound.refuse();
      this.app.interaction.pulse(0.8, 100);
      this.app.onSorted(it.id, false, guess);
    }
  }

  /** Stand a bottle at its true place on the scale (stacked in rows where several are close together). */
  place(it) {
    const s = SUBSTANCES[it.id];
    it.done = true;
    let level = 0;
    while (this.placed.some((p) => p.level === level && Math.abs(SUBSTANCES[p.id].ph - s.ph) < 2.0)) level++;
    this.placed.push({ id: it.id, level });
    const x = ((s.ph + 0.5) / 15 - 0.5) * W;
    const p = this.scale.localToWorld(new THREE.Vector3(x, 0.062 + level * 0.084, 0.005));
    it.group.position.copy(this.app.lab.worldToLocal(p));
    it.group.remove(it.tag);
    it.tag.userData.dispose?.();
    it.tag = makeLabel(`${s.short ?? s.name} · ${s.ph}`, { height: 0.0135, size: 40 });
    it.tag.position.y = -0.009;
    it.tag.material.depthTest = false;
    it.tag.renderOrder = 6;
    it.group.add(it.tag);
  }

  /** Place one by id (tests). */
  placeById(id) {
    const it = this.items.find((x) => x.id === id);
    if (it && !it.done) {
      this.place(it);
      this.app.onSorted(id, true, SUBSTANCES[id].ph);
    }
  }

  hint(id, guess) {
    const s = SUBSTANCES[id];
    const way = guess < s.ph ? 'less acidic (further right)' : 'more acidic (further left)';
    return `${s.name} is ${describePH(s.ph)}: try ${way}.`;
  }
}
