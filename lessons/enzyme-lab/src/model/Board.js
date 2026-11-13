import * as THREE from 'three';
import { TEMPS, CYL } from '../data/enzymes.js';

// The class board (2.6 m wide). During the starter quiz it shows everyone's score. Otherwise it is the class
// graph: each student's volume of oxygen after 2 minutes at every temperature they tried (a dot in their
// colour) and the class mean at each temperature (joined up), so together they show the rise to an optimum
// and the fall once the enzyme is denatured.

const W = 1664;
const H = 832;
export const BOARD_W = 2.6;
const DIM = '#aab3d8';
const GOOD = '#7ee2a8';
const FONT = 'system-ui, sans-serif';
const css = (c) => `#${c.toString(16).padStart(6, '0')}`;

/** The graph of oxygen after 2 min against temperature. people: [{ color, me, r: { T: cm³ } }]. */
export function drawGraph(c, x, y, w, h, people, { size = 1, line = true } = {}) {
  const xOf = (T) => x + (w * T) / 80;
  const yOf = (v) => y + h - (h * Math.min(CYL, v)) / CYL;
  c.font = `400 ${18 * size}px ${FONT}`;
  c.fillStyle = DIM;
  c.textAlign = 'right';
  for (let v = 0; v <= CYL; v += 10) {
    c.fillStyle = 'rgba(255,255,255,0.08)';
    c.fillRect(x, yOf(v), w, 1.5 * size);
    c.fillStyle = DIM;
    c.fillText(String(v), x - 10 * size, yOf(v) + 6 * size);
  }
  c.textAlign = 'center';
  for (const T of TEMPS) c.fillText(`${T}`, xOf(T), y + h + 26 * size);
  c.fillText('temperature (°C)', x + w / 2, y + h + 54 * size);
  c.save();
  c.translate(x - 56 * size, y + h / 2);
  c.rotate(-Math.PI / 2);
  c.fillText('oxygen after 2 minutes (cm³)', 0, 0);
  c.restore();
  c.strokeStyle = 'rgba(255,255,255,0.4)';
  c.lineWidth = 2 * size;
  c.beginPath();
  c.moveTo(x, y);
  c.lineTo(x, y + h);
  c.lineTo(x + w, y + h);
  c.stroke();
  // means
  const means = TEMPS.map((T) => {
    const vals = people.map((p) => p.r[T]).filter((v) => v != null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  });
  if (line) {
    c.strokeStyle = GOOD;
    c.lineWidth = 4 * size;
    c.beginPath();
    let started = false;
    TEMPS.forEach((T, i) => {
      if (means[i] == null) return;
      if (!started) c.moveTo(xOf(T), yOf(means[i]));
      else c.lineTo(xOf(T), yOf(means[i]));
      started = true;
    });
    c.stroke();
  }
  // dots
  people.forEach((p, k) => {
    const dx = people.length > 1 ? ((k / (people.length - 1)) - 0.5) * 18 * size : 0;
    for (const T of TEMPS) {
      if (p.r[T] == null) continue;
      c.beginPath();
      c.arc(xOf(T) + dx, yOf(p.r[T]), (p.me ? 9 : 7) * size, 0, Math.PI * 2);
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
    c.fillStyle = '#ffffff';
    c.font = `700 46px ${FONT}`;
    if (v.kind === 'quiz') {
      c.fillText('Starter quiz: enzymes', 40, 66);
      const people = v.people.filter((p) => p.n);
      const rowH = Math.min(70, 660 / Math.max(1, v.people.length));
      v.people.forEach((p, i) => {
        const y = 110 + i * rowH;
        c.fillStyle = css(p.color);
        c.beginPath();
        c.arc(60, y + rowH / 2, 12, 0, Math.PI * 2);
        c.fill();
        c.font = `600 ${Math.round(rowH * 0.45)}px ${FONT}`;
        c.fillStyle = '#ffffff';
        c.fillText(p.name, 90, y + rowH * 0.62);
        const bw = 900;
        c.fillStyle = 'rgba(255,255,255,0.08)';
        c.fillRect(560, y + rowH * 0.2, bw, rowH * 0.6);
        if (p.total) {
          c.fillStyle = GOOD;
          c.fillRect(560, y + rowH * 0.2, (bw * p.score) / p.total, rowH * 0.6);
        }
        c.fillStyle = '#ffffff';
        c.textAlign = 'right';
        c.fillText(p.n ? `${p.score} / ${p.total}` : 'not started', W - 40, y + rowH * 0.62);
        c.textAlign = 'left';
      });
      if (!people.length) {
        c.font = `400 30px ${FONT}`;
        c.fillStyle = DIM;
        c.fillText('Answer the questions on your own panel.', 40, H - 60);
      }
    } else {
      c.fillText('Class results: how much oxygen in 2 minutes?', 40, 66);
      c.font = `400 26px ${FONT}`;
      c.fillStyle = DIM;
      c.fillText('Each dot is one person’s result at that temperature; the green line joins the class means.', 40, 106);
      const means = drawGraph(c, 170, 150, W - 260, 540, v.people, { size: 1.4 });
      const best = means.reduce((b, m, i) => (m != null && (b < 0 || m > means[b]) ? i : b), -1);
      if (best >= 0 && means.filter((m) => m != null).length >= 3) {
        c.font = `700 30px ${FONT}`;
        c.fillStyle = GOOD;
        c.fillText(`So far the class gets most oxygen at ${TEMPS[best]} °C.`, 40, H - 30);
      } else {
        c.font = `400 28px ${FONT}`;
        c.fillStyle = DIM;
        c.fillText('Results appear here as people read their 2-minute volumes.', 40, H - 30);
      }
    }
    this.tex.needsUpdate = true;
  }
}
