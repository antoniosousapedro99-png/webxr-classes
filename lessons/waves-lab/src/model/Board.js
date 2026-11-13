import * as THREE from 'three';
import { ROPE, TANK, SETUPS, GAPS, LINKS, ropeParams, ropeLambda, tankLambda, pct, word, lightName, pitch } from '../data/waves.js';
import { Rope } from './Rope.js';
import { Tank } from './Tank.js';

// The class board (2.6 m wide): the teacher's wave, big enough for the whole room. It carries one or two big
// ropes (BEFORE and AFTER, for the predictions and the quiz) or the ripple tank seen from above, with the
// settings, the question and the class's answers written around them. The writing is one canvas, redrawn
// only when something on it changes.

const W = 1664;
const H = 832;
export const BOARD_W = 2.6;
const PX = W / BOARD_W; // canvas px per metre
const SCALE = 2.6; // the big ropes, compared with the one on your desk
const ROPE_X = -0.85;
const ROW = { single: 602, before: 500, after: 715 }; // canvas y of each rope's rest line
const yOf = (py) => (H / 2 - py) / PX;

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

export const lambdaWord = (m) => (m < 0.12 ? 'very short' : m < 0.2 ? 'short' : m < 0.32 ? 'medium' : m < 0.5 ? 'long' : 'very long');
const SPEED = ['very slow', 'slow', 'medium', 'fast', 'very fast'];

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

    this.ropes = [0, 1].map(() => {
      const r = new Rope({ stand: false });
      r.group.scale.setScalar(SCALE);
      r.group.position.set(ROPE_X, 0, 0.06);
      this.group.add(r.group);
      return r;
    });
    this.tank = new Tank({ lift: 0, frame: false });
    this.tank.group.scale.setScalar(0.72 / TANK.size);
    this.tank.group.position.set(0.72, -0.27, 0.01);
    this.group.add(this.tank.group);
    this.key = '';
  }

  /**
   * v: { mode, level, who, ropes: [{ w, link, frozen } | null, …], tank: { k, setup, gap, frozen } | null,
   *      ch: { kind, title, q, options, counts, votes, revealed, answer } | null }
   */
  show(dt, v) {
    const both = !!v.ropes[1];
    v.ropes.forEach((r, i) => {
      const rope = this.ropes[i];
      rope.group.visible = !!r;
      if (!r) return;
      rope.group.position.y = yOf(both ? (i ? ROW.after : ROW.before) : ROW.single);
      rope.set(ropeParams(r.w));
      rope.look(r.link ?? 'rope', r.w.f, r.w.a);
      rope.update(dt, r.frozen);
    });
    this.tank.group.visible = !!v.tank;
    if (v.tank) {
      const { k, setup, gap, frozen } = v.tank;
      this.tank.set({ f: TANK.f(k.f), a: TANK.a(k.a), v: TANK.v(k.d), setup, gap: GAPS[gap] });
      this.tank.update(dt, frozen);
    }
    const key = JSON.stringify(v);
    if (key === this.key) return;
    this.key = key;
    this.draw(v, both);
    this.tex.needsUpdate = true;
  }

  draw(v, both) {
    const c = this.canvas.getContext('2d');
    const adv = v.level === 'advanced';
    c.fillStyle = '#10162c';
    c.fillRect(0, 0, W, H);
    c.textBaseline = 'alphabetic';
    c.textAlign = 'left';
    const title = (text, note) => {
      c.fillStyle = '#ffffff';
      c.font = `700 46px ${FONT}`;
      c.fillText(text, 40, 62);
      if (note) {
        c.font = `600 28px ${FONT}`;
        c.fillStyle = '#9aa8ff';
        c.textAlign = 'right';
        c.fillText(note, W - 40, 60);
        c.textAlign = 'left';
      }
    };
    const stat = (x, y, label, value, sub, color = '#ffffff') => {
      c.font = `400 26px ${FONT}`;
      c.fillStyle = DIM;
      c.fillText(label, x, y);
      c.font = `700 50px ${FONT}`;
      c.fillStyle = color;
      c.fillText(value, x, y + 58);
      if (sub) {
        c.font = `400 24px ${FONT}`;
        c.fillStyle = DIM;
        c.fillText(sub, x, y + 92);
      }
    };
    const whose = v.who ? `${v.who}’s` : 'The class';

    if (v.ch) {
      // ── a prediction or a mystery wave: the question, the answers, and (once revealed) who chose what
      const ch = v.ch;
      title(ch.title, ch.revealed ? `${ch.votes} answer${ch.votes === 1 ? '' : 's'}` : `${ch.votes} answer${ch.votes === 1 ? '' : 's'} in`);
      c.font = `400 30px ${FONT}`;
      c.fillStyle = '#e6eaff';
      wrap(c, ch.q, W - 80).slice(0, 2).forEach((line, i) => c.fillText(line, 40, 108 + i * 38));
      const rows = Math.ceil(ch.options.length / 2);
      const h = rows > 2 ? 48 : 68;
      const top = rows > 2 ? 188 : 196;
      const w = (W - 80 - 24) / 2;
      const most = Math.max(1, ...ch.counts);
      ch.options.forEach((o, i) => {
        const x = 40 + (i % 2) * (w + 24);
        const y = top + Math.floor(i / 2) * (h + 8);
        const right = ch.revealed && i === ch.answer;
        rr(c, x, y, w, h, 14);
        c.fillStyle = right ? '#1d4a36' : '#1b2444';
        c.fill();
        if (ch.revealed && ch.counts[i]) {
          rr(c, x, y, Math.max(28, (w * ch.counts[i]) / most), h, 14);
          c.fillStyle = right ? '#2f8a5c' : '#35406e';
          c.fill();
        }
        if (right) {
          c.strokeStyle = GOOD;
          c.lineWidth = 4;
          rr(c, x, y, w, h, 14);
          c.stroke();
        }
        let size = rows > 2 ? 26 : 28;
        const text = `${'ABCDEF'[i]}   ${o}`;
        c.font = `600 ${size}px ${FONT}`;
        while (size > 18 && c.measureText(text).width > w - 110) c.font = `600 ${--size}px ${FONT}`;
        c.fillStyle = '#ffffff';
        c.fillText(text, x + 20, y + h / 2 + size * 0.36);
        if (ch.revealed) {
          c.font = `700 30px ${FONT}`;
          c.textAlign = 'right';
          c.fillStyle = right ? GOOD : '#ffffff';
          c.fillText(`${right ? '✓ ' : ''}${ch.counts[i]}`, x + w - 18, y + h / 2 + 11);
          c.textAlign = 'left';
        }
      });
      c.font = `700 26px ${FONT}`;
      c.fillStyle = '#9aa8ff';
      if (both) {
        c.fillText('BEFORE', 30, ROW.before - 118);
        c.fillText('AFTER', 30, ROW.after - 104);
      } else c.fillText(ch.kind === 'predict' ? 'FROZEN: what will happen?' : '', 30, ROW.single - 130);
    } else if (v.tank) {
      // ── the ripple tank: what it is showing and its settings, beside the tank itself
      const { k, setup } = v.tank;
      const s = SETUPS.find((x) => x.id === setup) ?? SETUPS[0];
      title(`${whose} ripple tank: ${s.title}`, v.tank.frozen ? 'FROZEN' : '');
      c.font = `400 30px ${FONT}`;
      c.fillStyle = '#e6eaff';
      wrap(c, s.note, 960).slice(0, 4).forEach((line, i) => c.fillText(line, 40, 120 + i * 40));
      const lam = tankLambda(k);
      stat(40, 330, 'Frequency', adv ? `${TANK.f(k.f).toFixed(1)} Hz` : pct(k.f), adv ? pct(k.f) : word(k.f));
      stat(370, 330, 'Amplitude', pct(k.a), word(k.a, ['very small', 'small', 'medium', 'large', 'very large']));
      stat(700, 330, 'Water depth', adv ? `${TANK.depth(k.d).toFixed(1)} mm` : pct(k.d), adv ? pct(k.d) : word(k.d, ['very shallow', 'shallow', 'medium', 'deep', 'very deep']));
      stat(40, 500, 'Wavelength', adv ? `${(lam * 100).toFixed(1)} cm` : lambdaWord(lam * 2.2), 'ripple to ripple', GOOD);
      stat(370, 500, 'Wave speed', adv ? `${(TANK.v(k.d) * 100).toFixed(1)} cm/s` : word(k.d, SPEED), 'set by the depth', GOOD);
      if (adv) {
        c.font = `600 30px ${FONT}`;
        c.fillStyle = '#ffd166';
        c.fillText(`speed = frequency × wavelength:  ${(TANK.v(k.d) * 100).toFixed(1)} = ${TANK.f(k.f).toFixed(1)} × ${(lam * 100).toFixed(1)}`, 40, 700);
      }
      c.font = `400 24px ${FONT}`;
      c.fillStyle = DIM;
      c.fillText('Seen from above. Ripples travel from left to right.', 40, 790);
    } else {
      // ── the teacher's rope
      const r = v.ropes[0];
      const w = r.w;
      const link = LINKS.find((l) => l.id === r.link) ?? LINKS[0];
      title(`${whose} wave${link.id === 'rope' ? '' : `: ${link.label.toLowerCase()}`}`, r.frozen ? 'FROZEN' : '');
      const lam = ropeLambda(w);
      stat(40, 120, 'Frequency', adv ? `${ROPE.f(w.f).toFixed(2)} Hz` : pct(w.f), adv ? pct(w.f) : word(w.f));
      stat(360, 120, 'Amplitude', adv ? `${(ROPE.a(w.a) * 100).toFixed(1)} cm` : pct(w.a), adv ? pct(w.a) : word(w.a, ['very small', 'small', 'medium', 'large', 'very large']));
      stat(680, 120, 'Tension', pct(w.t), word(w.t, ['very slack', 'slack', 'medium', 'tight', 'very tight']));
      stat(1000, 120, 'Wavelength', adv ? `${(lam * 100).toFixed(1)} cm` : lambdaWord(lam), 'crest to crest', GOOD);
      stat(1320, 120, 'Wave speed', adv ? `${(ROPE.v(w.t) * 100).toFixed(1)} cm/s` : word(w.t, SPEED), 'set by the rope', GOOD);
      c.font = `600 30px ${FONT}`;
      c.fillStyle = '#ffd166';
      const extra = link.id === 'sound' ? `Sound: the pitch is ${Math.round(pitch(w.f))} Hz, the loudness follows the amplitude.`
        : link.id === 'light' ? `Light: this frequency is ${lightName(w.f)}; a bigger amplitude is brighter.`
          : link.id === 'ocean' ? 'Ocean: the boat goes up and down. The wave moves along, the water does not.'
            : adv ? `speed = frequency × wavelength:  ${(ROPE.v(w.t) * 100).toFixed(1)} = ${ROPE.f(w.f).toFixed(2)} × ${(lam * 100).toFixed(1)}` : 'Watch the red bead: it only moves up and down.';
      c.fillText(extra, 40, 290);
    }
  }
}
