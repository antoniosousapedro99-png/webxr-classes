import * as THREE from 'three';
import { SPECIES, ORDER } from '../data/species.js';
import { makeBody } from './bodies.js';
import { rockPoint, pushOutOfRock } from './Reef.js';

// The animals swimming around the room, in "ocean" coordinates (origin = the reef, on the floor).
// One device (the host, or you when solo) simulates them; in a shared session it streams their positions,
// and everyone else just shows them — so all headsets see the same fish in the same places.

export const MOBILE = ['shark', 'barracuda', 'turtle', 'parrotfish', 'wrasse', 'clownfish', 'jelly', 'octopus', 'crab', 'cucumber', 'urchin'];
const BOUND = 2.7; // how far from the reef animals roam (m)

const rand = (a, b) => a + Math.random() * (b - a);
const ring = (r0, r1, y0, y1) => {
  const a = Math.random() * Math.PI * 2;
  const r = rand(r0, r1);
  return new THREE.Vector3(Math.cos(a) * r, rand(y0, y1), Math.sin(a) * r);
};

export class Sea {
  constructor(root, reef, overrides, handler) {
    this.root = root;
    this.reef = reef;
    this.overrides = overrides;
    this.handler = handler;
    this.agents = new Map();
    this.nextId = 1;
    this.time = 0;
    this.schoolTarget = {};
  }

  // ───────────── creating / removing animals ─────────────

  spawn(sp, id = this.nextId++, pos = null) {
    const body = makeBody(sp, this.overrides, SPECIES[sp].length);
    body.traverse((o) => {
      if (o.isMesh || o.isInstancedMesh) Object.assign(o.userData, { handler: this.handler, species: sp, tapOnly: true });
    });
    const a = { id, sp, body, pos: pos ?? this.startPos(sp), vel: new THREE.Vector3(), target: null, yaw: Math.random() * 6, phase: Math.random() * 10, net: null };
    a.target = this.newTarget(a);
    body.position.copy(a.pos);
    this.root.add(body);
    this.agents.set(id, a);
    return a;
  }

  despawn(id) {
    const a = this.agents.get(id);
    if (!a) return;
    this.root.remove(a.body);
    this.agents.delete(id);
  }

  /** Match the number of each animal to its population (host / solo only). */
  setPopulations(pop, removed) {
    for (const sp of MOBILE) {
      const base = SPECIES[sp].count;
      const want = removed.includes(sp) ? 0 : Math.max(0, Math.min(base * 2, Math.round(base * pop[sp])));
      const have = [...this.agents.values()].filter((a) => a.sp === sp);
      for (let i = have.length; i < want; i++) this.spawn(sp);
      for (let i = want; i < have.length; i++) this.despawn(have[i].id);
    }
  }

  startPos(sp) {
    if (sp === 'shark') return ring(1.9, 1.9, 1.2, 1.3); // starts on its patrol circle
    return this.newTarget({ sp });
  }

  newTarget(a) {
    switch (a.sp) {
      case 'shark': return null; // circles
      case 'barracuda': return ring(1.3, 2.5, 0.9, 1.8);
      case 'turtle': return ring(1.1, 2.4, 0.5, 1.6);
      case 'parrotfish': {
        const t = this.schoolTarget.parrotfish;
        if (!t || Math.random() < 0.3) this.schoolTarget.parrotfish = pushOutOfRock(ring(0.7, 1.1, 0.25, 0.9));
        return this.schoolTarget.parrotfish.clone().add(new THREE.Vector3(rand(-0.15, 0.15), rand(-0.08, 0.08), rand(-0.15, 0.15)));
      }
      case 'wrasse': return pushOutOfRock(rockPoint(5.2, 0.7).multiplyScalar(1.15).add(new THREE.Vector3(rand(-0.1, 0.1), rand(-0.05, 0.08), rand(-0.1, 0.1))));
      case 'clownfish': return this.reef.anemonePos.clone().add(new THREE.Vector3(rand(-0.09, 0.09), rand(0.06, 0.16), rand(-0.09, 0.09)));
      case 'jelly': return ring(0.9, 2.4, 0.8, 2.2);
      case 'octopus': return rockPoint(rand(0, Math.PI * 2), rand(0.3, 1.2));
      case 'crab': return ring(0.85, 1.05, 0, 0);
      case 'cucumber': return ring(1.0, 1.6, 0, 0);
      case 'urchin': return rockPoint(rand(0, Math.PI * 2), rand(1.25, 1.45)).multiplyScalar(1.02);
      default: return ring(1, 2, 0.5, 1.5);
    }
  }

  // ───────────── simulation (host / solo) ─────────────

