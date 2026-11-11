import * as THREE from 'three';
import { PARTS, T } from '../data/heart.js';

// The anatomical heart: a real human heart from BodyParts3D (see models/CREDITS.md), prepared by
// tools/heart-model/build.mjs into models/heart.glb (one node per part) and models/heart.json (landmarks
// measured from the anatomy: valve rings, chamber centres, vessel centre lines, the coronary artery…).
//
// It does everything the code-built heart (Heart.js) does, with the same interface:
//  • beating: the chambers squeeze towards their centres in the right order. Done in the vertex shader from
//    each vertex's position, so the pieces of the wall move together and never crack apart
//  • valves: the real tricuspid, mitral and pulmonary valves open and shut (shader); the aortic valve, which the
//    scan doesn't include, is drawn in code inside the aorta
//  • opened up: cut along the four-chamber plane, and turned to face you, like a textbook section
//  • looks, highlight, conditions (narrowed / blocked coronary artery, dying muscle, leaky valve, hole in the septum)

const V = (a) => new THREE.Vector3(...a);
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const pulse = (x, a, b, rise = 0.03, fall = 0.05) => smooth(a, a + rise, x) * (1 - smooth(b - fall, b, x));

const LOOKS = {
  real: {
    rightAtrium: 0x8c3038, leftAtrium: 0x8c3038, rightVentricle: 0x9c3434, leftVentricle: 0x9c3434, septum: 0x973032,
    valve: 0xf0e2c8, aorta: 0xd9a291, pulmonaryArtery: 0xcf9c92, venaCava: 0x6a4c8e, pulmonaryVeins: 0xa45064,
    coronaryArteries: 0xd0322c, cardiacVeins: 0x5c3c86, conduction: 0xffe066, chordae: 0x9a3638,
  },
  text: {
    rightAtrium: 0x3f74e6, leftAtrium: 0xe0413f, rightVentricle: 0x3466d8, leftVentricle: 0xd6363a, septum: 0xd98aa0,
    valve: 0xffffff, aorta: 0xff4d4d, pulmonaryArtery: 0x4d7dff, venaCava: 0x2f5fd0, pulmonaryVeins: 0xff6a5a,
    coronaryArteries: 0xff2a2a, cardiacVeins: 0x3a4fd8, conduction: 0xffe066, chordae: 0xe8a0b0,
  },
};
const VALVES = ['tricuspid', 'mitral', 'pulmonaryValve', 'aorticValve'];
const NODES = ['saNode', 'avNode', 'bundleOfHis', 'purkinje'];
const NO_CLIP = new Set(['tricuspid', 'mitral', 'chordae', 'saNode', 'avNode', 'bundleOfHis', 'purkinje']); // stay whole inside

/** Load the model and its landmarks (null if it can't be loaded: the lesson then uses the code-built heart). */
export async function loadHeartModel(base) {
  const [{ GLTFLoader }, { MeshoptDecoder }] = await Promise.all([
    import('three/addons/loaders/GLTFLoader.js'),
    import('three/addons/libs/meshopt_decoder.module.js'),
  ]);
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const [gltf, L] = await Promise.all([
    loader.loadAsync(new URL('heart.glb', base).toString()),
    fetch(new URL('heart.json', base)).then((r) => { if (!r.ok) throw new Error(`heart.json: ${r.status}`); return r.json(); }),
  ]);
  // compressed meshes store small integers plus a scale/offset on their node: bake that into plain geometry
  const geos = {};
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    const src = o.geometry;
    const g = new THREE.BufferGeometry();
    for (const name of ['position', 'normal']) {
      const a = src.getAttribute(name);
      if (!a) continue;
      const arr = new Float32Array(a.count * 3);
      for (let i = 0; i < a.count; i++) arr.set([a.getX(i), a.getY(i), a.getZ(i)], i * 3);
      g.setAttribute(name, new THREE.BufferAttribute(arr, 3));
    }
    g.setIndex(src.index);
    g.applyMatrix4(o.matrixWorld);
    if (!g.getAttribute('normal')) g.computeVertexNormals();
    geos[o.name || o.parent.name] = g;
  });
  return { geos, L };
}

const tube = (pts, r, seg = 40) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'centripetal'), seg, r, 12, false);

