import * as THREE from 'three';
import { CELLS } from '../data/cells.js';
import { Cell } from './Cell.js';
import { makeLabel } from '../../../../shared/ui/labels.js';

// Compare sizes: every cell at the SAME magnification, side by side, with a scale bar —
// so the models keep their true sizes relative to each other.

export const COMPARE_MAG = 10000; // 1 µm → 1 cm

function redBloodCell(diameterM) {
  // biconcave disc, made by spinning a dumbbell-shaped profile
  const r = diameterM / 2;
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const x = r * t;
    const th = r * (0.12 + 0.5 * t * t * (1 - t) * 1.6) * (1 - t ** 8) + 0.0005;
    pts.push(new THREE.Vector2(x, th));
  }
  for (let i = 24; i >= 0; i--) pts.push(new THREE.Vector2(pts[i].x, -pts[i].y));
  const m = new THREE.Mesh(new THREE.LatheGeometry(pts, 48), new THREE.MeshStandardMaterial({ color: 0xc8303a, roughness: 0.5 }));
  m.rotation.x = Math.PI / 2.4;
  return m;
}

export class CompareView {
  constructor(app) {
    this.app = app;
    this.group = new THREE.Group();
    this.cells = [];
    const m = COMPARE_MAG * 1e-6; // metres per µm
    const items = [
      { type: 'bacterium', x: -0.355, label: 'Bacterium\n2 µm' },
      { rbc: true, x: -0.29, label: 'Red blood cell\n7.5 µm' },
      { type: 'animal', x: -0.13, label: 'Animal cell\n20 µm' },
      { type: 'plant', x: 0.19, label: 'Plant cell\n40 µm' },
    ];
    for (const it of items) {
      let obj;
      let height;
      if (it.rbc) {
        obj = redBloodCell(7.5 * m);
        height = 7.5 * m * 0.5;
      } else {
        const def = CELLS[it.type];
        const cell = new Cell(it.type, { scale: (def.realSize * m) / def.display, seed: 3 });
        this.cells.push(cell);
        obj = cell.group;
        height = it.type === 'plant' ? 0.3 * cell.group.scale.x : it.type === 'animal' ? def.realSize * m : 0.19 * cell.group.scale.x;
      }
      obj.position.set(it.x, -0.02, 0);
      this.group.add(obj);
      const tag = makeLabel(it.label, { height: 0.04, size: 38 });
      // the two smallest sit close together: put the bacterium's label underneath
      tag.position.set(it.x, it.type === 'bacterium' ? -0.08 : Math.max(height / 2, 0.02) + 0.06, 0.02);
      this.group.add(tag);
    }
    // scale bar: 10 µm
    const bar = new THREE.Mesh(new THREE.BoxGeometry(10 * m, 0.004, 0.004), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    bar.position.set(-0.2, -0.2, 0.05);
    this.group.add(bar);
    const barLabel = makeLabel('10 µm (at 10,000× it is 10 cm)', { height: 0.026, size: 38, bg: null });
    barLabel.position.set(-0.2, -0.225, 0.05);
    this.group.add(barLabel);
    const title = makeLabel('All cells at the same magnification: 10,000×', { height: 0.034, size: 40 });
    title.position.set(0, 0.27, 0);
    this.group.add(title);
  }

  update(dt) {
    for (const c of this.cells) c.update(dt);
  }
}
