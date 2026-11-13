import { FIELD } from '../data/micro.js';

// What you see through the eyepiece. Each sample is a "tile" drawn in code (cells, nuclei, chloroplasts…)
// that repeats across the slide, with every labellable structure recorded at its position in micrometres.
// The view is a circle of the field of view for the objective in use, blurred by how far it is from focus.
// Pond water also has living organisms swimming across it.

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A tile: W × H µm drawn at R px per µm; features: [{ type, x, y, r }] in µm. */
function makeTile(W, H, R, bg, draw) {
  const c = document.createElement('canvas');
  c.width = Math.round(W * R);
  c.height = Math.round(H * R);
  const x = c.getContext('2d');
  x.fillStyle = bg;
  x.fillRect(0, 0, c.width, c.height);
  x.scale(R, R);
  const features = [];
  // draw everything three times across each edge so the tile repeats seamlessly
  const wrap = (fn) => { for (const dx of [-W, 0, W]) for (const dy of [-H, 0, H]) { x.save(); x.translate(dx, dy); fn(); x.restore(); } };
  draw(x, features, wrap);
  return { canvas: c, W, H, R, features };
}

const ellipse = (x, cx, cy, rx, ry, rot = 0) => { x.beginPath(); x.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2); };

const GEN = {
  onion() {
    return makeTile(1200, 420, 2, '#f1e3b0', (x, f, wrap) => {
      const r = rng(11);
      for (let row = 0; row < 6; row++) {
        const y0 = row * 70;
        const off = (row % 2) * 150;
        for (let k = 0; k < 4; k++) {
          const x0 = off + k * 300;
          const nx = x0 + 40 + r() * 220;
          const ny = y0 + 14 + r() * 42;
          wrap(() => {
            x.fillStyle = '#e8c878';
            x.fillRect(x0, y0, 300, 70);
            x.fillStyle = '#f6e6b4';
            x.fillRect(x0 + 8, y0 + 8, 284, 54);
            for (let g = 0; g < 30; g++) { x.fillStyle = 'rgba(160,110,30,0.25)'; x.fillRect(x0 + 4 + ((g * 37) % 292), y0 + 3 + ((g * 13) % 64), 2, 2); }
            x.strokeStyle = '#7d5216';
            x.lineWidth = 4;
            x.strokeRect(x0, y0, 300, 70);
            ellipse(x, nx, ny, 15, 11);
            x.fillStyle = '#8a5a12';
            x.fill();
            ellipse(x, nx + 3, ny - 2, 4, 3);
            x.fillStyle = '#4e3008';
            x.fill();
          });
          f.push({ type: 'nucleus', x: nx % 1200, y: ny, r: 16 });
          f.push({ type: 'cytoplasm', x: (nx + (nx - x0 > 150 ? -32 : 32)) % 1200, y: ny, r: 14 });
          f.push({ type: 'vacuole', x: (x0 + 150) % 1200, y: y0 + 35, r: 30 });
          for (let s = 0; s < 300; s += 30) { f.push({ type: 'cell wall', x: (x0 + s) % 1200, y: y0, r: 7 }); f.push({ type: 'cell wall', x: (x0 + s) % 1200, y: y0 + 70, r: 7 }); }
          f.push({ type: 'cell wall', x: x0 % 1200, y: y0 + 35, r: 7 });
        }
      }
    });
  },
  cheek() {
    return makeTile(800, 800, 2, '#eef3fa', (x, f, wrap) => {
      const r = rng(23);
      const cells = [];
      while (cells.length < 11) {
        const c = { x: r() * 800, y: r() * 800, s: 30 + r() * 12 };
        if (cells.every((o) => Math.hypot(o.x - c.x, o.y - c.y) > 70)) cells.push(c);
      }
      for (const c of cells) {
        const pts = [];
        for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2 + r() * 0.3; const d = c.s * (0.8 + r() * 0.35); pts.push([c.x + Math.cos(a) * d, c.y + Math.sin(a) * d]); }
        const n = { x: c.x + (r() - 0.5) * c.s * 0.4, y: c.y + (r() - 0.5) * c.s * 0.4 };
        const bact = r() < 0.5 ? { x: pts[2][0] + 6, y: pts[2][1] + 4 } : null;
        wrap(() => {
          x.beginPath();
          pts.forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py)));
          x.closePath();
          x.fillStyle = 'rgba(172,200,240,0.85)';
          x.fill();
          x.strokeStyle = '#3e6fc4';
          x.lineWidth = 1.4;
          x.stroke();
          for (let g = 0; g < 25; g++) { x.fillStyle = 'rgba(60,100,190,0.3)'; x.fillRect(c.x + (r() - 0.5) * c.s, c.y + (r() - 0.5) * c.s, 1, 1); }
          ellipse(x, n.x, n.y, 5, 4.2);
          x.fillStyle = '#1d3f8f';
          x.fill();
          if (bact) for (let b = 0; b < 14; b++) { ellipse(x, bact.x + ((b * 7) % 11) - 5, bact.y + ((b * 5) % 9) - 4, 0.9, 0.6); x.fillStyle = '#23409a'; x.fill(); }
        });
        f.push({ type: 'nucleus', x: n.x, y: n.y, r: 6 });
        f.push({ type: 'cytoplasm', x: (n.x + pts[0][0]) / 2, y: (n.y + pts[0][1]) / 2, r: 9 });
        f.push({ type: 'cytoplasm', x: (n.x + pts[5][0]) / 2, y: (n.y + pts[5][1]) / 2, r: 9 });
        for (const [px, py] of pts) f.push({ type: 'cell membrane', x: px, y: py, r: 6 });
        if (bact) f.push({ type: 'bacteria', x: bact.x, y: bact.y, r: 8 });
      }
    });
  },
  pondweed() {
    return makeTile(440, 280, 2, '#e3f2cf', (x, f, wrap) => {
      const r = rng(37);
      for (let row = 0; row < 8; row++) {
        const y0 = row * 35;
        const off = (row % 2) * 55;
        for (let k = 0; k < 4; k++) {
          const x0 = off + k * 110;
          const chl = [];
          for (let i = 0; i < 26; i++) {
            const side = r();
            const cx = side < 0.4 ? x0 + 6 + r() * 98 : side < 0.8 ? x0 + 6 + r() * 98 : x0 + (r() < 0.5 ? 6 : 104);
            const cy = side < 0.4 ? y0 + 5 : side < 0.8 ? y0 + 30 : y0 + 6 + r() * 23;
            chl.push([cx, cy, r() * 3]);
          }
          wrap(() => {
            x.fillStyle = '#d8eec0';
            x.fillRect(x0, y0, 110, 35);
            x.fillStyle = '#eef8e2';
            x.fillRect(x0 + 8, y0 + 8, 94, 19);
            x.strokeStyle = '#5c8a3a';
            x.lineWidth = 2.2;
            x.strokeRect(x0, y0, 110, 35);
            for (const [cx, cy, a] of chl) { ellipse(x, cx, cy, 3.2, 2.2, a); x.fillStyle = '#2f8f2f'; x.fill(); }
          });
          for (const [cx, cy] of chl) f.push({ type: 'chloroplast', x: cx % 440, y: cy, r: 4 });
          f.push({ type: 'vacuole', x: (x0 + 55) % 440, y: y0 + 17, r: 9 });
          f.push({ type: 'cytoplasm', x: (x0 + 20) % 440, y: y0 + 9, r: 4 });
          f.push({ type: 'cytoplasm', x: (x0 + 90) % 440, y: y0 + 26, r: 4 });
          for (let s = 0; s < 110; s += 15) { f.push({ type: 'cell wall', x: (x0 + s) % 440, y: y0, r: 4 }); }
          f.push({ type: 'cell wall', x: x0 % 440, y: y0 + 17, r: 4 });
        }
      }
    });
  },
  blood() {
    return makeTile(400, 400, 2, '#f8e8ec', (x, f, wrap) => {
      const r = rng(53);
      const wbc = [[120, 140], [300, 310]];
      const cells = [];
      for (let i = 0; i < 5000 && cells.length < 1050; i++) {
        const c = [r() * 400, r() * 400];
        if (wbc.some(([wx, wy]) => Math.hypot(wx - c[0], wy - c[1]) < 11)) continue;
        if (cells.every(([ox, oy]) => Math.hypot(ox - c[0], oy - c[1]) > 7.4)) cells.push(c);
      }
      const plates = Array.from({ length: 14 }, () => [r() * 400, r() * 400]);
      wrap(() => {
        for (const [cx, cy] of cells) {
          ellipse(x, cx, cy, 3.75, 3.75);
          x.fillStyle = '#e7909c';
          x.fill();
          ellipse(x, cx, cy, 1.6, 1.6);
          x.fillStyle = '#f5cdd2';
          x.fill();
        }
        for (const [cx, cy] of wbc) {
          ellipse(x, cx, cy, 6.5, 6.5);
          x.fillStyle = '#dccbe8';
          x.fill();
          for (const [dx, dy] of [[-2, -1.5], [1.8, -1.8], [0.5, 2]]) { ellipse(x, cx + dx, cy + dy, 2.4, 2); x.fillStyle = '#5a2a8a'; x.fill(); }
        }
        for (const [px, py] of plates) { ellipse(x, px, py, 1.1, 0.8); x.fillStyle = '#7b4c9c'; x.fill(); }
      });
      for (const [cx, cy] of cells) f.push({ type: 'red blood cell', x: cx, y: cy, r: 4 });
      for (const [cx, cy] of wbc) { f.push({ type: 'white blood cell', x: cx, y: cy, r: 7 }); f.push({ type: 'nucleus', x: cx, y: cy, r: 3.5 }); }
      for (const [px, py] of plates) f.push({ type: 'platelet', x: px, y: py, r: 2.5 });
    });
  },
  gut() {
    return makeTile(1600, 1000, 1.2, '#f7eef4', (x, f, wrap) => {
      const r = rng(71);
      const n = 6;
      const sp = 1600 / n;
      for (let i = 0; i < n; i++) {
        const cx = sp * (i + 0.5);
        const w = 150 + r() * 40;
        const top = 120 + r() * 120;
        const shape = (inset) => {
          x.beginPath();
          x.moveTo(cx - w / 2 + inset, 1000);
          x.lineTo(cx - w / 2 + inset, top + w / 2);
          x.arc(cx, top + w / 2, w / 2 - inset, Math.PI, 0);
          x.lineTo(cx + w / 2 - inset, 1000);
          x.closePath();
        };
        const nuclei = [];
        for (let y = top + 20; y < 1000; y += 13) for (const side of [-1, 1]) nuclei.push([cx + side * (w / 2 - 10), y + r() * 4]);
        const goblets = [];
        for (let k = 0; k < 6; k++) goblets.push([cx + (r() < 0.5 ? -1 : 1) * (w / 2 - 9), top + w / 2 + 40 + r() * 600]);
        const dots = Array.from({ length: 120 }, () => [cx + (r() - 0.5) * (w - 60), top + 60 + r() * (900 - top)]);
        wrap(() => {
          shape(0);
          x.fillStyle = '#efb3d3';
          x.fill();
          shape(20);
          x.fillStyle = '#e48fbd';
          x.fill();
          for (const [dx, dy] of dots) { ellipse(x, dx, dy, 2.5, 2); x.fillStyle = '#7b3c9a'; x.fill(); }
          for (const [nx, ny] of nuclei) { ellipse(x, nx, ny, 2.6, 4.5); x.fillStyle = '#5b2d8c'; x.fill(); }
          for (const [gx, gy] of goblets) { ellipse(x, gx, gy, 6, 11); x.fillStyle = '#fbf2f8'; x.fill(); x.strokeStyle = '#b77ea6'; x.lineWidth = 1; x.stroke(); }
        });
        for (let y = top + 80; y < 1000; y += 60) f.push({ type: 'villus', x: cx, y, r: w / 2 - 10 });
        for (const [nx, ny] of nuclei) f.push({ type: 'nucleus', x: nx, y: ny, r: 5 });
        for (const [dx, dy] of dots) f.push({ type: 'nucleus', x: dx, y: dy, r: 4 });
        for (const [gx, gy] of goblets) f.push({ type: 'goblet cell', x: gx, y: gy, r: 10 });
        for (let y = top + 60; y < 1000; y += 30) for (const side of [-1, 1]) f.push({ type: 'epithelium', x: cx + side * (w / 2 - 9), y, r: 11 });
      }
    });
  },
  pond() {
    return makeTile(1200, 1200, 1, '#eef5e6', (x, f, wrap) => {
      const r = rng(97);
      const strands = [];
      for (let s = 0; s < 6; s++) {
        const cells = [];
        let px = r() * 1200;
        let py = r() * 1200;
        let a = r() * Math.PI * 2;
        for (let k = 0; k < 14; k++) { cells.push([px, py, a]); px += Math.cos(a) * 32; py += Math.sin(a) * 32; a += (r() - 0.5) * 0.3; }
        strands.push(cells);
      }
      const specks = Array.from({ length: 300 }, () => [r() * 1200, r() * 1200, 1 + r() * 4]);
      wrap(() => {
        for (const [sx, sy, sr] of specks) { ellipse(x, sx, sy, sr, sr * 0.7); x.fillStyle = 'rgba(120,110,80,0.35)'; x.fill(); }
        for (const cells of strands) for (const [cx, cy, a] of cells) {
          x.save();
          x.translate(cx, cy);
          x.rotate(a);
          x.fillStyle = '#9fd18a';
          x.fillRect(-15, -7, 30, 14);
          x.strokeStyle = '#4f8a3a';
          x.lineWidth = 1.5;
          x.strokeRect(-15, -7, 30, 14);
          for (let i = -10; i <= 10; i += 5) { ellipse(x, i, ((i * 7) % 5) - 2, 2, 1.5); x.fillStyle = '#2f7f2f'; x.fill(); }
          x.restore();
        }
      });
      for (const cells of strands) for (const [cx, cy] of cells) { f.push({ type: 'algae', x: cx, y: cy, r: 16 }); f.push({ type: 'chloroplast', x: cx, y: cy, r: 6 }); }
    });
  },
};

