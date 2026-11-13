import * as THREE from 'three';
import { FACTORS, RUN } from '../data/kinetics.js';

// The class board (2.6 m wide). Starter: the prediction question and how the class answered. Otherwise: the
// class results for the factor the teacher is on — a bar for the class mean at each condition, with a dot
// for each person's result: the time to disappear (timing method: a shorter bar is a faster reaction) or the
// gas collected in 30 s (gas syringe: a taller bar is a faster reaction).

const W = 1664;
const H = 832;
export const BOARD_W = 2.6;
const GOOD = '#7ee2a8';
const DIM = '#aab3d8';
const FONT = 'system-ui, sans-serif';
const css = (c) => `#${c.toString(16).padStart(6, '0')}`;

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

/** A bar chart of one factor's results. people: [{ color, me, r: { opt: value } }]. */
export function drawChart(c, x, y, w, h, factor, people, { size = 1 } = {}) {
  const f = FACTORS[factor];
  const timing = f.method === 'timing';
  const vals = people.flatMap((p) => Object.values(p.r));
  const max = timing ? Math.max(45, ...vals) : 60;
  const yOf = (v) => y + h - (h * Math.min(max, v)) / max;
  c.font = `400 ${18 * size}px ${FONT}`;
  c.textAlign = 'right';
  const step = timing ? 10 : 10;
  for (let v = 0; v <= max; v += step) {
    c.fillStyle = 'rgba(255,255,255,0.08)';
    c.fillRect(x, yOf(v), w, 1.5 * size);
    c.fillStyle = DIM;
    c.fillText(String(v), x - 10 * size, yOf(v) + 6 * size);
  }
  c.save();
  c.translate(x - 56 * size, y + h / 2);
  c.rotate(-Math.PI / 2);
  c.textAlign = 'center';
  c.fillText(timing ? 'time to disappear (s)' : `gas in ${RUN} s (cm³)`, 0, 0);
  c.restore();
  const n = f.options.length;
  const bw = w / n;
  f.options.forEach(([opt, label], i) => {
    const cx = x + bw * (i + 0.5);
    const here = people.filter((p) => p.r[opt] != null);
    if (here.length) {
      const mean = here.reduce((a, p) => a + p.r[opt], 0) / here.length;
      c.fillStyle = 'rgba(126, 226, 168, 0.3)';
      c.fillRect(cx - bw * 0.3, yOf(mean), bw * 0.6, y + h - yOf(mean));
      c.fillStyle = GOOD;
      c.fillRect(cx - bw * 0.33, yOf(mean) - 3 * size, bw * 0.66, 6 * size);
      c.font = `700 ${26 * size}px ${FONT}`;
      c.textAlign = 'center';
      c.fillText(`${mean.toFixed(1)}`, cx, yOf(mean) - 14 * size);
      here.forEach((p, k) => {
        const dx = here.length > 1 ? ((k / (here.length - 1)) - 0.5) * bw * 0.4 : 0;
        c.beginPath();
        c.arc(cx + dx, yOf(p.r[opt]), (p.me ? 9 : 7) * size, 0, Math.PI * 2);
        c.fillStyle = css(p.color);
        c.fill();
        if (p.me) {
          c.lineWidth = 2.5 * size;
          c.strokeStyle = '#ffffff';
          c.stroke();
        }
      });
    }
    c.font = `700 ${22 * size}px ${FONT}`;
    c.fillStyle = '#ffffff';
    c.textAlign = 'center';
    c.fillText(label, cx, y + h + 30 * size);
  });
  c.fillStyle = 'rgba(255,255,255,0.4)';
  c.fillRect(x, y + h, w, 2 * size);
  c.textAlign = 'left';
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
    if (v.kind === 'predict') this.drawPredict(c, v.ch);
    else {
      const f = FACTORS[v.factor];
      c.fillStyle = '#ffffff';
      c.font = `700 46px ${FONT}`;
      c.fillText(`Class results: ${f.name.toLowerCase()}`, 40, 66);
      c.font = `400 26px ${FONT}`;
      c.fillStyle = DIM;
      wrap(c, `${f.what} ${f.method === 'timing' ? 'A shorter time means a faster reaction.' : 'More gas in the same time means a faster reaction.'}`, W - 80).slice(0, 2).forEach((l, i) => c.fillText(l, 40, 108 + i * 34));
      drawChart(c, 170, 190, W - 260, 520, v.factor, v.people, { size: 1.4 });
    }
    this.tex.needsUpdate = true;
  }

  drawPredict(c, ch) {
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
      let size = 32;
      const text = `${'ABCD'[i]}   ${o}`;
      c.font = `600 ${size}px ${FONT}`;
      while (size > 18 && c.measureText(text).width > w - 120) c.font = `600 ${--size}px ${FONT}`;
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
    c.font = `400 30px ${FONT}`;
    c.fillStyle = ch.revealed ? '#ffd166' : DIM;
    if (ch.revealed) wrap(c, ch.why, W - 80).slice(0, 4).forEach((line, i) => c.fillText(line, 40, 560 + i * 40));
    else c.fillText('Pick your prediction on your own panel.', 40, 590);
  }
}
