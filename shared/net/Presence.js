import * as THREE from 'three';
import { connect } from './transport.js';
import { makeLabel } from '../ui/labels.js';

// Shared sessions: everyone keeps their own models, and sees everyone else working beside them.
//
//  • Each person's lab is a "desk". Other people's desks appear side by side next to yours
//    (if you see someone on your right, they see you on their left).
//  • On each desk you see that person's avatar (head, body, hands, name) and a live copy of their
//    work, built by the lesson from the state they share (lesson.netState / lesson.createReplica).
//  • Everything is sent relative to the sender's own lab, so it lines up whatever room they're in.

const COLORS = [0x5b8cff, 0xff8a5c, 0x3ccf91, 0xffc94d, 0xb48cff, 0xff6b9a, 0x4cc9ff, 0xe0e070];
const SEAT_GAP = 1.75; // metres between desks
const POSE_HZ = 15;

export function sessionFromURL() {
  const p = new URLSearchParams(location.search);
  const code = p.get('session');
  return code ? { code: code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8), net: p.get('net') || 'p2p' } : null;
}

export function myName() {
  try {
    return localStorage.getItem('webxr-classes:name') || 'Guest';
  } catch {
    return 'Guest';
  }
}

const hashColor = (id) => COLORS[[...id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) % COLORS.length];
const q3 = (v) => Math.round(v * 1000) / 1000;

export class Presence {
  constructor(app, { lessonId, code, net }) {
    this.app = app;
    this.code = code;
    this.name = myName();
    this.status = 'connecting';
    this.peers = new Map();
    this.poseClock = 0;
    this.stateClock = 0;
    this.lastState = '';
    this.sinceFull = 0;
    connect(net, `${lessonId}-${code}`)
      .then((t) => this.start(t))
      .catch((e) => {
        this.status = 'failed';
        this.error = e.message;
        app.refresh();
      });
  }

  start(t) {
    this.t = t;
    this.selfId = t.selfId;
    this.status = 'connected';
    this.helloCh = t.channel('hello');
    this.poseCh = t.channel('pose');
    this.stateCh = t.channel('state');
    t.onPeerJoin((id) => {
      this.ensure(id);
      this.helloCh.send({ name: this.name }, id);
      this.sendState(true, id);
      this.app.refresh();
    });
    t.onPeerLeave((id) => this.remove(id));
    this.helloCh.onMessage((d, id) => {
      const p = this.ensure(id);
      p.name = String(d.name ?? 'Guest').slice(0, 24);
      p.tag.removeFromParent();
      p.tag.userData.dispose?.();
      p.tag = this.nameTag(p.name, p.color);
      p.avatar.add(p.tag);
      this.app.refresh();
    });
    this.poseCh.onMessage((d, id) => {
      this.ensure(id).pose = d;
    });
    this.stateCh.onMessage((d, id) => {
      const p = this.ensure(id);
      try {
        p.replica?.apply(d);
      } catch (e) {
        console.warn('Could not show a colleague’s work', e);
      }
    });
    this.app.refresh();
  }

  // ───────────── people ─────────────

  get people() {
    return [{ name: `${this.name} (you)`, color: hashColor(this.selfId ?? 'me') }, ...[...this.peers.values()].map((p) => ({ name: p.name, color: p.color }))];
  }

  nameTag(name, color) {
    const tag = makeLabel(name, { height: 0.045, size: 44, color: `#${color.toString(16).padStart(6, '0')}` });
    tag.userData.isTag = true;
    return tag;
  }

