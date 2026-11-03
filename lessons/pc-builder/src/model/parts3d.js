import * as THREE from 'three';
import { PARTS, CASES, layoutOf } from '../data/parts.js';
import { font } from '../../../../shared/ui/CanvasPanel.js';

// Life-size 3D models of every part, built from simple shapes.
// Convention (inside the case): x = towards the back of the case, y = up, z = out of the motherboard towards you.
// Every part's origin is the point that sits on its slot.

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.2, ...extra });

function box(w, h, d, color, x = 0, y = 0, z = 0, extra) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof color === 'number' ? mat(color, extra) : color);
  m.position.set(x, y, z);
  return m;
}

/** A flat printed label (like the writing on a real part). */
function printed(text, w, h, { color = '#e8ecf5', bg = null, size = 64, weight = 700 } = {}) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = Math.max(32, Math.round((512 * h) / w));
  const g = c.getContext('2d');
  if (bg) {
    g.fillStyle = bg;
    g.fillRect(0, 0, c.width, c.height);
  }
  g.fillStyle = color;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const lines = text.split('\n');
  let s = size;
  g.font = font(s, weight);
  while (s > 12 && Math.max(...lines.map((l) => g.measureText(l).width)) > c.width * 0.92) g.font = font(--s, weight);
  lines.forEach((l, i) => g.fillText(l, c.width / 2, c.height / 2 + (i - (lines.length - 1) / 2) * s * 1.15));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, transparent: true, toneMapped: false }));
}

/** A fan: frame ring + blades that spin when the PC is on. Faces +z. */
function fan(r, color = 0x2a2f3a) {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.08, 8, 32), mat(color));
  g.add(ring);
  const blades = new THREE.Group();
  const bladeMat = mat(0x3a4152, { side: THREE.DoubleSide });
  for (let i = 0; i < 7; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(r * 0.85, r * 0.28, 0.002), bladeMat);
    b.position.set(Math.cos((i / 7) * Math.PI * 2) * r * 0.45, Math.sin((i / 7) * Math.PI * 2) * r * 0.45, 0);
    b.rotation.z = (i / 7) * Math.PI * 2;
    b.rotation.x = 0.4;
    blades.add(b);
  }
  blades.add(new THREE.Mesh(new THREE.CylinderGeometry(r * 0.25, r * 0.25, 0.006, 20).rotateX(Math.PI / 2), mat(0x1c2029)));
  blades.userData.spin = 'z';
  g.add(blades);
  return g;
}

// ── individual parts ───────────────────────────────────

export function boardMesh(id) {
  const p = PARTS[id];
  const L = layoutOf(id);
  const [bw, bh] = L.size;
  const g = new THREE.Group();
  g.add(box(bw, bh, 0.0016, p.color, -bw / 2, -bh / 2, 0));
  const dark = 0x14161c;
  // CPU socket
  g.add(box(0.05, 0.05, 0.003, 0x8a8f99, L.cpu[0], L.cpu[1], 0.0015));
  g.add(box(0.042, 0.042, 0.0035, 0x2a2d35, L.cpu[0], L.cpu[1], 0.002));
  // VRM heatsinks around the socket, rear I/O cover, chipset heatsink
  g.add(box(0.012, 0.06, 0.012, 0x5a6070, L.cpu[0] + 0.04, L.cpu[1], 0.007));
  g.add(box(0.06, 0.012, 0.012, 0x5a6070, L.cpu[0], L.cpu[1] + 0.04, 0.007));
  g.add(box(0.02, 0.07, 0.03, 0x3a3f4c, -0.012, -0.05, 0.015));
  g.add(box(0.03, 0.03, 0.008, 0x5a6070, -bw + 0.05, -bh + 0.05, 0.004));
  // RAM slots
  for (const x of L.ram) g.add(box(0.0065, 0.135, 0.008, dark, x, L.ramY, 0.004));
  // M.2 slots
  for (const [x, y] of L.m2) g.add(box(0.084, 0.024, 0.0015, 0x2c3140, x, y, 0.001));
  // PCIe x16 slot
  g.add(box(0.09, 0.0065, 0.009, dark, -0.06, L.pcieY, 0.0045));
  // SATA ports on the front edge
  g.add(box(0.008, 0.03, 0.006, dark, -bw + 0.006, -bh * 0.6, 0.003));
  // Status LED (glows when the PC is on)
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.003, 8, 6), new THREE.MeshStandardMaterial({ color: 0x103018, emissive: 0x000000 }));
  led.position.set(-bw + 0.02, -0.02, 0.003);
  led.userData.led = true;
  g.add(led);
  const label = printed(p.short.toUpperCase(), 0.07, 0.014, { color: '#c8d0e0' });
  label.position.set(-bw + 0.05, -bh + 0.015, 0.0012);
  g.add(label);
  return g;
}

