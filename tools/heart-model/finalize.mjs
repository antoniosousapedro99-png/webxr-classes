// Turn the heart so the four-chamber plane faces the viewer (+z) with the base up and the apex down to the right
// (the classic textbook view), centre it, and measure the landmarks the lesson needs (valve rings, chamber
// centres, vessel centre lines, the left anterior descending artery, label anchors).
import path from 'node:path';
import { readSTL } from './stl.mjs';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a) => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const mean = (pts) => pts.reduce((s, p) => add(s, mul(p, 1 / pts.length)), [0, 0, 0]);
const r3 = (v) => v.map((x) => Math.round(x * 1000) / 1000);

export function makeTransform(frame) {
  const base = frame.av.n; // towards the atria
  let rl = sub(frame.mitRing, frame.triRing);
  rl = norm(sub(rl, mul(base, dot(rl, base))));
  let n4 = norm(cross(base, rl));
  if (n4[2] < 0) n4 = mul(n4, -1);
  // new axes: z' = n4 (towards you), y' = base tilted 25° towards the heart's right (your left), x' = y' × z'
  const tilt = (25 * Math.PI) / 180;
  const yb = norm(add(mul(base, Math.cos(tilt)), mul(rl, Math.sin(tilt))));
  const z = n4;
  const y = norm(sub(yb, mul(z, dot(yb, z))));
  const x = cross(y, z);
  const origin = frame.triRing.map((v, i) => (v + frame.mitRing[i]) / 2);
  const apply = (p) => sub(p, origin);
  const dir = (v) => v;
  // opened: turn the heart so its four-chamber plane faces you (rows: the screen axes in heart coordinates)
  return { apply, dir, origin, open: { x, y, z }, cutNormal: n4 };
}

/** Points along a tube, ordered from `start` outwards (centroids of slices by distance along the tube). */
export function centreline(pts, start, step = 0.06, maxLen = 3) {
  // order by "distance from the start, following the tube": greedy march using nearest slice centroids
  const line = [start];
  let cur = start;
  let prevDir = null;
  for (let k = 0; k < maxLen / step; k++) {
    const shell = pts.filter((p) => { const d = Math.hypot(...sub(p, cur)); return d > step * 0.6 && d < step * 1.6; });
    const ahead = prevDir ? shell.filter((p) => dot(norm(sub(p, cur)), prevDir) > 0.3) : shell;
    if (ahead.length < 8) break;
    const c = mean(ahead);
    const nd = norm(sub(c, cur));
    // stay on the tube's axis: step to the centroid of the ring around the next point
    const next = add(cur, mul(nd, step));
    const ring = pts.filter((p) => Math.abs(dot(sub(p, next), nd)) < step * 0.35);
    const near = ring.filter((p) => Math.hypot(...sub(p, next)) < 0.2);
    const pt = near.length > 8 ? mean(near) : next;
    prevDir = norm(sub(pt, cur));
    line.push(pt);
    cur = pt;
  }
  return line;
}

/** Centre line of a tube: centroids of the vertices binned by distance along the surface from `start`. */
export function geoLine(m, start, step = 0.06, maxDist = 3, startR = 0.06) {
  const nv = m.pos.length / 3;
  const P = (v) => [m.pos[v * 3], m.pos[v * 3 + 1], m.pos[v * 3 + 2]];
  const adj = Array.from({ length: nv }, () => []);
  for (let t = 0; t < m.idx.length; t += 3) for (let e = 0; e < 3; e++) { const a = m.idx[t + e], b = m.idx[t + ((e + 1) % 3)]; adj[a].push(b); adj[b].push(a); }
  // join pieces that touch (e.g. the ascending aorta, arch and descending aorta are separate files)
  const seen = new Map();
  for (let v = 0; v < nv; v++) { const k = P(v).map((x) => Math.round(x / 0.006)).join(); if (seen.has(k)) { adj[v].push(seen.get(k)); adj[seen.get(k)].push(v); } else seen.set(k, v); }
  const dist = new Float64Array(nv).fill(Infinity);
  let frontier = [];
  for (let v = 0; v < nv; v++) if (Math.hypot(...sub(P(v), start)) < startR) { dist[v] = 0; frontier.push(v); }
  if (!frontier.length) { let best = 0; for (let v = 1; v < nv; v++) if (Math.hypot(...sub(P(v), start)) < Math.hypot(...sub(P(best), start))) best = v; dist[best] = 0; frontier.push(best); }
  // (simple label-correcting search: fine for these sizes)
  while (frontier.length) {
    const next = [];
    for (const v of frontier) for (const w of adj[v]) {
      const d = dist[v] + Math.hypot(...sub(P(v), P(w)));
      if (d < dist[w] && d < maxDist) { dist[w] = d; next.push(w); }
    }
    frontier = [...new Set(next)];
  }
  const bins = [];
  for (let v = 0; v < nv; v++) if (dist[v] < maxDist) { const b = Math.floor(dist[v] / step); (bins[b] ??= []).push(P(v)); }
  return [start, ...bins.filter((b) => b && b.length > 6).map(mean)];
}

