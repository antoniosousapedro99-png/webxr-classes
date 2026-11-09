import * as THREE from 'three';

// Makes the real classroom look underwater (through passthrough), and the virtual sea life sit in it:
//  • a water tint around your head (lighter above, deeper below), drawn BEHIND the sea life so it can be
//    strong on the real room while the animals stay vivid; three strengths (light / medium / deep)
//  • a sandy sea bed on the real floor with rippling sunlight (caustics), fading out with distance
//  • sun shafts slanting down from the ceiling
//  • soft drifting "marine snow", bubbles from your hands, blue haze on far-away sea life (fog)
//  • muffled ocean sound
// `murk` (turbidity) and `bloom` (algae/phytoplankton) change the colour and visibility live.
//
// Mixed reality note: the headset blends our image over the camera view using its alpha. Additive effects
// (light, glow) must therefore leave alpha alone, or they turn into opaque black where they are dark.

// colours sampled from the reference underwater footage: teal overhead, navy-black towards the floor
const DEEP = new THREE.Color(0x011a24);
const MID = new THREE.Color(0x053648);
const SURFACE = new THREE.Color(0x0a6a88);
const GREEN = new THREE.Color(0x2f6b3a);

export const WATER_LEVELS = [
  { id: 'light', label: 'Light', alpha: 0.55, bed: 0.65 },
  { id: 'medium', label: 'Medium', alpha: 0.76, bed: 0.85 },
  { id: 'deep', label: 'Deep', alpha: 0.9, bed: 0.95 },
];

/** Normal "over" blending that also keeps alpha correct for passthrough compositing. */
function overBlend(mat) {
  return Object.assign(mat, {
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.SrcAlphaFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.OneFactor,
    blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
  });
}

/** Additive light that does not touch alpha (so it brightens the real room instead of covering it). */
export function addBlend(mat) {
  return Object.assign(mat, {
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.SrcAlphaFactor,
    blendDst: THREE.OneFactor,
    blendSrcAlpha: THREE.ZeroFactor,
    blendDstAlpha: THREE.OneFactor,
  });
}

/** Shared screen-size uniform for soft point particles (pixels per metre at 1 m). */
export const POINT_SCALE = { value: 600 };

/**
 * Soft, round point particles (flakes, plankton) with a per-point size in metres ("size" attribute, optional)
 * and gentle twinkle. glow = additive light; otherwise soft flakes blended normally.
 */