export class RealHeart {
  constructor(model, { handler = null, big = false } = {}) {
    this.big = big;
    this.real = true;
    const L = model.L;
    this.L = L;
    this.group = new THREE.Group(); // placed and scaled by the lesson
    this.model = new THREE.Group(); // turned by the user
    this.orient = new THREE.Group(); // turns to face you when opened up
    this.space = new THREE.Group(); // the heart's own coordinates (centred)
    this.group.add(this.model);
    this.model.add(this.orient);
    this.orient.add(this.space);
    this.parts = new Map();
    this.mats = new Map();
    this.handler = handler;
    this.view = 'real';
    this.level = 'core';
    this.cutOn = false;
    this.condition = 'healthy';
    this.highlight = new Set();
    this.time = 0;
    this.clip = new THREE.Plane();
    this.clipMats = [];
    this.openAmount = 0;

    // shared uniforms for the beat and the valves
    const base = V(L.base).normalize();
    const rl = V(L.rl).normalize();
    this.U = {
      uBase: { value: base }, uRL: { value: rl }, uMid: { value: V(L.triRing).add(V(L.mitRing)).multiplyScalar(0.5) },
      uRAc: { value: V(L.rightAtriumCentre) }, uLAc: { value: V(L.leftAtriumCentre) }, uRVc: { value: V(L.rightVentricleCentre) }, uLVc: { value: V(L.leftVentricleCentre) },
      uAtr: { value: 0 }, uVen: { value: 0 }, uWeak: { value: 0 },
    };
    // the coronary artery beyond the narrowing, for the dying muscle in a heart attack
    this.ladPts = L.lad.map(V);
    this.lad = new THREE.CatmullRomCurve3(this.ladPts, false, 'centripetal');
    const distal = [];
    for (let i = 0; i < 6; i++) distal.push(this.lad.getPoint(0.42 + (i / 5) * 0.55));
    this.U.uLad = { value: distal };
    this.U.uIsch = { value: 0 };

    this.build(model.geos);
    // centre the heart, so it turns about its middle
    const box = new THREE.Box3();
    for (const list of this.parts.values()) for (const o of list) box.expandByObject(o);
    this.centre = box.getCenter(new THREE.Vector3());
    this.space.position.copy(this.centre).negate();
    this.size = box.getSize(new THREE.Vector3());
    // the "opened" orientation: the four-chamber plane facing you, base up
    const o = L.open;
    const basis = new THREE.Matrix4().makeBasis(V(o.x), V(o.y), V(o.z)); // screen → heart
    this.openQuat = new THREE.Quaternion().setFromRotationMatrix(basis).invert();
    this.cutNormal = V(L.cutNormal).normalize();
    this.cutPoint = V(L.cutPoint);
    this.setView('real');
    this.setLevel('core');
  }

  // ───────────── building ─────────────

