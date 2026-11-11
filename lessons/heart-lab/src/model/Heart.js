import * as THREE from 'three';
import { PARTS, T } from '../data/heart.js';

// A human heart, built from code (no model file), so every part is its own object that can be named,
// tapped, highlighted, cut open and animated:
//  • four chambers that contract in the right order, a septum, four valves whose flaps open and close,
//    the great vessels, coronary arteries on the surface, and (advanced) the conduction system
//  • two looks: "realistic" (muscle, fat, pale arteries, purple veins) and "textbook" (blue = deoxygenated,
//    red = oxygenated)
//  • conditions: narrowed coronary artery, heart attack (dying muscle), leaky mitral valve, hole in the septum
//
// Coordinates: the heart is about 1.6 units tall, seen from the front (anterior view), so the heart's own
// right side (right atrium and ventricle) is on YOUR left, at −x; +y is up, +z points out of the chest.

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
/** A bump of height 1 between a and b (rising over `rise`, falling over `fall`). */
const pulse = (x, a, b, rise = 0.03, fall = 0.05) => smooth(a, a + rise, x) * (1 - smooth(b - fall, b, x));

export const CUT_Z = -0.06; // the cutting plane (front of the heart removed)

/** Where everything is (shared with the blood flow, so the blood goes through the right places). */
export const GEO = {
  centre: V(0, -0.05, -0.04),
  RA: { c: V(-0.36, 0.2, 0.0), r: V(0.21, 0.23, 0.2) },
  LA: { c: V(0.18, 0.27, -0.2), r: V(0.23, 0.16, 0.18) },
  RV: { c: V(-0.13, -0.1, 0.1), r: V(0.27, 0.33, 0.2), rotZ: -0.1, taper: 0.45 },
  LV: { c: V(0.12, -0.16, -0.04), r: V(0.27, 0.42, 0.27), rotZ: 0.38, taper: 0.55 },
  valves: {
    tricuspid: { c: V(-0.25, 0.04, 0.05), n: V(0.23, -0.3, 0.1), R: 0.085, n3: 3, kind: 'av' },
    mitral: { c: V(0.15, 0.07, -0.12), n: V(-0.06, -0.43, 0.16), R: 0.08, n3: 2, kind: 'av' },
    pulmonaryValve: { c: V(0.05, 0.22, 0.17), n: V(0.15, 1, -0.25), R: 0.064, n3: 3, kind: 'sl' },
    aorticValve: { c: V(-0.03, 0.2, -0.02), n: V(-0.1, 1, 0.05), R: 0.07, n3: 3, kind: 'sl' },
  },
  aorta: [V(-0.03, 0.18, -0.02), V(-0.06, 0.45, 0.0), V(-0.03, 0.66, -0.03), V(0.1, 0.76, -0.1), V(0.24, 0.7, -0.22), V(0.28, 0.5, -0.32), V(0.27, 0.1, -0.38), V(0.25, -0.3, -0.4)],
  aortaBranches: [[V(0.0, 0.72, -0.05), V(-0.04, 1.0, -0.06)], [V(0.09, 0.76, -0.1), V(0.1, 1.02, -0.12)], [V(0.17, 0.74, -0.16), V(0.22, 1.0, -0.2)]],
  paTrunk: [V(0.05, 0.2, 0.17), V(0.09, 0.4, 0.15), V(0.1, 0.52, 0.05)],
  paLeft: [V(0.1, 0.52, 0.05), V(0.3, 0.56, -0.02), V(0.47, 0.54, -0.08)],
  paRight: [V(0.1, 0.52, 0.05), V(-0.05, 0.56, -0.12), V(-0.3, 0.55, -0.15), V(-0.5, 0.52, -0.15)],
  svc: [V(-0.34, 0.86, -0.07), V(-0.35, 0.56, -0.05), V(-0.36, 0.32, -0.03)],
  ivc: [V(-0.28, -0.42, -0.17), V(-0.32, -0.18, -0.13), V(-0.36, 0.04, -0.07)],
  pulmVeins: [
    [V(-0.5, 0.36, -0.3), V(-0.2, 0.33, -0.3), V(0.03, 0.3, -0.24)],
    [V(-0.5, 0.2, -0.28), V(-0.2, 0.2, -0.28), V(0.03, 0.22, -0.22)],
    [V(0.55, 0.36, -0.26), V(0.36, 0.32, -0.24)],
    [V(0.55, 0.2, -0.24), V(0.36, 0.22, -0.22)],
  ],
  septumHole: V(0.0, -0.08, 0.04),
};

