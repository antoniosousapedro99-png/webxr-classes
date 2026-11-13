import * as THREE from 'three';
import { makeLabel } from '../../../../shared/ui/labels.js';
import { sound } from '../../../../shared/util/sound.js';

// Measuring a frozen wave. On the rope: two upright markers to drag onto crests (the distance between them
// is shown: one wavelength if they sit on neighbouring crests) and a level line to drag up to the top of a
// crest (its height above the rest line is the amplitude). On the ripple tank: two pegs with the distance
// between them.

const YELLOW = 0xffd166;
const GREEN = 0x7ee2a8;

function setLabel(owner, key, text, parent, height = 0.02) {
  if (owner[`${key}Text`] === text) return owner[key];
  owner[`${key}Text`] = text;
  const old = owner[key];
  const label = makeLabel(text, { height, size: 44 });
  label.material.depthTest = false;
  label.renderOrder = 8;
  if (old) {
    label.position.copy(old.position);
    old.removeFromParent();
    old.userData.dispose?.();
  }
  parent.add(label);
  owner[key] = label;
  return label;
}

const cm = (m, adv) => `${(m * 100).toFixed(adv ? 1 : 0)} cm`;

export class RopeRulers {
  constructor(app, rope) {
    this.app = app;
    this.rope = rope;
    this.group = new THREE.Group();
    rope.group.add(this.group);
    this.x = [rope.L * 0.2, rope.L * 0.55];
    this.y = 0.045;
    const knobGeo = new THREE.SphereGeometry(0.014, 16, 12);
    const mat = new THREE.MeshStandardMaterial({ color: YELLOW, roughness: 0.4, emissive: 0x4a3a10 });
    this.posts = [0, 1].map((i) => {
      const g = new THREE.Group();
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.21, 0.003), mat);
      post.position.y = -0.005;
      const knob = new THREE.Mesh(knobGeo, mat);
      knob.position.y = -0.115;
      knob.userData = { handler: this, kind: 'x', i };
      g.add(post, knob);
      this.group.add(g);
      return { g, knob };
    });
    this.bar = new THREE.Mesh(new THREE.BoxGeometry(1, 0.003, 0.003), mat);
    this.bar.position.y = -0.115;
    this.group.add(this.bar);

    const mat2 = new THREE.MeshStandardMaterial({ color: GREEN, roughness: 0.4, emissive: 0x124a2c });
    this.level = new THREE.Group();
    const line = new THREE.Mesh(new THREE.BoxGeometry(rope.L + 0.05, 0.003, 0.003), mat2);
    line.position.x = rope.L / 2 + 0.025;
    this.levelKnob = new THREE.Mesh(knobGeo, mat2);
    this.levelKnob.position.x = rope.L + 0.06;
    this.levelKnob.userData = { handler: this, kind: 'y' };
    this.level.add(line, this.levelKnob);
    this.group.add(this.level);
    this.group.visible = false;
    this.refresh();
  }

  get targets() {
    return [this.posts[0].knob, this.posts[1].knob, this.levelKnob];
  }

  /** Distance between the two markers (m). */
  get span() {
    return Math.abs(this.x[1] - this.x[0]);
  }

  /** Height of the level line above (or below) the rest line (m). */
  get height() {
    return Math.abs(this.y);
  }

  describe(o) {
    return o.userData.kind === 'x' ? 'Drag onto a crest' : 'Drag up to the top of a crest';
  }

  grab(o, mode, world) {
    const g = this.rope.group;
    const start = g.worldToLocal(world.clone());
    const { kind, i } = o.userData;
    const from = kind === 'x' ? this.x[i] : this.y;
    const peaks = kind === 'x' ? this.rope.peaks() : null;
    let snapped = false;
    return {
      move: (w) => {
        const p = g.worldToLocal(w.clone());
        let hit = false;
        if (kind === 'x') {
          let x = THREE.MathUtils.clamp(from + p.x - start.x, 0, this.rope.L);
          for (const pk of peaks) {
            if (Math.abs(pk.x - x) < 0.009) {
              x = pk.x;
              hit = true;
            }
          }
          this.x[i] = x;
        } else {
          let y = THREE.MathUtils.clamp(from + p.y - start.y, -0.09, 0.09);
          for (const a of [this.rope.p.a, -this.rope.p.a]) {
            if (Math.abs(a - y) < 0.004) {
              y = a;
              hit = true;
            }
          }
          this.y = y;
        }
        if (hit && !snapped) {
          sound.click();
          this.app.interaction.pulse(0.4, 20);
        }
        snapped = hit;
        this.refresh();
      },
      release: () => this.app.onMeasured(),
    };
  }

  refresh() {
    const adv = this.app.state?.level === 'advanced';
    this.posts.forEach((p, i) => { p.g.position.x = this.x[i]; });
    const mid = (this.x[0] + this.x[1]) / 2;
    this.bar.position.x = mid;
    this.bar.scale.x = Math.max(0.001, this.span);
    setLabel(this, 'spanLabel', cm(this.span, adv), this.group).position.set(mid, -0.145, 0);
    this.level.position.y = this.y;
    setLabel(this, 'heightLabel', cm(this.height, adv), this.group).position.set(this.rope.L + 0.06, this.y + 0.032, 0);
  }
}

export class TankRuler {
  constructor(app, tank) {
    this.app = app;
    this.tank = tank;
    this.group = new THREE.Group();
    tank.group.add(this.group);
    this.pts = [new THREE.Vector2(-0.12, -0.2), new THREE.Vector2(0.06, -0.2)];
    const mat = new THREE.MeshStandardMaterial({ color: YELLOW, roughness: 0.4, emissive: 0x4a3a10 });
    this.pegs = this.pts.map((p, i) => {
      const peg = new THREE.Mesh(new THREE.SphereGeometry(0.014, 16, 12), mat);
      peg.userData = { handler: this, i };
      this.group.add(peg);
      return peg;
    });
    this.bar = new THREE.Mesh(new THREE.BoxGeometry(1, 0.003, 0.003), mat);
    this.group.add(this.bar);
    this.group.visible = false;
    this.refresh();
  }

  get targets() {
    return this.pegs;
  }

  get span() {
    return this.pts[0].distanceTo(this.pts[1]);
  }

  describe() {
    return 'Drag onto a ripple';
  }

  grab(o, mode, world) {
    const g = this.tank.group;
    const start = g.worldToLocal(world.clone());
    const p0 = this.pts[o.userData.i].clone();
    const half = this.tank.size / 2;
    return {
      move: (w) => {
        const p = g.worldToLocal(w.clone());
        this.pts[o.userData.i].set(THREE.MathUtils.clamp(p0.x + p.x - start.x, -half, half), THREE.MathUtils.clamp(p0.y + p.y - start.y, -half, half));
        this.refresh();
      },
      release: () => this.app.onMeasured(),
    };
  }

  refresh() {
    const adv = this.app.state?.level === 'advanced';
    const [a, b] = this.pts;
    const z = 0.016;
    this.pegs[0].position.set(a.x, a.y, z);
    this.pegs[1].position.set(b.x, b.y, z);
    this.bar.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, z);
    this.bar.rotation.z = Math.atan2(b.y - a.y, b.x - a.x);
    this.bar.scale.x = Math.max(0.001, this.span);
    setLabel(this, 'label', cm(this.span, adv), this.group).position.set((a.x + b.x) / 2, (a.y + b.y) / 2, 0.05);
  }
}
