// BodyParts3D heart parts (STL, mm) → one GLB for the Heart Lab, in the lesson's heart coordinates:
// x = the patient's left (your right, looking at them), y = up, z = forward (out of the chest), 1 unit = 10 cm.
// Trims vessels a short way outside the heart, drops scan specks, simplifies for Quest, splits the heart wall
// into the chambers and septum, and stores each part as a named node.
// usage: node build.mjs <stlDir> ../../lessons/heart-lab/models/heart.glb   (see README.md)
import path from 'node:path';
import fs from 'node:fs';
import { Document, NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { meshopt, weld, prune } from '@gltf-transform/functions';
import { MeshoptSimplifier, MeshoptEncoder } from 'meshoptimizer';
import { readSTL, components } from './stl.mjs';

const [, , dir, out, preview] = process.argv;
await MeshoptSimplifier.ready;
await MeshoptEncoder.ready;

const CENTRE = [21.5, -122, 1237]; // middle of the heart wall (mm, scan axes)
const S = 0.01;
/** scan (x right→left of patient, y back→front is negative, z up) → heart coordinates */
const toHeart = (x, y, z) => [(x - CENTRE[0]) * S, (z - CENTRE[2]) * S, -(y - CENTRE[1]) * S];

// part id → files, how much to keep (triangles), and a box to trim to (heart coordinates)
const KEEP = { min: [-0.85, -0.75, -0.8], max: [0.85, 1.15, 0.9] };
export const PARTS = {
  pulmonaryValve: { files: ['FMA7246'], tris: 4000, minPiece: 100 },
  wall: { files: ['FMA7274'], tris: 70000, minPiece: 2000 },
  aorta: { files: ['FMA3736', 'FMA3768', 'FMA3784'], tris: 9000, box: { min: [-0.6, -0.4, -0.9], max: [0.6, 1.1, 0.9] } },
  pulmonaryArtery: { files: ['FMA66326'], tris: 7000, geo: { near: 'pulmonaryValve', r: 0.12, limit: 0.62 }, box: { min: [-0.62, 0.0, -0.9], max: [0.62, 1.1, 0.9] } },
  pulmonaryVeins: { files: ['FMA66643'], tris: 4000, geo: { near: 'wall', r: 0.03, limit: 0.2 }, box: { min: [-0.62, -0.3, -0.9], max: [0.66, 0.7, 0.9] } },
  venaCava: { files: ['FMA4720', 'FMA10951'], tris: 4000, box: { min: [-0.8, -0.56, -0.9], max: [0.6, 1.05, 0.9] } },
  tricuspid: { files: ['FMA7234'], tris: 7000, minPiece: 100 },
  mitral: { files: ['FMA7235'], tris: 5000 },
  coronaryArteries: { files: ['FMA3802', 'FMA3818', 'FMA3840nsn', 'FMA4685', 'FMA3862nsn', 'FMA3895'], tris: 9000 },
  cardiacVeins: { files: ['FMA4706', 'FMA4707', 'FMA4713'], tris: 4000 },
  chordae: { files: ['FMA7260', 'FMA7261', 'FMA7262', 'FMA7266', 'FMA9352nsn'], tris: 4000, minPiece: 100 },
};

function load(id) {
  const def = PARTS[id];
  const pos = [];
  const idx = [];
  for (const f of def.files) {
    const m = readSTL(path.join(dir, `${f}.stl`));
    const keepTri = new Uint8Array(m.idx.length / 3).fill(1);
    if (def.minPiece) {
      const c = components(m);
      const size = new Map();
      for (const x of c.comp) size.set(x, (size.get(x) ?? 0) + 1);
      c.comp.forEach((x, t) => { if (size.get(x) < def.minPiece) keepTri[t] = 0; });
    }
    const base = pos.length / 3;
    for (let i = 0; i < m.pos.length; i += 3) pos.push(...toHeart(m.pos[i], m.pos[i + 1], m.pos[i + 2]));
    const box = def.box ?? KEEP;
    const inBox = (v) => { for (let k = 0; k < 3; k++) if (pos[(base + v) * 3 + k] < box.min[k] || pos[(base + v) * 3 + k] > box.max[k]) return false; return true; };
    for (let t = 0; t < m.idx.length / 3; t++) {
      if (!keepTri[t]) continue;
      const [a, b, c] = [m.idx[t * 3], m.idx[t * 3 + 1], m.idx[t * 3 + 2]];
      if (!inBox(a) || !inBox(b) || !inBox(c)) continue;
      // STL scan faces are wound for z-up, y-back; our axis swap keeps handedness (x, z, -y) — no flip needed
      idx.push(base + a, base + b, base + c);
    }
  }
  // after trimming, keep only pieces still connected to something big (no floating fragments)
  let mesh = compact({ pos: new Float32Array(pos), idx: new Uint32Array(idx) });
  if (def.geo) mesh = geodesicTrim(mesh, meshes[def.geo.near], def.geo.r, def.geo.limit);
  const c = components(mesh);
  const size = new Map();
  for (const x of c.comp) size.set(x, (size.get(x) ?? 0) + 1);
  const minKeep = Math.max(60, (def.minPiece ?? 0) * 0.5);
  mesh.idx = mesh.idx.filter((_, i) => size.get(c.comp[Math.floor(i / 3)]) >= minKeep);
  mesh = compact(mesh);
  // simplify for Quest
  const target = Math.min(mesh.idx.length, def.tris * 3);
  const simp = MeshoptSimplifier.simplify(mesh.idx, mesh.pos, 3, target, 0.02, ['LockBorder']);
  return compact({ pos: mesh.pos, idx: simp[0] ?? simp });
}

/** Keep only the part of a vessel within `limit` (measured along its surface) of where it meets `ref`. */
function geodesicTrim(m, ref, r, limit) {
  const nv = m.pos.length / 3;
  // roots: vertices within r of any ref vertex (spatial hash)
  const cell = r;
  const grid = new Map();
  const key = (x, y, z) => `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`;
  for (let i = 0; i < ref.pos.length; i += 3) {
    const k = key(ref.pos[i], ref.pos[i + 1], ref.pos[i + 2]);
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(i);
  }
  const near = (x, y, z) => {
    const cx = Math.floor(x / cell), cy = Math.floor(y / cell), cz = Math.floor(z / cell);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) {
      for (const i of grid.get(`${cx + a},${cy + b},${cz + c}`) ?? []) {
        if (Math.hypot(ref.pos[i] - x, ref.pos[i + 1] - y, ref.pos[i + 2] - z) < r) return true;
      }
    }
    return false;
  };
  const adj = Array.from({ length: nv }, () => []);
  for (let t = 0; t < m.idx.length; t += 3) {
    for (let e = 0; e < 3; e++) {
      const a = m.idx[t + e], b = m.idx[t + ((e + 1) % 3)];
      adj[a].push(b);
      adj[b].push(a);
    }
  }
  const dist = new Float64Array(nv).fill(Infinity);
  const heap = [];
  const push = (d, v) => { heap.push([d, v]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0]; const last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, rr = l + 1; let s = i; if (l < heap.length && heap[l][0] < heap[s][0]) s = l; if (rr < heap.length && heap[rr][0] < heap[s][0]) s = rr; if (s === i) break; [heap[s], heap[i]] = [heap[i], heap[s]]; i = s; } } return top; };
  for (let v = 0; v < nv; v++) if (near(m.pos[v * 3], m.pos[v * 3 + 1], m.pos[v * 3 + 2])) { dist[v] = 0; push(0, v); }
  while (heap.length) {
    const [d, v] = pop();
    if (d > dist[v] || d > limit) continue;
    for (const w of adj[v]) {
      const nd = d + Math.hypot(m.pos[v * 3] - m.pos[w * 3], m.pos[v * 3 + 1] - m.pos[w * 3 + 1], m.pos[v * 3 + 2] - m.pos[w * 3 + 2]);
      if (nd < dist[w]) { dist[w] = nd; push(nd, w); }
    }
  }
  const idx = [];
  for (let t = 0; t < m.idx.length; t += 3) if (dist[m.idx[t]] < limit && dist[m.idx[t + 1]] < limit && dist[m.idx[t + 2]] < limit) idx.push(m.idx[t], m.idx[t + 1], m.idx[t + 2]);
  return compact({ pos: m.pos, idx: new Uint32Array(idx) });
}

