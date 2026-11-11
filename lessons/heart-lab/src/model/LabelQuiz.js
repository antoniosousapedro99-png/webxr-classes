import * as THREE from 'three';
import { PARTS, partsFor } from '../data/heart.js';
import { font, roundRect } from '../../../../shared/ui/CanvasPanel.js';
import { sound } from '../../../../shared/util/sound.js';

// "Label it" (plenary): name tags float beside your heart. Drag each onto the right part. Right answers
// stick; wrong ones come back with a hint. The teacher sees everyone's score in the Admin menu.

function tagTexture(text, state) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const g = c.getContext('2d');
  roundRect(g, 4, 4, 504, 120, 30);
  g.fillStyle = { idle: 'rgba(20,26,48,0.92)', right: 'rgba(30,120,70,0.95)', wrong: 'rgba(170,40,50,0.95)' }[state];
  g.fill();
  g.lineWidth = 6;
  g.strokeStyle = state === 'idle' ? '#ff8fa3' : '#ffffff';
  g.stroke();
  g.fillStyle = '#ffffff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  let s = 50;
  g.font = font(s, 700);
  while (g.measureText(text).width > 470 && s > 22) g.font = font(--s, 700);
  g.fillText(text, 256, 66);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class LabelQuiz {
  constructor(app) {
    this.app = app;
    this.group = new THREE.Group();
    app.lab.add(this.group);
    this.tags = [];
    this.right = 0;
    this.wrong = 0;
    this.raycaster = new THREE.Raycaster();
  }

  start(heart, level) {
    this.heart = heart;
    for (const t of this.tags) {
      t.material.map.dispose();
      this.group.remove(t);
    }
    this.tags = [];
    this.right = 0;
    this.wrong = 0;
    const ids = partsFor(level);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    const perCol = Math.ceil(ids.length / 2);
    const step = Math.min(0.05, 0.5 / perCol);
    ids.forEach((id, i) => {
      const col = i < perCol ? -1 : 1;
      const row = i < perCol ? i : i - perCol;
      const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.035),
        new THREE.MeshBasicMaterial({ map: tagTexture(PARTS[id].name, 'idle'), transparent: true, toneMapped: false, depthTest: false }));
      tag.renderOrder = 8;
      tag.position.set(col * 0.33, 0.24 - row * step, 0.1);
      tag.rotation.y = -col * 0.35;
      tag.userData = { handler: this, tag: id, home: tag.position.clone(), done: false };
      this.group.add(tag);
      this.tags.push(tag);
    });
  }

  get total() {
    return this.tags.length;
  }

  setLook(tag, state) {
    tag.material.map.dispose();
    tag.material.map = tagTexture(PARTS[tag.userData.tag].name, state);
  }

  describe(o) {
    return o.userData.done ? `${PARTS[o.userData.tag].name} ✓` : 'Drag this label onto the heart';
  }

  grab(o, mode, world) {
    if (o.userData.done) return null;
    const lab = this.app.lab;
    const offset = o.position.clone().sub(lab.worldToLocal(world.clone()));
    o.rotation.y = 0;
    return {
      move: (w) => o.position.copy(lab.worldToLocal(w.clone())).add(offset),
      release: () => this.drop(o),
    };
  }

  /** The part of the heart behind the tag, seen from your eyes. */
  partBehind(tag) {
    const eye = this.app.viewCamera().getWorldPosition(new THREE.Vector3());
    this.heart.group.updateMatrixWorld(true); // (the heart may have just been turned back)
    const at = tag.getWorldPosition(new THREE.Vector3());
    this.raycaster.set(eye, at.clone().sub(eye).normalize());
    const hit = this.raycaster.intersectObjects(this.heart.targets, false)[0];
    return hit ? { id: hit.object.userData.part, point: hit.point } : null;
  }

  drop(tag) {
    const id = tag.userData.tag;
    const hit = this.partBehind(tag);
    if (!hit || !PARTS[hit.id]) {
      tag.position.copy(tag.userData.home);
      tag.rotation.y = -Math.sign(tag.userData.home.x) * 0.35;
      return;
    }
    if (hit.id === id) {
      this.right++;
      tag.userData.done = true;
      this.setLook(tag, 'right');
      const eye = this.app.viewCamera().getWorldPosition(new THREE.Vector3());
      const p = hit.point.clone().add(eye.clone().sub(hit.point).normalize().multiplyScalar(0.03));
      tag.position.copy(this.app.lab.worldToLocal(p));
      tag.scale.setScalar(0.75);
      sound.bond();
      this.app.interaction.pulse(0.5, 40);
      if (this.right === this.total) {
        sound.release(300);
        this.app.explain({ title: `All ${this.total} labelled!`, text: `You named every part of the heart${this.wrong ? ` (with ${this.wrong} wrong tr${this.wrong === 1 ? 'y' : 'ies'} on the way)` : ' without a single mistake'}. Now explain to a partner what each part does.` });
      } else {
        this.app.explain({ title: `Yes: ${PARTS[id].name}`, text: `${PARTS[id].text} (${this.right} of ${this.total} labelled)` });
      }
    } else {
      this.wrong++;
      this.setLook(tag, 'wrong');
      sound.refuse();
      this.app.interaction.pulse(0.8, 100);
      this.app.explain({ title: `Not quite: that’s the ${PARTS[hit.id].name.toLowerCase()}`, text: `Look for ${PARTS[id].look}.` });
      setTimeout(() => {
        if (!tag.userData.done) this.setLook(tag, 'idle');
      }, 1200);
      tag.position.copy(tag.userData.home);
      tag.rotation.y = -Math.sign(tag.userData.home.x) * 0.35;
    }
    this.app.quizChanged?.();
  }

  get grabTargets() {
    return this.tags.filter((t) => !t.userData.done);
  }
}
