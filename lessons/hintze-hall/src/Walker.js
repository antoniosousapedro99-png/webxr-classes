import * as THREE from 'three';
import { computeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';

// Moving around the hall, in the headset and on a screen.
//  • The scanned hall itself is the floor and the walls (raycasts, made fast with a BVH).
//  • Walking follows the floor up and down stairs (steps up to STEP_UP high) and stops at walls,
//    balustrades and balcony edges (drops bigger than DROP).
//  • Teleporting jumps to any floor you point at, including the balconies.
// In the headset we never move the scene: we move the user, by offsetting the WebXR reference space.

THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

const STEP_UP = 0.45; // highest step you can walk up (m)
const DROP = 0.6; // biggest drop you can walk down (m) — bigger is a balcony edge
const RADIUS = 0.28; // how close you can get to a wall (m)
const EYE = 1.6; // eye height on a screen (m)
const MAX_FLOOR_Y = 17; // nothing above this is a floor (the roof walkways are off limits)

const yawOf = (dir) => Math.atan2(-dir.x, -dir.z); // rotation about y that turns −z (forward) towards dir

export class Walker {
  constructor(app, hall) {
    this.app = app;
    this.hall = hall;
    hall.traverse((o) => { if (o.isMesh) o.geometry.computeBoundsTree(); });
    this.rc = new THREE.Raycaster();
    this.rc.firstHitOnly = true;
    // the user's place in the hall: feet position (floor height in y) and facing
    this.origin = { x: 0, y: 0, z: 0, yaw: 0 }; // headset: where the play area's origin is in the hall
    this.desk = { x: 0, y: 1.25, z: 0, yaw: 0, pitch: 0 }; // screen: the walking camera
    this.baseRef = null;
    this.glide = null;
  }

  // ───────────── the hall as floor and walls ─────────────

  /** First hit along a ray against the hall (or null). */
  cast(from, dir, far = 100) {
    this.rc.set(from, dir);
    this.rc.far = far;
    return this.rc.intersectObject(this.hall, true)[0] ?? null;
  }

  /** The floor under (x, z), searching down from just above `nearY` (for stairs) — or from high up. */
  floorAt(x, z, nearY = null) {
    // A scanned staircase has slanted risers, so look at a few points close together and take the highest
    // surface that isn't a wall (anything more than ~80° from flat).
    const top = nearY === null ? MAX_FLOOR_Y + 1 : nearY + STEP_UP + 0.6;
    const far = nearY === null ? 40 : STEP_UP + DROP + 1.2;
    let best = null;
    for (const [ox, oz] of [[0, 0], [0.05, 0], [-0.05, 0], [0, 0.05], [0, -0.05]]) {
      const hit = this.cast(new THREE.Vector3(x + ox, top, z + oz), new THREE.Vector3(0, -1, 0), far);
      if (!hit) continue;
      const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
      if (Math.abs(n.y) > 0.17 && (best === null || hit.point.y > best)) best = hit.point.y;
    }
    return best;
  }

  /** Can you stand here? (a floor facing up, not too high, with headroom) */
  standable(point, normal) {
    if (normal.y < 0.7 || point.y > MAX_FLOOR_Y || point.y < 0.5) return false;
    const up = this.cast(point.clone().add(new THREE.Vector3(0, 0.15, 0)), new THREE.Vector3(0, 1, 0), 1.25); // room to stand (low galleries included)
    return !up;
  }

  /**
   * Try to walk from (x, z) at floor height y by (dx, dz). Slides along walls.
   * Returns the new { x, y, z } or null if you can't move at all.
   */
  step(x, y, z, dx, dz) {
    for (const [mx, mz] of [[dx, dz], [dx, 0], [0, dz]]) {
      const len = Math.hypot(mx, mz);
      if (len < 1e-5) continue;
      const dir = new THREE.Vector3(mx / len, 0, mz / len);
      // walls and balustrades: look ahead at knee and chest height
      let blocked = false;
      for (const h of [0.45, 1.1]) {
        const hit = this.cast(new THREE.Vector3(x, y + h, z), dir, len + RADIUS);
        if (hit) { blocked = true; break; }
      }
      if (blocked) continue;
      const nx = x + mx;
      const nz = z + mz;
      const f = this.floorAt(nx, nz, y);
      if (f === null || f - y > STEP_UP || y - f > DROP) continue; // too high a step, or an edge
      return { x: nx, y: f, z: nz };
    }
    return null;
  }

  // ───────────── headset ─────────────

  /** Call when the headset session starts: remember the real-world (floor) reference space. */
  startXR() {
    this.baseRef = this.app.renderer.xr.getReferenceSpace();
    this.applyOrigin();
  }

  stopXR() {
    this.baseRef = null;
  }

  /** The play area's placement in the hall, as a matrix. */
  originMatrix() {
    const o = this.origin;
    return new THREE.Matrix4().compose(new THREE.Vector3(o.x, o.y, o.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), o.yaw), new THREE.Vector3(1, 1, 1));
  }

  applyOrigin() {
    if (!this.baseRef) return;
    const inv = this.originMatrix().invert();
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    inv.decompose(p, q, new THREE.Vector3());
    const offset = this.baseRef.getOffsetReferenceSpace(new XRRigidTransform({ x: p.x, y: p.y, z: p.z }, { x: q.x, y: q.y, z: q.z, w: q.w }));
    this.app.renderer.xr.setReferenceSpace(offset);
  }

  /** Where your head is (in the hall), and where it is within your play area. */
  head() {
    const world = this.app.renderer.xr.getCamera().getWorldPosition(new THREE.Vector3());
    const local = world.clone().applyMatrix4(this.originMatrix().invert());
    return { world, local };
  }

  /** The direction you are looking, flattened. */
  facing() {
    const d = new THREE.Vector3();
    this.app.renderer.xr.getCamera().getWorldDirection(d);
    d.y = 0;
    return d.lengthSq() < 1e-6 ? new THREE.Vector3(0, 0, -1) : d.normalize();
  }

  /** Put your head above `pos` (feet on its floor), optionally facing `look`. */
  teleportXR(pos, look = null) {
    const o = this.origin;
    const { local } = this.head(); // where your head is within your play area (before we turn you)
    if (look) {
      // turn so that the way you are physically facing points at `look`
      const want = yawOf(new THREE.Vector3(look[0] - pos[0], 0, look[2] - pos[2]));
      const headYaw = yawOf(this.facing().applyAxisAngle(new THREE.Vector3(0, 1, 0), -o.yaw));
      o.yaw = want - headYaw;
    }
    const off = new THREE.Vector3(local.x, 0, local.z).applyAxisAngle(new THREE.Vector3(0, 1, 0), o.yaw);
    o.x = pos[0] - off.x;
    o.z = pos[2] - off.z;
    o.y = pos[1];
    this.applyOrigin();
  }

  /** Smooth walking (thumbstick) and turning, in the headset. */
  moveXR(forward, strafe, dt) {
    if (Math.abs(forward) < 0.15 && Math.abs(strafe) < 0.15) return;
    const speed = 1.6;
    const f = this.facing();
    const r = new THREE.Vector3(-f.z, 0, f.x);
    const d = f.multiplyScalar(forward * speed * dt).addScaledVector(r, strafe * speed * dt);
    const { world } = this.head();
    const to = this.step(world.x, this.origin.y, world.z, d.x, d.z);
    if (!to) return;
    this.origin.x += to.x - world.x;
    this.origin.z += to.z - world.z;
    this.origin.y += (to.y - this.origin.y) * 0.6; // ease onto each stair
    this.applyOrigin();
  }

  /** Turn on the spot (around your head) by `angle` radians. */
  turnXR(angle) {
    const { world } = this.head();
    const o = this.origin;
    const rel = new THREE.Vector3(o.x - world.x, 0, o.z - world.z).applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
    o.x = world.x + rel.x;
    o.z = world.z + rel.z;
    o.yaw += angle;
    this.applyOrigin();
  }

  // ───────────── screen ─────────────

  placeCamera(camera) {
    const d = this.desk;
    camera.position.set(d.x, d.y + EYE, d.z);
    camera.rotation.set(d.pitch, d.yaw, 0, 'YXZ');
  }

  teleportDesk(pos, look = null, smooth = true) {
    const d = this.desk;
    const target = { x: pos[0], y: pos[1], z: pos[2], yaw: d.yaw, pitch: d.pitch };
    if (look) {
      const dir = new THREE.Vector3(look[0] - pos[0], look[1] - (pos[1] + EYE), look[2] - pos[2]);
      target.yaw = yawOf(dir);
      target.pitch = Math.atan2(dir.y, Math.hypot(dir.x, dir.z));
    }
    if (!smooth) Object.assign(d, target);
    else this.glide = { from: { ...d }, to: target, t: 0 };
  }

  moveDesk(forward, strafe, dt) {
    if (this.glide) return;
    const d = this.desk;
    const speed = 2.2;
    const f = new THREE.Vector3(-Math.sin(d.yaw), 0, -Math.cos(d.yaw));
    const r = new THREE.Vector3(-f.z, 0, f.x);
    const v = f.multiplyScalar(forward * speed * dt).addScaledVector(r, strafe * speed * dt);
    if (v.lengthSq() < 1e-8) return;
    const to = this.step(d.x, d.y, d.z, v.x, v.z);
    if (!to) return;
    d.x = to.x;
    d.z = to.z;
    d.y += (to.y - d.y) * 0.6;
  }

  update(dt) {
    const g = this.glide;
    if (!g) return;
    g.t = Math.min(1, g.t + dt / 0.6);
    const k = g.t * g.t * (3 - 2 * g.t);
    const d = this.desk;
    for (const key of ['x', 'y', 'z', 'pitch']) d[key] = g.from[key] + (g.to[key] - g.from[key]) * k;
    d.yaw = g.from.yaw + Math.atan2(Math.sin(g.to.yaw - g.from.yaw), Math.cos(g.to.yaw - g.from.yaw)) * k;
    if (g.t >= 1) this.glide = null;
  }
}