export function cpuMesh(id) {
  const p = PARTS[id];
  const g = new THREE.Group();
  const intel = p.socket === 'LGA1700';
  const [w, h] = intel ? [0.0375, 0.045] : [0.04, 0.04];
  g.add(box(w, h, 0.0015, 0x2f5b3a, 0, 0, 0.00075)); // substrate
  g.add(box(w * 0.85, h * 0.75, 0.003, 0xc5c9d0, 0, 0, 0.003, { metalness: 0.8, roughness: 0.3 })); // heat spreader
  const label = printed(`${intel ? 'intel' : 'AMD'}\n${p.short.replace(/^(Ryzen|Core) /, '')}`, w * 0.8, h * 0.5, { color: '#3a3f4a' });
  label.position.z = 0.0046;
  g.add(label);
  return g;
}

export function coolerMesh(id) {
  const p = PARTS[id];
  const g = new THREE.Group();
  if (p.kind === 'stock') {
    g.add(box(0.09, 0.09, 0.028, 0x9aa0aa, 0, 0, 0.014, { metalness: 0.7 }));
    const f = fan(0.042, 0x1f232b);
    f.position.z = 0.045;
    g.add(f);
    g.add(box(0.095, 0.095, 0.012, 0x1f232b, 0, 0, 0.034));
  } else if (p.kind === 'tower') {
    g.add(box(0.045, 0.045, 0.01, 0xb87333, 0, 0, 0.005, { metalness: 0.8 })); // copper base
    for (let i = 0; i < 4; i++) g.add(box(0.005, 0.005, 0.12, 0xb87333, -0.015 + i * 0.01, 0, 0.07, { metalness: 0.8 })); // heat pipes
    const fins = box(0.05, 0.125, 0.12, 0xb8bec8, 0, 0, 0.095, { metalness: 0.7, roughness: 0.4 });
    g.add(fins);
    for (let i = 0; i < 12; i++) g.add(box(0.052, 0.126, 0.0012, 0x8a909a, 0, 0, 0.038 + i * 0.01));
    const f = fan(0.055);
    f.rotation.y = -Math.PI / 2;
    f.position.set(-0.04, 0, 0.095);
    g.add(f);
    g.add(box(0.012, 0.12, 0.12, 0x2a2f3a, -0.033, 0, 0.095));
  } else {
    const pump = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 32).rotateX(Math.PI / 2), mat(0x1f232b));
    pump.position.z = 0.017;
    g.add(pump);
    const top = printed('LIQUID', 0.04, 0.012, { color: '#7ec8ff' });
    top.position.z = 0.0325;
    g.add(top);
  }
  return g;
}

/** The radiator + tubes of the liquid cooler, in case space (from pump at `from` to the top of the case). */
export function radiatorMesh(c, from) {
  const g = new THREE.Group();
  const y = c.h / 2 - 0.03;
  g.add(box(0.27, 0.027, 0.12, 0x23272f, -0.02, y, 0));
  for (const x of [-0.085, 0.045]) {
    const f = fan(0.055);
    f.rotation.x = Math.PI / 2;
    f.position.set(x, y - 0.02, 0);
    g.add(f);
  }
  for (const dz of [-0.01, 0.01]) {
    const curve = new THREE.CatmullRomCurve3([
      from.clone().add(new THREE.Vector3(0.02, 0, 0.03 + dz)),
      new THREE.Vector3(from.x + 0.06, (from.y + y) / 2, 0.05 + dz),
      new THREE.Vector3(0.1, y - 0.01, 0.03 + dz),
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.006, 8), mat(0x15171c)));
  }
  return g;
}

