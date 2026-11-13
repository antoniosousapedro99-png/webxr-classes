// BodyParts3D skeleton + organ parts (STL, mm) → one GLB for the Identifying Organs lesson.
// Body coordinates, in metres: x = the patient's left, y = up (0 at the soles of the feet), z = forward.
// Every part keeps its real place in the body, so an organ's home is simply where its mesh already sits.
// Nodes: bones, ribcage (ribs, costal cartilages, sternum), skullcap (the top of the skull, cut off like an
// anatomy model so the brain can go in), and one node per organ.
// usage: node build.mjs <stlDir> ../../lessons/organs-lab/models/body.glb   (see README.md)
import path from 'node:path';
import fs from 'node:fs';
import { Document, NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { meshopt, prune } from '@gltf-transform/functions';
import { MeshoptSimplifier, MeshoptEncoder } from 'meshoptimizer';
import { readSTL, components, bbox } from './stl.mjs';
import { SKELETON, BRAIN } from './parts.mjs';

const [, , dir, out] = process.argv;
await MeshoptSimplifier.ready;
await MeshoptEncoder.ready;

// organ → STL files and how many triangles to keep (Quest: about 75,000 for all the organs)
const ORGANS = {
  brain: { files: BRAIN.map(([id]) => id), tris: 14000, minPiece: 30 },
  heart: { files: ['FMA7274', 'FMA3736', 'FMA66326', 'FMA4720', 'FMA10951', 'FMA66643'], tris: 7000, minPiece: 200, trimTo: 'FMA7274' },
  lungRight: { files: ['FMA7333', 'FMA7383', 'FMA7337'], tris: 5000 },
  lungLeft: { files: ['FMA7370', 'FMA7371'], tris: 5000 },
  liver: { files: ['FMA7197'], tris: 5000 },
  stomach: { files: ['FMA7148'], tris: 3000 },
  smallIntestine: { files: ['FMA7206', 'FMA7207', 'FMA7208'], tris: 9000 },
  largeIntestine: { files: ['FMA14543nsn', 'FMA14544', 'FMA14542'], tris: 6000 },
  kidneyRight: { files: ['FMA7204'], tris: 2000 },
  kidneyLeft: { files: ['FMA7205'], tris: 2000 },
  bladder: { files: ['FMA15900'], tris: 1500 },
  pancreas: { files: ['FMA7198nsn'], tris: 2000 },
  spleen: { files: ['FMA7196'], tris: 1500 },
  gallbladder: { files: ['FMA7202'], tris: 1000 },
  oesophagus: { files: ['FMA7131'], tris: 1500 },
  trachea: { files: ['FMA7394'], tris: 2500 },
  diaphragm: { files: ['FMA13295'], tris: 4000 },
};
const RIBCAGE = /\brib\b|costal cartilage|sternum|manubrium|xiphoid/;
const CRANIUM = /parietal bone|frontal bone|occipital bone|temporal bone|sphenoid/;
const SKELETON_TRIS = 70000;

// origin: the middle of the skeleton, soles of the feet at y = 0
const rawSkel = SKELETON.map(([id, name]) => ({ id, name, m: readSTL(path.join(dir, `${id}.stl`)) }));
const all = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
for (const { m } of rawSkel) {
  const b = bbox(m.pos);
  for (let k = 0; k < 3; k++) { all.min[k] = Math.min(all.min[k], b.min[k]); all.max[k] = Math.max(all.max[k], b.max[k]); }
}
const C = [(all.min[0] + all.max[0]) / 2, (all.min[1] + all.max[1]) / 2, all.min[2]];
const S = 0.001;
// scan axes: x toward the patient's left, y toward the back, z up → body: x left, y up, z forward
const toBody = (p) => {
  const q = new Float32Array(p.length);
  for (let i = 0; i < p.length; i += 3) {
    q[i] = (p[i] - C[0]) * S;
    q[i + 1] = (p[i + 2] - C[2]) * S;
    q[i + 2] = -(p[i + 1] - C[1]) * S;
  }
  return q;
};
console.log('skeleton height', ((all.max[2] - all.min[2]) * S).toFixed(3), 'm');

function compact(m) {
  const remap = new Int32Array(m.pos.length / 3).fill(-1);
  const pos = [];
  const idx = new Uint32Array(m.idx.length);
  m.idx.forEach((v, i) => {
    if (remap[v] < 0) {
      remap[v] = pos.length / 3;
      pos.push(m.pos[v * 3], m.pos[v * 3 + 1], m.pos[v * 3 + 2]);
    }
    idx[i] = remap[v];
  });
  return { pos: new Float32Array(pos), idx };
}

function dropSpecks(m, minPiece) {
  if (!minPiece) return m;
  const c = components(m);
  const size = new Map();
  for (const x of c.comp) size.set(x, (size.get(x) ?? 0) + 1);
  return compact({ pos: m.pos, idx: m.idx.filter((_, i) => size.get(c.comp[Math.floor(i / 3)]) >= minPiece) });
}

function simplify(m, tris) {
  const target = Math.min(m.idx.length, Math.max(36, Math.round(tris)) * 3);
  if (target >= m.idx.length) return m;
  const r = MeshoptSimplifier.simplify(m.idx, m.pos, 3, target, 0.05, ['LockBorder']);
  return compact({ pos: m.pos, idx: r[0] ?? r });
}

function merge(list) {
  const pos = [];
  const idx = [];
  for (const m of list) {
    const base = pos.length / 3;
    for (const v of m.pos) pos.push(v);
    for (const i of m.idx) idx.push(i + base);
  }
  return { pos: new Float32Array(pos), idx: new Uint32Array(idx) };
}

/** Keep only triangles with every corner inside the box. */
function trim(m, box) {
  const inside = (v) => [0, 1, 2].every((k) => m.pos[v * 3 + k] >= box.min[k] && m.pos[v * 3 + k] <= box.max[k]);
  return compact({ pos: m.pos, idx: m.idx.filter((_, i, a) => { const t = i - (i % 3); return inside(a[t]) && inside(a[t + 1]) && inside(a[t + 2]); }) });
}

// ── organs ──
const parts = {};
for (const [id, def] of Object.entries(ORGANS)) {
  let meshes = def.files.map((f) => {
    const m = readSTL(path.join(dir, `${f}.stl`));
    return { f, m: dropSpecks({ pos: toBody(m.pos), idx: m.idx }, def.minPiece) };
  });
  if (def.trimTo) {
    // the great vessels: only their first few centimetres out of the heart
    const b = bbox(meshes.find((x) => x.f === def.trimTo).m.pos);
    const box = { min: [b.min[0] - 0.005, b.min[1] - 0.005, b.min[2] - 0.005], max: [b.max[0] + 0.005, b.max[1] + 0.035, b.max[2] + 0.005] };
    meshes = meshes.map((x) => (x.f === def.trimTo ? x : { f: x.f, m: dropSpecks(trim(x.m, box), 60) }));
  }
  const total = meshes.reduce((a, x) => a + x.m.idx.length / 3, 0);
  parts[id] = merge(meshes.map((x) => simplify(x.m, (def.tris * x.m.idx.length) / 3 / total)));
}

/** Cut a mesh with the horizontal plane y = Y: triangles crossing it are split, so both edges are clean. */
function splitAt(m, Y) {
  const pos = Array.from(m.pos);
  const up = [];
  const down = [];
  const edge = new Map();
  const cross = (a, b) => {
    const k = a < b ? `${a},${b}` : `${b},${a}`;
    if (edge.has(k)) return edge.get(k);
    const ya = pos[a * 3 + 1];
    const yb = pos[b * 3 + 1];
    const t = (Y - ya) / (yb - ya);
    const i = pos.length / 3;
    for (let c = 0; c < 3; c++) pos.push(pos[a * 3 + c] + t * (pos[b * 3 + c] - pos[a * 3 + c]));
    edge.set(k, i);
    return i;
  };
  for (let t = 0; t < m.idx.length; t += 3) {
    const tri = [m.idx[t], m.idx[t + 1], m.idx[t + 2]];
    const side = tri.map((v) => pos[v * 3 + 1] > Y);
    if (side.every((x) => x)) { up.push(...tri); continue; }
    if (side.every((x) => !x)) { down.push(...tri); continue; }
    // walk round the triangle, building the polygon on each side (keeps the winding)
    const polys = { true: [], false: [] };
    for (let e = 0; e < 3; e++) {
      const a = tri[e];
      const b = tri[(e + 1) % 3];
      polys[side[e]].push(a);
      if (side[e] !== side[(e + 1) % 3]) {
        const x = cross(a, b);
        polys.true.push(x);
        polys.false.push(x);
      }
    }
    for (const [k, out] of [[true, up], [false, down]]) {
      const p = polys[k];
      for (let i = 1; i + 1 < p.length; i++) out.push(p[0], p[i], p[i + 1]);
    }
  }
  const P = new Float32Array(pos);
  return { above: compact({ pos: P, idx: new Uint32Array(up) }), below: compact({ pos: P, idx: new Uint32Array(down) }) };
}

// ── skeleton ──
const brainBox = bbox(parts.brain.pos);
const CUT_Y = brainBox.min[1] + 0.62 * (brainBox.max[1] - brainBox.min[1]); // skullcap: everything above this
const skelTotal = rawSkel.reduce((a, x) => a + x.m.idx.length / 3, 0);
const groups = { bones: [], ribcage: [], skullcap: [] };
for (const { name, m } of rawSkel) {
  const body = simplify(dropSpecks({ pos: toBody(m.pos), idx: m.idx }, 40), Math.max(60, (SKELETON_TRIS * m.idx.length) / 3 / skelTotal));
  if (RIBCAGE.test(name)) groups.ribcage.push(body);
  else if (CRANIUM.test(name)) {
    const { above, below } = splitAt(body, CUT_Y);
    groups.skullcap.push(above);
    groups.bones.push(below);
  } else groups.bones.push(body);
}
for (const [k, list] of Object.entries(groups)) parts[k] = merge(list);

function normals(m) {
  const n = new Float32Array(m.pos.length);
  const p = m.pos;
  for (let t = 0; t < m.idx.length; t += 3) {
    const [a, b, c] = [m.idx[t], m.idx[t + 1], m.idx[t + 2]];
    const ux = p[b * 3] - p[a * 3], uy = p[b * 3 + 1] - p[a * 3 + 1], uz = p[b * 3 + 2] - p[a * 3 + 2];
    const vx = p[c * 3] - p[a * 3], vy = p[c * 3 + 1] - p[a * 3 + 1], vz = p[c * 3 + 2] - p[a * 3 + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const v of [a, b, c]) { n[v * 3] += nx; n[v * 3 + 1] += ny; n[v * 3 + 2] += nz; }
  }
  for (let i = 0; i < n.length; i += 3) {
    const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1;
    n[i] /= l; n[i + 1] /= l; n[i + 2] /= l;
  }
  return n;
}

const doc = new Document();
const buffer = doc.createBuffer();
const scene = doc.createScene('body');
let sum = 0;
for (const [id, m] of Object.entries(parts)) {
  sum += m.idx.length / 3;
  const b = bbox(m.pos);
  console.log(id.padEnd(15), String(m.idx.length / 3).padStart(6), 'tris', 'centre', b.min.map((v, k) => ((v + b.max[k]) / 2).toFixed(3)).join(' '));
  const prim = doc.createPrimitive()
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(m.pos).setBuffer(buffer))
    .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(normals(m)).setBuffer(buffer))
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(m.idx).setBuffer(buffer));
  scene.addChild(doc.createNode(id).setMesh(doc.createMesh(id).addPrimitive(prim)));
}
console.log('total', sum, 'tris');
await doc.transform(prune());
await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
const io = new NodeIO().registerExtensions([EXTMeshoptCompression, KHRMeshQuantization]).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
await io.write(out, doc);
console.log('wrote', out, (fs.statSync(out).size / 1024).toFixed(0), 'KB');