// ───────────── looks ─────────────

const LOOKS = {
  real: {
    rightAtrium: 0x8a2c35, leftAtrium: 0x8a2c35, rightVentricle: 0x9a3030, leftVentricle: 0x9a3030, septum: 0x8f2a2c,
    valve: 0xf2e6d0, aorta: 0xd8a08c, pulmonaryArtery: 0xcf9a8e, venaCava: 0x6a4a8c, pulmonaryVeins: 0x9a4a5e,
    coronaryArteries: 0xc8302a, fat: 0xcfae78, conduction: 0xffe066, chordae: 0xf0e2d0,
  },
  text: {
    rightAtrium: 0x3f74e6, leftAtrium: 0xe0413f, rightVentricle: 0x3466d8, leftVentricle: 0xd6363a, septum: 0xd98aa0,
    valve: 0xffffff, aorta: 0xff4d4d, pulmonaryArtery: 0x4d7dff, venaCava: 0x2f5fd0, pulmonaryVeins: 0xff6a5a,
    coronaryArteries: 0xff2a2a, fat: 0xe6c46e, conduction: 0xffe066, chordae: 0xffffff,
  },
};
const INNER = { real: 0x8a3a42, text: null }; // inside of the chambers (textbook: the chamber's own colour, darker)

/** A muscle-like texture (fibres + mottling), made once. */
let muscleTex = null;
function muscleTexture() {
  if (muscleTex) return muscleTex;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#d8d0d0';
  g.fillRect(0, 0, 256, 256);
  let seed = 3;
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 900; i++) {
    // diagonal fibres
    const x = r() * 256;
    const y = r() * 256;
    const len = 20 + r() * 50;
    g.strokeStyle = `rgba(${150 + r() * 60},${110 + r() * 40},${110 + r() * 40},${0.25 + r() * 0.25})`;
    g.lineWidth = 1 + r() * 2;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + len * 0.8, y + len * 0.45);
    g.stroke();
  }
  for (let i = 0; i < 140; i++) {
    g.fillStyle = `rgba(255,255,255,${r() * 0.12})`;
    g.beginPath();
    g.arc(r() * 256, r() * 256, 4 + r() * 16, 0, Math.PI * 2);
    g.fill();
  }
  muscleTex = new THREE.CanvasTexture(c);
  muscleTex.colorSpace = THREE.SRGBColorSpace;
  muscleTex.wrapS = muscleTex.wrapT = THREE.RepeatWrapping;
  muscleTex.repeat.set(3, 2);
  return muscleTex;
}

// ───────────── shapes ─────────────

/** A soft, slightly lumpy egg: a sphere scaled to `r`, narrowing towards −y by `taper`. */
function blobGeometry(r, { taper = 0, lumps = 0.025, seed = 1 } = {}) {
  const g = new THREE.SphereGeometry(1, 56, 40);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const k = 1 + lumps * Math.sin(v.x * 7.1 + seed) * Math.sin(v.y * 5.3 + seed * 2) * Math.sin(v.z * 6.7 + seed * 3);
    v.multiplyScalar(k);
    if (taper && v.y < 0) {
      const s = 1 + v.y * taper; // narrower towards the bottom
      v.x *= s;
      v.z *= s;
    }
    p.setXYZ(i, v.x * r.x, v.y * r.y, v.z * r.z);
  }
  g.computeVertexNormals();
  return g;
}

const tube = (pts, radius, seg = 48) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'centripetal'), seg, radius, 16, false);

