import * as THREE from 'three';
import { MAX_Z } from '../data/elements.js';
import { COLORS } from './AtomModel.js';
import * as X from '../chemist/explain.js';
import { sound } from '../util/sound.js';

// Hands-on atom building: pull protons, neutrons and electrons out of the atom,
// or take new ones from the tray and drop them into the nucleus / shells.

const LIMITS = { p: MAX_Z, n: 60, e: MAX_Z };
const KEY = { proton: 'p', neutron: 'n', electron: 'e' };

export const ATOM_TRAY_ITEMS = [
  { kind: 'proton', label: 'Proton p⁺', color: COLORS.proton, radius: 0.02 },
  { kind: 'neutron', label: 'Neutron n', color: COLORS.neutron, radius: 0.02 },
  { kind: 'electron', label: 'Electron e⁻', color: COLORS.electron, emissive: 0x1a8fd0, radius: 0.015 },
];

export class AtomBuilder {
  constructor(app) {
    this.app = app;
    this.geo = new THREE.SphereGeometry(1, 20, 14);
  }

  get grabTargets() {
    const targets = this.app.atom.grabTargets;
    for (const t of targets) t.userData.handler = this;
    return targets;
  }

  describe(object) {
    const kind = object.userData.part ?? object.userData.trayItem;
    const p = X.PARTICLES[kind];
    if (!p) return '';
    return object.userData.trayItem ? `${p.name} · take one` : `${p.name} · pull it out`;
  }

  grab(object, mode, world) {
    const { app } = this;
    const kind = object.userData.part ?? object.userData.trayItem;
    if (!X.PARTICLES[kind]) return null;
    const key = KEY[kind];
    const before = { ...app.state.atom };
    const fromAtom = !!object.userData.part;
    if (fromAtom) {
      app.state.atom[key] = Math.max(0, app.state.atom[key] - 1);
      app.refresh();
    }
    app.explain(X.particlePicked(kind, fromAtom, before, { ...app.state.atom }));

    const mesh = new THREE.Mesh(this.geo, new THREE.MeshStandardMaterial({
      color: COLORS[kind], emissive: kind === 'electron' ? 0x1a8fd0 : 0x000000, roughness: 0.35,
    }));
    mesh.scale.setScalar(kind === 'electron' ? 0.012 : 0.016);
    mesh.position.copy(app.lab.worldToLocal(world.clone()));
    app.lab.add(mesh);

    let felt = false;
    let lastPulse = 0;
    return {
      move: (w) => {
        const hand = app.lab.worldToLocal(w.clone());
        mesh.position.copy(hand);
        app.tray.highlightBin(app.tray.binContains(w));

        // Electric forces near the atom: protons are pushed away, electrons pulled in.
        const centre = app.atom.group.position;
        const rel = hand.clone().sub(centre);
        const d = rel.length();
        const inner = kind === 'electron' ? app.atom.nucleusRadius + 0.03 : Math.max(app.atom.nucleusRadius, 0.012) + 0.012;
        const range = 0.14;
        const zone = d > inner && d < inner + range ? 1 - (d - inner) / range : 0;
        const charge = Math.min(1, 0.3 + app.state.atom.p / 8); // a bigger nucleus pushes/pulls harder
        let force = 0;
        if (zone > 0 && app.state.atom.p > 0) {
          if (kind === 'proton') force = 0.03 * zone * charge; // shown pushed back outwards
          if (kind === 'electron') force = -0.02 * zone * charge; // shown pulled inwards
          // (particles just pulled out keep their 'what changed' explanation)
          if (!felt && !fromAtom && (kind !== 'neutron' || zone > 0.5)) {
            felt = true;
            app.explain(X.FORCES[kind]);
          }
        }
        if (force) {
          mesh.position.addScaledVector(rel.normalize(), force);
          const now = performance.now();
          if (now - lastPulse > 50) {
            lastPulse = now;
            app.interaction.pulse(Math.min(1, Math.abs(force) * 35), 40);
          }
        }
      },
      release: (w) => {
        app.tray.highlightBin(false);
        app.lab.remove(mesh);
        mesh.material.dispose();
        const local = app.lab.worldToLocal(w.clone()).sub(app.atom.group.position);
        const d = local.length();
        const target = kind === 'electron'
          ? d < app.atom.outerRadius + 0.07
          : d < Math.max(app.atom.nucleusRadius, 0.02) + 0.05;
        const prev = { ...app.state.atom };
        if (target && !app.tray.binContains(w)) {
          if (prev[key] >= LIMITS[key]) {
            app.explain(X.particleLimit(kind));
            return;
          }
          app.state.atom[key] += 1;
          app.refresh();
          app.interaction.pulse(kind === 'proton' ? 1 : 0.5, kind === 'proton' ? 90 : 40);
          if (kind === 'electron') sound.bond();
          else sound.snap();
          app.explain(X.particleDropped(kind, true, prev, { ...app.state.atom }));
        } else if (!fromAtom) {
          app.explain(X.particleDropped(kind, false, prev, prev));
        }
        // (a particle pulled out of the atom and let go keeps its "what changed" explanation)
      },
    };
  }
}
