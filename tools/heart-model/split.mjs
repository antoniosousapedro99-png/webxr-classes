// Split the BodyParts3D heart wall (one mesh) into right/left atrium, right/left ventricle and septum, using
// the heart's own landmarks:
//  • the coronary (atrioventricular) groove, where the right coronary trunk and circumflex artery run,
//    separates atria from ventricles
//  • the interventricular grooves (anterior + posterior interventricular arteries) and the apex give the
//    plane of the septum, separating right from left
//  • the outflow tracts (towards the pulmonary valve and aorta) belong to the ventricles even above the groove
//  • atria: right near the venae cavae, left near the pulmonary veins
import path from 'node:path';
import { readSTL } from './stl.mjs';

const CENTRE = [21.5, -122, 1237];
const S = 0.01;
const toHeart = (x, y, z) => [(x - CENTRE[0]) * S, (z - CENTRE[2]) * S, -(y - CENTRE[1]) * S];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a) => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

function points(dir, ids) {
  const pts = [];
  for (const id of ids) {
    const m = readSTL(path.join(dir, `${id}.stl`));
    for (let i = 0; i < m.pos.length; i += 3) pts.push(toHeart(m.pos[i], m.pos[i + 1], m.pos[i + 2]));
  }
  return pts;
}
const mean = (pts) => pts.reduce((s, p) => [s[0] + p[0] / pts.length, s[1] + p[1] / pts.length, s[2] + p[2] / pts.length], [0, 0, 0]);

/** Least-squares plane: { c, n } (n = smallest-variance direction, by power iteration on the inverse-ish). */
function fitPlane(pts) {
  const c = mean(pts);
  const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const p of pts) {
    const d = sub(p, c);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) C[i][j] += d[i] * d[j];
  }
  // smallest eigenvector: largest eigenvector of (tr·I − C)
  const tr = C[0][0] + C[1][1] + C[2][2];
  const M = C.map((row, i) => row.map((v, j) => (i === j ? tr - v : -v)));
  let v = [0.3, 0.8, 0.5];
  for (let k = 0; k < 100; k++) v = norm([dot(M[0], v), dot(M[1], v), dot(M[2], v)]);
  return { c, n: v };
}

export function landmarks(dir) {
  const avGroove = points(dir, ['FMA3802', 'FMA3895']); // right coronary trunk + circumflex
  const ivGroove = points(dir, ['FMA3862nsn', 'FMA3840nsn']); // anterior + posterior interventricular
  const cava = points(dir, ['FMA4720', 'FMA10951']);
  const tricuspidPts = points(dir, ['FMA7234']);
  const mitralPts = points(dir, ['FMA7235']);
  const tricuspid = mean(tricuspidPts);
  const mitral = mean(mitralPts);
  const pv = mean(points(dir, ['FMA7246']));
  const asc = points(dir, ['FMA3736']);
  const aorticRoot = mean(asc.filter((p) => p[1] < Math.min(...asc.map((q) => q[1])) + 0.08));
  return { avGroove, ivGroove, cava, tricuspid, mitral, pv, aorticRoot, tricuspidPts, mitralPts };
}