const cache = new Map();
export function tile(id) {
  if (!cache.has(id)) {
    if (cache.size >= 3) cache.delete(cache.keys().next().value); // keep memory down on a headset
    cache.set(id, GEN[id]());
  }
  return cache.get(id);
}

/** Swimming organisms in pond water: positions (µm, around the view centre) at time t (s). */
export function organisms(t) {
  const out = [];
  for (let i = 0; i < 7; i++) {
    const r = rng(500 + i);
    const sp = 60 + r() * 80;
    const a0 = r() * Math.PI * 2;
    const turn = (r() - 0.5) * 0.4;
    const a = a0 + turn * t + Math.sin(t * 0.7 + i) * 0.4;
    // swim around a loop so they stay in the area
    const R = 150 + r() * 600;
    const phase = (sp * t) / R + r() * 6.28;
    const [ox, oy] = centre('pond');
    out.push({ x: ox + Math.cos(phase) * R * (0.6 + r() * 0.4), y: oy + Math.sin(phase * (i % 2 ? 1 : -1)) * R * 0.7, a: phase + Math.PI / 2 + (i % 2 ? 0 : Math.PI) + Math.sin(t * 2 + i) * 0.15 + a * 0, beat: t * 12 + i });
  }
  return out;
}

const FIXED = { onion: [600, 210], pondweed: [220, 140], blood: [120, 140], gut: [133, 600] };
/** Where the slide sits under the lens: on a cell, not on empty glass. */
const centre = (id) => FIXED[id] ?? (() => { const f = tile(id).features.find((x) => x.type === (id === 'cheek' ? 'nucleus' : 'algae')); return [f.x, f.y]; })();

