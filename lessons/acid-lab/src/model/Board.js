import * as THREE from 'three';
import { SUBSTANCES, PAPERS, paperColor, css } from '../data/acid.js';
import { drawScale } from './Sorter.js';

// The class board (about 2.6 m wide): the pH scale with the substances the teacher has placed, and the teacher's
// current test (papers and meter reading, shown big). One canvas, redrawn only
// when something on it changes.

const W = 1664;
const H = 832;
export const BOARD_W = 2.6;

const wrap = (c, text, maxW) => {
  const lines = [];
  let line = '';
  for (const word of String(text).split(' ')) {
    const t = line ? `${line} ${word}` : word;
    if (line && c.measureText(t).width > maxW) {
      lines.push(line);
      line = word;
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
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(BOARD_W, (BOARD_W * H) / W), new THREE.MeshBasicMaterial({ map: this.tex, toneMapped: false, side: THREE.DoubleSide }));
    const frame = new THREE.Mesh(new THREE.BoxGeometry(BOARD_W + 0.06, (BOARD_W * H) / W + 0.06, 0.02), new THREE.MeshStandardMaterial({ color: 0x2a3560, roughness: 0.6 }));
    frame.position.z = -0.012;
    this.group.add(frame, mesh);
    this.key = '';
  }

  /**
   * d: what the teacher (or you, solo) is doing: { sorted: [ids], test: { l, ph, red, blue, ui, m, stable }, who }.
   */
  draw(d) {
    const key = JSON.stringify(d);
    if (key === this.key) return;
    this.key = key;
    const c = this.canvas.getContext('2d');
    c.fillStyle = '#10162c';
    c.fillRect(0, 0, W, H);
    c.textBaseline = 'alphabetic';

    // ── the pH scale, with the substances placed so far
    c.fillStyle = '#ffffff';
    c.font = '700 46px system-ui, sans-serif';
    c.textAlign = 'left';
    c.fillText('The pH scale', 40, 62);
    c.font = '400 26px system-ui, sans-serif';
    c.fillStyle = '#aab3d8';
    c.fillText(d.sorted.length ? `${d.sorted.length} placed${d.who ? ` by ${d.who}` : ''}` : 'Substances appear here as they are placed', 330, 60);
    const sx = 60;
    const sw = W - 120;
    const sy = 330;
    drawScale(c, sx, sy, sw, 64, { big: true });
    const step = sw / 15;
    const rows = [];
    for (const id of [...d.sorted].sort((a, b) => SUBSTANCES[a].ph - SUBSTANCES[b].ph)) {
      const s = SUBSTANCES[id];
      if (!s) continue;
      const x = sx + (s.ph + 0.5) * step;
      c.font = '600 28px system-ui, sans-serif';
      const text = `${s.short ?? s.name} ${s.ph}`;
      const w = c.measureText(text).width + 20;
      let row = 0;
      while (rows[row] !== undefined && rows[row] > x - w / 2 - 6) row++;
      rows[row] = x + w / 2;
      const y = sy - 24 - row * 44;
      c.strokeStyle = 'rgba(255,255,255,0.5)';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(x, sy);
      c.lineTo(x, y + 6);
      c.stroke();
      rr(c, x - w / 2, y - 28, w, 36, 10);
      c.fillStyle = '#243058';
      c.fill();
      c.fillStyle = '#ffffff';
      c.textAlign = 'center';
      c.fillText(text, x, y - 2);
    }

    // ── the current test
    const ty = 500;
    c.textAlign = 'left';
    c.fillStyle = '#9aa8ff';
    c.font = '700 28px system-ui, sans-serif';
    c.fillText(d.who ? `${d.who.toUpperCase()}’S TEST` : 'CURRENT TEST', 40, ty);
    const t = d.test;
    if (!t?.l) {
      c.fillStyle = '#aab3d8';
      c.font = '400 28px system-ui, sans-serif';
      c.fillText('Dip a test paper or the pH meter in a solution to see it here.', 40, ty + 60);
    } else {
      c.fillStyle = '#ffffff';
      c.font = '700 120px system-ui, sans-serif';
      c.fillText(t.l, 44, ty + 150);
      c.font = '400 26px system-ui, sans-serif';
      c.fillStyle = '#aab3d8';
      c.fillText('solution', 40, ty + 190);
      const chip = (x, label, type) => {
        const done = t[type];
        rr(c, x, ty + 40, 150, 150, 18);
        c.fillStyle = done ? css(paperColor(type, t.ph)) : '#1b2444';
        c.fill();
        if (!done) {
          c.strokeStyle = css(PAPERS[type].dry);
          c.lineWidth = 4;
          c.stroke();
        }
        c.fillStyle = '#ffffff';
        c.font = '600 24px system-ui, sans-serif';
        c.textAlign = 'center';
        c.fillText(label, x + 75, ty + 224);
        if (!done) {
          c.fillStyle = '#6f7aa6';
          c.fillText('not yet', x + 75, ty + 124);
        }
        c.textAlign = 'left';
      };
      chip(300, 'Red litmus', 'red');
      chip(500, 'Blue litmus', 'blue');
      chip(700, 'Indicator', 'ui');
      // meter
      rr(c, 960, ty + 40, 440, 150, 18);
      c.fillStyle = '#0b1f16';
      c.fill();
      c.fillStyle = t.m == null ? '#3d6b55' : t.stable ? '#7dffb0' : '#e9f5c9';
      c.font = '700 104px ui-monospace, Menlo, Consolas, monospace';
      c.textAlign = 'center';
      c.fillText(t.m == null ? '--.--' : t.m.toFixed(t.stable ? 2 : 1), 1180, ty + 152);
      c.font = '600 24px system-ui, sans-serif';
      c.fillStyle = '#ffffff';
      c.fillText(t.m == null ? 'pH meter' : t.stable ? 'pH meter · stable' : 'pH meter · settling…', 1180, ty + 224);
      c.textAlign = 'left';
    }

    this.tex.needsUpdate = true;
  }
}