export function splitWall(wall, dir, extra = {}) {
  const L = landmarks(dir);
  // atria / ventricles: the plane of the coronary groove, its normal pointing to the atria (away from the apex)
  const av = fitPlane(L.avGroove);
  // the atria are on the side of the venae cavae (the top of the superior vena cava)
  const svcTop = L.cava.reduce((m, p) => (p[1] > m[1] ? p : m), L.cava[0]);
  if (dot(sub(svcTop, av.c), av.n) < 0) av.n = av.n.map((x) => -x);
  let apex = null;
  for (let i = 0; i < wall.pos.length; i += 3) {
    const p = [wall.pos[i], wall.pos[i + 1], wall.pos[i + 2]];
    if (!apex || dot(sub(p, av.c), av.n) < dot(sub(apex, av.c), av.n)) apex = p;
  }
  // right ↔ left: planes containing the long axis (apex → base), facing from the tricuspid to the mitral valve.
  // Ventricles: through the anterior interventricular groove. Atria: between the two AV valves.
  const axis = av.n;
  const perp = (v) => norm(sub(v, axis.map((x) => x * dot(v, axis))));
  const rl = perp(sub(L.mitral, L.tricuspid));
  const lad = L.ivGroove;
  const ivMid = mean(lad);
  const sp = { c: ivMid, n: rl };
  const atrMid = L.tricuspid.map((x, i) => (x + L.mitral[i]) / 2);
  const groove = [...L.ivGroove.filter((_, i) => i % 5 === 0)];
  const nearGroove = (p) => { for (const q of groove) if (Math.hypot(...sub(p, q)) < 0.05) return true; return false; };
  const frameExtra = {};
  const out = { rightAtrium: [], leftAtrium: [], rightVentricle: [], leftVentricle: [], septum: [] };
  const P = (v) => [wall.pos[v * 3], wall.pos[v * 3 + 1], wall.pos[v * 3 + 2]];
  const nt = wall.idx.length / 3;
  const G = [];
  const N = [];
  for (let t = 0; t < nt; t++) {
    const a = P(wall.idx[t * 3]), b = P(wall.idx[t * 3 + 1]), c = P(wall.idx[t * 3 + 2]);
    G.push([(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3]);
    N.push(norm(cross(sub(b, a), sub(c, a))));
  }
  // which way the scan's faces point: outwards from the muscle (then outer-surface normals point away from the middle)
  const mid = mean(G);
  let out1 = 0;
  for (let t = 0; t < nt; t++) if (dot(N[t], sub(G[t], mid)) > 0) out1++;
  // (both surfaces exist; the outer one is bigger, so most faces agree with the true orientation)
  const flip = out1 < nt / 2 ? -1 : 1;
  const grid = rayGrid(wall);
  const isInner = new Uint8Array(nt);
  const cav = new Array(nt);
  for (let t = 0; t < nt; t++) {
    const n = N[t].map((x) => x * flip);
    const hit = grid.cast(G[t], n, 0.7, t);
    if (hit !== null) {
      isInner[t] = 1;
      cav[t] = G[t].map((x, i) => x + n[i] * hit * 0.5);
    }
  }
  // the valve rings (annuli): the top of each AV valve, towards the atria (the rest is flaps and strings)
  const annulus = (pts) => {
    const hs = pts.map((p) => dot(p, av.n)).sort((a, b) => a - b);
    const cut = hs[Math.floor(hs.length * 0.85)];
    return mean(pts.filter((p) => dot(p, av.n) >= cut));
  };
  const triRing = annulus(L.tricuspidPts);
  const mitRing = annulus(L.mitralPts);
  const label = new Array(nt);
  const valveMid = triRing.map((x, i) => (x + mitRing[i]) / 2);
  const hInner = (q) => {
    // height above the nearer valve ring
    const r = Math.hypot(...sub(q, triRing)) < Math.hypot(...sub(q, mitRing)) ? triRing : mitRing;
    return dot(sub(q, r), av.n);
  };
  for (let t = 0; t < nt; t++) {
    const g = G[t];
    let part;
    if (isInner[t]) {
      const q = cav[t];
      const h = hInner(q) - 0.01;
      const side = dot(sub(g, sp.c), sp.n);
      if (h <= 0 && Math.abs(side) < 0.09 && Math.abs(dot(N[t], sp.n)) > 0.5) part = 'septum';
      else if (h > 0 && Math.hypot(...sub(q, L.pv)) < 0.18) part = 'rightVentricle';
      else if (h > 0 && Math.hypot(...sub(q, L.aorticRoot)) < 0.12) part = 'leftVentricle';
      else if (h > 0) part = dot(sub(q, atrMid), rl) > 0 ? 'leftAtrium' : 'rightAtrium';
      else part = dot(sub(q, sp.c), sp.n) > 0 ? 'leftVentricle' : 'rightVentricle';
    } else {
      const h = dot(sub(g, av.c), av.n);
      const side = dot(sub(g, sp.c), sp.n);
      const outflow = Math.hypot(...sub(g, L.pv)) < 0.2 ? 'rightVentricle' : Math.hypot(...sub(g, L.aorticRoot)) < 0.13 ? 'leftVentricle' : null;
      if (h > 0.02 && !outflow) part = dot(sub(g, atrMid), rl) > 0 ? 'leftAtrium' : 'rightAtrium';
      else if (outflow && h > 0.02) part = outflow;
      else part = side > 0 ? 'leftVentricle' : 'rightVentricle';
    }
    label[t] = part;
  }
  // smooth: an inner face takes the most common label of the faces around it (removes specks)
  const byVert = Array.from({ length: wall.pos.length / 3 }, () => []);
  for (let t = 0; t < nt; t++) for (let k = 0; k < 3; k++) byVert[wall.idx[t * 3 + k]].push(t);
  for (let it = 0; it < 8; it++) {
    const next = label.slice();
    for (let t = 0; t < nt; t++) {
      if (!isInner[t]) continue;
      const count = {};
      for (let k = 0; k < 3; k++) for (const u of byVert[wall.idx[t * 3 + k]]) count[label[u]] = (count[label[u]] ?? 0) + 1;
      let best = label[t];
      for (const [p, c] of Object.entries(count)) if (c > (count[best] ?? 0)) best = p;
      next[t] = best;
    }
    label.splice(0, nt, ...next);
  }
  for (let t = 0; t < nt; t++) out[label[t]].push(wall.idx[t * 3], wall.idx[t * 3 + 1], wall.idx[t * 3 + 2]);
  frameExtra.triRing = triRing;
  frameExtra.mitRing = mitRing;
  const res = {};
  for (const [k, idx] of Object.entries(out)) res[k] = { pos: wall.pos, idx: new Uint32Array(idx) };
  return { parts: res, frame: { av, sp, apex, atrMid, ...frameExtra, ...L } };
}

/** A uniform grid over the triangles, for casting short rays (does the ray from a face hit the wall again?). */
function rayGrid(m) {
  const C = 0.025;
  const cells = new Map();
  const P = (v) => [m.pos[v * 3], m.pos[v * 3 + 1], m.pos[v * 3 + 2]];
  const tris = [];
  for (let t = 0; t < m.idx.length / 3; t++) {
    const a = P(m.idx[t * 3]), b = P(m.idx[t * 3 + 1]), c = P(m.idx[t * 3 + 2]);
    tris.push([a, b, c]);
    const lo = [0, 1, 2].map((k) => Math.floor(Math.min(a[k], b[k], c[k]) / C));
    const hi = [0, 1, 2].map((k) => Math.floor(Math.max(a[k], b[k], c[k]) / C));
    for (let x = lo[0]; x <= hi[0]; x++) for (let y = lo[1]; y <= hi[1]; y++) for (let z = lo[2]; z <= hi[2]; z++) {
      const k = x + "," + y + "," + z;
      if (!cells.has(k)) cells.set(k, []);
      cells.get(k).push(t);
    }
  }
  const hitTri = (o, d, [a, b, c]) => { // Möller–Trumbore
    const e1 = sub(b, a), e2 = sub(c, a);
    const p = cross(d, e2);
    const det = dot(e1, p);
    if (Math.abs(det) < 1e-12) return null;
    const inv = 1 / det;
    const s = sub(o, a);
    const u = dot(s, p) * inv;
    if (u < 0 || u > 1) return null;
    const q = cross(s, e1);
    const v = dot(d, q) * inv;
    if (v < 0 || u + v > 1) return null;
    const t = dot(e2, q) * inv;
    return t > 0.004 ? t : null;
  };
  return {
    cast(o, d, max, self) {
      const seen = new Set([self]);
      let best = null;
      for (let s = 0; s <= max; s += C * 0.5) {
        if (best !== null && s > best + C) break;
        const p = o.map((x, i) => x + d[i] * s);
        const k = Math.floor(p[0] / C) + "," + Math.floor(p[1] / C) + "," + Math.floor(p[2] / C);
        for (const t of cells.get(k) ?? []) {
          if (seen.has(t)) continue;
          seen.add(t);
          const h = hitTri(o, d, tris[t]);
          if (h !== null && h <= max && (best === null || h < best)) best = h;
        }
      }
      return best;
    },
  };
}