/**
 * Draw the view through the eyepiece into a square canvas `c`.
 * p: { sample, mag, blur, t, pins: [{ label, x, y }], ready (slide on stage) }
 */
export function renderView(c, p, sharp) {
  const S = c.width;
  const x = c.getContext('2d');
  x.fillStyle = '#000000';
  x.fillRect(0, 0, S, S);
  if (!p.sample) {
    // just the light, no slide
    const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, p.light === false ? '#111' : '#fffdf2');
    g.addColorStop(1, p.light === false ? '#000' : '#e8e2c8');
    x.fillStyle = g;
    x.beginPath();
    x.arc(S / 2, S / 2, S / 2 - 4, 0, Math.PI * 2);
    x.fill();
    return;
  }
  const T = tile(p.sample);
  const field = FIELD[p.mag];
  const k = S / field; // px per µm in the view
  const [cx0, cy0] = centre(p.sample);
  // sharp image first
  sharp.width = S;
  sharp.height = S;
  const s = sharp.getContext('2d');
  const left = cx0 - field / 2;
  const top = cy0 - field / 2;
  const i0 = Math.floor(left / T.W);
  const j0 = Math.floor(top / T.H);
  for (let i = i0; i * T.W < left + field; i++) {
    for (let j = j0; j * T.H < top + field; j++) {
      s.drawImage(T.canvas, (i * T.W - left) * k, (j * T.H - top) * k, T.W * k + 0.5, T.H * k + 0.5);
    }
  }
  if (p.sample === 'pond') {
    for (const o of organisms(p.t)) {
      const ox = (o.x - left) * k;
      const oy = (o.y - top) * k;
      if (ox < -200 * k || oy < -200 * k || ox > S + 200 * k || oy > S + 200 * k) continue;
      s.save();
      s.translate(ox, oy);
      s.rotate(o.a);
      s.scale(k, k);
      // paramecium: slipper-shaped, cilia all round
      s.beginPath();
      s.ellipse(0, 0, 60, 22, 0, 0, Math.PI * 2);
      s.fillStyle = 'rgba(205,224,190,0.9)';
      s.fill();
      s.strokeStyle = '#6f8f5a';
      s.lineWidth = 2;
      s.stroke();
      if (k > 0.3) {
        s.strokeStyle = 'rgba(90,120,70,0.8)';
        s.lineWidth = 1;
        for (let i = 0; i < 40; i++) {
          const a = (i / 40) * Math.PI * 2;
          const ex = Math.cos(a) * 60;
          const ey = Math.sin(a) * 22;
          const w = Math.sin(o.beat + i * 0.6) * 0.5;
          s.beginPath();
          s.moveTo(ex, ey);
          s.lineTo(ex * 1.12 + w * 4, ey * 1.25 + w * 3);
          s.stroke();
        }
      }
      s.beginPath();
      s.ellipse(-5, 0, 14, 8, 0, 0, Math.PI * 2);
      s.fillStyle = '#8fa878';
      s.fill();
      s.restore();
    }
  }
  // then into the round view, blurred by how far it is from focus
  x.save();
  x.beginPath();
  x.arc(S / 2, S / 2, S / 2 - 4, 0, Math.PI * 2);
  x.clip();
  x.filter = p.blur > 0.4 ? `blur(${p.blur.toFixed(1)}px)` : 'none';
  x.drawImage(sharp, 0, 0);
  x.filter = 'none';
  // a soft dark edge, like a real eyepiece
  const g = x.createRadialGradient(S / 2, S / 2, S * 0.38, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.55)');
  x.fillStyle = g;
  x.fillRect(0, 0, S, S);
  // labels placed by the student
  for (const pin of p.pins ?? []) {
    const px = (pin.x - left) * k;
    const py = (pin.y - top) * k;
    if (px < 0 || py < 0 || px > S || py > S) continue;
    x.beginPath();
    x.arc(px, py, 7, 0, Math.PI * 2);
    x.fillStyle = '#ffd166';
    x.fill();
    x.strokeStyle = '#000';
    x.lineWidth = 2;
    x.stroke();
    x.font = `700 ${Math.round(S / 30)}px system-ui, sans-serif`;
    const w = x.measureText(pin.label).width + 14;
    const lx = Math.min(S - w - 6, px + 12);
    x.fillStyle = 'rgba(10,14,28,0.82)';
    x.fillRect(lx, py - S / 44 - 6, w, S / 22 + 4);
    x.fillStyle = '#ffd166';
    x.textBaseline = 'middle';
    x.fillText(pin.label, lx + 7, py - 3);
  }
  x.restore();
  // magnification
  x.font = `700 ${Math.round(S / 26)}px system-ui, sans-serif`;
  x.fillStyle = '#ffffff';
  x.textBaseline = 'top';
  x.fillText(`×${p.mag * 10}`, 14, 12);
}