  /** heads: positions (ocean coordinates) of everyone's head — animals keep out of people's faces. */
  simulate(dt, energy = 1, heads = []) {
    this.time += dt;
    this.heads = heads;
    const t = this.time;
    for (const a of this.agents.values()) {
      const s = { shark: 0.45, barracuda: 0.16, turtle: 0.2, parrotfish: 0.22, wrasse: 0.1, clownfish: 0.06, jelly: 0.05, octopus: 0.04, crab: 0.05, cucumber: 0.008, urchin: 0 }[a.sp] * energy;
      if (a.sp === 'shark') {
        a.angle = (a.angle ?? Math.random() * 6) + (dt * s) / 1.9;
        const r = 1.9 + Math.sin(t * 0.13 + a.id) * 0.4;
        a.pos.set(Math.cos(a.angle) * r, 1.25 + Math.sin(t * 0.3 + a.id) * 0.25, Math.sin(a.angle) * r);
        a.vel.set(-Math.sin(a.angle), 0, Math.cos(a.angle)).multiplyScalar(s);
        this.avoidPeople(a, 0.9);
        continue;
      }
      if (a.sp === 'urchin') {
        a.pos.copy(a.target);
        continue;
      }
      if (a.sp === 'octopus') {
        // creep over the rock surface
        a.pos.lerp(a.target, Math.min(1, dt * s * 2));
        pushOutOfRock(a.pos).multiplyScalar(0.99);
        if (a.pos.distanceTo(a.target) < 0.05) a.target = this.newTarget(a);
        a.vel.copy(a.target).sub(a.pos).setLength(0.01);
        continue;
      }
      const to = a.target.clone().sub(a.pos);
      if (to.length() < 0.08 || Math.random() < dt * 0.05) {
        a.target = this.newTarget(a);
        continue;
      }
      const desired = to.setLength(s);
      if (a.sp === 'jelly') desired.y += (Math.sin(t * 2.2 + a.phase) > 0.6 ? 0.06 : -0.01); // pulse up, sink a little
      a.vel.lerp(desired, Math.min(1, dt * 1.5));
      a.pos.addScaledVector(a.vel, dt);
      if (!['crab', 'cucumber'].includes(a.sp)) pushOutOfRock(a.pos);
      else a.pos.y = 0;
      const h = Math.hypot(a.pos.x, a.pos.z);
      if (h > BOUND) a.pos.multiplyScalar(BOUND / h);
      a.pos.y = Math.max(a.sp === 'crab' || a.sp === 'cucumber' ? 0 : 0.15, Math.min(2.4, a.pos.y));
      if (!['crab', 'cucumber', 'clownfish'].includes(a.sp)) this.avoidPeople(a, SPECIES[a.sp].length > 0.8 ? 0.8 : 0.45);
    }
  }

  /** Swim around people: never closer than `clear` metres to anyone's head (bigger animals keep further away). */
  avoidPeople(a, clear) {
    for (const h of this.heads ?? []) {
      // treat a person as a vertical capsule from the floor to their head
      const p = new THREE.Vector3(h.x, Math.min(Math.max(a.pos.y, 0), h.y), h.z);
      const d = a.pos.distanceTo(p);
      if (d < clear) {
        const away = a.pos.clone().sub(p);
        if (away.lengthSq() < 1e-6) away.set(1, 0, 0);
        a.pos.addScaledVector(away.normalize(), clear - d);
        if (a.target && a.target.distanceTo(p) < clear) a.target = this.newTarget(a);
      }
    }
  }

  /** Compact state for the network: [id, species index, x, y, z, yaw]. */
  serialize() {
    const q = (v) => Math.round(v * 100) / 100;
    return [...this.agents.values()].map((a) => [a.id, ORDER.indexOf(a.sp), q(a.pos.x), q(a.pos.y), q(a.pos.z), q(this.heading(a))]);
  }

  heading(a) {
    return a.vel.lengthSq() > 1e-8 ? Math.atan2(a.vel.x, a.vel.z) : a.yaw;
  }

  /** Clients: show the animals the host sent. */
  apply(list) {
    const seen = new Set();
    for (const [id, si, x, y, z, yaw] of list) {
      seen.add(id);
      let a = this.agents.get(id);
      if (!a) a = this.spawn(ORDER[si], id, new THREE.Vector3(x, y, z));
      a.net = { pos: new THREE.Vector3(x, y, z), yaw };
    }
    for (const id of [...this.agents.keys()]) if (!seen.has(id)) this.despawn(id);
  }

  // ───────────── drawing (everyone) ─────────────

  draw(dt, remote) {
    this.time += remote ? dt : 0;
    const t = this.time;
    for (const a of this.agents.values()) {
      if (remote && a.net) {
        a.vel.copy(a.net.pos).sub(a.pos).multiplyScalar(1 / Math.max(dt, 0.001));
        a.pos.lerp(a.net.pos, Math.min(1, dt * 8));
        a.yaw += Math.atan2(Math.sin(a.net.yaw - a.yaw), Math.cos(a.net.yaw - a.yaw)) * Math.min(1, dt * 6);
      } else if (!remote) {
        const target = this.heading(a);
        a.yaw += Math.atan2(Math.sin(target - a.yaw), Math.cos(target - a.yaw)) * Math.min(1, dt * 4);
      }
      a.body.position.copy(a.pos);
      if (a.sp === 'octopus' || a.sp === 'urchin') {
        // sit on the rock, facing out
        const n = a.pos.clone().normalize();
        a.body.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
        a.body.rotateY(a.yaw);
      } else {
        a.body.rotation.set(a.sp === 'jelly' ? -0.3 : -a.vel.y * 0.8, a.yaw, 0, 'YXZ');
      }
      a.body.userData.animate?.(t + a.phase, Math.min(2, a.vel.length() * 4 + 0.3));
    }
  }

  /** Where a species is right now (ocean coordinates), for food-web threads. */
  anchor(sp) {
    let best = null;
    for (const a of this.agents.values()) if (a.sp === sp && (!best || a.pos.y > best.y)) best = a.pos;
    return best ? best.clone().add(new THREE.Vector3(0, SPECIES[sp].length * 0.2, 0)) : this.reef.anchor(sp);
  }

  count(sp) {
    let n = 0;
    for (const a of this.agents.values()) if (a.sp === sp) n++;
    return n;
  }
}
