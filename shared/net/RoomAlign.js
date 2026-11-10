import * as THREE from 'three';

// Lining up headsets that share one real room — automatically, with nothing for students to do.
//
// Every headset has scanned the classroom once (Quest: Settings › Physical space › Space Setup). From its
// scan, each headset works out the same "room frame":
//  • its directions follow the walls (rooms are mostly rectangular),
//  • its origin is the centre of the room, on the floor.
// That leaves only which way round (4 possibilities in a rectangle, 2 if it is clearly longer than wide).
// The scan's furniture and fittings (doors, windows, tables, cupboards…) settle it: the admin's headset
// shares where they are in its room frame ("fingerprint"), and each headset picks the way round that
// matches best. Without the admin's fingerprint, every headset uses the same rule on its own scan.
// The frame is worked out again every second from the scan, so a headset that recentres or loses
// tracking puts itself right again by itself.

const MIN_WALL = 1; // metres: smaller vertical surfaces are not walls
const IN_GRID = THREE.MathUtils.degToRad(8);
const UP = new THREE.Vector3(0, 1, 0);
const NOT_FEATURES = new Set(['floor', 'ceiling', 'wall', 'global_mesh', 'invisible_wall_face']);
const WEIGHT = { door: 3, window: 2, screen: 2, table: 1.5 }; // how much each kind of feature counts

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const area = (poly) => Math.abs(poly.reduce((s, p, i) => {
  const q = poly[(i + 1) % poly.length];
  return s + p.x * q.z - q.x * p.z;
}, 0)) / 2;

/** What the headset knows about the real room (WebXR plane detection), refreshed once a second. */
export class RoomScan {
  constructor() {
    this.walls = []; // { p: point on the wall, n: horizontal unit normal, w: width }
    this.features = []; // { label, p: centre, a: area }
    this.floorY = null;
    this.last = 0;
    this.version = 0;
  }

  update(frame, refSpace) {
    const planes = frame?.detectedPlanes;
    if (!planes || !refSpace) return false;
    const now = performance.now();
    if (now - this.last < 1000) return false;
    this.last = now;
    const walls = [];
    const features = [];
    let floor = null;
    planes.forEach((plane) => {
      const pose = frame.getPose(plane.planeSpace, refSpace);
      if (!pose) return;
      const m = new THREE.Matrix4().fromArray(pose.transform.matrix);
      const p = new THREE.Vector3().setFromMatrixPosition(m);
      const label = plane.semanticLabel || (plane.orientation === 'vertical' ? 'wall' : p.y < 0.3 ? 'floor' : p.y > 2 ? 'ceiling' : 'table');
      const a = area(plane.polygon);
      if (label === 'wall') {
        const n = UP.clone().transformDirection(m).setY(0);
        if (n.lengthSq() < 0.5) return;
        const xs = plane.polygon.map((q) => q.x);
        const zs = plane.polygon.map((q) => q.z);
        const w = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs));
        if (w >= MIN_WALL) walls.push({ p, n: n.normalize(), w });
      } else if (label === 'floor') {
        floor = floor === null ? p.y : Math.min(floor, p.y);
      } else if (!NOT_FEATURES.has(label) && a > 0.05) {
        features.push({ label, p, a });
      }
    });
    this.walls = walls;
    this.features = features;
    this.floorY = floor;
    this.version++;
    return true;
  }

  get hasRoom() {
    return this.walls.length >= 3;
  }
}

/**
 * The room as a rectangle: the 4 possible room frames (origin at the centre on the floor, x along a wall;
 * candidate k is turned k × 90°), and the room's size along each candidate's x and z. Null if the scan
 * doesn't show a mostly-rectangular room.
 */
