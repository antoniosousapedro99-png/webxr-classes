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
//  • Same-room sessions (?room=same): once everyone has "lined up with the room" (touched the same two
//    real points), each desk appears where that person's lab really is, and avatars hide — you see the
//    real person through passthrough. Only their name tag and anything virtual in their hand remain.

const COLORS = [0x5b8cff, 0xff8a5c, 0x3ccf91, 0xffc94d, 0xb48cff, 0xff6b9a, 0x4cc9ff, 0xe0e070];
const SEAT_GAP = 1.75; // metres between desks
const POSE_HZ = 15;

export function sessionFromURL() {
  const p = new URLSearchParams(location.search);
  const code = p.get('session');
  return code ? { code: code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8), net: p.get('net') || 'p2p', sameRoom: p.get('room') === 'same', host: p.get('host') === '1' } : null;
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
  constructor(app, { lessonId, code, net, sameRoom = false, host = false }) {
    this.app = app;
    this.host = host; // started the session: runs the shared world (if the lesson has one)
    this.code = code;
    this.sameRoom = sameRoom;
    this.roomToWorld = null; // set once this headset has lined up with the room
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
    // A lesson with ONE shared world (e.g. the reef): the host runs it and broadcasts it ('world');
    // everyone else asks the host to change things ('ask').
    this.worldCh = t.channel('world');
    this.askCh = t.channel('ask');
    this.worldCh.onMessage((d, id) => this.app.onWorld?.(d, id));
    this.askCh.onMessage((d, id) => {
      if (this.isHost) this.app.onAsk?.(d, id);
    });
    t.onPeerJoin((id) => {
      this.ensure(id);
      this.helloCh.send({ name: this.name, host: this.host }, id);
      if (this.isHost) setTimeout(() => this.app.onPeerJoinedWorld?.(id), 300);
      this.sendState(true, id);
      this.app.refresh();
    });
    t.onPeerLeave((id) => this.remove(id));
    this.helloCh.onMessage((d, id) => {
      const p = this.ensure(id);
      p.host = !!d.host;
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
    const mark = (lined) => (this.sameRoom ? (lined ? ' ✓' : ' …') : '');
    const hostId = this.hostId;
    return [
      { name: `${this.name} (you)${mark(!!this.roomToWorld)}`, plain: this.name, you: true, host: hostId === this.selfId, lined: !!this.roomToWorld, color: hashColor(this.selfId ?? 'me') },
      ...[...this.peers.values()].map((p) => ({ name: `${p.name}${mark(!!p.pose?.lab)}`, plain: p.name, you: false, host: hostId === p.id, lined: !!p.pose?.lab, color: p.color })),
    ];
  }

  /**
   * Line up with the room from two real points touched in the same order on every headset.
   * The shared "room frame" has its origin at A, x pointing (level) towards B, y straight up.
   */
  setRoomPoints(a, b) {
    const x = new THREE.Vector3(b.x - a.x, 0, b.z - a.z);
    if (x.lengthSq() < 0.01) return false; // points too close together to give a direction
    x.normalize();
    const y = new THREE.Vector3(0, 1, 0);
    const z = new THREE.Vector3().crossVectors(x, y);
    this.roomToWorld = new THREE.Matrix4().makeBasis(x, y, z).setPosition(a);
    this.worldToRoom = this.roomToWorld.clone().invert();
    return true;
  }

  clearRoom() {
    this.roomToWorld = null;
    this.worldToRoom = null;
  }

  /** Is this colleague shown at their real place in the room? */
  aligned(p) {
    return this.sameRoom && !!this.roomToWorld && !!p.pose?.lab;
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
    avatar.visible = false; // until we know where they are
    root.add(avatar);
    // A lesson can supply its own avatar: { head, body, hands: [l, r], arms?: [l, r], desk? }
    // (desk: shown instead for someone using a computer, not a headset)
    const custom = this.app.makeAvatar?.(color);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.5 });
    const head = custom?.head ?? new THREE.Group();
    if (!custom) head.add(new THREE.Mesh(new THREE.SphereGeometry(0.095, 24, 16), mat));
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.06, 0.06), new THREE.MeshStandardMaterial({ color: 0x15171c, roughness: 0.2, metalness: 0.4 }));
    visor.position.set(0, 0.01, -0.08);
    if (!custom) head.add(visor);
    const body = custom?.body ?? new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.35, 6, 16), new THREE.MeshStandardMaterial({ color, roughness: 0.6, transparent: true, opacity: 0.55 }));
    const hands = custom?.hands ?? [0, 1].map(() => {
      const h = new THREE.Group();
      h.add(new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 12), mat));
      h.visible = false;
      return h;
    });
    for (const h of hands) h.visible = false;
    const arms = custom?.arms ?? [];
    const desk = custom?.desk ?? null;
    if (desk) { desk.visible = false; avatar.add(desk); }
    avatar.add(head, body, ...hands, ...arms);
    const p = { id, name: 'Guest', color, root, avatar, head, body, hands, arms, desk, tag: null, pose: null, held: [null, null], heldKey: ['', ''] };
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
      p.seat = { pos: new THREE.Vector3(k * SEAT_GAP, 0, Math.abs(k) * 0.25), yaw: -Math.sign(k) * 0.3 }; // turned a little towards you
      if (!this.aligned(p)) {
        p.root.position.copy(p.seat.pos);
        p.root.rotation.set(0, p.seat.yaw, 0);
      }
    }
  }

  /** Put a colleague's desk where their lab really is (same room, both lined up). */
  placeAtRealDesk(p) {
    const [x, y, z, yaw] = p.pose.lab;
    const theirLab = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(1, 1, 1));
    const world = this.roomToWorld.clone().multiply(theirLab);
    this.app.lab.updateMatrixWorld();
    const local = this.app.lab.matrixWorld.clone().invert().multiply(world);
    local.decompose(p.root.position, p.root.quaternion, new THREE.Vector3());
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
    // Same room: where my lab really is, in the shared room frame (so others can put my desk there).
    let lab = null;
    if (this.sameRoom && this.worldToRoom) {
      const m = this.worldToRoom.clone().multiply(app.lab.matrixWorld);
      const p = new THREE.Vector3();
      const r = new THREE.Quaternion();
      m.decompose(p, r, new THREE.Vector3());
      lab = [...p.toArray(), new THREE.Euler().setFromQuaternion(r, 'YXZ').y].map(q3);
    }
    return { h: [...pos.toArray(), q.x, q.y, q.z, q.w].map(q3), hands, held: app.netHolding ?? null, lab, xr: !!app.presenting };
  }

  /** Who runs the shared world: whoever started the session, or (if they left) the first by id. */
  get hostId() {
    if (!this.selfId) return null;
    const all = [{ id: this.selfId, host: this.host }, ...[...this.peers.values()].map((p) => ({ id: p.id, host: p.host }))];
    const flagged = all.filter((x) => x.host).map((x) => x.id).sort();
    return flagged[0] ?? all.map((x) => x.id).sort()[0];
  }

  get isHost() {
    return !this.selfId || this.hostId === this.selfId;
  }

  sendWorld(data, to) {
    this.worldCh?.send(data, to);
  }

  ask(data) {
    const h = this.hostId;
    if (h && h !== this.selfId) this.askCh?.send(data, h);
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
      p.avatar.visible = true;
      // Same room and lined up: their desk goes where it really is, and their body is the real one.
      const real = this.aligned(p);
      if (real) this.placeAtRealDesk(p);
      else if (p.seat && p.wasReal) {
        p.root.position.copy(p.seat.pos);
        p.root.rotation.set(0, p.seat.yaw, 0);
      }
      p.wasReal = real;
      // a lesson can hide avatars, or keep them even at people's real places (when the scene hides the real people)
      const shown = (!real || this.app.avatarsInRoom) && this.app.showAvatars !== false;
      const atDesk = !!p.desk && pose.xr === false; // on a computer: the lesson's desk avatar instead
      const body = shown && !atDesk;
      for (const c of p.head.children) c.visible = body;
      p.body.visible = body;
      const [x, y, z, qx, qy, qz, qw] = pose.h;
      p.head.position.lerp(new THREE.Vector3(x, y, z), k);
      p.head.quaternion.slerp(new THREE.Quaternion(qx, qy, qz, qw), k);
      // body hangs below the head, turned the way they face
      const yaw = new THREE.Euler().setFromQuaternion(p.head.quaternion, 'YXZ').y;
      p.body.position.set(p.head.position.x, p.head.position.y - 0.42, p.head.position.z);
      p.body.rotation.set(0, yaw, 0);
      p.tag.position.set(p.head.position.x, p.head.position.y + 0.17, p.head.position.z);
      if (p.desk) {
        p.desk.visible = shown && atDesk;
        if (p.desk.visible) {
          p.bob = (p.bob ?? Math.random() * 6) + dt;
          p.desk.position.copy(p.head.position);
          p.desk.position.y += Math.sin(p.bob * 1.6) * 0.025;
          p.desk.rotation.set(0, yaw, Math.sin(p.bob * 1.1) * 0.06);
        }
      }
      pose.hands.forEach((h, i) => {
        const hand = p.hands[i];
        hand.visible = !!h;
        hand.children[0].visible = body; // the hand ball (the real hand is visible in the same room)
        if (h) hand.position.lerp(new THREE.Vector3(...h), hand.visible ? k : 1);
        // arms reach from the shoulder to the hand
        const arm = p.arms[i];
        if (!arm) return;
        arm.visible = body && !!h;
        if (!arm.visible) return;
        const side = i === 0 ? -1 : 1;
        const shoulder = new THREE.Vector3(side * 0.17, -0.27, 0.02).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw).add(p.head.position);
        const to = hand.position.clone().sub(shoulder);
        const len = Math.max(0.05, Math.min(0.75, to.length()));
        arm.position.copy(shoulder);
        arm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.normalize());
        arm.scale.set(1, len, 1);
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
