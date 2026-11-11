import * as THREE from 'three';
import { connect } from './transport.js';

// Shared sessions: everyone keeps their own models, and sees everyone else working beside them.
//
//  • Each person's lab is a "desk". Other people's desks appear side by side next to yours
//    (if you see someone on your right, they see you on their left).
//  • On each desk you see a live copy of that person's work, built by the lesson from the state they
//    share (lesson.netState / lesson.createReplica). There are no avatars: in mixed reality you see the
//    real people.
//  • Everything is sent relative to the sender's own lab, so it lines up whatever room they're in.
//  • Same-room sessions (?room=same): every headset lines itself up with the room from its room scan
//    (RoomAlign.js), so each desk appears where that person really is.

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

/** Two room frames within 1 cm and about half a degree: don't move anything. */
function nearlySame(a, b) {
  const pa = new THREE.Vector3().setFromMatrixPosition(a);
  const pb = new THREE.Vector3().setFromMatrixPosition(b);
  const xa = new THREE.Vector3(1, 0, 0).transformDirection(a);
  const xb = new THREE.Vector3(1, 0, 0).transformDirection(b);
  return pa.distanceTo(pb) < 0.01 && xa.dot(xb) > Math.cos(0.009);
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
    this.error = null; // why it couldn't start (plain language)
    this.problem = null; // something going wrong while connected (plain language)
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
    this.connectedAt = performance.now();
    t.onProblem?.((text) => {
      if (this.peers.size) return; // already working with others: a hiccup with one more device
      this.problem = text;
      this.app.refresh();
    });
    setTimeout(() => this.app.refresh(), 20500); // "nobody found yet" help appears after 20 s
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
    // The admin (whoever opened the session) runs the class: settings for everyone ('admin') and the
    // room's fingerprint that every headset lines itself up with ('room'). Only the admin is listened to.
    this.roomRef = null;
    this.adminCh = t.channel('admin');
    this.adminCh.onMessage((d, id) => {
      if (id === this.hostId && !this.isHost) this.app.onAdmin?.(d);
    });
    this.roomCh = t.channel('room');
    this.roomCh.onMessage((d, id) => {
      if (id === this.hostId && !this.isHost) this.roomRef = d;
    });
    t.onPeerJoin((id) => {
      this.problem = null;
      this.ensure(id);
      this.helloCh.send({ name: this.name, host: this.host }, id);
      if (this.isHost) setTimeout(() => {
        this.app.onPeerJoinedWorld?.(id);
        this.app.onPeerJoinedAdmin?.(id);
      }, 300);
      this.sendState(true, id);
      this.app.refresh();
    });
    t.onPeerLeave((id) => this.remove(id));
    this.helloCh.onMessage((d, id) => {
      const p = this.ensure(id);
      p.host = !!d.host;
      p.name = String(d.name ?? 'Guest').slice(0, 24);
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
    const hostId = this.hostId;
    return [
      { id: this.selfId, plain: this.name, name: `${this.name} (you)`, you: true, host: hostId === this.selfId, room: this.sameRoom ? this.roomStatus : null, color: hashColor(this.selfId ?? 'me') },
      ...[...this.peers.values()].map((p) => ({ id: p.id, plain: p.name, name: p.name, you: false, host: hostId === p.id, room: this.sameRoom ? p.pose?.room ?? 'waiting' : null, color: p.color })),
    ];
  }

  /**
   * Where the shared room frame is in this headset's world (see RoomAlign.js), or null.
   * status: 'ok' | 'unsure' (couldn't tell which way round) | 'no-scan' (no room scan) | 'waiting'.
   */
  setRoomFrame(matrix, status) {
    this.roomStatus = status;
    if (!matrix) {
      this.clearRoom(status);
      return false;
    }
    const changed = !this.roomToWorld || !nearlySame(this.roomToWorld, matrix);
    if (changed) {
      this.roomToWorld = matrix.clone();
      this.worldToRoom = matrix.clone().invert();
    }
    return changed;
  }

  clearRoom(status = 'waiting') {
    this.roomToWorld = null;
    this.worldToRoom = null;
    this.roomStatus = status;
  }

  /** Is this colleague shown at their real place in the room? */
  aligned(p) {
    return this.sameRoom && !!this.roomToWorld && !!p.pose?.lab;
  }

  ensure(id) {
    if (this.peers.has(id)) return this.peers.get(id);
    const color = hashColor(id);
    const root = new THREE.Group(); // their desk, placed beside yours
    this.app.lab.add(root);
    const p = { id, name: 'Guest', color, root, pose: null };
    this.everJoined = true; // (so "waiting" can tell "nobody yet" from "everyone dropped out")
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
    const pos = app.lab.worldToLocal(cam.getWorldPosition(new THREE.Vector3())); // where they are (e.g. so animals steer round them)
    // Same room: where my lab really is, in the shared room frame (so others can put my desk there).
    let lab = null;
    if (this.sameRoom && this.worldToRoom) {
      const m = this.worldToRoom.clone().multiply(app.lab.matrixWorld);
      const p = new THREE.Vector3();
      const r = new THREE.Quaternion();
      m.decompose(p, r, new THREE.Vector3());
      lab = [...p.toArray(), new THREE.Euler().setFromQuaternion(r, 'YXZ').y].map(q3);
    }
    return { h: pos.toArray().map(q3), lab, room: this.sameRoom ? this.roomStatus ?? 'waiting' : null };
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
    for (const p of this.peers.values()) {
      p.replica?.update?.(dt);
      if (!p.pose) continue;
      // Same room and lined up: their desk goes where it really is.
      const real = this.aligned(p);
      if (real) this.placeAtRealDesk(p);
      else if (p.seat && p.wasReal) {
        p.root.position.copy(p.seat.pos);
        p.root.rotation.set(0, p.seat.yaw, 0);
      }
      p.wasReal = real;
    }
  }

  /** Where a colleague's head is, in world space (or null). */
  headOf(p) {
    if (!p.pose?.h) return null;
    return p.root.localToWorld(new THREE.Vector3(p.pose.h[0], p.pose.h[1], p.pose.h[2]));
  }

  leave() {
    this.t?.leave();
  }
}