export function ramMesh(id) {
  const p = PARTS[id];
  const g = new THREE.Group();
  g.add(box(0.0012, 0.133, 0.031, 0x1d5a2e, 0, 0, 0.0155)); // circuit board
  g.add(box(0.005, 0.133, 0.027, p.color, 0, 0, 0.0175, { metalness: 0.5 })); // heat spreader
  g.add(box(0.0052, 0.12, 0.004, 0xd4af37, 0, 0, 0.002, { metalness: 0.9 })); // gold contacts
  const label = printed(`${p.type}  ${p.gb} GB`, 0.1, 0.012, { color: '#ffffff' });
  label.rotation.y = -Math.PI / 2;
  label.rotation.z = Math.PI / 2;
  label.position.set(-0.0027, 0, 0.02);
  g.add(label);
  return g;
}

export function storageMesh(id) {
  const p = PARTS[id];
  const g = new THREE.Group();
  if (p.iface === 'nvme') {
    g.add(box(0.08, 0.022, 0.0012, 0x1a1c22, 0, 0, 0.0006));
    for (const x of [-0.02, 0.005]) g.add(box(0.016, 0.013, 0.0016, 0x30343e, x, 0, 0.0014));
    const l = printed('NVMe 1TB', 0.03, 0.009);
    l.position.set(0.025, 0, 0.0025);
    g.add(l);
  } else if (p.size === 2.5) {
    g.add(box(0.1, 0.007, 0.07, 0x30343e, 0, 0, 0));
    const l = printed('SSD 500GB', 0.06, 0.02);
    l.rotation.x = -Math.PI / 2;
    l.position.y = 0.0036;
    g.add(l);
  } else {
    g.add(box(0.147, 0.026, 0.102, 0x9aa0aa, 0, 0, 0, { metalness: 0.7 }));
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.001, 32), mat(0xd0d4dc, { metalness: 0.9 }));
    disc.position.y = 0.0135;
    g.add(disc);
    const l = printed('HDD 2TB', 0.05, 0.016, { color: '#2a2f3a' });
    l.rotation.x = -Math.PI / 2;
    l.position.set(0.045, 0.0136, 0.03);
    g.add(l);
  }
  return g;
}

/** Graphics card: origin at the rear bracket, card extends towards the front (-x), hangs below the slot. */
export function gpuMesh(id) {
  const p = PARTS[id];
  const g = new THREE.Group();
  const L = p.length;
  g.add(box(L, p.thick, 0.11, 0x22252d, -L / 2, -p.thick / 2, 0.06));
  g.add(box(L * 0.98, 0.002, 0.1, 0x1d5a2e, -L / 2, -0.001, 0.058)); // PCB
  g.add(box(0.004, p.thick + 0.01, 0.12, 0x9aa0aa, 0.002, -p.thick / 2, 0.06, { metalness: 0.8 })); // bracket
  g.add(box(0.07, 0.003, 0.008, 0xd4af37, -0.06, 0.001, 0.004, { metalness: 0.9 })); // PCIe contacts
  const n = p.fans;
  for (let i = 0; i < n; i++) {
    const f = fan(Math.min(0.045, (L / n) * 0.42));
    f.rotation.x = Math.PI / 2;
    f.position.set(-L * ((i + 0.5) / n), -p.thick - 0.001, 0.06);
    g.add(f);
  }
  const l = printed(p.watts > 200 ? 'GRAPHICS  ULTRA' : 'GRAPHICS', Math.min(0.12, L * 0.5), 0.018, { color: '#9fb4ff' });
  l.position.set(-L / 2, -p.thick / 2, 0.1155);
  g.add(l);
  return g;
}

