import * as THREE from 'three';

// Glowing dots flowing along curved paths between points — for showing how parts work together
// (power, data, molecules, energy…). Points are in the coordinates of `parent`.

export class Flows {
  constructor(parent) {
    this.group = new THREE.Group();
    parent.add(this.group);
    this.flows = [];
    this.dot = new THREE.SphereGeometry(0.006, 10, 8);
  }

  clear() {
    for (const o of [...this.group.children]) this.group.remove(o);
    this.flows = [];
  }

  /** flows: [{ from, to, color }], highlights: [{ at, radius }] */
  show(flows, highlights = []) {
    this.clear();
    for (const { from, to, color } of flows) {
      let curve;
      if (from.distanceTo(to) < 0.01) {
        // a loop around one place (e.g. work happening inside one organelle)
        const pts = [];
        for (let i = 0; i <= 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          pts.push(from.clone().add(new THREE.Vector3(Math.cos(a) * 0.04, Math.sin(a) * 0.04, 0.03)));
        }
        curve = new THREE.CatmullRomCurve3(pts, true);
      } else {
        const mid = from.clone().add(to).multiplyScalar(0.5).add(new THREE.Vector3(0, 0, 0.1));
        curve = new THREE.QuadraticBezierCurve3(from, mid, to);
      }
      const mat = new THREE.MeshBasicMaterial({ color, toneMapped: false });
      const dots = [];
      for (let i = 0; i < 10; i++) {
        const d = new THREE.Mesh(this.dot, mat);
        d.userData.t = i / 10;
        this.group.add(d);
        dots.push(d);
      }
      this.group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(40)),
        new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.35 })));
      this.flows.push({ curve, dots });
    }
    for (const { at, radius = 0.05 } of highlights) {
      const glow = new THREE.Mesh(new THREE.SphereGeometry(radius, 20, 14),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.13, depthWrite: false, blending: THREE.AdditiveBlending }));
      glow.position.copy(at);
      glow.userData.pulse = true;
      this.group.add(glow);
    }
  }

  update(dt) {
    for (const f of this.flows) {
      for (const d of f.dots) {
        d.userData.t = (d.userData.t + dt * 0.3) % 1;
        d.position.copy(f.curve.getPoint(d.userData.t));
      }
    }
    const s = 1 + 0.2 * Math.sin(performance.now() / 250);
    for (const o of this.group.children) if (o.userData.pulse) o.scale.setScalar(s);
  }
}
