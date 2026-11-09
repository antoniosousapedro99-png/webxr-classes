import * as THREE from 'three';
import { PARTS, CASES } from '../data/parts.js';
import { powerNeeded } from '../data/rules.js';
import { CASE_POS } from './PCBuild.js';

// Pressing Power: a realistic start-up shown line by line on the monitor.
// Each problem in the build shows up the way it would in real life (beeps, black screen, shutdown…).

/** The start-up script for a build. Each step: { text, wait (s), kind?, stop?, explain? } */
export function bootScript(build) {
  const s = [];
  const P = (id) => id && PARTS[id];
  const psu = P(build.psu);
  const cpu = P(build.cpu);
  const cooler = P(build.cooler);
  const gpu = P(build.gpu);
  const ram = build.ram.filter(Boolean).map(P);
  const board = P(build.board);
  // an M.2 SATA SSD in an NVMe-only slot fits, but the motherboard can't see it
  const unseen = build.m2.filter(Boolean).map(P).filter((d) => d.iface === 'm2sata' && board && !board.m2sata);
  const drives = [...build.m2, ...build.bays].filter(Boolean).map(P).filter((d) => !unseen.includes(d));
  const stop = (text, explain) => s.push({ text, wait: 0.8, kind: 'bad', stop: true, explain });

  if (!psu) {
    stop('…nothing happens.', { title: 'No power supply', text: 'Without a power supply no electricity reaches any part, so pressing the button does nothing. Install a PSU.' });
    return s;
  }
  if (!build.board) {
    stop('The PSU clicks on… but there is nothing to power.', { title: 'No motherboard', text: 'The power supply works, but every other part connects through the motherboard. Install one first.' });
    return s;
  }
  s.push({ text: `Power supply on: 230 V AC → 12 V / 5 V / 3.3 V DC (${psu.watts} W)`, wait: 0.9, fans: true });
  if (!cpu) {
    stop('Fans spin… but nothing else happens. (CPU LED on the motherboard is lit)', { title: 'No CPU', text: 'Fans and lights get power, but with no CPU there is nothing to run the start-up program. Install a CPU.' });
    return s;
  }
  s.push({ text: `BIOS: starting ${cpu.short} (${cpu.cores} cores, up to ${cpu.ghz} GHz)`, wait: 0.9 });
  if (!cooler) {
    s.push({ text: 'CPU temperature: 45 °C', wait: 0.5, kind: 'warn' });
    s.push({ text: 'CPU temperature: 78 °C', wait: 0.5, kind: 'warn' });
    stop('CPU temperature: 100 °C — emergency shutdown!', { title: 'Overheated in seconds', text: 'A CPU turns electricity into heat. With no cooler there is nowhere for it to go, so the CPU switched itself off to avoid damage. Fit a cooler.' });
    return s;
  }
  if (!ram.length) {
    stop('BEEP… BEEP… BEEP…  (no memory detected)', { title: 'No RAM: beep code', text: 'The POST (power-on self-test) found no memory. The CPU needs RAM to hold the instructions and data it is working on, so the computer cannot start. The beeps tell a technician what is wrong when there is no picture.' });
    return s;
  }
  const gb = ram.reduce((a, r) => a + r.gb, 0);
  s.push({ text: `Memory test: ${gb} GB ${ram[0].type} OK${ram.length >= 2 ? ' (dual channel)' : ' (single channel)'}`, wait: 0.9 });
  if (!gpu && !cpu.igpu) {
    stop('The computer is running… but the screen stays black.', { title: 'No picture', text: `The ${cpu.short} has no built-in graphics and there is no graphics card, so nothing is sending a picture to the monitor. Add a graphics card.` });
    return s;
  }
  s.push({ text: gpu ? `Graphics: ${gpu.short} (PCIe x16)` : `Graphics: built into the ${cpu.short}`, wait: 0.7, screen: true });
  if (unseen.length) s.push({ text: `M.2 slot: no drive detected (${unseen[0].short} is SATA; this slot only reads NVMe)`, wait: 0.9, kind: 'warn', explain: { title: 'Drive not detected', text: `The ${unseen[0].short} has the same M.2 shape as an NVMe drive, but talks to the computer using SATA. The M.2 slot on the ${board.short} only understands NVMe, so the drive is invisible. Use an NVMe SSD, or a board whose M.2 slot supports SATA.` } });
  if (!drives.length) {
    stop('No bootable device found. Insert boot disk and press any key.', { title: 'No storage', text: 'The BIOS looked for a drive holding an operating system and found none. RAM is wiped when the power is off, so the OS must be kept on storage. Install a drive.' });
    return s;
  }
  const boot = drives.reduce((a, d) => (d.mbps > a.mbps ? d : a));
  const secs = Math.round(4 + 4000 / boot.mbps);
  s.push({ text: `Loading operating system from ${boot.short} (${boot.mbps.toLocaleString('en-GB')} MB/s) into RAM…`, wait: Math.min(2.5, 0.6 + secs / 12) });
  s.push({ text: `Desktop ready in about ${secs} s.`, wait: 0.8, kind: 'ok', desktop: true });

  // Load test
  const need = powerNeeded(build);
  s.push({ text: `Load test: running a game… system draws about ${need} W`, wait: 1.2 });
  if (psu.watts < need) {
    stop(`Power supply overloaded (${psu.watts} W < ${need} W) — sudden shutdown!`, { title: 'Not enough power', text: `At full load the parts need about ${need} W, but the power supply can only give ${psu.watts} W, so it cut out to protect itself. Choose a bigger PSU (with about 25% to spare).` });
    return s;
  }
  if (board.maxCpuW && cpu.watts > board.maxCpuW) {
    s.push({ text: `CPU power limited to ${board.maxCpuW} W by the motherboard — running slower`, wait: 1, kind: 'warn', explain: { title: 'Held back by the motherboard', text: `The ${cpu.short} wants up to ${cpu.watts} W, but the ${board.short}'s power circuits (VRMs) can only deliver ${board.maxCpuW} W. The computer works, but the CPU is held back. A big CPU needs a board with strong power delivery.` } });
  }
  if (cooler.maxW < cpu.watts) {
    s.push({ text: `CPU at 100 °C — slowing down to stay safe (thermal throttling)`, wait: 1, kind: 'warn', explain: { title: 'Running hot', text: `The ${cpu.short} makes up to ${cpu.watts} W of heat but the ${cooler.short} can only remove ${cooler.maxW} W. The CPU protects itself by slowing down, so the computer works but is slower than it should be. A bigger cooler fixes this.` } });
  } else {
    s.push({ text: `CPU stable at ${Math.round(55 + (cpu.watts / cooler.maxW) * 25)} °C, power ${need} W of ${psu.watts} W`, wait: 0.8, kind: 'ok' });
  }
  s.push({ text: 'All systems working. Press “How it works” to follow the power and data.', wait: 0, kind: 'ok', done: true });
  return s;
}

