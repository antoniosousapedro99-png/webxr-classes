import * as THREE from 'three';
import { BALLS, SURFACES, SURFACE_IDS } from '../data/bounce.js';

// The class board (2.6 m wide). During the starter it shows the prediction question and, once revealed, how
// the class answered. Otherwise it is the class results chart: for one ball (the one the teacher has picked),
// every student's mean bounce on each surface as a coloured dot, and the class mean as a bar, so groups can
// compare and spot results that don't fit. One canvas, redrawn only when something on it changes.

const W = 1664;
const H = 832;
export const BOARD_W = 2.6;
const GOOD = '#7ee2a8';
const DIM = '#aab3d8';
const FONT = 'system-ui, sans-serif';

const wrap = (c, text, maxW) => {
  const lines = [];
  let line = '';
  for (const w of String(text).split(' ')) {
    const t = line ? `${line} ${w}` : w;
    if (line && c.measureText(t).width > maxW) {
      lines.push(line);
      line = w;
    } else line = t;
  }
  lines.push(line);
  return lines;
};
const rr = (c, x, y, w, h, r) => {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
};
const median = (a) => {
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
/** Results more than 12 percentage points from the others' median (with at least 3 results) don't fit. */
export const outlier = (v, all) => all.length >= 3 && Math.abs(v - median(all)) > 12;

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

  /** v: { ch } for a prediction, or { ball, people: [{ name, color, me, avg: { surf: % } }] } for the chart. */
  draw(v) {
    const key = JSON.stringify(v);
    if (key === this.key) return;
    this.key = key;
    const c = this.canvas.getContext('2d');
    c.fillStyle = '#10162c';
    c.fillRect(0, 0, W, H);
    c.textBaseline = 'alphabetic';
    c.textAlign = 'left';
    if (v.ch) this.drawQuestion(c, v.ch);
    else this.drawChart(c, v);
    this.tex.needsUpdate = true;
  }

  drawQuestion(c, ch) {
    c.fillStyle = '#ffffff';
    c.font = `700 46px ${FONT}`;
    c.fillText(ch.title, 40, 70);
    c.font = `600 28px ${FONT}`;
    c.fillStyle = '#9aa8ff';
    c.textAlign = 'right';
    c.fillText(`${ch.votes} answer${ch.votes === 1 ? '' : 's'}${ch.revealed ? '' : ' in'}`, W - 40, 66);
    c.textAlign = 'left';
    c.font = `400 36px ${FONT}`;
    c.fillStyle = '#e6eaff';
    wrap(c, ch.q, W - 80).slice(0, 3).forEach((line, i) => c.fillText(line, 40, 130 + i * 46));
    const w = (W - 80 - 24) / 2;
    const h = 92;
    const top = 290;
    const most = Math.max(1, ...ch.counts);
    ch.options.forEach((o, i) => {
      const x = 40 + (i % 2) * (w + 24);
      const y = top + Math.floor(i / 2) * (h + 16);
      const right = ch.revealed && i === ch.answer;
      rr(c, x, y, w, h, 16);
      c.fillStyle = right ? '#1d4a36' : '#1b2444';
      c.fill();
      if (ch.revealed && ch.counts[i]) {
        rr(c, x, y, Math.max(32, (w * ch.counts[i]) / most), h, 16);
        c.fillStyle = right ? '#2f8a5c' : '#35406e';
        c.fill();
      }
      if (right) {
        c.strokeStyle = GOOD;
        c.lineWidth = 4;
        rr(c, x, y, w, h, 16);
        c.stroke();
      }
      let size = 34;
      const text = `${'ABCD'[i]}   ${o}`;
      c.font = `600 ${size}px ${FONT}`;
      while (size > 20 && c.measureText(text).width > w - 120) c.font = `600 ${--size}px ${FONT}`;
      c.fillStyle = '#ffffff';
      c.fillText(text, x + 24, y + h / 2 + size * 0.36);
      if (ch.revealed) {
        c.font = `700 36px ${FONT}`;
        c.textAlign = 'right';
        c.fillStyle = right ? GOOD : '#ffffff';
        c.fillText(`${right ? '✓ ' : ''}${ch.counts[i]}`, x + w - 22, y + h / 2 + 13);
        c.textAlign = 'left';
      }
    });
    if (ch.revealed) {
      c.font = `400 30px ${FONT}`;
      c.fillStyle = '#ffd166';
      wrap(c, ch.why, W - 80).slice(0, 4).forEach((line, i) => c.fillText(line, 40, 560 + i * 40));
    } else {
      c.font = `400 30px ${FONT}`;
      c.fillStyle = DIM;
      c.fillText('Pick your prediction on your own panel. Then test it: drop the balls.', 40, 590);
    }
  }

  drawChart(c, v) {
    const b = BALLS[v.ball];
    c.fillStyle = '#ffffff';
    c.font = `700 46px ${FONT}`;
    c.fillText(`${b.name}: how high it bounces back on each surface`, 40, 66);
    c.font = `400 26px ${FONT}`;
    c.fillStyle = DIM;
    c.fillText('Bounce = rebound height ÷ drop height. Each dot is one person’s mean; the bar is the class mean.', 40, 106);
    // people with a mean for this ball
    const people = v.people.filter((p) => Object.keys(p.avg).length);
    const x0 = 150;
    const x1 = W - 40;
    const y0 = 740; // 0 %
    const y1 = 170; // 100 %
    const yOf = (pct) => y0 - ((y0 - y1) * Math.min(100, Math.max(0, pct))) / 100;
    c.font = `400 22px ${FONT}`;
    c.textAlign = 'right';
    for (let p = 0; p <= 100; p += 20) {
      const y = yOf(p);
      c.fillStyle = 'rgba(255,255,255,0.12)';
      c.fillRect(x0, y, x1 - x0, 2);
      c.fillStyle = DIM;
      c.fillText(`${p}%`, x0 - 14, y + 8);
    }
    const colW = (x1 - x0) / SURFACE_IDS.length;
    SURFACE_IDS.forEach((id, i) => {
      const cx = x0 + colW * (i + 0.5);
      const vals = people.filter((p) => p.avg[id] != null).map((p) => p.avg[id]);
      c.textAlign = 'center';
      c.font = `700 26px ${FONT}`;
      c.fillStyle = '#ffffff';
      c.fillText(SURFACES[id].short ?? SURFACES[id].name, cx, y0 + 40);
      c.font = `400 22px ${FONT}`;
      c.fillStyle = DIM;
      c.fillText(vals.length ? `${vals.length} result${vals.length === 1 ? '' : 's'}` : 'no results yet', cx, y0 + 70);
      if (!vals.length) return;
      const mean = vals.reduce((a, x) => a + x, 0) / vals.length;
      c.fillStyle = 'rgba(126, 226, 168, 0.28)';
      c.fillRect(cx - colW * 0.36, yOf(mean), colW * 0.72, y0 - yOf(mean));
      c.fillStyle = GOOD;
      c.fillRect(cx - colW * 0.4, yOf(mean) - 3, colW * 0.8, 6);
      c.font = `700 30px ${FONT}`;
      c.fillText(`${Math.round(mean)}%`, cx, yOf(mean) - 16);
      // dots, spread sideways so they don't hide each other
      const here = people.filter((p) => p.avg[id] != null);
      here.forEach((p, k) => {
        const val = p.avg[id];
        const dx = here.length > 1 ? ((k / (here.length - 1)) - 0.5) * colW * 0.5 : 0;
        const y = yOf(val);
        c.beginPath();
        c.arc(cx + dx, y, p.me ? 13 : 10, 0, Math.PI * 2);
        c.fillStyle = `#${p.color.toString(16).padStart(6, '0')}`;
        c.fill();
        if (p.me) {
          c.lineWidth = 3;
          c.strokeStyle = '#ffffff';
          c.stroke();
        }
        if (outlier(val, vals)) {
          c.beginPath();
          c.arc(cx + dx, y, 22, 0, Math.PI * 2);
          c.lineWidth = 3;
          c.strokeStyle = '#ffd166';
          c.stroke();
          c.font = `600 20px ${FONT}`;
          c.fillStyle = '#ffd166';
          c.fillText(`${p.name}?`, cx + dx, y + 46);
        }
      });
    });
    c.textAlign = 'left';
    if (!people.length) {
      c.font = `400 32px ${FONT}`;
      c.fillStyle = DIM;
      c.fillText(`No results for the ${b.name.toLowerCase()} yet. Drop it, read the bounce and record it.`, x0 + 30, 460);
    }
  }
}
