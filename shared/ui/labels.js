import * as THREE from 'three';
import { font, roundRect } from './CanvasPanel.js';

/** A camera-facing text label. `height` is the label's height in metres. */
export function makeLabel(text, { height = 0.04, color = '#ffffff', bg = 'rgba(12, 16, 30, 0.78)', size = 56, weight = 700 } = {}) {
  const lines = String(text).split('\n');
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.font = font(size, weight);
  const pad = size * 0.45;
  const lineH = size * 1.25;
  const w = Math.ceil(Math.max(...lines.map((l) => ctx.measureText(l).width)) + pad * 2);
  const h = Math.ceil(lines.length * lineH + pad * 1.2);
  canvas.width = w;
  canvas.height = h;
  if (bg) {
    roundRect(ctx, 0, 0, w, h, size * 0.4);
    ctx.fillStyle = bg;
    ctx.fill();
  }
  ctx.font = font(size, weight);
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lines.forEach((l, i) => ctx.fillText(l, w / 2, pad * 0.6 + lineH * (i + 0.5)));

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, toneMapped: false }));
  sprite.scale.set((height * w) / h, height, 1);
  sprite.userData.dispose = () => {
    texture.dispose();
    sprite.material.dispose();
  };
  return sprite;
}

/** Dispose of geometries, materials and label textures below `object`, then empty it. */
export function clearGroup(object, keep = new Set()) {
  for (const child of [...object.children]) {
    child.traverse((o) => {
      o.userData.dispose?.();
      if (o.geometry && !keep.has(o.geometry)) o.geometry.dispose();
      if (o.material && !keep.has(o.material)) o.material.dispose?.();
    });
    object.remove(child);
  }
}
