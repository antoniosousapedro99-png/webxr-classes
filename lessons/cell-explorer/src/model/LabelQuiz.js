import * as THREE from 'three';
import { ORGANELLES } from '../data/cells.js';
import { font, roundRect } from '../../../../shared/ui/CanvasPanel.js';
import { sound } from '../../../../shared/util/sound.js';

// "Label it": name tags float beside the cell. Drag each one onto the right part of the cell.
// The tag sticks if it's right; if not, it comes back with a hint about what to look for.

const LOOK = {
  membrane: 'the thin outer layer that wraps the whole cell',
  cytoplasm: 'the jelly that fills the space between the organelles',
  nucleus: 'the big round purple structure with a dark spot inside',
  mitochondria: 'orange capsule shapes with folds inside',
  ribosomes: 'the tiny dark dots scattered everywhere',
  roughER: 'the folded blue layers around the nucleus, dotted with ribosomes',
  smoothER: 'the smooth pale-blue tubes beside the rough ER',
  golgi: 'the stack of curved yellow sacs',
  vesicles: 'small yellow bubbles near the Golgi',
  lysosomes: 'small pink-purple spheres with dark specks',
  centrioles: 'two tiny bundles of tubes at right angles',
  cellWall: 'the thick green outer layer',
  vacuole: 'the big pale-blue bag in the middle',
  chloroplasts: 'green ovals with stacks of discs inside',
  nucleoid: 'the tangled purple loop',
  plasmids: 'small orange rings',
  flagellum: 'the long spiral tail',
  pili: 'the short hairs on the outside',
  capsule: 'the faint outermost layer',
};

function tagTexture(text, state) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const g = c.getContext('2d');
  roundRect(g, 4, 4, 504, 120, 30);
  g.fillStyle = { idle: 'rgba(20,26,48,0.92)', right: 'rgba(30,120,70,0.95)', wrong: 'rgba(170,40,50,0.95)' }[state];
  g.fill();
  g.lineWidth = 6;
  g.strokeStyle = state === 'idle' ? '#9aa8ff' : '#ffffff';
  g.stroke();
  g.fillStyle = '#ffffff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  let s = 52;
  g.font = font(s, 700);
  while (g.measureText(text).width > 470 && s > 24) g.font = font(--s, 700);
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
    this.raycaster = new THREE.Raycaster();
  }

  start(cell) {
    this.cell = cell;
    for (const t of this.tags) this.group.remove(t);
    this.tags = [];
    this.right = 0;
    this.wrong = 0;
    const ids = [...cell.parts.keys()];
    // shuffle so the order doesn't give the answers away
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    const perCol = Math.ceil(ids.length / 2);
    ids.forEach((id, i) => {
      const col = i < perCol ? -1 : 1;
      const row = i < perCol ? i : i - perCol;
      const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.0325),
        new THREE.MeshBasicMaterial({ map: tagTexture(ORGANELLES[id].name, 'idle'), transparent: true, toneMapped: false, depthTest: false }));
      tag.renderOrder = 8;
      tag.position.set(col * 0.33, 0.2 - row * 0.05, 0.1);
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
    tag.material.map = tagTexture(ORGANELLES[tag.userData.tag].name, state);
  }

  describe(o) {
    return o.userData.done ? `${ORGANELLES[o.userData.tag].name} ✓` : 'Drag this label onto the cell';
  }

  grab(o, mode, world) {
    if (o.userData.done) return null;
    const lab = this.app.lab;
    const offset = o.position.clone().sub(lab.worldToLocal(world.clone()));
    o.rotation.y = 0;
    this.app.netHolding = { label: `Label: ${ORGANELLES[o.userData.tag].name}` };
    return {
      move: (w) => o.position.copy(lab.worldToLocal(w.clone())).add(offset),
      release: () => {
        this.app.netHolding = null;
        this.drop(o);
      },
    };
  }

  /** What part of the cell is behind the tag, seen from your eyes? */
  partBehind(tag) {
    const eye = this.app.viewCamera().getWorldPosition(new THREE.Vector3());
    const at = tag.getWorldPosition(new THREE.Vector3());
    this.raycaster.set(eye, at.clone().sub(eye).normalize());
    const hit = this.raycaster.intersectObjects(this.cell.targets, false)[0];
    return hit ? { id: hit.object.userData.organelle, point: hit.point } : null;
  }

  drop(tag) {
    const id = tag.userData.tag;
    const hit = this.partBehind(tag);
    if (!hit) {
      tag.position.copy(tag.userData.home);
      return;
    }
    if (hit.id === id) {
      this.right++;
      tag.userData.done = true;
      this.setLook(tag, 'right');
      // stick it just in front of the part it labels
      const eye = this.app.viewCamera().getWorldPosition(new THREE.Vector3());
      const p = hit.point.clone().add(eye.clone().sub(hit.point).normalize().multiplyScalar(0.03));
      tag.position.copy(this.app.lab.worldToLocal(p));
      tag.scale.setScalar(0.8);
      sound.bond();
      this.app.interaction.pulse(0.5, 40);
      if (this.right === this.total) {
        sound.release(300);
        this.app.explain({ title: `All ${this.total} labelled!`, text: `You named every part of the ${this.cell.def.name.toLowerCase()}${this.wrong ? ` (with ${this.wrong} wrong tr${this.wrong === 1 ? 'y' : 'ies'} on the way)` : ' without a single mistake'}. Try another cell, or switch to Explore to find out what each part does.` });
      } else {
        this.app.explain({ title: `Yes — ${ORGANELLES[id].name}`, text: `${ORGANELLES[id].purpose} (${this.right} of ${this.total} labelled)` });
      }
    } else {
      this.wrong++;
      this.setLook(tag, 'wrong');
      sound.refuse();
      this.app.interaction.pulse(0.8, 100);
      this.app.explain({ title: `Not quite — that’s the ${ORGANELLES[hit.id].name.toLowerCase()}`, text: `The ${ORGANELLES[id].name.toLowerCase()} is ${LOOK[id]}.` });
      setTimeout(() => {
        if (!tag.userData.done) this.setLook(tag, 'idle');
      }, 1200);
      tag.position.copy(tag.userData.home);
    }
  }

  get grabTargets() {
    return this.tags.filter((t) => !t.userData.done);
  }
}
