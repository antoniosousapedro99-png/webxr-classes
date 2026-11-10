import * as THREE from 'three';

// Lining up headsets that share one real room.
//
// Each person touches the same two real points (A, then B). On its own that is only as precise as the
// touches: a couple of centimetres off at each point turns the whole frame by a few degrees, which puts
// things 15–30 cm apart a few metres away. So if the headset has scanned the room (Quest: Space Setup),
// the rough frame is snapped to the real walls:
//  • its direction is turned to match the walls exactly (rooms are mostly rectangular), and
//  • its origin moves to the wall corner behind point A (the nearest wall in −x and in −z), on the floor.
// Every headset picks the same physical corner and wall direction, so they agree to about a centimetre
// whatever their touches were. The touches only have to be roughly right (within about 25°, and the same
// two points in the same order for everyone).

const MIN_WALL = 1; // metres: ignore smaller vertical surfaces
const SNAP_MAX = THREE.MathUtils.degToRad(25); // rough direction must be this close to a wall direction
const IN_GRID = THREE.MathUtils.degToRad(6); // walls this close to the room's grid count as "square"
const UP = new THREE.Vector3(0, 1, 0);

/** Keeps the walls and floor the headset knows about (WebXR plane detection), refreshed once a second. */
export class RoomWalls {
  constructor() {
    this.walls = []; // { p: point on the wall, n: horizontal unit normal, w: width }
    this.floorY = null;
    this.last = 0;
  }

  update(frame, refSpace) {
    const planes = frame?.detectedPlanes;
    if (!planes || !refSpace) return;
    const now = performance.now();
    if (now - this.last < 1000) return;
    this.last = now;
    const walls = [];
    let floor = null;
    planes.forEach((plane) => {
      const pose = frame.getPose(plane.planeSpace, refSpace);
      if (!pose) return;
      const m = new THREE.Matrix4().fromArray(pose.transform.matrix);
      const p = new THREE.Vector3().setFromMatrixPosition(m);
      const label = plane.semanticLabel;
      if (plane.orientation === 'vertical') {
        if (label && label !== 'wall') return; // doors, windows, wall art… are on walls but smaller
        const n = UP.clone().transformDirection(m).setY(0);
        if (n.lengthSq() < 0.5) return;
        const xs = plane.polygon.map((q) => q.x);
        const zs = plane.polygon.map((q) => q.z);
        const w = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs));
        if (w >= MIN_WALL) walls.push({ p, n: n.normalize(), w });
      } else if (label === 'floor' || (!label && p.y < 0.3)) {
        floor = floor === null ? p.y : Math.min(floor, p.y);
      }
    });
    this.walls = walls;
    this.floorY = floor;
  }

  get count() {
    return this.walls.length;
  }
}

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * Snap the rough frame (origin a, x towards b) to the walls. Returns the room→world matrix, or null if the
 * walls can't be used (no room scan, an irregular room, or the touches were too far off).
 */
export function snapToWalls(a, b, room) {
  const walls = room?.walls ?? [];
  if (walls.length < 2) return null;
  const rough = Math.atan2(b.z - a.z, b.x - a.x);
  // the room's grid direction: wall normals, folded into 90° (weighted by wall width)
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
  const square = walls.filter((w) => Math.abs(wrap(4 * (Math.atan2(w.n.z, w.n.x) - grid))) / 4 < IN_GRID).reduce((s, w) => s + w.w, 0);
  if (square / total < 0.6) return null; // not a mostly-rectangular room
  const theta = grid + Math.round((rough - grid) / (Math.PI / 2)) * (Math.PI / 2);
  if (Math.abs(wrap(rough - theta)) > SNAP_MAX) return null;
  const x = new THREE.Vector3(Math.cos(theta), 0, Math.sin(theta));
  const z = new THREE.Vector3().crossVectors(x, UP); // same handedness as the touch-only frame

  // the wall behind A along an axis (or, failing that, the nearest one in front)
  const offset = (u) => {
    let behind = null;
    let ahead = null;
    for (const w of walls) {
      if (Math.abs(w.n.dot(u)) < Math.cos(IN_GRID * 1.5)) continue;
      const d = w.p.clone().sub(a).dot(u);
      if (d <= 0 && (behind === null || d > behind)) behind = d;
      if (d > 0 && (ahead === null || d < ahead)) ahead = d;
    }
    return behind ?? ahead;
  };
  const dx = offset(x);
  const dz = offset(z);
  if (dx === null || dz === null) return null; // need two perpendicular walls for a corner
  const origin = a.clone().addScaledVector(x, dx).addScaledVector(z, dz);
  origin.y = room.floorY ?? 0;
  return new THREE.Matrix4().makeBasis(x, UP, z).setPosition(origin);
}
