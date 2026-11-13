import * as THREE from 'three';
import { makeLabel, clearGroup } from '../../../../shared/ui/labels.js';
import { TOP } from './Body.js';

// Starter option 2: a 3D pen. Pick it up and draw in the air (on a screen: drag it, and it draws on a sheet
// facing you). Add a label, hide it, and let your partner guess. Drawings are shared, so a partner sees yours
// at your desk.

export const INKS = [0xff5a6e, 0x5bb8ff, 0x7ee2a8, 0xffd166, 0xffffff];
const MAX_POINTS = 700; // in all strokes (kept small: drawings are shared with the class)
const STEP = 0.006; // a new point every 6 mm
const HOME = new THREE.Vector3(-0.66, TOP + 0.012, 0.24);

/** Draw strokes ([[ink, x,y,z, x,y,z…]…], lab coordinates in mm) into a group as tubes. */
export function drawStrokes(group, strokes, label, hidden) {
  clearGroup(group);
  const box = new THREE.Box3();
  for (const s of strokes) {
    const pts = [];
    for (let i = 1; i + 2 < s.length; i += 3) pts.push(new THREE.Vector3(s[i] / 1000, s[i + 1] / 1000, s[i + 2] / 1000));
    if (pts.length < 2) {
      if (pts.length === 1) {
        const dot = new THREE.Mesh(new THREE.SphereGeometry(0.004, 8, 6), new THREE.MeshBasicMaterial({ color: INKS[s[0]] ?? 0xffffff }));
        dot.position.copy(pts[0]);
        group.add(dot);
        box.expandByPoint(pts[0]);
      }
      continue;
    }
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.min(200, pts.length * 2), 0.0028, 6, false), new THREE.MeshBasicMaterial({ color: INKS[s[0]] ?? 0xffffff }));
    group.add(tube);
    for (const p of pts) box.expandByPoint(p);
  }
  if (label && !box.isEmpty()) {
    const tag = makeLabel(hidden ? '? ? ?' : label, { height: 0.03, size: 56 });
    tag.position.set((box.min.x + box.max.x) / 2, box.max.y + 0.04, (box.min.z + box.max.z) / 2);
    group.add(tag);
  }
}

export class Pen {
  constructor(app) {
    this.app = app;
    this.group = new THREE.Group();
    app.lab.add(this.group);
    this.strokes = []; // [[ink, x,y,z (mm)…]…]
    this.ink = 0;
    this.label = null;
    this.hidden = false;
    this.ink3d = new THREE.Group();
    this.group.add(this.ink3d);
    this.live = null; // the stroke being drawn, as a line until it's finished

    // the pen: tip at the origin, body along +x (it points away from the hand)
    this.pen = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.13, 12).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x3a3f55, roughness: 0.4 }));
    body.position.x = 0.085;
    this.tipMat = new THREE.MeshStandardMaterial({ color: INKS[0], emissive: INKS[0], emissiveIntensity: 0.6 });
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.022, 12).rotateZ(Math.PI / 2), this.tipMat);
    tip.position.x = 0.01;
    this.pen.add(body, tip);
    for (const m of [body, tip]) m.userData = { handler: this, pen: true };
    this.picks = [body, tip];
    this.pen.position.copy(HOME);
    this.pen.rotation.y = -0.6;
    this.group.add(this.pen);
    this.tag = makeLabel('3D pen', { height: 0.012, size: 36 });
    this.tag.position.copy(HOME).add(new THREE.Vector3(0.06, 0.02, 0.03));
    this.group.add(this.tag);
    this.setVisible(false);
  }

  setVisible(on) {
    this.pen.visible = on;
    this.tag.visible = on;
    this.ink3d.visible = on;
  }

  get points() {
    return this.strokes.reduce((a, s) => a + (s.length - 1) / 3, 0);
  }

  setInk(i) {
    this.ink = i;
    this.tipMat.color.setHex(INKS[i]);
    this.tipMat.emissive.setHex(INKS[i]);
  }

  undo() {
    this.strokes.pop();
    this.redraw();
  }

  clear() {
    this.strokes = [];
    this.redraw();
  }

  redraw() {
    drawStrokes(this.ink3d, this.strokes, this.label, false);
    this.app.onDrawingChanged();
  }

  describe() {
    return '3D pen · pick it up and draw in the air';
  }

  grab(o, mode, world) {
    const off = this.pen.position.clone().sub(this.group.worldToLocal(world.clone()));
    this.pen.userData.held = true;
    let stroke = null;
    let last = null;
    const add = () => {
      if (this.points >= MAX_POINTS) return;
      const tip = this.pen.position;
      if (last && tip.distanceTo(last) < STEP) return;
      last = tip.clone();
      if (!stroke) {
        stroke = [this.ink];
        this.strokes.push(stroke);
      }
      stroke.push(Math.round(tip.x * 1000), Math.round(tip.y * 1000), Math.round(tip.z * 1000));
      this.drawLive(stroke);
    };
    return {
      move: (w) => {
        this.pen.position.copy(this.group.worldToLocal(w.clone())).add(off);
        // on a screen the pen is dragged across a sheet facing you; in a headset it follows your hand
        add();
      },
      release: () => {
        this.pen.userData.held = false;
        if (stroke && stroke.length <= 4) this.strokes.pop(); // a click, not a stroke
        this.live?.removeFromParent();
        this.live = null;
        this.pen.position.copy(HOME);
        this.redraw();
      },
    };
  }

  drawLive(stroke) {
    const pts = [];
    for (let i = 1; i + 2 < stroke.length; i += 3) pts.push(new THREE.Vector3(stroke[i] / 1000, stroke[i + 1] / 1000, stroke[i + 2] / 1000));
    if (!this.live) {
      this.live = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: INKS[stroke[0]] }));
      this.group.add(this.live);
    }
    this.live.geometry.dispose();
    this.live.geometry = new THREE.BufferGeometry().setFromPoints(pts);
  }

  get targets() {
    return this.pen.visible ? this.picks : [];
  }
}
