import * as THREE from 'three';

// Makes the real classroom look underwater (through passthrough), and the virtual sea life sit in it:
//  • a tint dome around your head (lighter above, deeper below) — classmates are seen through it too
//  • sun shafts slanting down from the ceiling, caustic ripples of light on the real floor
//  • drifting "marine snow", bubbles from your hands, blue haze on far-away sea life (fog)
//  • muffled ocean sound
// `murk` (turbidity) and `bloom` (algae/phytoplankton) change the colour and visibility live.

const DEEP = new THREE.Color(0x04324d);
const SURFACE = new THREE.Color(0x3fb7d9);
const GREEN = new THREE.Color(0x2f6b3a);

export class Water {
  constructor(app, oceanRoot) {
    this.app = app;
    this.root = oceanRoot;
    this.murk = 0.1;
    this.bloom = 0;
    this.time = 0;

    // Tint dome: drawn after the sea life (so it tints it) but before the panels (so they stay readable).
    this.dome = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 32, 16),
      new THREE.ShaderMaterial({
        uniforms: { uDeep: { value: DEEP.clone() }, uTop: { value: SURFACE.clone() }, uAlpha: { value: 0.34 } },
        vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: `uniform vec3 uDeep; uniform vec3 uTop; uniform float uAlpha; varying vec3 vDir;
          void main(){ float k = smoothstep(-0.8, 0.9, vDir.y); vec3 c = mix(uDeep, uTop, k);
            gl_FragColor = vec4(c, uAlpha * mix(1.25, 0.8, k)); }`,
        side: THREE.BackSide, transparent: true, depthTest: false, depthWrite: false,
      }),
    );
    this.dome.renderOrder = 5;
    this.dome.frustumCulled = false;
    app.scene.add(this.dome);

    app.scene.fog = new THREE.FogExp2(0x0b4f6e, 0.12);

    this.makeShafts();
    this.makeCaustics();
    this.makeSnow();
    this.makeBubbles();
  }

  makeShafts() {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 256;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, 'rgba(220,250,255,0.55)');
    grad.addColorStop(1, 'rgba(220,250,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 256);
    const edge = g.createLinearGradient(0, 0, 64, 0);
    edge.addColorStop(0, 'rgba(0,0,0,1)');
    edge.addColorStop(0.5, 'rgba(0,0,0,0)');
    edge.addColorStop(1, 'rgba(0,0,0,1)');
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = edge;
    g.fillRect(0, 0, 64, 256);
    const tex = new THREE.CanvasTexture(c);
    this.shafts = [];
    for (let i = 0; i < 7; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.35 + Math.random() * 0.4, 3.2),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.35, side: THREE.DoubleSide, fog: false }));
      const a = (i / 7) * Math.PI * 2 + Math.random();
      const r = 0.6 + Math.random() * 1.8;
      m.position.set(Math.cos(a) * r, 1.6, Math.sin(a) * r);
      m.rotation.z = 0.22;
      m.userData.phase = Math.random() * 10;
      this.root.add(m);
      this.shafts.push(m);
    }
  }

  makeCaustics() {
    // Rippling light on the floor: a cheap animated caustic pattern, faded out towards the edge.
    this.caustics = new THREE.Mesh(new THREE.CircleGeometry(4, 64).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uStrength: { value: 0.5 } },
      vertexShader: 'varying vec2 vP; void main(){ vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform float uTime; uniform float uStrength; varying vec2 vP;
        float c(vec2 p){ vec2 i = p; float v = 0.0;
          for(int n=0;n<3;n++){ float t = uTime*(0.3+0.1*float(n)); i = p + vec2(cos(t - i.x) + sin(t + i.y), sin(t - i.y) + cos(t + i.x));
            v += 1.0 / length(vec2(p.x / (sin(i.x + t) / 0.02), p.y / (cos(i.y + t) / 0.02))); }
          v /= 3.0; return pow(clamp(1.17 - pow(v, 1.4), 0.0, 1.0), 8.0); }
        void main(){ float k = c(vP * 2.2); float fade = 1.0 - smoothstep(1.5, 4.0, length(vP));
          gl_FragColor = vec4(vec3(0.75, 0.95, 1.0) * k * uStrength * fade, 1.0); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    this.caustics.position.y = 0.005;
    this.caustics.renderOrder = 1;
    this.root.add(this.caustics);
  }

  makeSnow() {
    const n = 700;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n * 3; i++) pos[i] = (Math.random() - 0.5) * 4;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.snow = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xdff4ff, size: 0.008, transparent: true, opacity: 0.55, depthWrite: false, fog: false }));
    this.snow.frustumCulled = false;
    this.app.scene.add(this.snow);
  }

  makeBubbles() {
    const n = 120;
    this.bubbles = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xe8fbff, transparent: true, opacity: 0.45, roughness: 0.05, metalness: 0.3, emissive: 0x204050, depthWrite: false }), n);
    this.bubbles.frustumCulled = false;
    this.bubbleData = Array.from({ length: n }, () => ({ life: 0, p: new THREE.Vector3(), r: 0.005, seed: Math.random() * 10 }));
    this.app.scene.add(this.bubbles);
    this.lastHands = [];
    this.vents = [new THREE.Vector3(0.35, 0.6, 0.2), new THREE.Vector3(-0.5, 0.4, -0.25)];
  }

  spawnBubble(worldPos, size = 0.004 + Math.random() * 0.006) {
    const b = this.bubbleData.find((x) => x.life <= 0);
    if (!b) return;
    b.life = 2.5 + Math.random() * 2;
    b.p.copy(worldPos);
    b.r = size;
  }

  /** Change how the water looks (from the reef's state). */
  setConditions({ murk, bloom }) {
    this.murk = murk;
    this.bloom = bloom;
  }

  update(dt) {
    this.time += dt;
    const t = this.time;
    const cam = this.app.viewCamera().getWorldPosition(new THREE.Vector3());
    this.dome.position.copy(cam);
    // colour: bluer when clear, greener with a bloom, darker and more opaque when murky
    const u = this.dome.material.uniforms;
    u.uTop.value.copy(SURFACE).lerp(GREEN, this.bloom * 0.7).multiplyScalar(1 - this.murk * 0.45);
    u.uDeep.value.copy(DEEP).lerp(GREEN, this.bloom * 0.4).multiplyScalar(1 - this.murk * 0.4);
    u.uAlpha.value = 0.3 + this.murk * 0.35 + this.bloom * 0.1;
    this.app.scene.fog.density = 0.1 + this.murk * 0.45;
    this.app.scene.fog.color.copy(u.uTop.value).lerp(u.uDeep.value, 0.5);
    this.caustics.material.uniforms.uTime.value = t;
    this.caustics.material.uniforms.uStrength.value = 0.55 * (1 - this.murk * 0.8);
    for (const s of this.shafts) {
      s.material.opacity = (0.28 + 0.12 * Math.sin(t * 0.4 + s.userData.phase)) * (1 - this.murk * 0.8);
      s.rotation.y = Math.atan2(cam.x - s.getWorldPosition(new THREE.Vector3()).x, cam.z - s.getWorldPosition(new THREE.Vector3()).z);
    }

    // marine snow drifts slowly and wraps around you
    const p = this.snow.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i) + Math.sin(t * 0.3 + i) * 0.0008;
      let y = p.getY(i) - dt * 0.02;
      let z = p.getZ(i) + Math.cos(t * 0.25 + i * 1.7) * 0.0008;
      const wrap = (v, c) => (v - c > 2 ? v - 4 : v - c < -2 ? v + 4 : v);
      x = wrap(x, cam.x);
      y = wrap(y, cam.y);
      z = wrap(z, cam.z);
      p.setXYZ(i, x, y, z);
    }
    p.needsUpdate = true;
    this.snow.material.opacity = 0.45 + this.murk * 0.4;
    this.snow.material.size = 0.008 + this.murk * 0.01;

    // bubbles from moving hands, and from two vents in the reef
    const hands = this.app.presenting ? this.app.interaction.controllers.filter((c) => c.userData.mode === 'tracked-pointer').map((c) => this.app.interaction.sourcePoint(c)) : [];
    hands.forEach((h, i) => {
      const last = this.lastHands[i];
      if (last && last.distanceTo(h) > 0.025 && Math.random() < 0.6) this.spawnBubble(h);
      this.lastHands[i] = h;
    });
    if (Math.random() < dt * 4) {
      const v = this.vents[Math.floor(Math.random() * this.vents.length)];
      this.spawnBubble(this.root.localToWorld(v.clone()), 0.003 + Math.random() * 0.004);
    }
    const m = new THREE.Object3D();
    this.bubbleData.forEach((b, i) => {
      if (b.life > 0) {
        b.life -= dt;
        b.p.y += dt * (0.12 + b.r * 20);
        b.p.x += Math.sin(t * 6 + b.seed) * 0.0006;
        m.position.copy(b.p);
        m.scale.setScalar(b.life > 0 ? b.r : 0);
      } else m.scale.setScalar(0);
      m.updateMatrix();
      this.bubbles.setMatrixAt(i, m.matrix);
    });
    this.bubbles.instanceMatrix.needsUpdate = true;
  }
}