export function roomFrames(scan) {
  const walls = scan?.walls ?? [];
  if (walls.length < 3) return null;
  let C = 0;
  let S = 0;
  let total = 0;
  for (const w of walls) {
    const phi = Math.atan2(w.n.z, w.n.x);
    C += w.w * Math.cos(4 * phi);
    S += w.w * Math.sin(4 * phi);
    total += w.w;
  }
  const grid = Math.atan2(S, C) / 4;
  const onGrid = (w) => Math.abs(wrap(4 * (Math.atan2(w.n.z, w.n.x) - grid))) / 4 < IN_GRID;
  if (walls.filter(onGrid).reduce((s, w) => s + w.w, 0) / total < 0.6) return null;
  const u = new THREE.Vector3(Math.cos(grid), 0, Math.sin(grid));
  const v = new THREE.Vector3().crossVectors(u, UP);
  const span = (axis) => {
    const d = walls.filter((w) => onGrid(w) && Math.abs(w.n.dot(axis)) > 0.9).map((w) => w.p.dot(axis));
    return d.length >= 2 ? [Math.min(...d), Math.max(...d)] : null;
  };
  const su = span(u);
  const sv = span(v);
  if (!su || !sv || su[1] - su[0] < 1.5 || sv[1] - sv[0] < 1.5) return null;
  const centre = u.clone().multiplyScalar((su[0] + su[1]) / 2).addScaledVector(v, (sv[0] + sv[1]) / 2);
  centre.y = scan.floorY ?? 0;
  const W = su[1] - su[0];
  const D = sv[1] - sv[0];
  const candidates = [0, 1, 2, 3].map((k) => {
    const x = u.clone().applyAxisAngle(UP, -k * Math.PI / 2);
    const z = new THREE.Vector3().crossVectors(x, UP);
    return { k, matrix: new THREE.Matrix4().makeBasis(x, UP, z).setPosition(centre), size: k % 2 ? [D, W] : [W, D] };
  });
  return { candidates, size: [W, D] };
}

/** The room's features in a room frame: what other headsets match against. */
export function fingerprint(scan, matrix) {
  const inv = matrix.clone().invert();
  return scan.features.map((f) => {
    const p = f.p.clone().applyMatrix4(inv);
    return { label: f.label, x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2), a: +f.a.toFixed(2) };
  });
}

/** How badly a candidate frame disagrees with a reference fingerprint (lower is better). */
function mismatch(scan, cand, ref) {
  let score = Math.abs(cand.size[0] - ref.size[0]) + Math.abs(cand.size[1] - ref.size[1]);
  const mine = fingerprint(scan, cand.matrix);
  let weight = 0;
  let sum = 0;
  for (const f of ref.features) {
    const w = (WEIGHT[f.label] ?? 1) * Math.min(2, Math.sqrt(f.a));
    let best = 3;
    for (const g of mine) if (g.label === f.label) best = Math.min(best, Math.hypot(g.x - f.x, g.z - f.z));
    sum += w * best;
    weight += w;
  }
  if (weight) score += sum / weight;
  return score;
}

/**
 * This headset's room frame. With a reference (the admin's { size, features }), the candidate that matches it;
 * otherwise the shared rule: x along the longer side, turned so the features' centre lies ahead-right.
 * Returns { matrix, size, sure } or null when the scan isn't usable.
 */
export function solveRoom(scan, ref = null) {
  const room = roomFrames(scan);
  if (!room) return null;
  const { candidates } = room;
  if (ref?.size) {
    const scored = candidates.map((c) => ({ c, s: mismatch(scan, c, ref) })).sort((a, b) => a.s - b.s);
    return { matrix: scored[0].c.matrix, size: scored[0].c.size, sure: scored[1].s - scored[0].s > 0.25 };
  }
  // the shared rule (used by the admin, and by anyone before the admin's fingerprint arrives)
  const [W, D] = room.size;
  let pool = candidates;
  if (Math.abs(W - D) > 0.4) pool = candidates.filter((c) => c.size[0] >= c.size[1]);
  const weightOf = (f) => (WEIGHT[f.label] ?? 1) * f.a;
  const scored = pool.map((c) => {
    const fp = fingerprint(scan, c.matrix);
    let x = 0;
    let z = 0;
    for (const f of fp) {
      const w = weightOf(f);
      x += w * f.x;
      z += w * f.z;
    }
    return { c, angle: Math.abs(wrap(Math.atan2(z, x) - Math.PI / 4)), strength: Math.hypot(x, z) };
  }).sort((a, b) => a.angle - b.angle);
  const sure = scored[0].strength > 0.5 && (scored.length < 2 || scored[1].angle - scored[0].angle > 0.3);
  return { matrix: scored[0].c.matrix, size: scored[0].c.size, sure };
}
