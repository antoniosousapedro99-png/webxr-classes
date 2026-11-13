import * as THREE from 'three';
import { PARTS, SAMPLES } from '../data/micro.js';
import { renderView } from './Specimens.js';

// The class board (2.6 m wide). Starter: a labelled diagram of the microscope with the part the teacher has
// just tapped highlighted. Lab: the teacher's view down the microscope, big. Quiz: everyone's scores.

const W = 1664;
const H = 832;
export const BOARD_W = 2.6;
const DIM = '#aab3d8';
const GOOD = '#7ee2a8';
const HL = '#ffd166';
const FONT = 'system-ui, sans-serif';
const css = (c) => `#${c.toString(16).padStart(6, '0')}`;

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
    this.view = document.createElement('canvas');
    this.view.width = this.view.height = 640;
    this.sharp = document.createElement('canvas');
    this.key = '';
  }

  /** v: { kind: 'parts', part } | { kind: 'view', sample, mag, blur, t, pins, who } | { kind: 'quiz', people } */
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
    if (v.kind === 'parts') this.drawParts(c, v.part);
    else if (v.kind === 'view') {
      c.fillText(`${v.who ? `${v.who}’s` : 'The'} view down the microscope`, 40, 66);
      renderView(this.view, v, this.sharp);
      c.drawImage(this.view, 40, 100, 700, 700);
      c.font = `700 40px ${FONT}`;
      c.fillStyle = '#ffffff';
      c.fillText(v.sample ? SAMPLES[v.sample].name : 'No slide on the stage', 800, 160);
      c.font = `400 30px ${FONT}`;
      c.fillStyle = DIM;
      if (v.sample) {
        c.fillText(`Stain: ${SAMPLES[v.sample].stain}`, 800, 214);
        c.fillStyle = GOOD;
        c.font = `700 34px ${FONT}`;
        c.fillText(`Magnification: ×10 eyepiece × ×${v.mag} objective = ×${v.mag * 10}`, 800, 290);
        c.font = `400 28px ${FONT}`;
        c.fillStyle = v.blur > 1.5 ? HL : GOOD;
        c.fillText(v.blur > 1.5 ? 'Out of focus: turn the focus knobs' : 'In focus', 800, 350);
        const lines = wrap(c, SAMPLES[v.sample].about, 800);
        c.fillStyle = '#e6eaff';
        lines.slice(0, 6).forEach((l, i) => c.fillText(l, 800, 430 + i * 40));
      }
    } else {
      c.fillText('Quiz: microscopes', 40, 66);
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
        c.fillStyle = 'rgba(255,255,255,0.08)';
        c.fillRect(560, y + rowH * 0.2, 900, rowH * 0.6);
        if (p.total) {
          c.fillStyle = GOOD;
          c.fillRect(560, y + rowH * 0.2, (900 * p.score) / p.total, rowH * 0.6);
        }
        c.fillStyle = '#ffffff';
        c.textAlign = 'right';
        c.fillText(p.n ? `${p.score} / ${p.total}` : 'not started', W - 40, y + rowH * 0.62);
        c.textAlign = 'left';
      });
    }
    this.tex.needsUpdate = true;
  }

  /** A side-on diagram of a microscope with every part labelled. */
  drawParts(c, hl) {
    c.fillText('Parts of the microscope', 40, 66);
    const col = (id) => (id === hl ? HL : '#c9d1f0');
    const ox = 420;
    const oy = 780;
    const box = (id, x, y, w, h) => { c.fillStyle = col(id); c.fillRect(ox + x, oy - y - h, w, h); };
    box('base', -170, 0, 340, 50);
    box('light', -40, 50, 80, 22);
    box('arm', 90, 50, 50, 440);
    box('stage', -150, 230, 270, 22);
    box('clips', -120, 252, 60, 10);
    box('clips', 20, 252, 60, 10);
    c.fillStyle = col('coarse');
    c.beginPath();
    c.arc(ox + 115, oy - 330, 48, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = col('fine');
    c.beginPath();
    c.arc(ox + 115, oy - 210, 26, 0, Math.PI * 2);
    c.fill();
    box('objectives', -40, 290, 26, 80);
    box('objectives', -6, 300, 26, 70);
    box('objectives', 28, 310, 26, 60);
    box('nosepiece', -60, 370, 140, 34);
    c.save();
    c.translate(ox - 10, oy - 404);
    c.rotate(-0.35);
    c.fillStyle = col('eyepiece');
    c.fillRect(-28, -240, 56, 240);
    c.restore();
    // labels
    const labels = [['eyepiece', -150, 640], ['nosepiece', -320, 400], ['objectives', -320, 320], ['clips', -320, 262], ['stage', -320, 236], ['light', -320, 62], ['base', -320, 20], ['arm', 240, 480], ['coarse', 240, 330], ['fine', 240, 210]];
    c.font = `600 30px ${FONT}`;
    for (const [id, x, y] of labels) {
      c.fillStyle = id === hl ? HL : '#ffffff';
      c.textAlign = x < 0 ? 'right' : 'left';
      c.fillText(PARTS[id].name, ox + x, oy - y);
    }
    c.textAlign = 'left';
    if (hl) {
      c.font = `700 40px ${FONT}`;
      c.fillStyle = HL;
      c.fillText(PARTS[hl].name, 940, 200);
      c.font = `400 32px ${FONT}`;
      c.fillStyle = '#e6eaff';
      wrap(c, PARTS[hl].job, 660).forEach((l, i) => c.fillText(l, 940, 260 + i * 44));
    } else {
      c.font = `400 32px ${FONT}`;
      c.fillStyle = DIM;
      wrap(c, 'Tap any part of your microscope to find out what it does.', 660).forEach((l, i) => c.fillText(l, 940, 260 + i * 44));
    }
  }
}

function wrap(c, text, maxW) {
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
}
