// Network settings for shared sessions. The defaults need no server at all.
//
// If a school network blocks peer-to-peer connections, add a TURN server here (a relay that
// forwards the traffic). Example:
//   turnServers: [{ urls: 'turn:turn.example.org:3478', username: 'user', credential: 'secret' }],
//
// To use your own signalling relays instead of the public Nostr ones, list them in relayUrls
// (wss:// addresses of Nostr relays).

export const NET_CONFIG = {
  relayUrls: [],
  turnServers: [],
};
