import * as THREE from 'three';
import { getElement, CATEGORY_COLORS, MAX_Z } from '../data/elements.js';

// A flat UI panel drawn on a 2D canvas and shown as a texture in 3D.
// The same panel works with a mouse, touch, XR controllers and hand pinches:
// whatever ray hits it gives us a UV coordinate, which we map to a button.

export const THEME = {
  bg: 'rgba(14, 18, 32, 0.9)',
  border: 'rgba(124, 140, 255, 0.55)',
  text: '#eef1ff',
  dim: '#a3abd1',
  accent: '#9aa8ff',
  btn: '#252e50',
  btnHover: '#36427a',
  btnActive: '#5b6cff',
  btnDisabled: '#1a2038',
  box: 'rgba(91, 108, 255, 0.14)',
};

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
export const font = (size, weight = 400) => `${weight} ${size}px ${FONT}`;

export function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export class CanvasPanel {
  constructor({ width = 0.5, height = 0.75, pxPerMeter = 1500, name = 'panel' } = {}) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = Math.round(width * pxPerMeter);
    this.canvas.height = Math.round(height * pxPerMeter);
    this.ctx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;
    this.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshBasicMaterial({ map: this.texture, transparent: true, toneMapped: false }),
    );
    this.mesh.name = name;
    this.mesh.userData.panel = this;
    this.buttons = [];
    this.hoverId = null;
    this.builder = null;
  }

  setBuilder(fn) {
    this.builder = fn;
    this.redraw();
  }

  redraw() {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    roundRect(ctx, 4, 4, canvas.width - 8, canvas.height - 8, 36);
    ctx.fillStyle = THEME.bg;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = THEME.border;
    ctx.stroke();
    this.buttons = [];
    if (this.builder) this.builder(new PanelDrawer(this));
    this.texture.needsUpdate = true;
  }

  buttonAt(uv) {
    const x = uv.x * this.canvas.width;
    const y = (1 - uv.y) * this.canvas.height;
    return this.buttons.find((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) || null;
  }

  setHover(id) {
    if (id === this.hoverId) return;
    this.hoverId = id;
    this.redraw();
  }

  /** Returns true if a button was pressed. */
  click(uv) {
    const b = this.buttonAt(uv);
    if (!b || b.disabled) return false;
    b.onClick?.();
    return true;
  }
}

/** Simple top-to-bottom layout helper handed to panel builders. */
class PanelDrawer {
  constructor(panel) {
    this.panel = panel;
    this.ctx = panel.ctx;
    this.W = panel.canvas.width;
    this.H = panel.canvas.height;
    this.pad = 40;
    this.y = 40;
    this.auto = 0;
  }

  get contentWidth() {
    return this.W - this.pad * 2;
  }

  gap(px = 16) {
    this.y += px;
  }

  wrap(text, maxWidth) {
    const lines = [];
    for (const para of String(text).split('\n')) {
      let line = '';
      for (const word of para.split(' ')) {
        const test = line ? `${line} ${word}` : word;
        if (line && this.ctx.measureText(test).width > maxWidth) {
          lines.push(line);
          line = word;
        } else line = test;
      }
      lines.push(line);
    }
    return lines;
  }

  title(text, { size = 50, color = THEME.text } = {}) {
    this.text(text, { size, weight: 700, color });
  }

  heading(text, { size = 30 } = {}) {
    this.gap(6);
    this.text(text.toUpperCase(), { size, weight: 700, color: THEME.accent });
    this.gap(2);
  }

  text(str, { size = 30, weight = 400, color = THEME.text, lineHeight = 1.32, x = this.pad, width = this.contentWidth } = {}) {
    const { ctx } = this;
    ctx.font = font(size, weight);
    ctx.fillStyle = color;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    for (const line of this.wrap(str, width)) {
      ctx.fillText(line, x, this.y);
      this.y += size * lineHeight;
    }
  }

  /** Label on the left, value on the right of the same line. */
  kv(label, value, { size = 30, color = THEME.text } = {}) {
    const { ctx } = this;
    ctx.textBaseline = 'top';
    ctx.font = font(size, 400);
    ctx.fillStyle = THEME.dim;
    ctx.textAlign = 'left';
    ctx.fillText(label, this.pad, this.y);
    ctx.font = font(size, 700);
    ctx.fillStyle = color;
    ctx.textAlign = 'right';
    ctx.fillText(String(value), this.W - this.pad, this.y);
    ctx.textAlign = 'left';
    this.y += size * 1.4;
  }

  divider() {
    this.gap(10);
    this.ctx.fillStyle = THEME.border;
    this.ctx.fillRect(this.pad, this.y, this.contentWidth, 2);
    this.gap(22);
  }

