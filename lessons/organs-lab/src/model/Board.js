import * as THREE from 'three';
import { STARTER_OPTIONS, SYSTEMS, QUIZ, organ } from '../data/organs.js';

// The class board (2.6 m wide):
//   starter   – the four starter tasks (as on the lesson plan's poster), the class's sticky notes (an organ
//               and what it does, stuck side by side) and who remembered the most organs;
//   build / functions – everyone's progress: organs in place, mistakes, function cards matched;
//   systems   – the system the teacher has picked, its organs, its job and what it depends on;
//   quiz      – everyone's score, and how the class did on each question.

const W = 1664;
const H = 832;
export const BOARD_W = 2.6;
const GOOD = '#7ee2a8';
const DIM = '#aab3d8';
const FONT = 'system-ui, sans-serif';
const css = (c) => `#${c.toString(16).padStart(6, '0')}`;
const NOTE_COLS = ['#ffe58a', '#ffc4d6', '#c8f0d0', '#cfe3ff', '#ffd9b0'];

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
    if (v.kind === 'starter') this.drawStarter(c, v);
    else if (v.kind === 'systems') this.drawSystems(c, v);
    else if (v.kind === 'quiz') this.drawQuiz(c, v);
    else this.drawProgress(c, v);
    this.tex.needsUpdate = true;
  }

  title(c, text, sub) {
    c.fillStyle = '#ffffff';
    c.font = `700 46px ${FONT}`;
    c.fillText(text, 40, 70);
    if (sub) {
      c.font = `400 26px ${FONT}`;
      c.fillStyle = DIM;
      c.fillText(sub, 40, 108);
    }
  }

  drawStarter(c, v) {
    this.title(c, 'Starter tasks', 'Pick one option on your own panel.');
    const w = (W - 80 - 3 * 20) / 4;
    STARTER_OPTIONS.forEach((o, i) => {
      const x = 40 + i * (w + 20);
      const y = 132;
      rr(c, x, y, w, 300, 18);
      c.fillStyle = ['#5a2f45', '#24406a', '#5a4026', '#3e3a3a'][i];
      c.fill();
      c.fillStyle = '#ffffff';
      c.font = `800 32px ${FONT}`;
      c.fillText(`${o.name}: ${o.title}`, x + 18, y + 46);
      c.font = `400 23px ${FONT}`;
      c.fillStyle = '#e6eaff';
      wrap(c, o.poster, w - 36).slice(0, 8).forEach((l, k) => c.fillText(l, x + 18, y + 88 + k * 30));
      c.font = `700 22px ${FONT}`;
      c.fillStyle = '#ffd166';
      c.fillText(`${v.counts[o.id] ?? 0} doing this`, x + 18, y + 284);
    });
    // sticky notes
    c.fillStyle = '#ffffff';
    c.font = `700 30px ${FONT}`;
    c.fillText('Our sticky notes', 40, 484);
    const nw = 150;
    const nh = 110;
    v.notes.slice(0, 10).forEach((n, i) => {
      const x = 40 + (i % 5) * (2 * nw + 30);
      const y = 502 + Math.floor(i / 5) * (nh + 16);
      const colour = NOTE_COLS[i % NOTE_COLS.length];
      for (const [k, text] of [[0, n.organ], [1, n.fn]]) {
        rr(c, x + k * (nw + 4), y, nw, nh, 6);
        c.fillStyle = colour;
        c.fill();
        c.fillStyle = '#1d2236';
        c.font = `${k ? 600 : 800} ${k ? 17 : 22}px ${FONT}`;
        wrap(c, text, nw - 16).slice(0, k ? 5 : 3).forEach((l, j) => c.fillText(l, x + k * (nw + 4) + 9, y + 28 + j * (k ? 20 : 26)));
      }
      c.fillStyle = css(n.color);
      c.beginPath();
      c.arc(x + 2 * nw - 8, y + nh - 12, 7, 0, Math.PI * 2);
      c.fill();
      if (v.revealed) {
        c.font = `800 26px ${FONT}`;
        c.fillStyle = n.right ? '#2f8a5c' : '#c03a3a';
        c.fillText(n.right ? '✓' : '✗', x + 2 * nw - 30, y + 26);
      }
    });
    if (!v.notes.length) {
      c.font = `400 26px ${FONT}`;
      c.fillStyle = DIM;
      c.fillText('Notes from option 3 appear here.', 40, 534);
    }
    // memory list
    if (v.recall.length) {
      c.fillStyle = '#ffffff';
      c.font = `700 26px ${FONT}`;
      c.textAlign = 'right';
      c.fillText(`Most organs remembered: ${v.recall.slice(0, 3).map((r) => `${r.name} ${r.n}`).join(' · ')}`, W - 40, H - 24);
      c.textAlign = 'left';
    }
  }

  drawProgress(c, v) {
    const cards = v.kind === 'functions';
    this.title(c, cards ? 'Function cards: who has matched them all?' : 'Building the body: everyone’s progress', cards ? 'Each card goes on the organ that does that job.' : `Put every organ in its place in your skeleton (${v.total} pieces at ${v.level === 'advanced' ? 'Advanced' : 'Core'}).`);
    const rows = v.people;
    const rowH = Math.min(64, (H - 170) / Math.max(1, rows.length));
    const barX = 420;
    const barW = W - barX - 360;
    c.font = `700 22px ${FONT}`;
    c.fillStyle = DIM;
    c.fillText(cards ? 'cards matched' : 'organs in place', barX, 150);
    c.fillText(cards ? 'wrong tries' : 'mistakes', W - 320, 150);
    rows.forEach((p, i) => {
      const y = 166 + i * rowH;
      const size = Math.max(18, Math.min(30, rowH * 0.5));
      c.fillStyle = css(p.color);
      c.beginPath();
      c.arc(56, y + rowH / 2, size * 0.4, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#ffffff';
      c.font = `${p.me ? 800 : 600} ${size}px ${FONT}`;
      c.fillText(`${p.name}${p.me && p.name !== 'You' && !p.name.includes('(you)') ? ' (you)' : ''}`, 80, y + rowH / 2 + size * 0.35);
      const done = cards ? p.c : p.p;
      const total = cards ? p.cn : p.n;
      rr(c, barX, y + rowH * 0.2, barW, rowH * 0.6, 8);
      c.fillStyle = '#1b2444';
      c.fill();
      if (done && total) {
        rr(c, barX, y + rowH * 0.2, Math.max(16, (barW * done) / total), rowH * 0.6, 8);
        c.fillStyle = done === total ? '#2f8a5c' : '#3e5bd0';
        c.fill();
      }
      c.fillStyle = '#ffffff';
      c.font = `700 ${size * 0.85}px ${FONT}`;
      c.fillText(`${done ?? 0} / ${total ?? 0}${done && done === total ? '  ✓ complete' : ''}`, barX + 14, y + rowH / 2 + size * 0.3);
      c.fillStyle = (cards ? p.cw : p.w) ? '#ffd166' : DIM;
      c.fillText(String((cards ? p.cw : p.w) ?? 0), W - 320, y + rowH / 2 + size * 0.3);
    });
  }

  drawSystems(c, v) {
    const s = SYSTEMS.find((x) => x.id === v.system);
    if (!s) {
      this.title(c, 'Body systems: working together', 'Every organ belongs to a system, and every system needs the others.');
      const w = (W - 80 - 4 * 16) / 5;
      SYSTEMS.forEach((x, i) => {
        const left = 40 + i * (w + 16);
        rr(c, left, 140, w, 600, 16);
        c.fillStyle = '#1b2444';
        c.fill();
        c.fillStyle = x.color;
        c.fillRect(left, 140, w, 10);
        c.font = `800 27px ${FONT}`;
        wrap(c, x.name, w - 30).forEach((l, k) => c.fillText(l, left + 16, 190 + k * 32));
        c.fillStyle = '#ffffff';
        c.font = `600 22px ${FONT}`;
        let y = 270;
        for (const id of x.organs) {
          c.fillText(`• ${organ(id).name}`, left + 16, y);
          y += 30;
        }
        c.fillStyle = '#e6eaff';
        c.font = `400 20px ${FONT}`;
        wrap(c, x.job, w - 32).slice(0, 8).forEach((l, k) => c.fillText(l, left + 16, Math.max(y + 16, 520) + k * 25));
      });
      c.font = `600 28px ${FONT}`;
      c.fillStyle = '#ffd166';
      c.fillText('No system works alone: the heart pumps what the lungs and intestines take in, and the brain controls them all.', 40, H - 40);
      return;
    }
    c.fillStyle = s.color;
    c.fillRect(0, 0, 18, H);
    this.title(c, s.name);
    c.font = `600 28px ${FONT}`;
    c.fillStyle = '#ffffff';
    let x = 40;
    for (const id of s.organs) {
      const name = organ(id).name;
      const w = c.measureText(name).width + 36;
      if (x + w > W - 40) break;
      rr(c, x, 104, w, 48, 24);
      c.fillStyle = s.color;
      c.fill();
      c.fillStyle = '#10162c';
      c.fillText(name, x + 18, 138);
      x += w + 12;
    }
    c.fillStyle = DIM;
    c.font = `700 26px ${FONT}`;
    c.fillText('ITS JOB', 40, 214);
    c.fillStyle = '#ffffff';
    c.font = `400 36px ${FONT}`;
    const job = wrap(c, s.job, W - 80).slice(0, 4);
    job.forEach((l, k) => c.fillText(l, 40, 262 + k * 46));
    const y0 = 262 + job.length * 46 + 40;
    c.fillStyle = DIM;
    c.font = `700 26px ${FONT}`;
    c.fillText('WHAT IT DEPENDS ON', 40, y0);
    c.fillStyle = '#ffd166';
    c.font = `400 36px ${FONT}`;
    wrap(c, s.needs, W - 80).slice(0, 5).forEach((l, k) => c.fillText(l, 40, y0 + 48 + k * 46));
  }

  drawQuiz(c, v) {
    this.title(c, 'Quiz', v.revealed ? 'How the class did on each question.' : 'Answer the 10 questions on your own panel.');
    const rows = v.people.slice(0, 14);
    const rowH = Math.min(46, (H - 170) / Math.max(1, rows.length));
    rows.forEach((p, i) => {
      const y = 150 + i * rowH;
      c.fillStyle = css(p.color);
      c.beginPath();
      c.arc(56, y + rowH / 2, 10, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#ffffff';
      c.font = `${p.me ? 800 : 600} 24px ${FONT}`;
      c.fillText(`${p.name}${p.me && p.name !== 'You' && !p.name.includes('(you)') ? ' (you)' : ''}`, 76, y + rowH / 2 + 8);
      c.font = `700 24px ${FONT}`;
      c.fillStyle = p.done === QUIZ.length ? GOOD : DIM;
      c.fillText(`${p.score} / ${QUIZ.length}${p.done < QUIZ.length ? `  (${p.done} answered)` : ''}`, 380, y + rowH / 2 + 8);
    });
    // per question: % of the class right (once revealed)
    const x0 = 720;
    const bw = (W - x0 - 40) / QUIZ.length;
    c.strokeStyle = 'rgba(255,255,255,0.25)';
    c.lineWidth = 2;
    c.strokeRect(x0, 160, W - x0 - 40, 540);
    QUIZ.forEach((q, i) => {
      const x = x0 + i * bw;
      c.font = `700 24px ${FONT}`;
      c.fillStyle = DIM;
      c.textAlign = 'center';
      c.fillText(`Q${i + 1}`, x + bw / 2, 740);
      const st = v.perQ[i];
      if (v.revealed && st.n) {
        const f = st.right / st.n;
        c.fillStyle = f >= 0.7 ? '#2f8a5c' : f >= 0.4 ? '#c99a2e' : '#a83d3d';
        c.fillRect(x + 10, 700 - 540 * f, bw - 20, 540 * f);
        c.fillStyle = '#ffffff';
        c.fillText(`${Math.round(f * 100)}%`, x + bw / 2, 690 - 540 * f);
      }
      c.textAlign = 'left';
    });
    if (!v.revealed) {
      c.font = `400 26px ${FONT}`;
      c.fillStyle = DIM;
      c.fillText('Your teacher will show how the class did on each question.', x0 + 20, 430);
    }
  }
}