/** The point on the slide (µm) at a spot in the view (0–1 from the top left), for the current sample/lens. */
export function viewToSlide(sample, mag, u, v) {
  const [cx0, cy0] = centre(sample);
  const field = FIELD[mag];
  return { x: cx0 - field / 2 + u * field, y: cy0 - field / 2 + v * field };
}

/** Is there a structure of this type at (x, y) µm, within `tol` µm? Returns its position, or null. */
export function findStructure(sample, type, x, y, tol, t = 0) {
  if (sample === 'pond' && (type === 'single-celled organism' || type === 'cilia')) {
    for (const o of organisms(t)) {
      // in the organism's own frame
      const dx = x - o.x;
      const dy = y - o.y;
      const lx = dx * Math.cos(-o.a) - dy * Math.sin(-o.a);
      const ly = dx * Math.sin(-o.a) + dy * Math.cos(-o.a);
      const e = (lx / 60) ** 2 + (ly / 22) ** 2;
      if (type === 'single-celled organism' && e < 1.1 + tol / 40) return { x: o.x, y: o.y };
      if (type === 'cilia' && e > 0.75 && e < 1.6 + tol / 30) return { x, y };
    }
    return null;
  }
  const T = tile(sample);
  const tx = ((x % T.W) + T.W) % T.W;
  const ty = ((y % T.H) + T.H) % T.H;
  let best = null;
  let bd = Infinity;
  for (const f of T.features) {
    if (f.type !== type) continue;
    for (const ox of [-T.W, 0, T.W]) for (const oy of [-T.H, 0, T.H]) {
      const d = Math.hypot(f.x + ox - tx, f.y + oy - ty);
      if (d < f.r + tol && d < bd) { bd = d; best = { x: x - tx + f.x + ox, y: y - ty + f.y + oy }; }
    }
  }
  return best;
}