export function psuMesh(id) {
  const p = PARTS[id];
  const g = new THREE.Group();
  const [w, h, d] = p.form === 'SFX' ? [0.125, 0.0635, 0.1] : [0.15, 0.086, 0.14];
  g.add(box(w, h, d, 0x1c1f26));
  const f = fan(Math.min(w, d) * 0.4);
  f.rotation.x = Math.PI / 2;
  f.position.y = -h / 2 - 0.001;
  g.add(f);
  const l = printed(`${p.watts} W`, w * 0.6, h * 0.35, { color: '#ffd166' });
  l.position.z = d / 2 + 0.0006;
  g.add(l);
  return g;
}

export function partMesh(id) {
  switch (PARTS[id].cat) {
    case 'board': return boardMesh(id);
    case 'cpu': return cpuMesh(id);
    case 'cooler': return coolerMesh(id);
    case 'ram': return ramMesh(id);
    case 'storage': return storageMesh(id);
    case 'gpu': return gpuMesh(id);
    case 'psu': return psuMesh(id);
    default: return new THREE.Group();
  }
}

// ── the case ───────────────────────────────────────────

export function caseMesh(caseId) {
  const c = CASES[caseId];
  const { w, h, d } = c;
  const g = new THREE.Group();
  const body = 0x3a4150;
  const t = 0.004;
  g.add(box(w, h, t, 0x4a5262, 0, 0, -d / 2)); // right side (motherboard tray) — lighter so parts stand out
  g.add(box(w, t, d, body, 0, h / 2, 0)); // top
  g.add(box(w, t, d, body, 0, -h / 2, 0)); // bottom
  g.add(box(t, h, d, body, w / 2, 0, 0)); // rear
  // Front panel: mesh look, with intake fans behind it
  g.add(box(t, h, d, new THREE.MeshStandardMaterial({ color: 0x3a4152, transparent: true, opacity: 0.45 }), -w / 2, 0, 0));
  const nFans = h > 0.4 ? 2 : 1;
  for (let i = 0; i < nFans; i++) {
    const f = fan(Math.min(0.06, d * 0.3));
    f.rotation.y = Math.PI / 2;
    f.position.set(-w / 2 + 0.015, h * (nFans === 2 ? (i === 0 ? 0.18 : -0.12) : 0.05), 0);
    g.add(f);
  }
  // Glass side (the side facing you) — very faint, so you can see in.
  const glass = box(w, h, 0.002, new THREE.MeshStandardMaterial({ color: 0xaad4ff, transparent: true, opacity: 0.06, depthWrite: false }), 0, 0, d / 2);
  g.add(glass);
  // Feet and rear exhaust fan
  for (const x of [-w / 2 + 0.04, w / 2 - 0.04]) g.add(box(0.03, 0.01, d * 0.9, 0x15171c, x, -h / 2 - 0.007, 0));
  if (h > 0.3) {
    const ex = fan(0.05);
    ex.rotation.y = Math.PI / 2;
    ex.position.set(w / 2 - 0.012, c.anchor[1] - 0.06, 0);
    g.add(ex);
  }
  // Drive bay cages
  for (const bay of c.bays) {
    const cage = box(bay.size === 3.5 ? 0.152 : 0.105, 0.03, d * 0.75, new THREE.MeshStandardMaterial({ color: 0x5a6070, transparent: true, opacity: 0.25 }), bay.pos[0], bay.pos[1], 0);
    g.add(cage);
  }
  // Power button on the top front
  const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.006, 24), new THREE.MeshStandardMaterial({ color: 0x2a3040, emissive: 0x000000 }));
  btn.position.set(-w / 2 + 0.04, h / 2 + 0.004, d / 4);
  btn.userData.powerButton = true;
  g.add(btn);
  const name = printed(c.short.toUpperCase(), 0.12, 0.02, { color: '#8a93ad' });
  name.position.set(-w / 2 + 0.1, -h / 2 + 0.03, d / 2 - 0.004);
  g.add(name);
  return g;
}

/** A see-through copy of a part, used to preview where it will go (green = fits, red = doesn't). */
export function ghostOf(id, ok) {
  const g = partMesh(id);
  const m = new THREE.MeshBasicMaterial({ color: ok ? 0x56d68c : 0xff5a5a, transparent: true, opacity: 0.35, depthWrite: false });
  g.traverse((o) => {
    if (o.isMesh) o.material = m;
  });
  return g;
}
