import * as THREE from 'three';
import { TYPES, SOURCES, ABSORBERS, HALF_LIFE, verdictText } from '../data/radiation.js';

// The class board (2.6 m wide). While the class explores it shows the teacher's Geiger counter in big
// numbers (what is in the holder, which absorber) next to a table of alpha, beta and gamma. During the
// half-life experiment it shows the teacher's decay graph. For the plenary it collects everyone's verdicts:
// for each source, how many said alpha, beta, gamma or a mix, and (once the teacher reveals them) the answers.

const W = 1664;
const H = 832;
export const BOARD_W = 2.6;
const GOOD = '#7ee2a8';
const DIM = '#aab3d8';
const FONT = 'system-ui, sans-serif';
const SHORT = {
  Alpha: { what: 'A helium nucleus (2p + 2n)', stop: 'Paper (or skin)' },
  Beta: { what: 'A fast electron', stop: 'Aluminium (a few mm)' },
  Gamma: { what: 'An electromagnetic wave', stop: 'Thick lead: only partly' },
};
const css = (c) => `#${c.toString(16).padStart(6, '0')}`;

const rr = (c, x, y, w, h, r) => {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
};

/** A decay graph: counts in each 10 s against time, with the half-life marked when `mark`. */
export function drawDecay(c, x, y, w, h, points, { size = 1, mark = false } = {}) {
  const maxT = Math.max(300, ...points.map((p) => p.t));
  const maxC = Math.max(100, ...points.map((p) => p.c)) * 1.1;
  c.fillStyle = 'rgba(255,255,255,0.05)';
  c.fillRect(x, y, w, h);
  c.strokeStyle = 'rgba(255,255,255,0.35)';
  c.lineWidth = 2 * size;
  c.beginPath();
  c.moveTo(x, y);
  c.lineTo(x, y + h);
  c.lineTo(x + w, y + h);
  c.stroke();
  c.font = `400 ${16 * size}px ${FONT}`;
  c.fillStyle = DIM;
  c.textAlign = 'center';
  for (let t = 0; t <= maxT; t += 60) {
    const px = x + (w * t) / maxT;
    c.fillRect(px, y + h, 1.5 * size, 6 * size);
    c.fillText(`${t}`, px, y + h + 22 * size);
  }
  c.fillText('time (s)', x + w / 2, y + h + 44 * size);
  c.textAlign = 'right';
  const step = maxC > 400 ? 100 : maxC > 200 ? 50 : 20;
  for (let k = 0; k <= maxC; k += step) {
    const py = y + h - (h * k) / maxC;
    c.fillText(`${k}`, x - 8 * size, py + 5 * size);
    c.fillStyle = 'rgba(255,255,255,0.07)';
    c.fillRect(x, py, w, 1);
    c.fillStyle = DIM;
  }
  c.save();
  c.translate(x - 52 * size, y + h / 2);
  c.rotate(-Math.PI / 2);
  c.textAlign = 'center';
  c.fillText('counts in 10 s', 0, 0);
  c.restore();
  c.textAlign = 'left';
  if (mark && points.length) {
    const c0 = points[0].c;
    for (const [k, col] of [[0.5, '#ffd166'], [0.25, '#ffb38a']]) {
      const py = y + h - (h * c0 * k) / maxC;
      const px = x + (w * (points[0].t + HALF_LIFE * (k === 0.5 ? 1 : 2))) / maxT;
      c.setLineDash([8 * size, 6 * size]);
      c.strokeStyle = col;
      c.beginPath();
      c.moveTo(x, py);
      c.lineTo(px, py);
      c.lineTo(px, y + h);
      c.stroke();
      c.setLineDash([]);
    }
  }
  c.fillStyle = '#52c7ff';
  for (const p of points) {
    c.beginPath();
    c.arc(x + (w * p.t) / maxT, y + h - (h * p.c) / maxC, 6 * size, 0, Math.PI * 2);
    c.fill();
  }
}

