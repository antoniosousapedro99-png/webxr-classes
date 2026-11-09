import * as THREE from 'three';

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

const SCROLLBAR_W = 58; // width of the scroll buttons (canvas px)

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
    // Scrolling: when the content is taller than the panel, it scrolls (scrollbar with ▲ ▼ on the right).
    this.scroll = 0;
    this.maxScroll = 0;
  }

  setBuilder(fn) {
    this.builder = fn;
    this.redraw();
  }

  get scrollable() {
    return this.maxScroll > 0;
  }

  /** Scroll by `px` canvas pixels (positive = down). Returns true if it moved. */
  scrollBy(px) {
    const was = this.scroll;
    this.scroll = Math.max(0, Math.min(this.maxScroll, this.scroll + px));
    if (this.scroll === was) return false;
    this.redraw();
    return true;
  }

  redraw() {
    const { ctx, canvas } = this;
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    roundRect(ctx, 4, 4, W - 8, H - 8, 36);
    ctx.fillStyle = THEME.bg;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = THEME.border;
    ctx.stroke();
    this.buttons = [];
    if (!this.builder) {
      this.texture.needsUpdate = true;
      return;
    }
    // draw the content shifted up by the scroll amount, clipped to the panel
    ctx.save();
    roundRect(ctx, 6, 6, W - 12, H - 12, 34);
    ctx.clip();
    ctx.translate(0, -this.scroll);
    const ui = new PanelDrawer(this);
    if (this.maxScroll > 0) ui.scrollbarRoom = SCROLLBAR_W; // keep content clear of the scrollbar
    this.builder(ui);
    ctx.restore();
    // how tall was it? (content below the panel's bottom edge needs scrolling)
    const contentH = ui.y + 24;
    const max = Math.max(0, Math.round(contentH - H));
    const needsBar = max > 0;
    if (needsBar !== this.maxScroll > 0 || Math.min(this.scroll, max) !== this.scroll) {
      // first time it overflows (content is re-laid out narrower), or it got shorter: draw again
      this.maxScroll = max;
      this.scroll = Math.min(this.scroll, max);
      this.redraw();
      return;
    }
    this.maxScroll = max;
    if (needsBar) this.drawScrollbar(contentH);
    this.texture.needsUpdate = true;
  }

  drawScrollbar(contentH) {
    const { ctx } = this;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const x = W - SCROLLBAR_W - 14;
    const btn = SCROLLBAR_W;
    // soft fade where content continues above / below
    const fade = (y0, y1) => {
      const g = ctx.createLinearGradient(0, y0, 0, y1);
      g.addColorStop(0, 'rgba(14,18,32,0)');
      g.addColorStop(1, 'rgba(14,18,32,0.95)');
      ctx.fillStyle = g;
      ctx.fillRect(8, Math.min(y0, y1), x - 16, Math.abs(y1 - y0));
    };
    if (this.scroll < this.maxScroll) fade(H - 90, H - 8);
    if (this.scroll > 0) fade(90, 8);
    // track and thumb
    const top = 18 + btn + 10;
    const bottom = H - 18 - btn - 10;
    roundRect(ctx, x + btn / 2 - 6, top, 12, bottom - top, 6);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fill();
    const thumbH = Math.max(50, ((bottom - top) * H) / contentH);
    const thumbY = top + ((bottom - top - thumbH) * this.scroll) / this.maxScroll;
    roundRect(ctx, x + btn / 2 - 6, thumbY, 12, thumbH, 6);
    ctx.fillStyle = THEME.accent;
    ctx.fill();
    // ▲ ▼ buttons (work with every kind of input)
    const page = H * 0.6;
    const drawer = new PanelDrawer(this);
    drawer.fixed = true;
    drawer.button({ id: 'scroll-up', label: '▲', disabled: this.scroll <= 0, onClick: () => this.scrollBy(-page) }, x, 18, btn, btn, 30);
    drawer.button({ id: 'scroll-down', label: '▼', disabled: this.scroll >= this.maxScroll, onClick: () => this.scrollBy(page) }, x, H - 18 - btn, btn, btn, 30);
  }

  buttonAt(uv) {
    const x = uv.x * this.canvas.width;
    const y = (1 - uv.y) * this.canvas.height;
    // the scroll buttons stay put; everything else moves with the scroll
    const fixed = this.buttons.find((b) => b.fixed && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
    if (fixed) return fixed;
    const cy = y + this.scroll;
    return this.buttons.find((b) => !b.fixed && x >= b.x && x <= b.x + b.w && cy >= b.y && cy <= b.y + b.h) || null;
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
    this.scrollbarRoom = 0; // set while the panel scrolls
    this.fixed = false; // buttons that do not scroll (the scrollbar's own)
  }

  get contentWidth() {
    return this.W - this.pad * 2 - this.scrollbarRoom;
  }

  /** x of the right edge of the content. */
  get right() {
    return this.W - this.pad - this.scrollbarRoom;
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
    ctx.fillText(String(value), this.right, this.y);
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
    this.panel.buttons.push({ id, x, y, w, h, onClick, disabled, fixed: this.fixed });
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
  bar(label, value, max, color, unit = 'kJ') {
    const { ctx } = this;
    ctx.font = font(24, 600);
    ctx.fillStyle = THEME.dim;
    ctx.textBaseline = 'top';
    ctx.fillText(label, this.pad, this.y);
    ctx.textAlign = 'right';
    ctx.fillStyle = THEME.text;
    ctx.fillText(`${Math.round(value)} ${unit}`, this.right, this.y);
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
    const right = this.right;
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
}