/** drop unused vertices */
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

export const meshes = {};
for (const id of Object.keys(PARTS)) {
  meshes[id] = load(id);
  console.log(id.padEnd(18), meshes[id].idx.length / 3, 'tris');
}

// the heart wall, split into chambers + septum (see split.mjs)
const { splitWall } = await import('./split.mjs');
const veinPts = [];
for (let i = 0; i < meshes.pulmonaryVeins.pos.length; i += 3) veinPts.push([...meshes.pulmonaryVeins.pos.slice(i, i + 3)]);
const split = splitWall(meshes.wall, dir, { pulmonaryVeinRoots: veinPts });
const groups = Object.fromEntries(Object.entries(split.parts).map(([k, m]) => [k, compact(m)]));
for (const [k, m] of Object.entries(groups)) console.log('  wall →', k, m.idx.length / 3);
// turn to the textbook four-chamber view, centre, and measure the landmarks
const { makeTransform, measure } = await import('./finalize.mjs');
const T = makeTransform(split.frame);
T.raw = toHeart;
const moveAll = (m) => { for (let i = 0; i < m.pos.length; i += 3) m.pos.set(T.apply([m.pos[i], m.pos[i + 1], m.pos[i + 2]]), i); };
for (const m of Object.values(meshes)) moveAll(m);
for (const m of Object.values(groups)) moveAll(m);
const L = measure(dir, T, meshes, groups, split.frame);
fs.writeFileSync(out.replace(/.glb$/, '.json'), JSON.stringify(L));
console.log('landmarks:', Object.keys(L).join(' '));
const parts = { ...groups };
for (const id of Object.keys(PARTS)) if (id !== 'wall') parts[id] = meshes[id];

const doc = new Document();
const buffer = doc.createBuffer();
const scene = doc.createScene('heart');
for (const [id, m] of Object.entries(parts)) {
  if (!m.idx.length) continue;
  const prim = doc.createPrimitive()
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(m.pos).setBuffer(buffer))
    .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(normals(m)).setBuffer(buffer))
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(m.idx).setBuffer(buffer));
  const mesh = doc.createMesh(id).addPrimitive(prim);
  scene.addChild(doc.createNode(id).setMesh(mesh));
}
await doc.transform(prune());
const io = new NodeIO().registerExtensions([EXTMeshoptCompression, KHRMeshQuantization]).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
if (!preview) await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
await io.write(out, doc);
console.log('wrote', out, (fs.statSync(out).size / 1024).toFixed(0), 'KB');
