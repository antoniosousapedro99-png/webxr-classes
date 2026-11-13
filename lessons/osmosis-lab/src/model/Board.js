import * as THREE from 'three';
import { CONCENTRATIONS, POTATO_C } from '../data/osmosis.js';

// The class board (2.6 m wide). During the starter it shows the prediction question and, once revealed, how
// the class answered. Otherwise it is the class results chart: every student's mean % mass change at each
// concentration, with the class mean joined up and a zero line, so the class can see where the curve
// crosses from a gain to a loss.

const W = 1664;
const H = 832;
export const BOARD_W = 2.6;
const GOOD = '#7ee2a8';
const BAD = '#ff8a8a';
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

/** The % mass change graph: x = concentration (M), y = % change, with a zero line. */
export function drawGraph(c, x, y, w, h, people, { size = 1 } = {}) {
  const xOf = (C) => x + (w * C) / 1;
  const yRange = 32; // ±32%
  const yOf = (pct) => y + h / 2 - (h / 2) * Math.max(-1, Math.min(1, pct / yRange));
  c.font = `400 ${18 * size}px ${FONT}`;
  c.fillStyle = DIM;
  c.textAlign = 'right';
  for (let pct = -30; pct <= 30; pct += 10) {
    c.fillStyle = pct === 0 ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.08)';
    c.fillRect(x, yOf(pct), w, pct === 0 ? 2.5 * size : 1.5 * size);
    c.fillStyle = DIM;
    c.fillText(`${pct > 0 ? '+' : ''}${pct}%`, x - 10 * size, yOf(pct) + 6 * size);
  }
  c.textAlign = 'center';
  for (const C of CONCENTRATIONS) c.fillText(`${C.toFixed(2)}`, xOf(C), y + h + 26 * size);
  c.fillText('concentration (mol/dm³ salt)', x + w / 2, y + h + 54 * size);
  c.save();
  c.translate(x - 56 * size, y + h / 2);
  c.rotate(-Math.PI / 2);
  c.fillText('mass change (%)', 0, 0);
  c.restore();
  c.strokeStyle = 'rgba(255,255,255,0.4)';
  c.lineWidth = 2 * size;
  c.strokeRect(x, y, w, h);
  // means
  const means = CONCENTRATIONS.map((C) => {
    const vals = people.map((p) => p.r[C]).filter((v) => v != null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  });
  c.strokeStyle = GOOD;
  c.lineWidth = 4 * size;
  c.beginPath();
  let started = false;
  CONCENTRATIONS.forEach((C, i) => {
    if (means[i] == null) return;
    if (!started) c.moveTo(xOf(C), yOf(means[i]));
    else c.lineTo(xOf(C), yOf(means[i]));
    started = true;
  });
  c.stroke();
  people.forEach((p, k) => {
    const dx = people.length > 1 ? ((k / (people.length - 1)) - 0.5) * 16 * size : 0;
    for (const C of CONCENTRATIONS) {
      if (p.r[C] == null) continue;
      c.beginPath();
      c.arc(xOf(C) + dx, yOf(p.r[C]), (p.me ? 9 : 7) * size, 0, Math.PI * 2);
      c.fillStyle = css(p.color);
      c.fill();
      if (p.me) {
        c.lineWidth = 2.5 * size;
        c.strokeStyle = '#ffffff';
        c.stroke();
      }
    }
  });
  c.textAlign = 'left';
  return means;
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
    else this.drawGraph(c, v);
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

  drawGraph(c, v) {
    c.fillStyle = '#ffffff';
    c.font = `700 46px ${FONT}`;
    c.fillText('Class results: % mass change in each solution', 40, 66);
    c.font = `400 26px ${FONT}`;
    c.fillStyle = DIM;
    c.fillText('Each dot is one person’s mean at that concentration; the green line joins the class means.', 40, 106);
    const means = drawGraph(c, 170, 150, W - 260, 540, v.people, { size: 1.4 });
    const cross = findCrossing(means);
    c.font = `700 30px ${FONT}`;
    c.fillStyle = GOOD;
    if (cross) c.fillText(`The class’s results cross zero between ${cross[0].toFixed(2)} and ${cross[1].toFixed(2)} mol/dm³: that is about where the potato’s own concentration is.`, 40, H - 30);
    else {
      c.font = `400 28px ${FONT}`;
      c.fillStyle = DIM;
      c.fillText('Results appear here as people finish weighing their pieces.', 40, H - 30);
    }
    void POTATO_C;
  }
}

function findCrossing(means) {
  for (let i = 0; i < means.length - 1; i++) {
    if (means[i] == null || means[i + 1] == null) continue;
    if ((means[i] > 0) !== (means[i + 1] > 0)) return [CONCENTRATIONS[i], CONCENTRATIONS[i + 1]];
  }
  return null;
}
