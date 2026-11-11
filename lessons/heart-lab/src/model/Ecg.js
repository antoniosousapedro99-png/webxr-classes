import * as THREE from 'three';
import { T } from '../data/heart.js';

// A heart monitor: the ECG trace sweeps across like a real one, in time with the beating heart.
// One canvas texture, which can be shown in several places (on the desk and under the big heart).

const g = (x, c, w) => Math.exp(-(((x - c) / w) ** 2));

/** The ECG at a point in the beat (f, 0–1), in millivolts-ish. stElevation: heart attack. */
export function ecgValue(f, stElevation = 0) {
  let v = 0.15 * g(f, (T.pStart + T.pEnd) / 2, 0.02); // P
  v += -0.12 * g(f, T.qrsStart + 0.012, 0.006); // Q
  v += 1.0 * g(f, T.qrsStart + 0.027, 0.008); // R
  v += -0.25 * g(f, T.qrsStart + 0.043, 0.007); // S
  v += (0.3 + stElevation * 0.12) * g(f, (T.tStart + T.tEnd) / 2, 0.035); // T
  if (stElevation) {
    const s = Math.min(1, Math.max(0, (f - (T.qrsStart + 0.05)) / 0.02)) * Math.min(1, Math.max(0, (T.tEnd - f) / 0.06));
    v += 0.28 * stElevation * s;
  }
  return v;
}

export class Ecg {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 768;
    this.canvas.height = 240;
    this.ctx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.x = 0;
    this.lastY = null;
    this.window = 4; // seconds across the screen
    this.top = 46;
    this.labels = false;
    this.lastF = 0;
    this.clear();
  }

  /** A flat screen for the trace: width × height in metres. */
  makeScreen(width) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, (width * this.canvas.height) / this.canvas.width),
      new THREE.MeshBasicMaterial({ map: this.texture, toneMapped: false, transparent: true }));
    return mesh;
  }

  clear() {
    const c = this.ctx;
    c.fillStyle = '#04110b';
    c.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.grid(0, this.canvas.width);
    this.x = 0;
    this.lastY = null;
  }

  grid(x0, x1) {
    const c = this.ctx;
    c.fillStyle = '#04110b';
    c.fillRect(x0, this.top, x1 - x0, this.canvas.height - this.top);
    c.strokeStyle = 'rgba(60,160,100,0.18)';
    c.lineWidth = 1;
    for (let x = Math.ceil(x0 / 24) * 24; x < x1; x += 24) {
      c.beginPath();
      c.moveTo(x + 0.5, this.top);
      c.lineTo(x + 0.5, this.canvas.height);
      c.stroke();
    }
    for (let y = this.top; y < this.canvas.height; y += 24) {
      c.beginPath();
      c.moveTo(x0, y + 0.5);
      c.lineTo(x1, y + 0.5);
      c.stroke();
    }
  }

  header(bpm, note) {
    const c = this.ctx;
    c.fillStyle = '#071a10';
    c.fillRect(0, 0, this.canvas.width, this.top);
    c.font = '700 28px system-ui, sans-serif';
    c.textBaseline = 'middle';
    c.fillStyle = '#7dffb0';
    c.fillText('ECG', 16, 24);
    c.fillStyle = '#ffffff';
    c.textAlign = 'right';
    c.fillText(`♥ ${bpm} bpm`, this.canvas.width - 16, 24);
    c.textAlign = 'left';
    if (note) {
      c.font = '600 22px system-ui, sans-serif';
      c.fillStyle = '#ff8a8a';
      c.fillText(note, 86, 25);
    }
    this.texture.needsUpdate = true;
  }

  /** dt: seconds of heart time; f: the phase of the beat. */
  update(dt, f, { bpm, st = 0, note = '' } = {}) {
    const key = `${bpm}|${note}`;
    if (key !== this.headerKey) {
      this.headerKey = key;
      this.header(bpm, note);
    }
    if (dt <= 0) return;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const nx = this.x + (dt / this.window) * W;
    const mid = this.top + (H - this.top) * 0.66;
    const yOf = (ff) => mid - ecgValue(ff - Math.floor(ff), st) * (H - this.top) * 0.55;
    const c = this.ctx;
    // wipe a little ahead of the pen, like a real monitor
    const wipe = (a, b) => this.grid(a, Math.min(W, b));
    if (nx >= W) {
      wipe(this.x, W);
      this.x = 0;
      this.lastY = null;
      this.lastF = f;
      wipe(0, 30);
      return;
    }
    wipe(this.x + 1, nx + 30);
    const f0 = this.lastF;
    const f1 = f < f0 ? f + 1 : f; // (a new beat started)
    if (this.lastY !== null) {
      // draw through several points, so the narrow R spike is never skipped between frames
      const n = Math.max(1, Math.ceil(nx - this.x));
      c.strokeStyle = '#47ff8a';
      c.lineWidth = 4;
      c.lineJoin = 'round';
      c.beginPath();
      c.moveTo(this.x, this.lastY);
      for (let k = 1; k <= n; k++) c.lineTo(this.x + ((nx - this.x) * k) / n, yOf(f0 + ((f1 - f0) * k) / n));
      c.stroke();
    }
    const y = yOf(f);
    // wave names (advanced), just behind the pen so the wipe doesn’t erase them
    if (this.labels) {
      const marks = [[(T.pStart + T.pEnd) / 2, 'P'], [T.qrsStart + 0.027, 'QRS'], [(T.tStart + T.tEnd) / 2, 'T']];
      for (const [at, name] of marks) {
        for (const m of [at, at + 1]) {
          if (f0 < m && f1 >= m) {
            c.font = '700 24px system-ui, sans-serif';
            c.fillStyle = '#ffd166';
            c.textAlign = 'right';
            c.fillText(name, nx - 4, Math.max(this.top + 4, yOf(m) - 34));
            c.textAlign = 'left';
          }
        }
      }
    }
    this.lastF = f;
    this.x = nx;
    this.lastY = y;
    this.texture.needsUpdate = true;
  }
}
