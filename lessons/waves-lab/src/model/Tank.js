import * as THREE from 'three';
import { TANK, SETUP_INDEX } from '../data/waves.js';

// A ripple tank seen from above. The water surface is worked out in a shader from the physics of each
// set-up (so it costs almost nothing on a headset):
//   open      straight ripples from a dipping bar
//   barrier   a slanted wall: the incoming ripples plus their mirror image (reflection)
//   gap       a wall with a gap: every point of the gap sends out circular ripples (diffraction)
//   two       two dippers: their circular ripples add up (interference)
//   shallow   a shallow patch where ripples travel at half the speed and bend (refraction)
// Coordinates are metres on the tank: x across (ripples travel towards +x), y away from you.

const HEIGHT = /* glsl */ `
uniform float uPhase, uK, uAmp, uGap, uRatio, uHalf;
uniform int uSetup;
float wave(float ph) { return sin(ph - uPhase); }
float height(vec2 p) {
  float x = p.x + uHalf;
  if (uSetup == 0) return wave(uK * x);
  if (uSetup == 1) {
    vec2 n = vec2(0.70711, 0.70711);
    float s = dot(n, p) - 0.12;
    if (s > 0.0) return 0.0;
    vec2 m = p - 2.0 * s * n;
    return 0.6 * (wave(uK * x) + smoothstep(-0.15, -0.11, p.x) * wave(uK * (m.x + uHalf)));
  }
  if (uSetup == 2) {
    float x0 = -0.08;
    if (p.x < x0) return wave(uK * x);
    float sum = 0.0;
    for (int i = 0; i < 12; i++) {
      vec2 s = vec2(x0, ((float(i) + 0.5) / 12.0 - 0.5) * uGap);
      float r = distance(p, s);
      sum += wave(uK * (x0 + uHalf + r)) / sqrt(1.0 + r / (0.5 * uGap + 0.02));
    }
    return sum / 12.0;
  }
  if (uSetup == 3) {
    float r1 = distance(p, vec2(-0.2, 0.07));
    float r2 = distance(p, vec2(-0.2, -0.07));
    return 0.75 * (wave(uK * r1) / sqrt(1.0 + r1 * 8.0) + wave(uK * r2) / sqrt(1.0 + r2 * 8.0));
  }
  vec2 n = normalize(vec2(1.0, 0.55));
  float d = 0.02;
  float s = dot(n, p) - d;
  if (s < 0.0) return wave(uK * x);
  vec2 t = vec2(-n.y, n.x);
  float kt = uK * t.x;
  float k2 = uK * uRatio;
  return wave(sqrt(k2 * k2 - kt * kt) * s + uK * n.x * d + kt * dot(t, p) + uK * uHalf);
}
`;

const VERT = /* glsl */ `
${HEIGHT}
uniform float uLift;
varying vec2 vP;
void main() {
  vP = position.xy;
  vec3 p = position;
  p.z += height(vP) * uAmp * uLift;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;

const FRAG = /* glsl */ `
${HEIGHT}
varying vec2 vP;
void main() {
  float e = 0.002;
  float h = height(vP) * uAmp;
  float hx = height(vP + vec2(e, 0.0)) * uAmp - h;
  float hy = height(vP + vec2(0.0, e)) * uAmp - h;
  vec3 n = normalize(vec3(-hx, -hy, 0.45));
  vec3 c = mix(vec3(0.02, 0.13, 0.30), vec3(0.36, 0.76, 1.0), 0.5 + 0.5 * h);
  c += 0.45 * pow(max(dot(n, normalize(vec3(-0.4, 0.5, 0.75))), 0.0), 20.0);
  vec3 wall = vec3(0.82, 0.84, 0.9);
  if (uSetup == 1) {
    float s = dot(vec2(0.70711, 0.70711), vP) - 0.12;
    if (s > 0.0) c = vec3(0.03, 0.12, 0.25);
    if (abs(s) < 0.006) c = wall;
  } else if (uSetup == 2) {
    if (abs(vP.x + 0.08) < 0.006 && abs(vP.y) > uGap * 0.5) c = wall;
  } else if (uSetup == 3) {
    if (distance(vP, vec2(-0.2, 0.07)) < 0.011 || distance(vP, vec2(-0.2, -0.07)) < 0.011) c = wall;
  } else if (uSetup == 4) {
    float s = dot(normalize(vec2(1.0, 0.55)), vP) - 0.02;
    if (s > 0.0) c = mix(c, vec3(0.80, 0.90, 0.72), 0.3);
    if (abs(s) < 0.002) c = mix(c, vec3(1.0), 0.5);
  }
  if (uSetup != 3 && vP.x < -uHalf + 0.012) c = wall * (0.8 + 0.2 * sin(uPhase));
  gl_FragColor = vec4(c, 1.0);
}
`;

export class Tank {
  /** `lift`: how far the surface really rises and falls (m); 0 for a flat picture of the tank. */
  constructor({ lift = 0.004, segments = 128, frame = true } = {}) {
    this.size = TANK.size;
    this.group = new THREE.Group();
    this.uniforms = {
      uPhase: { value: 0 },
      uK: { value: 60 },
      uAmp: { value: 0.6 },
      uGap: { value: 0.2 },
      uRatio: { value: TANK.shallow },
      uHalf: { value: this.size / 2 },
      uSetup: { value: 0 },
      uLift: { value: lift },
    };
    const seg = lift ? segments : 1;
    this.surface = new THREE.Mesh(
      new THREE.PlaneGeometry(this.size, this.size, seg, seg),
      new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: VERT, fragmentShader: FRAG, side: THREE.DoubleSide }),
    );
    this.group.add(this.surface);
    if (frame) {
      const mat = new THREE.MeshStandardMaterial({ color: 0x2a3560, roughness: 0.6 });
      const t = 0.014;
      const h = 0.03;
      const s = this.size;
      for (const [x, y, w, d] of [[0, s / 2 + t / 2, s + 2 * t, t], [0, -s / 2 - t / 2, s + 2 * t, t], [s / 2 + t / 2, 0, t, s], [-s / 2 - t / 2, 0, t, s]]) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, d, h), mat);
        m.position.set(x, y, 0);
        this.group.add(m);
      }
      const base = new THREE.Mesh(new THREE.BoxGeometry(s + 2 * t, s + 2 * t, 0.006), mat);
      base.position.z = -h / 2;
      this.group.add(base);
    }
    this.p = { f: 2, a: 0.6, v: 0.15 };
    this.k = 60;
  }

  /** f (Hz), a (0–1), v (m/s), setup id, gap width (m). */
  set({ f, a, v, setup, gap }) {
    this.p = { f, a, v };
    this.uniforms.uSetup.value = SETUP_INDEX[setup] ?? 0;
    this.uniforms.uGap.value = gap;
  }

  update(dt, frozen) {
    const u = this.uniforms;
    const ease = Math.min(1, dt * 6);
    u.uAmp.value += (this.p.a - u.uAmp.value) * ease;
    this.k += ((2 * Math.PI * this.p.f) / this.p.v - this.k) * ease;
    u.uK.value = this.k;
    if (!frozen) u.uPhase.value = (u.uPhase.value + 2 * Math.PI * this.p.f * dt) % (2 * Math.PI);
  }
}
