import * as THREE from 'three';
import { METALS, METAL_IDS, LABELS } from '../data/lithium.js';

// The class board (2.6 m wide). Starter: the prediction question and, once revealed, how the class answered.
// Otherwise: the class's verdicts for each mystery metal (how many said sodium, potassium…), and a bar chart
// of how long each metal took to react in the water, lithium to caesium — the trend down the group. Once the
// teacher reveals the answers, the true identities are shown and the bars are named.

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
    else this.drawResults(c, v);
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
      let size = 30;
      const text = `${'ABCD'[i]}   ${o}`;
      c.font = `600 ${size}px ${FONT}`;
      while (size > 16 && c.measureText(text).width > w - 120) c.font = `600 ${--size}px ${FONT}`;
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

  /** v: { revealed, people, tally: { label: [[id, n]…] }, truth: { label: id }, times: { id: seconds } } */
  drawResults(c, v) {
    c.fillStyle = '#ffffff';
    c.font = `700 46px ${FONT}`;
    c.fillText('Class results: which metal is which?', 40, 66);
    c.font = `600 28px ${FONT}`;
    c.fillStyle = '#9aa8ff';
    c.textAlign = 'right';
    c.fillText(v.revealed ? 'Answers revealed' : `${v.people} ${v.people === 1 ? 'person' : 'people'}`, W - 40, 62);
    c.textAlign = 'left';
    // verdicts
    LABELS.forEach((l, i) => {
      const y = 110 + i * 80;
      c.font = `700 40px ${FONT}`;
      c.fillStyle = '#ffffff';
      c.fillText(`Metal ${l}`, 40, y + 48);
      let x = 260;
      const tally = v.tally[l] ?? [];
      if (!tally.length) {
        c.font = `400 26px ${FONT}`;
        c.fillStyle = DIM;
        c.fillText('no answers yet', x, y + 46);
      }
      for (const [id, n] of tally) {
        const right = v.revealed && v.truth[l] === id;
        const text = `${METALS[id].name}: ${n}`;
        c.font = `700 28px ${FONT}`;
        const w = c.measureText(text).width + 30;
        rr(c, x, y + 12, w, 50, 12);
        c.fillStyle = right ? '#2f8a5c' : v.revealed ? '#3a2633' : '#283361';
        c.fill();
        c.fillStyle = '#ffffff';
        c.fillText(text, x + 15, y + 46);
        x += w + 12;
      }
      if (v.revealed) {
        c.textAlign = 'right';
        c.font = `700 30px ${FONT}`;
        c.fillStyle = GOOD;
        c.fillText(`✓ ${METALS[v.truth[l]].name}`, 820, y + 46);
        c.textAlign = 'left';
      }
    });
    // the trend: time to react in water, down the group
    const x0 = 900;
    const x1 = W - 50;
    const y0 = 720;
    const y1 = 200;
    c.font = `700 30px ${FONT}`;
    c.fillStyle = '#ffffff';
    c.fillText('Time to react in water', x0, 130);
    const ids = METAL_IDS;
    const max = Math.max(5, ...ids.map((id) => v.times[id] ?? 0));
    const bw = (x1 - x0) / ids.length;
    ids.forEach((id, i) => {
      const t = v.times[id];
      const cx = x0 + bw * (i + 0.5);
      const named = id === 'li' || v.revealed;
      if (t != null) {
        const h = ((y0 - y1) * t) / max;
        c.fillStyle = css(METALS[id].flame);
        c.fillRect(cx - bw * 0.32, y0 - h, bw * 0.64, h);
        c.font = `700 26px ${FONT}`;
        c.fillStyle = '#ffffff';
        c.textAlign = 'center';
        c.fillText(`${t.toFixed(1)} s`, cx, y0 - h - 12);
      }
      c.textAlign = 'center';
      c.font = `700 30px ${FONT}`;
      c.fillStyle = named ? '#ffffff' : DIM;
      c.fillText(named ? METALS[id].sym : '?', cx, y0 + 40);
      c.textAlign = 'left';
    });
    c.fillStyle = 'rgba(255,255,255,0.4)';
    c.fillRect(x0, y0, x1 - x0, 2);
    c.font = `400 24px ${FONT}`;
    c.fillStyle = DIM;
    c.fillText(v.revealed ? 'Down the group (Li → Cs), the reaction gets faster: reactivity increases.' : 'Bars appear in group order once the answers are revealed.', x0, y0 + 85);
  }
}
