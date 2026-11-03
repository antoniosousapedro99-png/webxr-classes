import * as THREE from 'three';

// Visual "energy" for reactions: a flash of light, a glow and a shockwave ring that spread into the room.

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,200,120,0.8)');
  grad.addColorStop(1, 'rgba(255,120,40,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Effects {
  constructor(parent) {
    this.group = new THREE.Group();
    parent.add(this.group);
    this.light = new THREE.PointLight(0xffa040, 0, 3, 1.5);
    this.group.add(this.light);
    this.glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, opacity: 0,
    }));
    this.ring = new THREE.Mesh(
      new THREE.TorusGeometry(1, 0.01, 8, 96),
      new THREE.MeshBasicMaterial({ color: 0xffb060, transparent: true, opacity: 0, toneMapped: false }),
    );
    this.ring.rotation.x = Math.PI / 2;
    this.group.add(this.glow, this.ring);
    this.t = Infinity;
    this.size = 1;
  }

  /** Start a burst; strength 0..1. Exothermic = warm orange, endothermic = cold blue. */
  burst(strength, exothermic = true) {
    this.t = 0;
    this.size = 0.4 + strength * 1.2;
    const color = exothermic ? 0xffa040 : 0x60b0ff;
    this.light.color.setHex(color);
    this.glow.material.color.setHex(exothermic ? 0xffffff : 0x9fd0ff);
    this.ring.material.color.setHex(color);
    this.strength = strength;
  }

  update(dt) {
    if (this.t > 3) return;
    this.t += dt;
    const t = this.t;
    const fade = Math.max(0, 1 - t / 2.5);
    this.light.intensity = 25 * this.strength * Math.max(0, 1 - t / 1.2);
    this.glow.material.opacity = fade * 0.9;
    this.glow.scale.setScalar(this.size * (0.3 + Math.min(1, t * 2)));
    const r = this.size * 1.5 * Math.min(1, t / 1.5);
    this.ring.scale.set(r + 0.01, r + 0.01, 1);
    this.ring.material.opacity = Math.max(0, 1 - t / 1.5);
  }
}