// ── Underwater sound ───────────────────────────────────

export class OceanSound {
  start() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    // a muffled rumble: brown noise through a low-pass filter, slowly swelling
    const buf = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      d[i] = last * 3.5;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 380;
    const gain = ctx.createGain();
    gain.gain.value = 0.25;
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.08;
    lfoGain.gain.value = 0.08;
    lfo.connect(lfoGain).connect(gain.gain);
    src.connect(lp).connect(gain).connect(ctx.destination);
    src.start();
    lfo.start();
    this.timer = setInterval(() => this.whale(), 38000);
    setTimeout(() => this.whale(), 6000);
  }

  /** A distant whale call. */
  whale() {
    const ctx = this.ctx;
    if (!ctx) return;
    const o = ctx.createOscillator();
    const v = ctx.createOscillator();
    const vg = ctx.createGain();
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    const now = ctx.currentTime;
    o.frequency.setValueAtTime(180, now);
    o.frequency.exponentialRampToValueAtTime(320, now + 1.6);
    o.frequency.exponentialRampToValueAtTime(140, now + 3.5);
    v.frequency.value = 5;
    vg.gain.value = 6;
    v.connect(vg).connect(o.frequency);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.05, now + 0.8);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 3.8);
    o.connect(lp).connect(g).connect(ctx.destination);
    o.start(now);
    v.start(now);
    o.stop(now + 4);
    v.stop(now + 4);
  }

  blip() {
    const ctx = this.ctx;
    if (!ctx) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const now = ctx.currentTime;
    o.frequency.setValueAtTime(500 + Math.random() * 300, now);
    o.frequency.exponentialRampToValueAtTime(1400, now + 0.08);
    g.gain.setValueAtTime(0.04, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
    o.connect(g).connect(ctx.destination);
    o.start(now);
    o.stop(now + 0.12);
  }
}