export function softPoints({ color, size = 0.006, opacity = 0.7, glow = false, twinkle = 0.3 }) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uSize: { value: size }, uOpacity: { value: opacity }, uScale: POINT_SCALE, uTime: { value: 0 }, uTwinkle: { value: twinkle } },
    vertexShader: `
      attribute float size; attribute float seed;
      uniform float uSize; uniform float uScale; uniform float uTime; uniform float uTwinkle;
      varying float vA;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float s = size > 0.0 ? size : uSize;
        gl_PointSize = clamp(s * uScale * projectionMatrix[1][1] / max(0.05, -mv.z), 1.0, 64.0);
        vA = 1.0 - uTwinkle * (0.5 + 0.5 * sin(uTime * (0.7 + fract(seed * 7.3)) + seed * 40.0));
        vA *= smoothstep(0.05, 0.35, -mv.z); // fade right in front of your eyes
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uColor; uniform float uOpacity; varying float vA;
      void main(){
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float a = (1.0 - smoothstep(0.25, 1.0, d)) * uOpacity * vA;
        if (a < 0.01) discard;
        gl_FragColor = vec4(uColor, a);
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
  });
  return glow ? addBlend(mat) : overBlend(mat);
}

/** Random per-point size and seed attributes for softPoints. */
export function pointAttributes(geo, n, minSize, maxSize) {
  const size = new Float32Array(n);
  const seed = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const r = Math.random();
    size[i] = minSize + (maxSize - minSize) * r * r * r; // mostly small, a few big
    seed[i] = Math.random();
  }
  geo.setAttribute('size', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
}

export class Water {
  constructor(app, oceanRoot) {
    this.app = app;
    this.root = oceanRoot;
    this.murk = 0.1;
    this.bloom = 0;
    this.time = 0;
    let saved = 1;
    try { saved = +(localStorage.getItem('reef-dive-water') ?? 1); } catch { /* storage blocked */ }
    this.level = WATER_LEVELS[saved] ? saved : 1;

    // Water tint around your head. It is drawn FIRST (before any sea life), so it tints the real room through
    // passthrough but the animals are drawn on top of it, staying vivid (fog gives them distance haze instead).
    const dome = new THREE.ShaderMaterial({
      uniforms: { uDeep: { value: DEEP.clone() }, uMid: { value: MID.clone() }, uTop: { value: SURFACE.clone() }, uAlpha: { value: 0.66 }, uTime: { value: 0 }, uLight: { value: 1 } },
      vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform vec3 uDeep; uniform vec3 uMid; uniform vec3 uTop; uniform float uAlpha; uniform float uTime; uniform float uLight; varying vec3 vDir;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
        void main(){
          float y = vDir.y;
          // teal overhead → deep blue at eye level → almost black towards the floor
          vec3 c = mix(uDeep, uMid, smoothstep(-0.75, 0.05, y));
          c = mix(c, uTop, smoothstep(0.05, 0.9, y));
          float light = 0.0;
          if (y > -0.2) {
            // shimmering sunlight on the surface above: soft cloudy cells that drift
            vec2 sp = vDir.xz / max(0.25, y + 0.35) * 2.2;
            float n = noise(sp + vec2(uTime * 0.12, uTime * 0.07)) * 0.6 + noise(sp * 2.3 - vec2(uTime * 0.18, -uTime * 0.11)) * 0.4;
            light += smoothstep(0.45, 0.9, n) * smoothstep(0.1, 0.8, y) * 0.35;
            // soft vertical light rays, flickering slowly, fading towards the floor
            float az = atan(vDir.x, vDir.z);
            float rays = noise(vec2(az * 9.0, uTime * 0.15)) * 0.65 + noise(vec2(az * 23.0, uTime * 0.25 + 3.0)) * 0.35;
            light += pow(rays, 3.0) * smoothstep(-0.2, 0.6, y) * 0.28;
          }
          c += vec3(0.05, 0.42, 0.52) * light * uLight;
          gl_FragColor = vec4(c, clamp(uAlpha * mix(1.15, 0.85, smoothstep(-0.7, 0.85, y)), 0.0, 0.96));
          #include <colorspace_fragment>
        }`,
      side: THREE.BackSide, transparent: false, depthTest: false, depthWrite: false,
    });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(0.35, 32, 16), overBlend(dome));
    this.dome.renderOrder = -100; // opaque pass, before everything (transparent: false keeps it there)
    this.dome.frustumCulled = false;
    app.scene.add(this.dome);

    app.scene.fog = new THREE.FogExp2(0x0b4f6e, 0.18);

    // Underwater light: water soaks up red first, so sunlight from above is blue-green and the
    // light bouncing up from below is a dark teal (this lesson only; the other lessons keep white light).
    app.scene.traverse((o) => {
      if (o.isHemisphereLight) {
        o.color.set(0xc4ecf5);
        o.groundColor.set(0x16343c);
        o.intensity = 1.9;
      } else if (o.isDirectionalLight) {
        o.color.set(0xe0f6ff);
        o.intensity = 1.7;
      }
    });

    this.makeShafts();
    this.makeSeabed();
    this.makeSnow();
    this.makeBubbles();
  }

  /** Cycle light → medium → deep (each person's own view). */
  cycleLevel() {
    this.level = (this.level + 1) % WATER_LEVELS.length;
    try { localStorage.setItem('reef-dive-water', String(this.level)); } catch { /* storage blocked */ }
    return WATER_LEVELS[this.level];
  }

  /** A camera flash: the water clears for a moment. */
  flash() {
    this.flashT = 0.12;
  }

  get levelInfo() {
    return WATER_LEVELS[this.level];
  }

  makeShafts() {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 256;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, 'rgba(220,250,255,0)'); // soft top: no hard edge near the ceiling
    grad.addColorStop(0.18, 'rgba(220,250,255,0.6)');
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
    for (let i = 0; i < 9; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.35 + Math.random() * 0.45, 3.4),
        addBlend(new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.4, side: THREE.DoubleSide, fog: false })));
      const a = (i / 9) * Math.PI * 2 + Math.random();
      const r = 0.8 + Math.random() * 2.8;
      m.position.set(Math.cos(a) * r, 1.7, Math.sin(a) * r);
      m.rotation.z = 0.22;
      m.userData.phase = Math.random() * 10;
      this.root.add(m);
      this.shafts.push(m);
    }
  }

  makeSeabed() {
    // A sandy sea floor laid over the real floor around the reef: rippled sand with dancing caustic light,
    // strong near the reef and fading out towards the room's edges.
    this.seabed = new THREE.Mesh(new THREE.CircleGeometry(5.5, 96).rotateX(-Math.PI / 2), overBlend(new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uStrength: { value: 0.55 }, uAlpha: { value: 0.75 }, uTint: { value: DEEP.clone() } },
      vertexShader: 'varying vec2 vP; void main(){ vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform float uTime; uniform float uStrength; uniform float uAlpha; uniform vec3 uTint; varying vec2 vP;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float caustic(vec2 p){ vec2 i = p; float v = 0.0;
          for(int n=0;n<3;n++){ float t = uTime*(0.3+0.1*float(n)); i = p + vec2(cos(t - i.x) + sin(t + i.y), sin(t - i.y) + cos(t + i.x));
            v += 1.0 / length(vec2(p.x / (sin(i.x + t) / 0.02), p.y / (cos(i.y + t) / 0.02))); }
          v /= 3.0; return pow(clamp(1.17 - pow(v, 1.4), 0.0, 1.0), 8.0); }
        void main(){
          float r = length(vP);
          // wind-blown sand ripples, with grains
          float rip = sin(vP.x * 11.0 + sin(vP.y * 2.1) * 2.0 + sin(vP.y * 0.6 + vP.x * 0.4) * 2.5);
          float g = hash(floor(vP * 180.0));
          vec3 sand = mix(vec3(0.50, 0.47, 0.38), vec3(0.74, 0.69, 0.55), smoothstep(-0.3, 1.0, rip));
          sand *= 0.9 + 0.2 * g;
          sand = mix(sand * vec3(0.55, 0.75, 0.8), uTint * 2.0, 0.45); // seen through water: blue-green and darker
          vec3 col = sand + vec3(0.7, 0.95, 1.0) * caustic(vP * 2.2) * uStrength;
          float a = uAlpha * (1.0 - smoothstep(3.4, 5.5, r));
          gl_FragColor = vec4(col, a);
          #include <colorspace_fragment>
        }`,
      transparent: false, depthWrite: false,
    })));
    this.seabed.position.y = 0.004;
    this.seabed.renderOrder = -90; // after the water tint, before the sea life
    this.root.add(this.seabed);
  }

  makeSnow() {
    // Marine snow: soft flakes of many sizes drifting slowly down, in a 5 m box that follows you.
    const n = 1600;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n * 3; i++) pos[i] = (Math.random() - 0.5) * 5;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    pointAttributes(geo, n, 0.0025, 0.014);
    this.snow = new THREE.Points(geo, softPoints({ color: 0xe6f6ff, opacity: 0.6, twinkle: 0.35 }));
    this.snow.frustumCulled = false;
    this.snow.renderOrder = 6;
    this.app.scene.add(this.snow);
    // a few bright motes catching the light
    const m = 160;
    const pos2 = new Float32Array(m * 3);
    for (let i = 0; i < m * 3; i++) pos2[i] = (Math.random() - 0.5) * 5;
    const geo2 = new THREE.BufferGeometry();
    geo2.setAttribute('position', new THREE.BufferAttribute(pos2, 3));
    pointAttributes(geo2, m, 0.003, 0.008);
    this.motes = new THREE.Points(geo2, softPoints({ color: 0xbff4ff, opacity: 0.9, glow: true, twinkle: 0.9 }));
    this.motes.frustumCulled = false;
    this.app.scene.add(this.motes);
  }

  makeBubbles() {
    const n = 120;
    this.bubbles = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xe8fbff, transparent: true, opacity: 0.45, roughness: 0.05, metalness: 0.3, emissive: 0x204050, depthWrite: false }), n);
    this.bubbles.frustumCulled = false;
    this.bubbleData = Array.from({ length: n }, () => ({ life: 0, p: new THREE.Vector3(), r: 0.005, seed: Math.random() * 10 }));
    this.app.scene.add(this.bubbles);
    this.lastHands = [];
    this.vents = this.app.reef?.vents ?? [new THREE.Vector3(0.35, 0.6, 0.2)];
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
    const lv = WATER_LEVELS[this.level];
    // colour: bluer when clear, greener with a bloom, darker and more opaque when murky
    const u = this.dome.material.uniforms;
    u.uTop.value.copy(SURFACE).lerp(GREEN, this.bloom * 0.7).multiplyScalar(1 - this.murk * 0.45);
    u.uMid.value.copy(MID).lerp(GREEN, this.bloom * 0.5).multiplyScalar(1 - this.murk * 0.4);
    u.uDeep.value.copy(DEEP).lerp(GREEN, this.bloom * 0.4).multiplyScalar(1 - this.murk * 0.4);
    u.uTime.value = t;
    u.uLight.value = 1 - this.murk * 0.85;
    u.uAlpha.value = Math.min(0.92, lv.alpha + this.murk * 0.3 + this.bloom * 0.1);
    if (this.flashT > 0) {
      this.flashT -= dt;
      u.uAlpha.value *= 0.15;
    }
    this.app.scene.fog.density = 0.16 + this.murk * 0.45 + this.level * 0.03;
    this.app.scene.fog.color.copy(u.uMid.value).lerp(u.uTop.value, 0.25);
    const bed = this.seabed.material.uniforms;
    bed.uTime.value = t;
    bed.uStrength.value = 0.6 * (1 - this.murk * 0.8);
    bed.uAlpha.value = lv.bed;
    bed.uTint.value.copy(u.uMid.value);
    for (const s of this.shafts) {
      s.material.opacity = (0.32 + 0.14 * Math.sin(t * 0.4 + s.userData.phase)) * (1 - this.murk * 0.8);
      s.rotation.y = Math.atan2(cam.x - s.getWorldPosition(new THREE.Vector3()).x, cam.z - s.getWorldPosition(new THREE.Vector3()).z);
    }

    // particle size: pixels per metre, from the real framebuffer height (much taller in the headset)
    const xr = this.app.renderer.xr;
    const h = (xr.isPresenting && xr.getBaseLayer?.()?.framebufferHeight) || this.app.renderer.domElement.height;
    POINT_SCALE.value = h * 0.5;

    // marine snow drifts slowly down and sideways, and wraps around you
    const wrap = (v, c) => (v - c > 2.5 ? v - 5 : v - c < -2.5 ? v + 5 : v);
    for (const [pts, fall, sway] of [[this.snow, 0.018, 0.0007], [this.motes, 0.006, 0.0012]]) {
      const p = pts.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i) + Math.sin(t * 0.3 + i) * sway;
        const y = p.getY(i) - dt * fall * (0.6 + (i % 7) / 7);
        const z = p.getZ(i) + Math.cos(t * 0.25 + i * 1.7) * sway;
        p.setXYZ(i, wrap(x, cam.x), wrap(y, cam.y), wrap(z, cam.z));
      }
      p.needsUpdate = true;
      pts.material.uniforms.uTime.value = t;
    }
    this.snow.material.uniforms.uOpacity.value = 0.55 + this.murk * 0.4;
    this.motes.material.uniforms.uOpacity.value = 0.9 * (1 - this.murk * 0.7);

    // bubbles from moving hands, and from two vents in the reef
    const hands = this.app.presenting ? this.app.interaction.controllers.filter((c) => c.userData.mode === 'tracked-pointer').map((c) => this.app.interaction.sourcePoint(c)) : [];
    hands.forEach((hp, i) => {
      const last = this.lastHands[i];
      if (last && last.distanceTo(hp) > 0.025 && Math.random() < 0.6) this.spawnBubble(hp);
      this.lastHands[i] = hp;
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
