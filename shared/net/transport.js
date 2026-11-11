// How headsets in a session reach each other.
//
//  • 'p2p' (default): peer-to-peer WebRTC via Trystero. Only devices on the same network can meet: each
//    device finds its network's public address (STUN) and that becomes part of the session's name.
//    Public Nostr relays (config.js) only introduce the devices; after that, lesson data flows directly
//    between them, inside the school network. No server of our own is needed.
//  • 'local': BroadcastChannel — tabs in the same browser on the same device (for testing: add ?net=local).
//
// Both expose the same small interface:
//   selfId, onPeerJoin(fn), onPeerLeave(fn), onProblem(fn(text)), channel(name) → { send(data, peerId?), onMessage(fn(data, peerId)) }, leave()
// connect() rejects with a plain-language Error when it can't start (e.g. the network can't be checked).

import { NET_CONFIG } from './config.js';

export async function connect(kind, roomId) {
  return kind === 'local' ? new LocalTransport(roomId) : p2p(roomId);
}

/**
 * Which network this device is on: the start of its public IPv4 address (as seen by a STUN server),
 * e.g. "203.0.113". Devices behind the same school router share it. Null if it can't be found.
 */
export async function networkKey(timeoutMs = 5000) {
  if (typeof RTCPeerConnection === 'undefined') return null;
  const pc = new RTCPeerConnection({ iceServers: NET_CONFIG.stunServers.map((urls) => ({ urls })) });
  const v4 = new Set();
  const v6 = new Set();
  return new Promise((resolve) => {
    let finished = false;
    let early = null;
    const done = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      clearTimeout(early);
      pc.close();
      const bits = Math.max(8, Math.min(32, NET_CONFIG.networkPrefix ?? 24));
      const a = [...v4].sort()[0];
      if (a) {
        const n = a.split('.').reduce((acc, x) => acc * 256 + Number(x), 0);
        const masked = Math.floor(n / 2 ** (32 - bits)) * 2 ** (32 - bits);
        resolve(`${[24, 16, 8, 0].map((sh) => Math.floor(masked / 2 ** sh) % 256).join('.')}/${bits}`);
      } else {
        const b = [...v6].sort()[0];
        resolve(b ? `${b.split(':').slice(0, 4).join(':')}::/64` : null); // IPv6: the home network part
      }
    };
    const timer = setTimeout(done, timeoutMs);
    pc.onicecandidate = (e) => {
      if (!e.candidate) return done();
      const f = e.candidate.candidate.split(' ');
      const ip = e.candidate.address ?? f[4];
      const type = e.candidate.type ?? f[7];
      if (type !== 'srflx' || !ip) return;
      if (/^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
        v4.add(ip);
        early ??= setTimeout(done, 400); // a moment more, in case another STUN server answers too
      } else if (ip.includes(':')) v6.add(ip);
    };
    pc.createDataChannel('probe');
    pc.createOffer().then((o) => pc.setLocalDescription(o)).catch(done);
  });
}

async function sha(text) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(d)].slice(0, 9).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function p2p(roomId) {
  let room = roomId;
  if (NET_CONFIG.sameNetworkOnly) {
    const key = await networkKey();
    if (!key) {
      throw new Error('Couldn’t check which network this device is on, so it can’t join a shared session. The network may block STUN (UDP port 19302 / 3478). Ask IT to allow it, or work solo.');
    }
    room = `${roomId}-${await sha(`webxr-classes|${key}`)}`; // (the address itself is never sent anywhere)
  }
  const { joinRoom, selfId } = await import('../vendor/trystero-nostr.js');
  const config = {
    appId: 'webxr-classes-v1',
    rtcConfig: { iceServers: [...NET_CONFIG.stunServers.map((urls) => ({ urls })), ...(NET_CONFIG.turnServers ?? [])] },
  };
  if (NET_CONFIG.relayUrls?.length) config.relayConfig = { urls: NET_CONFIG.relayUrls, warnOnRelayFailure: false };
  let problem = () => {};
  const r = joinRoom(config, room, {
    onJoinError: (e) => {
      console.warn('Shared session:', e.error);
      problem('Found someone, but couldn’t connect to them. The Wi-Fi may block devices from talking to each other (“client isolation”).');
    },
  });
  return {
    selfId,
    onPeerJoin: (fn) => { r.onPeerJoin = fn; },
    onPeerLeave: (fn) => { r.onPeerLeave = fn; },
    onProblem: (fn) => { problem = fn; },
    channel(name) {
      const a = r.makeAction(name);
      return {
        send: (data, peerId) => { a.send(data, peerId ? { target: peerId } : undefined)?.catch?.(() => {}); }, // (a peer that just left: nothing to do)
        onMessage: (fn) => { a.onMessage = (data, { peerId }) => fn(data, peerId); },
      };
    },
    leave: () => r.leave(),
  };
}

/** Same-device transport for testing (several tabs/windows of one browser). */
class LocalTransport {
  constructor(roomId) {
    this.selfId = Math.random().toString(36).slice(2, 10);
    this.bc = new BroadcastChannel(`webxr-classes:${roomId}`);
    this.peers = new Map(); // id → last seen
    this.handlers = {};
    this.join = () => {};
    this.leaveFn = () => {};
    this.bc.onmessage = ({ data: m }) => {
      if (m.from === this.selfId || (m.to && m.to !== this.selfId)) return;
      if (!this.peers.has(m.from)) {
        this.peers.set(m.from, Date.now());
        this.bc.postMessage({ from: this.selfId, to: m.from, kind: 'here' });
        this.join(m.from);
      }
      this.peers.set(m.from, Date.now());
      if (m.kind === 'bye') this.drop(m.from);
      if (m.kind === 'msg') this.handlers[m.channel]?.(m.data, m.from);
    };
    this.timer = setInterval(() => {
      this.bc.postMessage({ from: this.selfId, kind: 'here' });
      for (const [id, t] of this.peers) if (Date.now() - t > 6000) this.drop(id);
    }, 1500);
    window.addEventListener('pagehide', () => this.leave());
    setTimeout(() => this.bc.postMessage({ from: this.selfId, kind: 'here' }), 50);
  }

  drop(id) {
    if (this.peers.delete(id)) this.leaveFn(id);
  }

  onPeerJoin(fn) { this.join = fn; }
  onPeerLeave(fn) { this.leaveFn = fn; }
  onProblem() {}

  channel(name) {
    return {
      send: (data, peerId) => this.bc.postMessage({ from: this.selfId, to: peerId, kind: 'msg', channel: name, data }),
      onMessage: (fn) => { this.handlers[name] = fn; },
    };
  }

  leave() {
    clearInterval(this.timer);
    this.bc.postMessage({ from: this.selfId, kind: 'bye' });
  }
}
