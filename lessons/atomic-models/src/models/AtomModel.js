import * as THREE from 'three';
import { shellsFor } from '../data/elements.js';
import { clearGroup } from '../ui/labels.js';

// Bohr-style atom: packed nucleus of protons + neutrons, electrons on shells.
// NOT to scale (the Scale mode shows the real proportions).

const NUCLEON_R = 0.011;
const FIRST_SHELL_GAP = 0.05;
const SHELL_GAP = 0.045;

export const COLORS = { proton: 0xe5484d, neutron: 0x9aa4b5, electron: 0x4cc9ff };

function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Face-centred cubic lattice points (nearest-neighbour distance 1), closest to the centre first.
let LATTICE = null;
function lattice() {
  if (LATTICE) return LATTICE;
  const pts = [];
  const s = Math.SQRT1_2;
  for (let i = -5; i <= 5; i++)
    for (let j = -5; j <= 5; j++)
      for (let k = -5; k <= 5; k++)
        if (((i + j + k) & 1) === 0) pts.push(new THREE.Vector3(i * s, j * s, k * s));
  const c = new THREE.Vector3(0.05, 0.03, 0.02); // break ties so small nuclei look natural
  pts.sort((a, b) => a.distanceToSquared(c) - b.distanceToSquared(c));
  LATTICE = pts;
  return pts;
}

export class AtomModel {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'atom';
    this.nucleus = new THREE.Group();
    this.electrons = new THREE.Group();
    this.group.add(this.nucleus, this.electrons);

    this.geoNucleon = new THREE.SphereGeometry(NUCLEON_R, 24, 16);
    this.geoElectron = new THREE.SphereGeometry(0.009, 16, 12);
    this.matP = new THREE.MeshStandardMaterial({ color: COLORS.proton, roughness: 0.35 });
    this.matN = new THREE.MeshStandardMaterial({ color: COLORS.neutron, roughness: 0.45 });
    this.matE = new THREE.MeshStandardMaterial({ color: COLORS.electron, emissive: 0x1a8fd0, emissiveIntensity: 1.3 });
    this.shared = new Set([this.geoNucleon, this.geoElectron, this.matP, this.matN, this.matE]);

    this.orbits = [];
    this.cloud = null;
    this.key = '';
    this.nucleusRadius = 0;
    this.outerRadius = 0.1;
  }

  set({ p, n, e, view }) {
    const key = `${p}/${n}/${e}/${view}`;
    if (key === this.key) return;
    this.key = key;
    this.buildNucleus(p, n);
    this.buildElectrons(e, view);
  }

  buildNucleus(p, n) {
    clearGroup(this.nucleus, this.shared);
    const A = p + n;
    if (A === 0) {
      this.nucleusRadius = 0;
      return;
    }
    const pts = lattice().slice(0, A).map((v) => v.clone());
    const centre = pts.reduce((acc, v) => acc.add(v), new THREE.Vector3()).divideScalar(A);
    // Decide which lattice sites are protons with a repeatable shuffle.
    const rand = mulberry32(A * 131 + p * 7);
    const order = pts.map((_, i) => i).sort(() => rand() - 0.5);
    const isProton = new Set(order.slice(0, p));
    let maxR = 0;
    pts.forEach((v, i) => {
      v.sub(centre).multiplyScalar(NUCLEON_R * 2 * 0.92);
      maxR = Math.max(maxR, v.length());
      const m = new THREE.Mesh(this.geoNucleon, isProton.has(i) ? this.matP : this.matN);
      m.position.copy(v);
      this.nucleus.add(m);
    });
    this.nucleusRadius = maxR + NUCLEON_R;
  }

  buildElectrons(e, view) {
    clearGroup(this.electrons, this.shared);
    this.orbits = [];
    this.cloud = null;
    const shells = shellsFor(e);
    const base = Math.max(this.nucleusRadius, NUCLEON_R) + FIRST_SHELL_GAP;
    const radii = shells.map((_, k) => base + k * SHELL_GAP);
    this.outerRadius = radii.length ? radii[radii.length - 1] : Math.max(this.nucleusRadius, 0.05);

    if (view === 'cloud') {
      this.buildCloud(shells, radii);
      return;
    }

    shells.forEach((count, k) => {
      const r = radii[k];
      const tilt = new THREE.Group();
      tilt.rotation.set(0.35 + k * 0.55, k * 1.15, 0);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(r, 0.0013, 6, 128),
        new THREE.MeshBasicMaterial({ color: 0x8c9bff, transparent: true, opacity: 0.4 }),
      );
      tilt.add(ring);
      const orbit = new THREE.Group();
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        const el = new THREE.Mesh(this.geoElectron, this.matE);
        el.position.set(Math.cos(a) * r, Math.sin(a) * r, 0);
        orbit.add(el);
      }
      orbit.userData.speed = 1.1 / (k + 1);
      tilt.add(orbit);
      this.orbits.push(orbit);
      this.electrons.add(tilt);
    });
  }

  // Probability-cloud style view: dots are denser where an electron is more likely to be found.
  buildCloud(shells, radii) {
    const rand = mulberry32(shells.length * 977 + shells.reduce((a, b) => a + b, 0));
    const gauss = () => Math.sqrt(-2 * Math.log(rand() + 1e-9)) * Math.cos(2 * Math.PI * rand());
    const positions = [];
    shells.forEach((count, k) => {
      for (let i = 0; i < count * 450; i++) {
        const dir = new THREE.Vector3(gauss(), gauss(), gauss()).normalize();
        const r = Math.max(0.005, radii[k] + gauss() * SHELL_GAP * 0.3);
        positions.push(dir.x * r, dir.y * r, dir.z * r);
      }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    this.cloud = new THREE.Points(geo, new THREE.PointsMaterial({
      color: COLORS.electron, size: 0.0035, transparent: true, opacity: 0.6,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    this.electrons.add(this.cloud);
  }

  animate(dt) {
    for (const o of this.orbits) o.rotation.z += o.userData.speed * dt;
    if (this.cloud) this.cloud.rotation.y += 0.15 * dt;
    this.nucleus.rotation.y += 0.25 * dt;
  }
}