export function measure(dir, T, meshes, groups, frame) {
  const tp = (ids) => {
    const out = [];
    for (const id of ids) {
      const m = readSTL(path.join(dir, `${id}.stl`));
      for (let i = 0; i < m.pos.length; i += 3) out.push(T.apply(T.raw(m.pos[i], m.pos[i + 1], m.pos[i + 2])));
    }
    return out;
  };
  const vpts = (m) => { const o = []; for (let i = 0; i < m.pos.length; i += 3) o.push([m.pos[i], m.pos[i + 1], m.pos[i + 2]]); return o; };
  const L = {};
  L.triRing = T.apply(frame.triRing);
  L.mitRing = T.apply(frame.mitRing);
  L.base = norm(T.dir(frame.av.n));
  L.cutPoint = [0, 0, 0]; // towards the atria
  L.rl = norm(T.dir(frame.sp.n)); // towards the left side
  L.apex = T.apply(frame.apex);
  L.pv = T.apply(frame.pv);
  L.aorticRoot = T.apply(frame.aorticRoot);
  // vessel centre lines (from the end at the heart)
  const aortaPts = vpts(meshes.aorta);
  L.aorta = geoLine(meshes.aorta, L.aorticRoot, 0.08, 3);
  const paPts = vpts(meshes.pulmonaryArtery);
  L.paTrunk = geoLine(meshes.pulmonaryArtery, L.pv, 0.06, 0.32, 0.09);
  const svc = tp(['FMA4720']).filter((p) => true);
  const ivc = tp(['FMA10951']);
  const inBox = (p, m) => { for (let i = 0; i < m.pos.length; i += 300) if (Math.hypot(p[0] - m.pos[i], p[1] - m.pos[i + 1], p[2] - m.pos[i + 2]) < 0.05) return true; return false; };
  const svcKept = svc.filter((p) => inBox(p, meshes.venaCava));
  const ivcKept = ivc.filter((p) => inBox(p, meshes.venaCava));
  const ends = (pts, axis) => { const s = [...pts].sort((a, b) => dot(a, axis) - dot(b, axis)); const n = Math.max(5, Math.floor(s.length * 0.08)); return [mean(s.slice(0, n)), mean(s.slice(-n))]; };
  const [svcLow, svcHigh] = ends(svcKept, [0, 1, 0]);
  const [ivcLow, ivcHigh] = ends(ivcKept, [0, 1, 0]);
  L.svc = [svcHigh, svcLow];
  L.ivc = [ivcLow, ivcHigh];
  // pulmonary artery branch ends and pulmonary vein ends: the far ends of the trimmed vessels
  const farEnds = (pts, from, k) => {
    const far = pts.filter((p) => Math.hypot(...sub(p, from)) > 0.28);
    const groups = [];
    for (const p of far) {
      let g = groups.find((q) => Math.hypot(...sub(q.c, p)) < 0.12);
      if (!g) groups.push((g = { c: p, pts: [] }));
      g.pts.push(p);
      g.c = mean(g.pts.length > 50 ? g.pts.slice(-50) : g.pts);
    }
    return groups.sort((a, b) => b.pts.length - a.pts.length).slice(0, k).map((g) => mean(g.pts));
  };
  L.paEnds = farEnds(paPts, L.pv, 2);
  L.laCentre = null;
  // chamber cavities: centroid of each chamber's inner faces, pushed into the cavity
  for (const [id, m] of Object.entries(groups)) {
    const pts = vpts(m);
    L[`${id}Centre`] = mean(pts);
  }
  const veinPts = vpts(meshes.pulmonaryVeins);
  L.veinEnds = farEnds(veinPts, L[`leftAtriumCentre`], 4).length >= 2 ? farEnds(veinPts, mean(veinPts), 4) : [];
  // left anterior descending artery: centre line from the stem of the left coronary artery
  const lad = tp(['FMA3862nsn']);
  const lcaStem = mean(tp(['FMA4685']));
  L.lad = geoLine(ladMesh(dir, T), lcaStem, 0.05, 2, 0.04);
  // anchors for name tags: outer middle of each part
  L.anchors = {};
  const mid = mean(vpts(meshes.wall));
  for (const [id, m] of Object.entries({ ...groups, ...meshes })) {
    if (id === 'wall') continue;
    const pts = vpts(m);
    const c = mean(pts);
    const out = norm(sub(c, mid));
    let far = c;
    for (const p of pts) if (dot(sub(p, c), out) > dot(sub(far, c), out)) far = p;
    L.anchors[id] = r3(add(far, mul(out, 0.03)));
  }
  L.open = T.open;
  L.cutNormal = T.cutNormal;
  L.open = { x: r3(L.open.x), y: r3(L.open.y), z: r3(L.open.z) };
  for (const k of Object.keys(L)) {
    if (Array.isArray(L[k]) && typeof L[k][0] === 'number') L[k] = r3(L[k]);
    else if (Array.isArray(L[k])) L[k] = L[k].map(r3);
  }
  return L;
}

function ladMesh(dir, T) {
  const m = readSTL(path.join(dir, 'FMA3862nsn.stl'));
  for (let i = 0; i < m.pos.length; i += 3) m.pos.set(T.apply(T.raw(m.pos[i], m.pos[i + 1], m.pos[i + 2])), i);
  return m;
}
