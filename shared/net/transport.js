// How headsets in a session reach each other.
//
//  • 'p2p' (default): peer-to-peer WebRTC via Trystero. Public Nostr relays are only used to
//    introduce the peers; after that, lesson data flows directly between the devices. No server needed.
//  • 'local': BroadcastChannel — tabs in the same browser on the same device (for testing: add ?net=local).
//
// Both expose the same small interface:
//   selfId, onPeerJoin(fn), onPeerLeave(fn), channel(name) → { send(data, peerId?), onMessage(fn(data, peerId)) }, leave()

import { NET_CONFIG } from './config.js';

export async function connect(kind, roomId) {
  return kind === 'local' ? new LocalTransport(roomId) : p2p(roomId);
}

async function p2p(roomId) {
  const { joinRoom, selfId } = await import('../vendor/trystero-nostr.js');
  const config = { appId: 'webxr-classes-v1' };
  if (NET_CONFIG.relayUrls?.length) config.relayConfig = { urls: NET_CONFIG.relayUrls };
  if (NET_CONFIG.turnServers?.length) config.turnConfig = NET_CONFIG.turnServers;
  const room = joinRoom(config, roomId);
  return {
    selfId,
    onPeerJoin: (fn) => { room.onPeerJoin = fn; },
    onPeerLeave: (fn) => { room.onPeerLeave = fn; },
    channel(name) {
      const a = room.makeAction(name);
      return {
        send: (data, peerId) => a.send(data, peerId ? { target: peerId } : undefined),
        onMessage: (fn) => { a.onMessage = (data, { peerId }) => fn(data, peerId); },
      };
    },
    leave: () => room.leave(),
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