  ensure(id) {
    if (this.peers.has(id)) return this.peers.get(id);
    const color = hashColor(id);
    const root = new THREE.Group(); // their desk, placed beside yours
    this.app.lab.add(root);
    const avatar = new THREE.Group();
    root.add(avatar);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.5 });
    const head = new THREE.Group();
    head.add(new THREE.Mesh(new THREE.SphereGeometry(0.095, 24, 16), mat));
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.06, 0.06), new THREE.MeshStandardMaterial({ color: 0x15171c, roughness: 0.2, metalness: 0.4 }));
    visor.position.set(0, 0.01, -0.08);
    head.add(visor);
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.35, 6, 16), new THREE.MeshStandardMaterial({ color, roughness: 0.6, transparent: true, opacity: 0.55 }));
    const hands = [0, 1].map(() => {
      const h = new THREE.Group();
      h.add(new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 12), mat));
      h.visible = false;
      return h;
    });
    avatar.add(head, body, ...hands);
    const p = { id, name: 'Guest', color, root, avatar, head, body, hands, tag: null, pose: null, held: [null, null], heldKey: ['', ''] };
    p.tag = this.nameTag(p.name, color);
    avatar.add(p.tag);
    p.replica = this.app.createReplica?.() ?? null;
    if (p.replica) root.add(p.replica.group);
    this.peers.set(id, p);
    this.layout();
    return p;
  }

  remove(id) {
    const p = this.peers.get(id);
    if (!p) return;
    this.app.lab.remove(p.root);
    this.peers.delete(id);
    this.layout();
    this.app.refresh();
  }

  /** Desks side by side, in the same order for everyone. */
  layout() {
    const ids = [this.selfId, ...this.peers.keys()].sort();
    const me = ids.indexOf(this.selfId);
    for (const p of this.peers.values()) {
      const k = ids.indexOf(p.id) - me;
      p.root.position.set(k * SEAT_GAP, 0, Math.abs(k) * 0.25);
      p.root.rotation.y = -Math.sign(k) * 0.3; // turned a little towards you
    }
  }

  // ───────────── sending ─────────────

  myPose() {
    const app = this.app;
    const cam = app.viewCamera();
    const pos = app.lab.worldToLocal(cam.getWorldPosition(new THREE.Vector3()));
    const q = app.lab.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(cam.getWorldQuaternion(new THREE.Quaternion()));
    const hands = [null, null];
    if (app.presenting) {
      for (const c of app.interaction.controllers) {
        const src = c.userData.inputSource;
        if (c.userData.mode !== 'tracked-pointer' || !src) continue;
        const i = src.handedness === 'left' ? 0 : 1;
        hands[i] = app.lab.worldToLocal(app.interaction.sourcePoint(c)).toArray().map(q3);
      }
    }
    return { h: [...pos.toArray(), q.x, q.y, q.z, q.w].map(q3), hands, held: app.netHolding ?? null };
  }

  sendState(force = false, to) {
    if (!this.stateCh || !this.app.netState) return;
    const s = this.app.netState();
    const json = JSON.stringify(s);
    if (!force && json === this.lastState) return;
    this.lastState = json;
    this.stateCh.send(s, to);
  }

  // ───────────── every frame ─────────────

  update(dt) {
    if (this.status !== 'connected') return;
    if (this.peers.size) {
      this.poseClock += dt;
      if (this.poseClock > 1 / POSE_HZ) {
        this.poseClock = 0;
        this.poseCh.send(this.myPose());
      }
      this.stateClock += dt;
      this.sinceFull += dt;
      if (this.stateClock > 0.3) {
        this.stateClock = 0;
        this.sendState(this.sinceFull > 4); // resend everything now and then, in case a message was lost
        if (this.sinceFull > 4) this.sinceFull = 0;
      }
    }
    const k = Math.min(1, dt * 12);
    for (const p of this.peers.values()) {
      p.replica?.update?.(dt);
      const pose = p.pose;
      if (!pose) continue;
      const [x, y, z, qx, qy, qz, qw] = pose.h;
      p.head.position.lerp(new THREE.Vector3(x, y, z), k);
      p.head.quaternion.slerp(new THREE.Quaternion(qx, qy, qz, qw), k);
      // body hangs below the head, turned the way they face
      const yaw = new THREE.Euler().setFromQuaternion(p.head.quaternion, 'YXZ').y;
      p.body.position.set(p.head.position.x, p.head.position.y - 0.42, p.head.position.z);
      p.body.rotation.set(0, yaw, 0);
      p.tag.position.set(p.head.position.x, p.head.position.y + 0.17, p.head.position.z);
      pose.hands.forEach((h, i) => {
        const hand = p.hands[i];
        hand.visible = !!h;
        if (h) hand.position.lerp(new THREE.Vector3(...h), hand.visible ? k : 1);
      });
      // what they're holding, shown in the hand that holds it (or by their head on a screen)
      const key = pose.held ? JSON.stringify(pose.held) : '';
      const hi = pose.hands[1] ? 1 : pose.hands[0] ? 0 : -1;
      if (key !== p.heldKey[0]) {
        p.heldKey[0] = key;
        p.held[0]?.removeFromParent();
        p.held[0] = key ? this.heldObject(p, pose.held) : null;
      }
      if (p.held[0]) {
        const anchor = hi >= 0 ? p.hands[hi] : p.head;
        if (p.held[0].parent !== anchor) anchor.add(p.held[0]);
        p.held[0].position.set(0, hi >= 0 ? 0 : -0.25, hi >= 0 ? 0 : -0.3);
      }
    }
  }

  heldObject(p, held) {
    const custom = p.replica?.heldObject?.(held);
    const g = new THREE.Group();
    if (custom) g.add(custom);
    else g.add(new THREE.Mesh(new THREE.SphereGeometry(0.02, 12, 8), new THREE.MeshBasicMaterial({ color: p.color, toneMapped: false })));
    if (held.label) {
      const tag = makeLabel(held.label, { height: 0.026, size: 40 });
      tag.position.y = 0.07;
      g.add(tag);
    }
    return g;
  }

  leave() {
    this.t?.leave();
  }
}
