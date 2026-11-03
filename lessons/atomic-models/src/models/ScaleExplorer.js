import * as THREE from 'three';
import { getElement } from '../data/elements.js';
import { atomToNucleusRatio } from '../data/atomInfo.js';
import { formatLength } from '../util/format.js';
import { makeLabel, clearGroup } from '../../../../shared/ui/labels.js';

// Two ways to feel the scale of atoms:
//  • compare — real atoms side by side, all drawn to one scale (1 pm → 0.4 mm)
//  • room    — the nucleus shrunk/grown to an everyday object placed in your room,
//              with the electron cloud drawn at its true relative size… far outside the window.

export const COMPARE_SCALE = 0.0004; // metres of model per picometre

export const COMPARE_PRESETS = {
  period2: { label: 'Across period 2', z: [3, 4, 5, 6, 7, 8, 9, 10] },
  group1: { label: 'Down group 1', z: [1, 3, 11, 19] },
  everyday: { label: 'Everyday atoms', z: [1, 6, 7, 8, 11, 17, 26] },
  noble: { label: 'Noble gases', z: [2, 10, 18, 36] },
};

export const NUCLEUS_OBJECTS = {
  pea: { label: 'Pea', radius: 0.0045 },
  marble: { label: 'Marble', radius: 0.008 },
  golf: { label: 'Golf ball', radius: 0.0214 },
  tennis: { label: 'Tennis ball', radius: 0.0335 },
  football: { label: 'Football', radius: 0.11 },
};

export class ScaleExplorer {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'scale';
    this.compare = new THREE.Group();
    this.room = new THREE.Group();
    this.group.add(this.compare, this.room);
    this.key = '';
    this.electron = null;
    this.edgeRadius = 0;
    this.time = 0;
  }

  set({ sub, preset, objectId, Z, A }) {
    const key = `${sub}/${preset}/${objectId}/${Z}/${A}`;
    if (key === this.key) return;
    this.key = key;
    clearGroup(this.compare);
    clearGroup(this.room);
    this.electron = null;
    this.compare.visible = sub === 'compare';
    this.room.visible = sub === 'room';
    if (sub === 'compare') this.buildCompare(COMPARE_PRESETS[preset]);
    else if (sub === 'room') this.buildRoom(NUCLEUS_OBJECTS[objectId], getElement(Z), A);
  }

  buildCompare(preset) {
    const els = preset.z.map(getElement);
    const gap = 0.025;
    const radii = els.map((e) => e.radius * COMPARE_SCALE);
    const total = radii.reduce((s, r) => s + 2 * r, 0) + gap * (els.length - 1);
    let x = -total / 2;
    const sphere = new THREE.SphereGeometry(1, 40, 24);
    els.forEach((el, i) => {
      const r = radii[i];
      x += r;
      const mesh = new THREE.Mesh(sphere, new THREE.MeshStandardMaterial({
        color: el.color, roughness: 0.4, transparent: true, opacity: 0.92,
      }));
      mesh.scale.setScalar(r);
      mesh.position.set(x, r - 0.1, 0);
      this.compare.add(mesh);
      const label = makeLabel(`${el.symbol}\n${el.radius} pm`, { height: 0.05, size: 44 });
      label.position.set(x, 2 * r - 0.1 + 0.045, 0);
      this.compare.add(label);
      x += r + gap;
    });

    // 100 pm scale bar
    const barLen = 100 * COMPARE_SCALE;
    const bar = new THREE.Mesh(new THREE.BoxGeometry(barLen, 0.004, 0.004), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    bar.position.set(-barLen / 2, -0.14, 0);
    this.compare.add(bar);
    const barLabel = makeLabel('100 pm = 0.000 000 000 1 m', { height: 0.028, size: 40, bg: null });
    barLabel.position.set(0.16, -0.14, 0);
    this.compare.add(barLabel);
  }

  buildRoom(object, element, A) {
    const ratio = atomToNucleusRatio(element, A);
    const R = object.radius * ratio; // where the electron cloud ends
    this.edgeRadius = R;

    // The nucleus, at the real size of the chosen object.
    const nucleus = new THREE.Mesh(
      new THREE.SphereGeometry(object.radius, 32, 20),
      new THREE.MeshStandardMaterial({ color: 0xe5484d, emissive: 0x401010, roughness: 0.4 }),
    );
    this.room.add(nucleus);
    const marker = new THREE.Mesh(
      new THREE.TorusGeometry(Math.max(object.radius * 1.8, 0.03), 0.002, 8, 64),
      new THREE.MeshBasicMaterial({ color: 0xffd166 }),
    );
    marker.userData.pulse = true;
    this.room.add(marker);
    const label = makeLabel(`Nucleus of ${element.name}-${A}\n= a ${object.label.toLowerCase()} (${formatLength(object.radius * 2)})`, { height: 0.07, size: 40 });
    label.position.set(0, Math.max(object.radius * 2, 0.06) + 0.06, 0);
    this.room.add(label);

    // The electron cloud's edge: a faint bubble around you, plus a ring and a beacon to look for.
    const bubble = new THREE.Mesh(
      new THREE.SphereGeometry(R, 64, 32),
      new THREE.MeshBasicMaterial({ color: 0x4cc9ff, transparent: true, opacity: 0.1, side: THREE.BackSide, depthWrite: false }),
    );
    bubble.renderOrder = -1;
    this.room.add(bubble);

    const ringPts = [];
    for (let i = 0; i <= 256; i++) {
      const a = (i / 256) * Math.PI * 2;
      ringPts.push(new THREE.Vector3(Math.cos(a) * R, 0, Math.sin(a) * R));
    }
    this.room.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(ringPts),
      new THREE.LineBasicMaterial({ color: 0x4cc9ff, transparent: true, opacity: 0.8 }),
    ));

    const beaconH = Math.max(10, R * 0.15);
    const beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(R * 0.006, R * 0.006, beaconH, 12),
      new THREE.MeshBasicMaterial({ color: 0x4cc9ff, transparent: true, opacity: 0.7 }),
    );
    beacon.position.set(0, beaconH / 2, -R);
    this.room.add(beacon);
    const edgeLabel = makeLabel(`Edge of the atom\n${formatLength(R)} away`, { height: R * 0.09, size: 48 });
    edgeLabel.position.set(0, beaconH + R * 0.07, -R);
    this.room.add(edgeLabel);

    this.electron = makeLabel('e⁻', { height: Math.max(1, R * 0.03), color: '#4cc9ff', size: 64 });
    this.room.add(this.electron);
  }

  animate(dt) {
    this.time += dt;
    if (this.electron) {
      const a = this.time * 0.08 + Math.PI / 2;
      const R = this.edgeRadius;
      this.electron.position.set(Math.cos(a) * R, R * 0.02, -Math.sin(a) * R);
    }
    for (const c of this.room.children) {
      if (c.userData.pulse) c.scale.setScalar(1 + 0.15 * Math.sin(this.time * 4));
    }
  }
}
