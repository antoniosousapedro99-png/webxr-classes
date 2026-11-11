// Network settings for shared sessions. Nothing here needs a server of your own.
//
// How a session connects (see transport.js):
//  1. Each device asks a STUN server "what is my network's public address?". Devices on the same school
//     network share it, so it becomes part of the session's name: only devices on the same network can
//     find each other, even with the right code.
//  2. The devices introduce themselves through the Nostr relays below (small public message servers).
//     Only short connection notes pass through them, never lesson data.
//  3. After that, all lesson data goes directly between the devices, inside the school network.
//
// For a school web filter (e.g. Lightspeed), allow:
//  • the site itself (GitHub Pages) and cdn.jsdelivr.net (three.js and the 3D model decoders),
//  • the relays in relayUrls (secure WebSockets, port 443),
//  • the STUN servers in stunServers (UDP; usually a firewall setting rather than a web-filter one),
//  • device-to-device traffic on the Wi-Fi ("client isolation" off for the headsets' network).

export const NET_CONFIG = {
  // Only devices on the same network (same public address) can join each other's sessions.
  sameNetworkOnly: true,
  // How much of the public IPv4 address must match: 24 = the first three numbers (schools with several
  // public addresses usually have them side by side). 32 = exactly the same address.
  networkPrefix: 24,

  // Fixed, well-known relays (instead of a random pick from a long list), so a web filter only needs
  // these few addresses allowed. Each device uses all of them, so one being down doesn't matter.
  relayUrls: ['wss://nos.lol', 'wss://relay.primal.net', 'wss://nostr.mom'],

  // Finding the network's public address, and helping devices reach each other.
  stunServers: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun.cloudflare.com:3478'],

  // Only if a network blocks direct connections between devices: a TURN relay that forwards the traffic.
  // Example: [{ urls: 'turn:turn.example.org:3478', username: 'user', credential: 'secret' }]
  turnServers: [],
};