export class Heart {
  /**
   * handler: the Interaction handler for its parts (tap / grab), set on every part.
   * big: the class demo heart (no picking-specific changes, just a flag for the owner).
   */
  constructor({ handler = null, big = false } = {}) {
    this.big = big;
    this.group = new THREE.Group(); // placed and scaled by the lesson
    this.model = new THREE.Group(); // turned by the user
    this.group.add(this.model);
    this.parts = new Map(); // id → meshes
    this.mats = new Map(); // id → material
    this.view = 'real';
    this.level = 'core';
    this.cutOn = false;
    this.condition = 'healthy';
    this.highlight = new Set();
    this.clip = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);
    this.clipMats = []; // materials cut by the plane
    this.vesselMats = []; // see-through when cut open
    this.handler = handler;
    this.time = 0;
    this.build();
    this.setView('real');
    this.setLevel('core');
    this.space = this.model; // where blood and name tags go
    this.model.position.y = -0.19; // (its middle, top to bottom)
    this.real = false;
  }

  /** Points the blood flows through (see Blood.js). */
  get geo() {
    const VAL = GEO.valves;
    const ao = GEO.aorta;
    return {
      RAc: GEO.RA.c, LAc: GEO.LA.c, RVc: V(-0.1, -0.15, 0.08), LVc: V(0.1, -0.15, -0.04),
      RVlow: V(-0.06, -0.33, 0.08), LVlow: V(0.18, -0.38, -0.02), RVout: V(0.0, 0.05, 0.15), LVout: V(-0.01, 0.05, -0.03),
      tricuspid: VAL.tricuspid.c, mitral: VAL.mitral.c, pulmonaryValve: VAL.pulmonaryValve.c, aorticValve: VAL.aorticValve.c,
      inlets: [[GEO.svc[0], GEO.svc[1]], [GEO.ivc[0], GEO.ivc[1]]],
      paTrunk: [GEO.paTrunk[1], GEO.paTrunk[2]],
      paOut: [GEO.paLeft.slice(1), GEO.paRight.slice(1)],
      aortaOut: [[ao[1], ao[2], ao[3], ao[4], ao[5], ao[6], ao[7]], [ao[1], ao[2], ao[3], GEO.aortaBranches[1][1]]],
      veins: GEO.pulmVeins.map((v) => [v[0], v.at(-1)]),
      septumHole: GEO.septumHole,
      scale: 1,
    };
  }

  // ───────────── building ─────────────

  mat(id, { clip = false, vessel = false, inner = true } = {}) {
    if (this.mats.has(id)) return this.mats.get(id);
    const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0, side: THREE.DoubleSide });
    m.userData.inner = { value: new THREE.Color(0x5e1520) };
    m.userData.isch = { value: 0 };
    m.userData.hasInner = inner;
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uInner = m.userData.inner;
      sh.uniforms.uIsch = m.userData.isch;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vObj;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = position;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform vec3 uInner;\nuniform float uIsch;\nvarying vec3 vObj;')
        .replace('#include <map_fragment>', `#include <map_fragment>
          ${inner ? 'if (!gl_FrontFacing) diffuseColor.rgb = uInner;' : ''}
          if (uIsch > 0.0) {
            // the dying muscle beyond the blocked artery: the front of the left ventricle, towards the tip
            float zone = smoothstep(-0.16, 0.04, vObj.z) * smoothstep(0.12, -0.18, vObj.y) * smoothstep(-0.22, -0.02, vObj.x);
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.2, 0.13, 0.22), zone * uIsch * 0.92);
          }`);
    };
    m.customProgramCacheKey = () => `heart-${inner}`;
    this.mats.set(id, m);
    if (clip) this.clipMats.push(m);
    if (vessel) this.vesselMats.push(m);
    return m;
  }

  add(id, mesh, parent = this.model) {
    parent.add(mesh);
    if (!this.parts.has(id)) this.parts.set(id, []);
    this.parts.get(id).push(mesh);
    mesh.traverse((o) => {
      if (o.isMesh) Object.assign(o.userData, { part: id, heart: this, handler: this.handler });
    });
    return mesh;
  }

  chamber(id, def, extra = {}) {
    const m = new THREE.Mesh(blobGeometry(def.r, { taper: def.taper ?? 0, seed: id.length }), this.mat(id, { clip: true }));
    m.position.copy(def.c);
    m.rotation.z = def.rotZ ?? 0;
    Object.assign(m.userData, { base: m.scale.clone(), ...extra });
    return this.add(id, m);
  }

  build() {
    // chambers
    this.RA = this.chamber('rightAtrium', GEO.RA, { beat: 'atria' });
    this.LA = this.chamber('leftAtrium', GEO.LA, { beat: 'atria' });
    this.RV = this.chamber('rightVentricle', GEO.RV, { beat: 'ventricles' });
    this.LV = this.chamber('leftVentricle', GEO.LV, { beat: 'ventricles', lv: true });
    // auricles (ear-shaped flaps of the atria) and the right ventricle's outflow towards the pulmonary artery
    const lobe = (id, c, r, rz, beat) => {
      const m = new THREE.Mesh(blobGeometry(r, { lumps: 0.06, seed: c.x * 10 }), this.mat(id, { clip: true }));
      m.position.copy(c);
      m.rotation.z = rz;
      m.userData.beat = beat;
      m.userData.base = m.scale.clone();
      return this.add(id, m);
    };
    lobe('rightAtrium', V(-0.22, 0.34, 0.15), V(0.12, 0.07, 0.1), 0.5, 'atria');
    lobe('leftAtrium', V(0.33, 0.24, 0.05), V(0.1, 0.06, 0.08), -0.4, 'atria');
    lobe('rightVentricle', V(0.02, 0.08, 0.16), V(0.11, 0.15, 0.1), -0.25, 'ventricles');

    // septum (between the ventricles), with the "hole in the heart" marker
    const n = GEO.LV.c.clone().sub(GEO.RV.c).normalize();
    const sep = new THREE.Mesh(blobGeometry(V(0.035, 0.3, 0.18), { lumps: 0.01 }), this.mat('septum', { clip: true }));
    sep.position.set(0.0, -0.15, 0.03);
    sep.quaternion.setFromUnitVectors(V(1, 0, 0), n);
    sep.userData.beat = 'ventricles';
    sep.userData.base = sep.scale.clone();
    this.add('septum', sep);
    this.hole = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.012, 10, 24), new THREE.MeshBasicMaterial({ color: 0x1a0508 }));
    this.hole.position.copy(GEO.septumHole);
    this.hole.quaternion.setFromUnitVectors(V(0, 0, 1), n);
    this.hole.visible = false;
    this.model.add(this.hole);

    // great vessels
    const vessel = (id, pts, r) => this.add(id, new THREE.Mesh(tube(pts, r), this.mat(id, { vessel: true })));
    vessel('aorta', GEO.aorta, 0.078);
    for (const b of GEO.aortaBranches) vessel('aorta', b, 0.03);
    vessel('pulmonaryArtery', GEO.paTrunk, 0.068);
    vessel('pulmonaryArtery', GEO.paLeft, 0.05);
    vessel('pulmonaryArtery', GEO.paRight, 0.05);
    vessel('venaCava', GEO.svc, 0.062);
    vessel('venaCava', GEO.ivc, 0.066);
    for (const p of GEO.pulmVeins) vessel('pulmonaryVeins', p, 0.034);

    // valves
    this.valves = {};
    for (const [id, def] of Object.entries(GEO.valves)) this.valves[id] = this.buildValve(id, def);

    // coronary arteries and fat, laid on the surface
    this.model.updateMatrixWorld(true);
    const surf = this.surfaceProjector();
    const onSurface = (pts, lift = 0.012) => pts.map((p, i) => (i === 0 ? p : surf(p, lift)));
    this.ladPts = onSurface([V(-0.02, 0.22, 0.02), V(0.12, 0.15, 0.18), V(0.08, 0.0, 0.28), V(0.1, -0.2, 0.27), V(0.16, -0.4, 0.18), V(0.26, -0.56, 0.04)]);
    const rca = onSurface([V(-0.06, 0.22, 0.04), V(-0.2, 0.12, 0.2), V(-0.38, 0.02, 0.15), V(-0.46, -0.08, -0.05), V(-0.35, -0.2, -0.22)]);
    const cx = onSurface([V(0.12, 0.15, 0.18), V(0.3, 0.1, 0.1), V(0.42, 0.0, -0.1), V(0.35, -0.06, -0.28)]);
    cx[0] = this.ladPts[1];
    this.lad = new THREE.CatmullRomCurve3(this.ladPts, false, 'centripetal');
    const cor = this.mat('coronaryArteries', { clip: true, inner: false });
    for (const pts of [this.ladPts, rca, cx]) this.add('coronaryArteries', new THREE.Mesh(tube(pts, 0.017, 64), cor));
    // small side branches
    for (const [a, b] of [[0.3, V(0.3, -0.1, 0.2)], [0.55, V(0.32, -0.3, 0.15)], [0.45, V(-0.05, -0.28, 0.25)]]) {
      const p0 = this.lad.getPoint(a);
      this.add('coronaryArteries', new THREE.Mesh(tube([p0, surf(p0.clone().lerp(b, 0.5), 0.01), surf(b, 0.01)], 0.009, 24), cor));
    }
    const fatMat = this.mat('fat', { clip: true, inner: false });
    this.fat = new THREE.Group();
    this.model.add(this.fat);
    const rcaCurve = new THREE.CatmullRomCurve3(rca);
    for (let i = 0; i < 9; i++) {
      const t = 0.08 + (i / 9) * 0.85;
      const p = (i % 2 ? rcaCurve : this.lad).getPoint(i % 2 ? t : t * 0.6);
      const f = new THREE.Mesh(blobGeometry(V(0.07, 0.05, 0.022), { lumps: 0.12, seed: i }), fatMat);
      f.position.copy(surf(p, -0.012));
      f.lookAt(GEO.centre.clone().multiplyScalar(-1).add(f.position.clone().multiplyScalar(2)));
            this.fat.add(f);
    }

    // narrowing (plaque) and clot in the left anterior descending artery
    const at = this.lad.getPoint(0.38);
    const dir = this.lad.getTangent(0.38);
    this.plaque = new THREE.Mesh(new THREE.TorusGeometry(0.019, 0.01, 10, 20), new THREE.MeshStandardMaterial({ color: 0xf0d070, roughness: 0.8 }));
    this.plaque.position.copy(at);
    this.plaque.quaternion.setFromUnitVectors(V(0, 0, 1), dir);
    this.plaque.scale.set(1, 1, 2.2);
    this.clot = new THREE.Mesh(new THREE.SphereGeometry(0.024, 14, 10), new THREE.MeshStandardMaterial({ color: 0x3a0606, roughness: 0.7 }));
    this.clot.position.copy(at);
    this.plaque.visible = this.clot.visible = false;
    this.model.add(this.plaque, this.clot);

    // advanced: the conduction system and the valve strings
    this.adv = new THREE.Group();
    this.model.add(this.adv);
    const cond = this.mat('conduction', { inner: false });
    const node = (id, p, r) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), this.mat(id, { inner: false }));
      m.position.copy(p);
      this.add(id, m, this.adv);
      return m;
    };
    this.sa = node('saNode', surf(V(-0.3, 0.42, 0.12), -0.005), 0.03);
    this.av = node('avNode', V(-0.1, 0.07, -0.02), 0.026);
    this.mats.get('saNode').color.set(0xffe066);
    this.mats.get('avNode').color.set(0xffe066);
    this.add('bundleOfHis', new THREE.Mesh(tube([V(-0.1, 0.07, -0.02), V(-0.03, -0.05, 0.03), V(0.02, -0.3, 0.04), V(0.12, -0.46, 0.02)], 0.012, 32), this.mat('bundleOfHis', { inner: false })), this.adv);
    const pk = this.mat('purkinje', { inner: false });
    for (const pts of [
      [V(0.12, -0.46, 0.02), V(0.33, -0.3, -0.02), V(0.37, -0.05, -0.06)],
      [V(0.12, -0.46, 0.02), V(0.2, -0.38, -0.2), V(0.25, -0.1, -0.28)],
      [V(0.08, -0.42, 0.04), V(-0.18, -0.36, 0.06), V(-0.36, -0.12, 0.06)],
      [V(0.08, -0.42, 0.04), V(-0.1, -0.33, 0.2), V(-0.22, -0.05, 0.24)],
    ]) this.add('purkinje', new THREE.Mesh(tube(pts.map((p, i) => (i === 0 ? p : surf(p, -0.035))), 0.008, 24), pk), this.adv);
    // papillary muscles + chordae tendineae (lines to the AV valve flaps, updated as the flaps move)
    const pap = this.mat('chordae', { inner: false });
    this.papillary = [
      { p: V(-0.13, -0.27, 0.06), valve: 'tricuspid' },
      { p: V(0.06, -0.3, -0.04), valve: 'mitral' },
      { p: V(0.2, -0.27, -0.12), valve: 'mitral' },
    ];
    for (const pm of this.papillary) {
      const m = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.09, 12), pap);
      m.position.copy(pm.p);
      this.add('chordae', m, this.adv);
    }
    this.chordGeo = new THREE.BufferGeometry();
    this.chordGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(3 * 2 * 12), 3));
    this.chords = new THREE.LineSegments(this.chordGeo, new THREE.LineBasicMaterial({ color: 0xf5ead8 }));
    this.chords.frustumCulled = false;
    this.adv.add(this.chords);
    void cond;

    this.makeClipAwarePicking();
  }

  /** Put a point on the outside of the heart (along the line from its centre), `lift` above the surface. */
  surfaceProjector() {
    const ray = new THREE.Raycaster();
    const walls = ['rightAtrium', 'leftAtrium', 'rightVentricle', 'leftVentricle'].flatMap((id) => this.parts.get(id));
    const c = GEO.centre;
    return (p, lift = 0.01) => {
      const dir = p.clone().sub(c).normalize();
      ray.set(c.clone().addScaledVector(dir, 3), dir.clone().negate());
      const hit = ray.intersectObjects(walls, false)[0];
      return hit ? hit.point.clone().addScaledVector(dir, lift) : p.clone();
    };
  }

  buildValve(id, def) {
    const g = new THREE.Group();
    g.position.copy(def.c);
    g.quaternion.setFromUnitVectors(V(0, 1, 0), def.n.clone().normalize());
    const m = this.mat(id, { inner: false });
    const R = def.R;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(R, R * 0.12, 8, 32), m);
    ring.rotation.x = Math.PI / 2;
    g.add(ring);
    const leaves = [];
    const n = def.n3;
    const span = (Math.PI * 2) / n;
    const sag = def.kind === 'av' ? R * 0.35 : R * 0.25; // closed flaps bulge back (upstream)
    for (let i = 0; i < n; i++) {
      const mid = (i + 0.5) * span + 0.3;
      const H = V(R * Math.cos(mid), 0, R * Math.sin(mid));
      const leaf = new THREE.Group();
      leaf.rotation.order = 'YXZ';
      leaf.position.copy(H);
      leaf.rotation.y = Math.atan2(-Math.cos(mid), -Math.sin(mid)); // local +z points to the middle
      leaf.updateMatrix();
      const inv = leaf.matrix.clone().invert();
      const K = 10;
      const J = 6;
      const pos = [];
      for (let j = 0; j <= J; j++) {
        for (let k = 0; k <= K; k++) {
          const a = mid - span * 0.49 + (span * 0.98 * k) / K;
          const rim = V(R * Math.cos(a), 0, R * Math.sin(a));
          const s = j / J;
          const p = rim.lerp(V(0, 0, 0), s * 0.97);
          p.y = -sag * Math.sin(s * Math.PI * 0.5) * (def.kind === 'sl' ? 1 - Math.abs(k / K - 0.5) : 1);
          p.applyMatrix4(inv);
          pos.push(p.x, p.y, p.z);
        }
      }
      const idx = [];
      for (let j = 0; j < J; j++) {
        for (let k = 0; k < K; k++) {
          const a = j * (K + 1) + k;
          idx.push(a, a + 1, a + K + 1, a + 1, a + K + 2, a + K + 1);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, m);
      leaf.add(mesh);
      leaf.userData.tip = V(0, -sag, R * 0.92);
      g.add(leaf);
      leaves.push(leaf);
    }
    this.add(id, g);
    return { group: g, leaves, def, open: 0 };
  }

  /** Rays shouldn't hit the part of the wall that has been cut away. */
  makeClipAwarePicking() {
    const heart = this;
    for (const m of this.clipMats) m.userData.clipped = true;
    this.model.traverse((o) => {
      if (!o.isMesh || !o.material.userData?.clipped) return;
      o.raycast = function (raycaster, hits) {
        const mine = [];
        THREE.Mesh.prototype.raycast.call(this, raycaster, mine);
        for (const h of mine) if (!heart.cutOn || heart.clip.distanceToPoint(h.point) >= -1e-4) hits.push(h);
      };
    });
  }

  // ───────────── settings ─────────────

  setView(view) {
    this.view = view;
    const look = LOOKS[view];
    for (const [id, m] of this.mats) {
      const key = ['tricuspid', 'mitral', 'pulmonaryValve', 'aorticValve'].includes(id) ? 'valve'
        : ['saNode', 'avNode', 'bundleOfHis', 'purkinje'].includes(id) ? 'conduction' : id;
      const c = look[key] ?? 0xffffff;
      m.color.set(c);
      const muscle = ['rightAtrium', 'leftAtrium', 'rightVentricle', 'leftVentricle', 'septum'].includes(id);
      const map = view === 'real' && muscle ? muscleTexture() : null;
      if (m.map !== map) {
        m.map = map;
        m.bumpMap = map;
        m.bumpScale = 0.6;
        m.needsUpdate = true;
      }
      m.roughness = view === 'real' ? (key === 'valve' ? 0.4 : muscle ? 0.5 : 0.6) : 0.65;
      m.userData.inner.value.set(INNER[view] ?? new THREE.Color(c).multiplyScalar(0.55));
    }
    this.fat.visible = view === 'real';
  }

  setLevel(level) {
    this.level = level;
    this.adv.visible = level === 'advanced';
  }

  setCut(on) {
    if (on === this.cutOn) return;
    this.cutOn = on;
    for (const m of this.clipMats) {
      m.clippingPlanes = on ? [this.clip] : null;
      m.needsUpdate = true;
    }
    for (const m of this.vesselMats) {
      m.transparent = on;
      m.opacity = on ? 0.42 : 1;
      m.depthWrite = !on;
      m.needsUpdate = true;
    }
  }

  setCondition(id) {
    this.condition = id;
    this.plaque.visible = id === 'chd' || id === 'attack';
    this.clot.visible = id === 'attack';
    this.hole.visible = id === 'vsd';
  }

  /** Parts that glow (selected, or highlighted by a step or the teacher). */
  setHighlight(ids) {
    this.highlight = new Set(ids.filter(Boolean));
  }

  get targets() {
    const t = [];
    for (const [id, list] of this.parts) {
      if (PARTS[id]?.advanced && this.level !== 'advanced') continue;
      for (const o of list) o.traverse((m) => m.isMesh && t.push(m));
    }
    return t;
  }

  /** A good place for a part's name tag (heart coordinates), slightly outside the part. */
  anchor(id) {
    const fixed = {
      rightAtrium: V(-0.55, 0.22, 0.1), leftAtrium: V(0.34, 0.42, -0.1), rightVentricle: V(-0.36, -0.16, 0.25), leftVentricle: V(0.36, -0.5, 0.1),
      septum: V(0.03, -0.14, 0.14), tricuspid: V(-0.33, -0.01, 0.12), mitral: V(0.24, 0.04, -0.06), pulmonaryValve: V(0.16, 0.3, 0.2),
      aorticValve: V(-0.16, 0.27, 0.02), aorta: V(0.12, 0.86, -0.1), pulmonaryArtery: V(0.38, 0.62, 0.0), venaCava: V(-0.5, 0.74, 0.0),
      pulmonaryVeins: V(0.6, 0.12, -0.2), coronaryArteries: this.ladPts[2], saNode: V(-0.3, 0.5, 0.14), avNode: V(-0.12, 0.12, 0.02),
      bundleOfHis: V(0.06, -0.38, 0.1), purkinje: V(0.44, -0.18, 0.0), chordae: V(-0.18, -0.36, 0.14),
    };

    return (fixed[id] ?? V(0, 0, 0)).clone();
  }

  // ───────────── every frame ─────────────

  /**
   * f: where we are in the heartbeat (0–1, see T in data/heart.js).
   * Returns how open the valves are, for the blood flow: { av, sl, mitral }.
   */
  update(dt, f) {
    this.time += dt;
    const atria = pulse(f, T.atrialStart, T.atrialEnd, 0.05, 0.06);
    const vent = smooth(T.avClose - 0.02, T.slOpen + 0.06, f) * (1 - smooth(T.slClose - 0.04, T.avOpen + 0.02, f));
    const attack = this.condition === 'attack';
    this.model.traverse((o) => {
      const b = o.userData.beat;
      if (!b || !o.userData.base) return;
      const k = b === 'atria' ? atria * 0.09 : vent * (o.userData.lv && attack ? 0.05 : 0.1);
      o.scale.set(o.userData.base.x * (1 - k), o.userData.base.y * (1 - k * 1.25), o.userData.base.z * (1 - k));
    });

    // valves: AV (tricuspid, mitral) open while the ventricles fill; semilunar open while they empty
    const av = 1 - smooth(T.avClose - 0.025, T.avClose + 0.005, f) + smooth(T.avOpen - 0.01, T.avOpen + 0.04, f);
    const sl = smooth(T.slOpen - 0.01, T.slOpen + 0.03, f) * (1 - smooth(T.slClose - 0.03, T.slClose + 0.005, f));
    const leaky = this.condition === 'mitral';
    const open = { tricuspid: av, mitral: leaky ? Math.max(av, 0.32) : av, pulmonaryValve: sl, aorticValve: sl };
    for (const [id, v] of Object.entries(this.valves)) {
      v.open = Math.min(1, open[id]);
      const lim = v.def.kind === 'av' ? 1.35 : 1.25;
      for (const leaf of v.leaves) leaf.rotation.x = -v.open * lim;
    }

    // conduction: the impulse runs SA node → atria → AV node (delay) → bundle of His → Purkinje fibres
    if (this.adv.visible) {
      const glow = { saNode: pulse(f, 0.0, 0.08, 0.01, 0.05), avNode: pulse(f, 0.07, 0.15, 0.01, 0.04), bundleOfHis: pulse(f, 0.13, 0.18, 0.01, 0.03), purkinje: pulse(f, 0.15, 0.22, 0.01, 0.04) };
      for (const [id, g] of Object.entries(glow)) this.mats.get(id).emissive.setRGB(1 * g, 0.85 * g, 0.2 * g);
      this.updateChords();
    }

    // highlight: a gentle glow
    const hl = 0.35 + 0.25 * Math.sin(this.time * 4);
    for (const [id, m] of this.mats) {
      if (['saNode', 'avNode', 'bundleOfHis', 'purkinje'].includes(id) && this.adv.visible) continue;
      if (this.highlight.has(id)) m.emissive.setRGB(0.25 * hl, 0.75 * hl, 0.85 * hl);
      else m.emissive.setRGB(0, 0, 0);
    }
    this.mats.get('leftVentricle').userData.isch.value = attack ? 1 : 0;
    this.mats.get('septum').userData.isch.value = 0;

    // the cutting plane follows the heart as it turns
    this.model.updateMatrixWorld();
    const nrm = new THREE.Vector3(0, 0, -1).transformDirection(this.model.matrixWorld);
    const pt = new THREE.Vector3(0, 0, CUT_Z).applyMatrix4(this.model.matrixWorld);
    this.clip.setFromNormalAndCoplanarPoint(nrm, pt);
    return { av, sl, mitral: open.mitral, vent, atria };
  }

  updateChords() {
    const pos = this.chordGeo.attributes.position;
    let i = 0;
    const toModel = this.model.matrixWorld.clone().invert();
    const tip = new THREE.Vector3();
    for (const pm of this.papillary) {
      const v = this.valves[pm.valve];
      for (const leaf of v.leaves) {
        if (i >= 12) break;
        leaf.updateMatrixWorld();
        tip.copy(leaf.userData.tip).applyMatrix4(leaf.matrixWorld).applyMatrix4(toModel);
        pos.setXYZ(i * 2, pm.p.x, pm.p.y + 0.04, pm.p.z);
        pos.setXYZ(i * 2 + 1, tip.x, tip.y, tip.z);
        i++;
      }
    }
    for (; i < 12; i++) {
      pos.setXYZ(i * 2, 0, 0, 0);
      pos.setXYZ(i * 2 + 1, 0, 0, 0);
    }
    pos.needsUpdate = true;
  }
}

/** The ECG / sounds / blood all agree on these. */
export const valveState = (f) => ({
  av: f < T.avClose || f > T.avOpen,
  sl: f > T.slOpen && f < T.slClose,
});