  mat(id) {
    if (this.mats.has(id)) return this.mats.get(id);
    const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0, side: THREE.DoubleSide });
    m.userData.inner = { value: new THREE.Color(0x5e1520) };
    m.userData.fibre = { value: 0 }; // muscle fibres (realistic look, heart muscle only)
    m.userData.valve = null; // { ring, axis, open, R, kind }
    const self = this;
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, self.U, { uInner: m.userData.inner, uFibre: m.userData.fibre });
      const v = m.userData.valve;
      if (v) Object.assign(sh.uniforms, { uRing: { value: v.ring }, uAxis: { value: v.axis }, uOpen: v.open, uR: { value: v.R } });
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>
          uniform vec3 uBase, uRL, uMid, uRAc, uLAc, uRVc, uLVc;
          uniform float uAtr, uVen, uWeak;
          ${v ? 'uniform vec3 uRing, uAxis; uniform float uOpen, uR;' : ''}
          varying vec3 vObj;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vec3 p = transformed;
          ${v && v.kind === 'av' ? `
          { // AV valve: the flaps swing in to meet in the middle (shut) or hang open into the ventricle
            vec3 d = p - uRing; float ax = dot(d, uAxis); vec3 rad = d - uAxis * ax;
            float w = smoothstep(-0.01, 0.04, ax) * (1.0 - smoothstep(0.2, 0.3, ax));
            float shut = (1.0 - uOpen) * w;
            rad *= 1.0 - 0.8 * shut * smoothstep(0.0, 0.14, ax);
            ax *= 1.0 - 0.55 * shut;
            p = uRing + uAxis * ax + rad;
          }` : ''}
          ${v && v.kind === 'sl' ? `
          { // semilunar valve: the cusps are pushed out against the artery wall when open
            vec3 d = p - uRing; float ax = dot(d, uAxis); vec3 rad = d - uAxis * ax;
            float r = length(rad);
            if (r > 1e-4) rad *= 1.0 + uOpen * 0.85 * max(0.0, uR - r) / r;
            ax += uOpen * 0.03;
            p = uRing + uAxis * ax + rad;
          }` : ''}
          { // the beat: atria then ventricles squeeze towards their middles
            float h = dot(p - uMid, uBase);
            float side = smoothstep(-0.06, 0.06, dot(p - uMid, uRL));
            float wA = smoothstep(-0.03, 0.12, h);
            float wV = 1.0 - smoothstep(-0.12, 0.03, h);
            vec3 cA = mix(uRAc, uLAc, side);
            vec3 cV = mix(uRVc, uLVc, side);
            float fA = 1.0 - smoothstep(0.35, 0.6, distance(p, cA));
            float fV = 1.0 - smoothstep(0.6, 0.95, distance(p, cV));
            p += (cA - p) * wA * fA * uAtr * 0.08;
            p += (cV - p) * wV * fV * uVen * 0.09 * (1.0 - uWeak * side * 0.6);
          }
          vObj = p;
          transformed = p;`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
          uniform vec3 uInner; uniform float uIsch, uFibre; uniform vec3 uLad[6];
          varying vec3 vObj;`)
        .replace('#include <map_fragment>', `#include <map_fragment>
          if (!gl_FrontFacing) diffuseColor.rgb = uInner; // inside the muscle, where it is cut
          if (uFibre > 0.0) { // fine muscle fibres and mottling (no texture needed)
            float fib = sin(vObj.x * 70.0 + sin(vObj.y * 23.0) * 3.0 + vObj.z * 31.0) * sin(vObj.y * 61.0 - vObj.z * 17.0 + sin(vObj.x * 19.0) * 2.0);
            float mot = sin(vObj.x * 9.0 + 1.3) * sin(vObj.y * 7.0 + 0.7) * sin(vObj.z * 8.0 + 2.1);
            diffuseColor.rgb *= 1.0 + uFibre * (0.07 * fib + 0.1 * mot);
          }
          if (uIsch > 0.0) {
            float d = 10.0;
            for (int i = 0; i < 6; i++) d = min(d, distance(vObj, uLad[i]));
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.2, 0.13, 0.22), (1.0 - smoothstep(0.07, 0.18, d)) * uIsch * 0.9);
          }`);
    };
    m.customProgramCacheKey = () => `realheart-${m.userData.valve?.kind ?? 'none'}`;
    this.mats.set(id, m);
    if (!NO_CLIP.has(id)) this.clipMats.push(m);
    return m;
  }

  add(id, mesh, parent = this.space) {
    parent.add(mesh);
    if (!this.parts.has(id)) this.parts.set(id, []);
    this.parts.get(id).push(mesh);
    mesh.traverse((o) => {
      if (o.isMesh) Object.assign(o.userData, { part: id, heart: this, handler: this.handler });
    });
    return mesh;
  }

  build(geos) {
    const L = this.L;
    const flowIn = V(L.base).negate().normalize(); // atria → ventricles
    this.valves = {};
    for (const [id, g] of Object.entries(geos)) {
      const m = this.mat(id);
      if (id === 'tricuspid' || id === 'mitral') {
        const ring = V(id === 'tricuspid' ? L.triRing : L.mitRing);
        m.userData.valve = { ring, axis: flowIn, open: { value: 1 }, R: id === 'tricuspid' ? 0.18 : 0.15, kind: 'av' };
        this.valves[id] = { open: 1, uniform: m.userData.valve.open, def: { kind: 'av' } };
      } else if (id === 'pulmonaryValve') {
        const axis = V(L.paTrunk[1] ?? L.paTrunk[0]).sub(V(L.pv)).normalize();
        m.userData.valve = { ring: V(L.pv), axis, open: { value: 0 }, R: 0.12, kind: 'sl' };
        this.valves[id] = { open: 0, uniform: m.userData.valve.open, def: { kind: 'sl' } };
      }
      this.add(id, new THREE.Mesh(g, m));
    }

    // the aortic valve (not in the scan): three cusps in the root of the aorta
    const root = V(L.aorticRoot);
    const aAxis = V(L.aorta[1]).sub(root).normalize();
    this.valves.aorticValve = this.buildCusps('aorticValve', root.clone().addScaledVector(aAxis, 0.03), aAxis, 0.1);

    // plaque and clot in the left anterior descending artery
    const at = this.lad.getPoint(0.35);
    const dir = this.lad.getTangent(0.35);
    this.plaque = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.011, 10, 20), new THREE.MeshStandardMaterial({ color: 0xf0d070, roughness: 0.8 }));
    this.plaque.position.copy(at);
    this.plaque.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
    this.plaque.scale.set(1, 1, 2.2);
    this.clot = new THREE.Mesh(new THREE.SphereGeometry(0.026, 14, 10), new THREE.MeshStandardMaterial({ color: 0x3a0606, roughness: 0.7 }));
    this.clot.position.copy(at);
    this.plaque.visible = this.clot.visible = false;
    this.space.add(this.plaque, this.clot);

    // hole in the septum
    const sepC = V(L.septumCentre);
    this.hole = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.014, 10, 24), new THREE.MeshBasicMaterial({ color: 0x1a0508 }));
    this.hole.position.copy(sepC);
    this.hole.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), V(L.rl).normalize());
    this.hole.visible = false;
    this.space.add(this.hole);

    // advanced: the conduction system, laid out on the real anatomy
    this.adv = new THREE.Group();
    this.space.add(this.adv);
    const apex = V(L.apex);
    const rl = V(L.rl).normalize();
    const RVc = V(L.rightVentricleCentre);
    const LVc = V(L.leftVentricleCentre);
    const node = (id, p, r) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), this.mat(id));
      m.position.copy(p);
      this.add(id, m, this.adv);
      return m;
    };
    const saPos = V(L.svc[1]).lerp(V(L.rightAtriumCentre), 0.25);
    const avPos = V(L.triRing).lerp(sepC, 0.35).addScaledVector(V(L.base), 0.03);
    this.sa = node('saNode', saPos, 0.035);
    this.av = node('avNode', avPos, 0.03);
    const hisEnd = sepC.clone().lerp(apex, 0.75);
    this.add('bundleOfHis', new THREE.Mesh(tube([avPos, avPos.clone().lerp(sepC, 0.5), sepC, hisEnd], 0.013), this.mat('bundleOfHis')), this.adv);
    const pk = this.mat('purkinje');
    for (const [c, s] of [[LVc, 1], [RVc, -1]]) {
      for (const k of [-1, 1]) {
        const side = rl.clone().multiplyScalar(s * 0.12);
        const across = new THREE.Vector3().crossVectors(rl, V(L.base)).normalize().multiplyScalar(k * 0.1);
        const pts = [hisEnd, hisEnd.clone().lerp(c, 0.4).add(side).add(across), c.clone().add(side.clone().multiplyScalar(1.6)).add(across)];
        this.add('purkinje', new THREE.Mesh(tube(pts, 0.009, 24), pk), this.adv);
      }
    }
    this.makeClipAwarePicking();
  }

  /** A semilunar valve drawn in code: three pocket-shaped cusps that open against the wall. */
  buildCusps(id, centre, axis, R) {
    const g = new THREE.Group();
    g.position.copy(centre);
    g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis);
    const m = this.mat(id);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(R, R * 0.1, 8, 32), m);
    ring.rotation.x = Math.PI / 2;
    g.add(ring);
    const leaves = [];
    for (let i = 0; i < 3; i++) {
      const mid = (i + 0.5) * ((Math.PI * 2) / 3);
      const leaf = new THREE.Group();
      leaf.rotation.order = 'YXZ';
      leaf.position.set(R * Math.cos(mid), 0, R * Math.sin(mid));
      leaf.rotation.y = Math.atan2(-Math.cos(mid), -Math.sin(mid));
      const shape = new THREE.Mesh(new THREE.CircleGeometry(R * 0.98, 16, -Math.PI / 3, (Math.PI * 2) / 3), m);
      shape.rotation.x = -Math.PI / 2;
      shape.rotation.z = Math.PI / 2;
      shape.position.z = 0;
      leaf.add(shape);
      g.add(leaf);
      leaves.push(leaf);
    }
    this.add(id, g);
    return { group: g, leaves, open: 0, def: { kind: 'sl' } };
  }

  makeClipAwarePicking() {
    const heart = this;
    const clipped = new Set(this.clipMats);
    this.space.traverse((o) => {
      if (!o.isMesh || !clipped.has(o.material)) return;
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
      const key = VALVES.includes(id) ? 'valve' : NODES.includes(id) ? 'conduction' : id;
      const c = look[key] ?? 0xffffff;
      m.color.set(c);
      m.roughness = view === 'real' ? (key === 'valve' ? 0.4 : 0.48) : 0.62;
      // where the muscle is cut: a darker shade of the part
      m.userData.inner.value.set(view === 'real' ? 0x6e1e26 : new THREE.Color(c).multiplyScalar(0.55));
      m.userData.fibre.value = view === 'real' && ['rightAtrium', 'leftAtrium', 'rightVentricle', 'leftVentricle', 'septum', 'chordae'].includes(id) ? 1 : 0;
    }
  }

  setLevel(level) {
    this.level = level;
    this.adv.visible = level === 'advanced';
    for (const o of this.parts.get('chordae') ?? []) o.visible = level === 'advanced';
  }

  setCut(on) {
    if (on === this.cutOn) return;
    this.cutOn = on;
    for (const m of this.clipMats) {
      m.clippingPlanes = on ? [this.clip] : null;
      m.needsUpdate = true;
    }
  }

  setCondition(id) {
    this.condition = id;
    this.plaque.visible = id === 'chd' || id === 'attack';
    this.clot.visible = id === 'attack';
    this.hole.visible = id === 'vsd';
  }

  setHighlight(ids) {
    this.highlight = new Set(ids.filter(Boolean));
  }

  get targets() {
    const t = [];
    for (const [id, list] of this.parts) {
      if (PARTS[id]?.advanced && this.level !== 'advanced') continue;
      if (!PARTS[id]) continue; // e.g. the cardiac veins: shown, but not a lesson part
      for (const o of list) o.traverse((m) => m.isMesh && m.visible !== false && t.push(m));
    }
    return t;
  }

  anchor(id) {
    const L = this.L;
    const valves = { tricuspid: L.triRing, mitral: L.mitRing, pulmonaryValve: L.pv, aorticValve: L.aorticRoot };
    if (valves[id]) return V(valves[id]);
    const a = L.anchors[id];
    if (a) return V(a);
    const extra = { saNode: this.sa.position.toArray(), avNode: this.av.position.toArray(), bundleOfHis: L.septumCentre, purkinje: L.apex };
    return V(extra[id] ?? [0, 0, 0]);
  }

  /**
   * Opened up: where to point a part's name tag. Parts left whole inside (valves, conduction system) keep their
   * usual place; others point at where the cut passes through them (null: nothing of it is left).
   */
  anchorCut(id) {
    if (NO_CLIP.has(id) || !this.parts.has(id)) return this.anchor(id);
    const a = this.anchor(id);
    const n = this.cutNormal;
    if (a.clone().sub(this.cutPoint).dot(n) < 0) return a; // already on the side that stays
    this.sectionCache ??= {};
    if (!(id in this.sectionCache)) {
      // the middle of the part's cross-section (its vertices close to the cutting plane)
      const sum = new THREE.Vector3();
      let k = 0;
      const p = new THREE.Vector3();
      for (const o of this.parts.get(id)) {
        o.traverse((m) => {
          if (!m.isMesh) return;
          const pos = m.geometry.attributes.position;
          for (let i = 0; i < pos.count; i += 3) {
            p.fromBufferAttribute(pos, i);
            const d = p.clone().sub(this.cutPoint).dot(n);
            if (d < 0 && d > -0.04) { sum.add(p); k++; }
          }
        });
      }
      this.sectionCache[id] = k > 10 ? sum.divideScalar(k).addScaledVector(n, -0.02) : null;
    }
    return this.sectionCache[id]?.clone() ?? null;
  }

  /** Points the blood flows through (see Blood.js). */
  get geo() {
    const L = this.L;
    const n = V(L.cutNormal).normalize();
    const cp = V(L.cutPoint);
    const behind = (p, d = 0.07) => p.clone().addScaledVector(n, -(p.clone().sub(cp).dot(n) + d)); // onto the kept side of the cut
    const lerp = (a, b, t) => behind(V(a).lerp(V(b), t));
    const LAc = behind(V(L.leftAtriumCentre));
    return {
      RAc: behind(V(L.rightAtriumCentre)), LAc, RVc: behind(V(L.rightVentricleCentre)), LVc: behind(V(L.leftVentricleCentre)),
      RVlow: lerp(L.rightVentricleCentre, L.apex, 0.35), LVlow: lerp(L.leftVentricleCentre, L.apex, 0.55),
      RVout: lerp(L.rightVentricleCentre, L.pv, 0.6), LVout: lerp(L.leftVentricleCentre, L.aorticRoot, 0.6),
      tricuspid: behind(V(L.triRing).addScaledVector(V(L.base), -0.04), 0.03), mitral: behind(V(L.mitRing).addScaledVector(V(L.base), -0.04), 0.03),
      pulmonaryValve: V(L.pv), aorticValve: V(L.aorticRoot),
      inlets: [[V(L.svc[0]), V(L.svc[1])], [V(L.ivc[0]), V(L.ivc[1])]],
      paTrunk: L.paTrunk.slice(1).map(V),
      paOut: L.paEnds.map((e) => [V(e)]),
      aortaOut: [L.aorta.slice(1).map(V)],
      veins: L.veinEnds.map((e) => [V(e), V(e).lerp(LAc, 0.45)]),
      septumHole: behind(V(L.septumCentre), 0.02),
      scale: 1.25,
    };
  }

  // ───────────── every frame ─────────────

  update(dt, f) {
    this.time += dt;
    const atria = pulse(f, T.atrialStart, T.atrialEnd, 0.05, 0.06);
    const vent = smooth(T.avClose - 0.02, T.slOpen + 0.06, f) * (1 - smooth(T.slClose - 0.04, T.avOpen + 0.02, f));
    this.U.uAtr.value = atria;
    this.U.uVen.value = vent;
    const attack = this.condition === 'attack';
    this.U.uWeak.value = attack ? 1 : 0;
    this.U.uIsch.value = attack ? 1 : 0;

    const av = 1 - smooth(T.avClose - 0.025, T.avClose + 0.005, f) + smooth(T.avOpen - 0.01, T.avOpen + 0.04, f);
    const sl = smooth(T.slOpen - 0.01, T.slOpen + 0.03, f) * (1 - smooth(T.slClose - 0.03, T.slClose + 0.005, f));
    const leaky = this.condition === 'mitral';
    const open = { tricuspid: av, mitral: leaky ? Math.max(av, 0.35) : av, pulmonaryValve: sl, aorticValve: sl };
    for (const [id, v] of Object.entries(this.valves)) {
      v.open = Math.min(1, open[id]);
      if (v.uniform) v.uniform.value = v.open;
      if (v.leaves) for (const leaf of v.leaves) leaf.rotation.x = -v.open * 1.25;
    }

    if (this.adv.visible) {
      const glow = { saNode: pulse(f, 0.0, 0.08, 0.01, 0.05), avNode: pulse(f, 0.07, 0.15, 0.01, 0.04), bundleOfHis: pulse(f, 0.13, 0.18, 0.01, 0.03), purkinje: pulse(f, 0.15, 0.22, 0.01, 0.04) };
      for (const [id, g] of Object.entries(glow)) this.mats.get(id).emissive.setRGB(g, 0.85 * g, 0.2 * g);
    }
    const hl = 0.35 + 0.25 * Math.sin(this.time * 4);
    for (const [id, m] of this.mats) {
      if (NODES.includes(id) && this.adv.visible) continue;
      if (this.highlight.has(id)) m.emissive.setRGB(0.25 * hl, 0.75 * hl, 0.85 * hl);
      else m.emissive.setRGB(0, 0, 0);
    }

    // opened up: turn to face the four-chamber plane towards you (and back when closed)
    const target = this.cutOn ? 1 : 0;
    this.openAmount += (target - this.openAmount) * Math.min(1, dt * 3);
    this.orient.quaternion.identity().slerp(this.openQuat, smooth(0, 1, this.openAmount));

    // the cutting plane (four-chamber plane), in world space
    this.space.updateMatrixWorld();
    const nrm = this.cutNormal.clone().negate().transformDirection(this.space.matrixWorld);
    const pt = this.cutPoint.clone().applyMatrix4(this.space.matrixWorld);
    this.clip.setFromNormalAndCoplanarPoint(nrm, pt);
    return { av, sl, mitral: open.mitral, vent, atria };
  }
}