export class Board {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = W;
    this.canvas.height = H;
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.group = new THREE.Group();
    const h = (BOARD_W * H) / W;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(BOARD_W, h), new THREE.MeshBasicMaterial({ map: this.tex, toneMapped: false }));
    const frame = new THREE.Mesh(new THREE.BoxGeometry(BOARD_W + 0.06, h + 0.06, 0.02), new THREE.MeshStandardMaterial({ color: 0x2a3560, roughness: 0.6 }));
    frame.position.z = -0.012;
    this.group.add(frame, face);
    this.key = '';
  }

  draw(v) {
    const key = JSON.stringify(v);
    if (key === this.key) return;
    this.key = key;
    const c = this.canvas.getContext('2d');
    c.fillStyle = '#10162c';
    c.fillRect(0, 0, W, H);
    c.textBaseline = 'alphabetic';
    c.textAlign = 'left';
    if (v.kind === 'results') this.drawResults(c, v);
    else if (v.kind === 'halflife') this.drawHalfLife(c, v);
    else this.drawCounter(c, v);
    this.tex.needsUpdate = true;
  }

  title(c, text, note) {
    c.fillStyle = '#ffffff';
    c.font = `700 46px ${FONT}`;
    c.fillText(text, 40, 66);
    if (note) {
      c.font = `600 28px ${FONT}`;
      c.fillStyle = '#9aa8ff';
      c.textAlign = 'right';
      c.fillText(note, W - 40, 62);
      c.textAlign = 'left';
    }
  }

  drawCounter(c, v) {
    const k = v.counter;
    this.title(c, `${v.who ? `${v.who}’s` : 'The'} Geiger counter`);
    // the display
    rr(c, 40, 100, 620, 330, 24);
    c.fillStyle = '#132416';
    c.fill();
    c.fillStyle = '#9dff9d';
    c.font = `600 34px ui-monospace, Consolas, monospace`;
    c.fillText(k.label, 70, 150);
    c.font = `700 200px ui-monospace, Consolas, monospace`;
    c.textAlign = 'right';
    c.fillText(String(k.value), 630, 360);
    c.textAlign = 'left';
    c.font = `600 30px ${FONT}`;
    c.fillStyle = '#ffffff';
    c.fillText(k.holder ? `In the holder: ${SOURCES[k.holder].name}` : 'Nothing in the holder: background only', 40, 480);
    c.fillStyle = DIM;
    c.fillText(`Absorber: ${ABSORBERS[k.absorber].name}${k.clip ? '' : ' · probe out of its clip'}`, 40, 522);
    c.font = `400 26px ${FONT}`;
    c.fillText('Each click is one count: one particle or ray detected.', 40, 600);
    c.fillText('Background radiation is always there: measure it first.', 40, 638);

    // the three kinds
    const x0 = 720;
    const cols = [x0, x0 + 230, x0 + 530];
    c.font = `700 26px ${FONT}`;
    c.fillStyle = '#9aa8ff';
    ['', 'Stopped by', 'Ionising'].forEach((h, i) => c.fillText(h, cols[i], 128));
    Object.values(TYPES).forEach((t, i) => {
      const y = 190 + i * 180;
      c.fillStyle = css(t.color);
      c.font = `700 64px ${FONT}`;
      c.fillText(t.sym, x0, y + 30);
      c.font = `700 30px ${FONT}`;
      c.fillText(t.name, x0 + 60, y + 18);
      c.font = `400 22px ${FONT}`;
      c.fillStyle = DIM;
      c.fillText(SHORT[t.name].what, x0, y + 70);
      c.fillText(`Range: ${t.range}`, x0, y + 104);
      c.font = `600 26px ${FONT}`;
      c.fillStyle = '#ffffff';
      c.fillText(SHORT[t.name].stop, cols[1], y + 18);
      c.fillText(t.ionising, cols[2], y + 18);
    });
  }

  drawHalfLife(c, v) {
    this.title(c, `${v.who ? `${v.who}’s` : 'The'} half-life experiment: protactinium-234m`, v.points.length ? `${v.points.length} counts` : '');
    drawDecay(c, 150, 120, W - 220, 560, v.points, { size: 1.6, mark: v.mark });
    c.font = `400 28px ${FONT}`;
    c.fillStyle = DIM;
    c.fillText('The half-life is the time it takes for the count rate to fall to half. How long does it take to halve again?', 40, 810);
  }

  drawResults(c, v) {
    this.title(c, 'Class results: what does each source give off?', v.revealed ? 'Answers revealed' : `${v.people} ${v.people === 1 ? 'person' : 'people'}`);
    const ids = v.rows.map((r) => r.id);
    const n = ids.length;
    const rowH = Math.min(62, 700 / Math.max(1, n));
    v.rows.forEach((r, i) => {
      const y = 100 + i * rowH;
      c.font = `600 ${Math.round(rowH * 0.45)}px ${FONT}`;
      c.fillStyle = '#ffffff';
      c.fillText(SOURCES[r.id].name, 40, y + rowH * 0.62);
      let x = 520;
      const total = r.tally.reduce((a, [, k]) => a + k, 0);
      if (!total) {
        c.fillStyle = DIM;
        c.font = `400 ${Math.round(rowH * 0.38)}px ${FONT}`;
        c.fillText('no verdicts yet', x, y + rowH * 0.6);
      }
      for (const [verdict, k] of r.tally) {
        const right = v.revealed && verdict === SOURCES[r.id].answer;
        const label = `${verdictText(verdict)}: ${k}`;
        c.font = `700 ${Math.round(rowH * 0.4)}px ${FONT}`;
        const w = c.measureText(label).width + 30;
        rr(c, x, y + rowH * 0.12, w, rowH * 0.76, 12);
        c.fillStyle = right ? '#2f8a5c' : v.revealed ? '#3a2633' : '#283361';
        c.fill();
        c.fillStyle = '#ffffff';
        c.fillText(label, x + 15, y + rowH * 0.64);
        x += w + 12;
      }
      if (v.revealed) {
        c.textAlign = 'right';
        c.fillStyle = GOOD;
        c.font = `700 ${Math.round(rowH * 0.42)}px ${FONT}`;
        c.fillText(`✓ ${verdictText(SOURCES[r.id].answer)}`, W - 40, y + rowH * 0.62);
        c.textAlign = 'left';
      }
    });
    if (!n) {
      c.font = `400 32px ${FONT}`;
      c.fillStyle = DIM;
      c.fillText('No verdicts yet. Test the sources and record what each one gives off.', 40, 200);
    }
  }
}