  /** Text in a tinted rounded box. */
  box(str, { size = 28, color = THEME.text } = {}) {
    const { ctx } = this;
    ctx.font = font(size, 400);
    const inner = this.contentWidth - 48;
    const lines = this.wrap(str, inner);
    const h = lines.length * size * 1.32 + 40;
    roundRect(ctx, this.pad, this.y, this.contentWidth, h, 20);
    ctx.fillStyle = THEME.box;
    ctx.fill();
    const y0 = this.y;
    this.y += 20;
    this.text(str, { size, color, x: this.pad + 24, width: inner });
    this.y = y0 + h + 12;
  }

  button({ id, label, onClick, active = false, disabled = false, color = null }, x, y, w, h, size) {
    const { ctx } = this;
    id = id ?? `auto-${this.auto++}`;
    const hover = this.panel.hoverId === id && !disabled;
    roundRect(ctx, x, y, w, h, 16);
    ctx.fillStyle = disabled ? THEME.btnDisabled : active ? THEME.btnActive : hover ? THEME.btnHover : (color || THEME.btn);
    ctx.fill();
    if (hover) {
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
    }
    let s = size;
    ctx.font = font(s, 600);
    while (s > 16 && ctx.measureText(label).width > w - 20) {
      s -= 1;
      ctx.font = font(s, 600);
    }
    ctx.fillStyle = disabled ? '#5c6488' : THEME.text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + w / 2, y + h / 2 + 1);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    this.panel.buttons.push({ id, x, y, w, h, onClick, disabled });
  }

  /** A grid of buttons, `cols` per row (defaults to all in one row). */
  buttons(specs, { cols = specs.length, height = 76, size = 30, gap = 14 } = {}) {
    const w = (this.contentWidth - gap * (cols - 1)) / cols;
    specs.forEach((spec, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      this.button(spec, this.pad + col * (w + gap), this.y + row * (height + gap), w, height, size);
    });
    this.y += Math.ceil(specs.length / cols) * (height + gap);
  }

  /** Horizontal bar with a label and value, e.g. for energy. */
  bar(label, value, max, color) {
    const { ctx } = this;
    ctx.font = font(24, 600);
    ctx.fillStyle = THEME.dim;
    ctx.textBaseline = 'top';
    ctx.fillText(label, this.pad, this.y);
    ctx.textAlign = 'right';
    ctx.fillStyle = THEME.text;
    ctx.fillText(`${Math.round(value)} kJ`, this.W - this.pad, this.y);
    ctx.textAlign = 'left';
    this.y += 32;
    roundRect(ctx, this.pad, this.y, this.contentWidth, 22, 11);
    ctx.fillStyle = THEME.btnDisabled;
    ctx.fill();
    const w = Math.max(0, Math.min(1, value / max)) * this.contentWidth;
    if (w > 4) {
      roundRect(ctx, this.pad, this.y, w, 22, 11);
      ctx.fillStyle = color;
      ctx.fill();
    }
    this.y += 36;
  }

  /** "Protons   [−]  6  [+]" */
  stepper(label, value, { id, onMinus, onPlus, color = THEME.text, size = 34 }) {
    const { ctx } = this;
    const h = 76;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(this.pad + 16, this.y + h / 2, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = font(size, 600);
    ctx.fillStyle = THEME.text;
    ctx.textBaseline = 'middle';
    ctx.fillText(label, this.pad + 46, this.y + h / 2);
    const bw = 110;
    const right = this.W - this.pad;
    this.button({ id: `${id}-plus`, label: '+', onClick: onPlus }, right - bw, this.y, bw, h, 46);
    ctx.font = font(44, 700);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = THEME.text;
    ctx.fillText(String(value), right - bw - 70, this.y + h / 2);
    ctx.textAlign = 'left';
    this.button({ id: `${id}-minus`, label: '−', onClick: onMinus }, right - bw * 2 - 140, this.y, bw, h, 46);
    ctx.textBaseline = 'top';
    this.y += h + 14;
  }

  /** Mini periodic table of the first 36 elements. */
  periodicTable(selectedZ, onPick) {
    const { ctx } = this;
    const cw = this.contentWidth / 18;
    const ch = 58;
    for (let Z = 1; Z <= MAX_Z; Z++) {
      const el = getElement(Z);
      const x = this.pad + (el.group - 1) * cw;
      const y = this.y + (el.period - 1) * ch;
      const id = `pt-${Z}`;
      const hover = this.panel.hoverId === id;
      roundRect(ctx, x + 2, y + 2, cw - 4, ch - 4, 8);
      ctx.fillStyle = CATEGORY_COLORS[el.category];
      ctx.fill();
      if (Z === selectedZ || hover) {
        ctx.lineWidth = Z === selectedZ ? 5 : 3;
        ctx.strokeStyle = Z === selectedZ ? '#ffffff' : '#c9d0ff';
        ctx.stroke();
      }
      ctx.font = font(22, 700);
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(el.symbol, x + cw / 2, y + ch / 2 + 1);
      this.panel.buttons.push({ id, x, y, w: cw, h: ch, onClick: () => onPick(Z) });
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    this.y += ch * 4 + 12;
  }
}
