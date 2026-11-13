import * as THREE from 'three';
import { makeLabel } from '../../../../shared/ui/labels.js';
import { SAMPLES, SAMPLE_IDS, MAGS } from '../data/micro.js';

// The bench, as in the original lesson: a row of glass slides with samples, a pipette, a box of coverslips
// and a microscope with − / + focus buttons. Every part of the microscope can be tapped (starter activity).
// Steps: pipette a drop of stain (or water) onto a slide, put a coverslip on it, move it onto the stage.

export const TOP = -0.3;
const M = new THREE.Vector3(0.24, TOP, -0.05); // microscope base
const STAGE_Y = 0.105;
const SLIDE_Z = 0.17;
const PIPETTE_HOME = new THREE.Vector3(-0.02, TOP, SLIDE_Z);
const COVER_HOME = new THREE.Vector3(0.07, TOP, SLIDE_Z);

const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.5, ...o });
const glassMat = new THREE.MeshStandardMaterial({ color: 0xe8f4ff, transparent: true, opacity: 0.45, roughness: 0.05 });

export class Bench {
  constructor(app) {
    this.app = app;
    this.group = new THREE.Group();
    app.lab.add(this.group);
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.012, 0.38), mat(0xe9ecf2, { roughness: 0.4 }));
    top.position.set(0, TOP - 0.006, 0.05);
    this.group.add(top);
    this.parts = [];
    this.buildMicroscope();

    // slides
    this.slides = SAMPLE_IDS.map((id, i) => {
      const g = new THREE.Group();
      const glass = new THREE.Mesh(new THREE.BoxGeometry(0.066, 0.0025, 0.024), glassMat);
      glass.position.y = 0.00125;
      const spot = new THREE.Mesh(new THREE.CircleGeometry(0.0075, 20).rotateX(-Math.PI / 2), mat(0xd9d2c2, { transparent: true, opacity: 0.9 }));
      spot.position.y = 0.0027;
      const cover = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.0006, 0.02), mat(0xf4fbff, { transparent: true, opacity: 0.5, roughness: 0.05 }));
      cover.position.y = 0.0032;
      cover.visible = false;
      g.add(glass, spot, cover);
      const home = new THREE.Vector3(-0.44 + i * 0.072, TOP, SLIDE_Z);
      g.position.copy(home);
      const tag = makeLabel(SAMPLES[id].short, { height: 0.011, size: 36 });
      tag.position.set(0, 0.005, 0.026);
      g.add(tag);
      const s = { id, group: g, spot, cover, home, stained: false, covered: false, onStage: false };
      for (const m of [glass, spot]) m.userData = { handler: this, slide: s };
      s.picks = [glass, spot];
      this.group.add(g);
      return s;
    });

    // pipette: a dropper bottle, and the dropper you pick up
    const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.045, 20), mat(0x6b4a2a, { transparent: true, opacity: 0.85 }));
    bottle.position.set(PIPETTE_HOME.x, TOP + 0.0225, PIPETTE_HOME.z);
    const bTag = makeLabel('Stain / water', { height: 0.011, size: 36 });
    bTag.position.set(PIPETTE_HOME.x, TOP + 0.11, PIPETTE_HOME.z);
    this.group.add(bottle, bTag);
    this.pipette = new THREE.Group();
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0018, 0.07, 12), mat(0xeaf4ff, { transparent: true, opacity: 0.7 }));
    tube.position.y = 0.035;
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.008, 14, 10), mat(0xd94848));
    bulb.position.y = 0.075;
    this.pipette.add(tube, bulb);
    this.pipetteHome = new THREE.Vector3(PIPETTE_HOME.x, TOP + 0.045, PIPETTE_HOME.z);
    this.pipette.position.copy(this.pipetteHome);
    for (const m of [tube, bulb]) m.userData = { handler: this, pipette: true };
    this.pipettePicks = [tube, bulb];
    this.group.add(this.pipette);

    // coverslips
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.012, 0.03), mat(0x3d6fd0));
    box.position.set(COVER_HOME.x, TOP + 0.006, COVER_HOME.z);
    const cTag = makeLabel('Coverslips', { height: 0.011, size: 36 });
    cTag.position.set(COVER_HOME.x, TOP + 0.04, COVER_HOME.z);
    this.group.add(box, cTag);
    this.coverslip = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.002, 0.022), mat(0xf4fbff, { transparent: true, opacity: 0.6, roughness: 0.05 }));
    this.coverHome = new THREE.Vector3(COVER_HOME.x, TOP + 0.013, COVER_HOME.z);
    this.coverslip.position.copy(this.coverHome);
    this.coverslip.userData = { handler: this, coverslip: true };
    this.group.add(this.coverslip);
  }

  part(id, mesh) {
    mesh.userData = { handler: this, part: id, tapOnly: true };
    this.parts.push(mesh);
    this.scope.add(mesh);
    return mesh;
  }

  buildMicroscope() {
    this.scope = new THREE.Group();
    this.scope.position.copy(M);
    this.group.add(this.scope);
    const body = mat(0xeeeef2, { roughness: 0.35 });
    const dark = mat(0x2b2f3a, { roughness: 0.4 });
    const metal = mat(0xb8bec8, { metalness: 0.6, roughness: 0.3 });
    const add = (id, geo, m, x, y, z, rot) => {
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.set(x, y, z);
      if (rot) mesh.rotation.set(...rot);
      return this.part(id, mesh);
    };
    add('base', new THREE.BoxGeometry(0.12, 0.025, 0.15), body, 0, 0.0125, 0.01);
    add('light', new THREE.CylinderGeometry(0.014, 0.016, 0.012, 20), mat(0xfff3b0, { emissive: 0xffe680, emissiveIntensity: 0.6 }), 0, 0.031, 0.02);
    add('arm', new THREE.BoxGeometry(0.026, 0.21, 0.03), body, 0, 0.13, -0.05, [0.12, 0, 0]);
    add('stage', new THREE.BoxGeometry(0.1, 0.008, 0.085), dark, 0, STAGE_Y, 0.015);
    add('clips', new THREE.BoxGeometry(0.006, 0.003, 0.03), metal, -0.025, STAGE_Y + 0.0055, 0.025);
    add('clips', new THREE.BoxGeometry(0.006, 0.003, 0.03), metal, 0.025, STAGE_Y + 0.0055, 0.025);
    add('coarse', new THREE.CylinderGeometry(0.02, 0.02, 0.012, 24), dark, 0.025, 0.11, -0.045, [0, 0, Math.PI / 2]);
    add('coarse', new THREE.CylinderGeometry(0.02, 0.02, 0.012, 24), dark, -0.025, 0.11, -0.045, [0, 0, Math.PI / 2]);
    add('fine', new THREE.CylinderGeometry(0.011, 0.011, 0.012, 20), metal, 0.036, 0.075, -0.045, [0, 0, Math.PI / 2]);
    add('fine', new THREE.CylinderGeometry(0.011, 0.011, 0.012, 20), metal, -0.036, 0.075, -0.045, [0, 0, Math.PI / 2]);
    // head: nosepiece, objectives, tube, eyepiece
    add('nosepiece', new THREE.CylinderGeometry(0.026, 0.022, 0.014, 24), body, 0, 0.165, 0.012);
    this.objectives = MAGS.map((mag, i) => {
      const a = (i - 1) * 0.9;
      const len = 0.022 + i * 0.008;
      const o = add('objectives', new THREE.CylinderGeometry(0.0065, 0.0055, len, 16), metal, 0, 0, 0);
      o.userData.mag = mag;
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.0068, 0.0068, 0.003, 16), mat([0xd94848, 0xf2c12e, 0x3d8bd9][i]));
      band.position.y = -len / 2 + 0.006;
      o.add(band);
      o.userData.len = len;
      o.userData.a = a;
      return o;
    });
    add('eyepiece', new THREE.CylinderGeometry(0.012, 0.014, 0.075, 20), body, 0, 0.21, -0.005, [-0.5, 0, 0]);
    add('eyepiece', new THREE.CylinderGeometry(0.01, 0.01, 0.03, 20), dark, 0, 0.255, 0.02, [-0.5, 0, 0]);
    // the − / + focus buttons, as in the original lesson
    this.focusButtons = [-1, 1].map((d) => {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.006, 20).rotateX(Math.PI / 2), mat(d > 0 ? 0x3d8bd9 : 0x2b2f3a));
      b.position.set(d * 0.03, 0.013, 0.088);
      b.userData = { handler: this, focus: d, tapOnly: true };
      const l = makeLabel(d > 0 ? '+' : '−', { height: 0.016, size: 48, bg: null });
      l.position.set(b.position.x, b.position.y, b.position.z + 0.007);
      this.scope.add(b, l);
      return b;
    });
    this.setObjective(4);
  }

  /** Turn the nosepiece so that this lens points down at the stage. */
  setObjective(mag) {
    const i = MAGS.indexOf(mag);
    this.objectives.forEach((o, k) => {
      const a = (k - i) * 1.0;
      const len = o.userData.len;
      o.position.set(Math.sin(a) * 0.018, 0.155 - Math.cos(a) * (len / 2 + 0.002), 0.012);
      o.rotation.set(0, 0, a);
    });
  }

  get targets() {
    const t = [...this.parts, ...this.focusButtons, ...this.pipettePicks, this.coverslip];
    for (const s of this.slides) t.push(...s.picks);
    return t;
  }

  get onStage() {
    return this.slides.find((s) => s.onStage) ?? null;
  }

  describe(o) {
    const u = o.userData;
    if (u.part) return this.app.state.mode === 'parts' ? `Tap: ${u.part === 'objectives' ? 'objective lenses' : u.part}` : u.part === 'objectives' || u.part === 'nosepiece' ? 'Tap to change the objective lens' : '';
    if (u.focus) return u.focus > 0 ? 'Focus +' : 'Focus −';
    if (u.pipette) return 'Pipette · hold it over a slide to add a drop';
    if (u.coverslip) return 'Coverslip · put it on a slide with a drop on it';
    if (u.slide) return `${SAMPLES[u.slide.id].name}${u.slide.stained ? (u.slide.covered ? ' · ready: put it on the stage' : ' · needs a coverslip') : ' · add a drop first'}`;
    return '';
  }

  tap(o) {
    const u = o.userData;
    if (u.focus) this.app.focusButton(u.focus);
    else if (u.part) this.app.tapPart(u.part);
  }

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
      obj.position.y = Math.max(TOP + 0.003, obj.position.y);
    };
  }

  slideNear(p, r, filter) {
    return this.slides.find((s) => !s.onStage && filter(s) && this.near(p, s.group.position.clone().setY(TOP + 0.003), r)) ?? null;
  }

  grab(o, mode, world) {
    const u = o.userData;
    if (u.pipette) {
      const move = this.follow(this.pipette, world);
      return {
        move: (w) => {
          move(w);
          // the tip over a slide (on a screen, the bulb over it will do too)
          const tip = this.pipette.position;
          const bulb = tip.clone().add(new THREE.Vector3(0, 0.075, 0));
          const s = this.slideNear(tip, 0.03, (x) => !x.stained) ?? (this.app.presenting ? null : this.slideNear(bulb, 0.03, (x) => !x.stained));
          if (s) this.stain(s);
        },
        release: () => this.pipette.position.copy(this.pipetteHome),
      };
    }
    if (u.coverslip) {
      const move = this.follow(this.coverslip, world);
      return {
        move,
        release: () => {
          const s = this.slideNear(this.coverslip.position, 0.03, (x) => !x.covered);
          this.coverslip.position.copy(this.coverHome);
          if (!s) return;
          if (!s.stained) this.app.dropFirst(s.id);
          else this.cover(s);
        },
      };
    }
    if (u.slide) {
      const s = u.slide;
      if (s.onStage) this.offStage(s);
      const move = this.follow(s.group, world);
      return {
        move,
        release: () => {
          const stage = new THREE.Vector3(M.x, M.y + STAGE_Y + 0.004, M.z + 0.015);
          if (this.near(s.group.position, stage, 0.05)) this.app.toStage(s.id);
          else s.group.position.copy(s.home);
        },
      };
    }
    return null;
  }

  stain(s) {
    s.stained = true;
    const c = new THREE.Color(SAMPLES[s.id].drop);
    s.spot.material.color.lerp(c, SAMPLES[s.id].stain === 'water' ? 0.25 : 0.75);
    this.app.onStep('stain', s.id);
  }

  cover(s) {
    s.covered = true;
    s.cover.visible = true;
    this.app.onStep('cover', s.id);
  }

  putOnStage(s) {
    const old = this.onStage;
    if (old && old !== s) this.offStage(old);
    s.onStage = true;
    s.group.position.set(M.x, M.y + STAGE_Y + 0.004, M.z + 0.015);
  }

  offStage(s) {
    s.onStage = false;
    s.group.position.copy(s.home);
    this.app.onOffStage(s.id);
  }

  /** The steps by button (for tests). */
  quick(id) {
    const s = this.slides.find((x) => x.id === id);
    if (!s.stained) this.stain(s);
    if (!s.covered) this.cover(s);
    this.app.toStage(id);
  }
}