// ── "How it works": glowing dots flowing between the parts ──

const COLORS = { power: 0xffd166, data: 0x4cc9ff, image: 0x7ee2a8, heat: 0xff6b4a };

export class TourFX {
  constructor(app) {
    this.app = app;
    this.group = new THREE.Group();
    app.lab.add(this.group);
    this.flows = [];
    this.dot = new THREE.SphereGeometry(0.006, 10, 8);
  }

  clear() {
    for (const o of [...this.group.children]) this.group.remove(o);
    this.flows = [];
  }

  where(what) {
    if (what === 'screen') return this.app.explainPanel.mesh.position.clone().add(new THREE.Vector3(0, -0.1, 0));
    if (what === 'out') {
      const c = CASES[this.app.state.build.case];
      return CASE_POS.clone().add(new THREE.Vector3(c.w / 2 + 0.15, c.anchor[1] - 0.06, 0));
    }
    return this.app.pc.locate(what);
  }

  show(step) {
    this.clear();
    for (const [a, b, kind] of step.flows) {
      const from = this.where(a);
      const to = this.where(b);
      if (!from || !to) continue;
      const mid = from.clone().add(to).multiplyScalar(0.5).add(new THREE.Vector3(0, 0, 0.12));
      const curve = new THREE.QuadraticBezierCurve3(from, mid, to);
      const mat = new THREE.MeshBasicMaterial({ color: COLORS[kind], toneMapped: false });
      const dots = [];
      for (let i = 0; i < 10; i++) {
        const d = new THREE.Mesh(this.dot, mat);
        d.userData.t = i / 10;
        this.group.add(d);
        dots.push(d);
      }
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(30)),
        new THREE.LineBasicMaterial({ color: COLORS[kind], transparent: true, opacity: 0.35 }));
      this.group.add(line);
      this.flows.push({ curve, dots });
    }
    for (const what of step.highlight) {
      const p = this.where(what);
      if (!p) continue;
      const glow = new THREE.Mesh(new THREE.SphereGeometry(0.05, 20, 14),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.15, depthWrite: false, blending: THREE.AdditiveBlending }));
      glow.position.copy(p);
      glow.userData.pulse = true;
      this.group.add(glow);
    }
  }

  update(dt) {
    for (const f of this.flows) {
      for (const d of f.dots) {
        d.userData.t = (d.userData.t + dt * 0.35) % 1;
        d.position.copy(f.curve.getPoint(d.userData.t));
      }
    }
    const s = 1 + 0.25 * Math.sin(performance.now() / 250);
    for (const o of this.group.children) if (o.userData.pulse) o.scale.setScalar(s);
  }
}
