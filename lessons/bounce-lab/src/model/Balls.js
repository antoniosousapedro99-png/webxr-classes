import * as THREE from 'three';
import { makeLabel } from '../../../../shared/ui/labels.js';
import { BALLS, BALL_IDS } from '../data/bounce.js';

// The six balls at real size, on a shelf in the middle of your lab. Pick one up, hold it over a mat at
// any height and let go. (The balls live in the floor zone's coordinates, so their flights are worked out
// above the floor; on the shelf they simply follow the lab.)

const SHELF_Y = -0.42;

function ballTexture(id) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const x = c.getContext('2d');
  const col = `#${BALLS[id].color.toString(16).padStart(6, '0')}`;
  x.fillStyle = col;
  x.fillRect(0, 0, 512, 256);
  if (id === 'basketball') {
    x.strokeStyle = '#1b1208';
    x.lineWidth = 7;
    for (const u of [0, 128, 256, 384]) {
      x.beginPath();
      x.moveTo(u, 0);
      x.lineTo(u, 256);
      x.stroke();
    }
    x.beginPath();
    x.moveTo(0, 128);
    x.lineTo(512, 128);
    x.stroke();
  } else if (id === 'tennis') {
    x.strokeStyle = '#f7f7ef';
    x.lineWidth = 9;
    x.beginPath();
    for (let u = 0; u <= 512; u += 4) x.lineTo(u, 128 + 70 * Math.sin((u / 512) * Math.PI * 4));
    x.stroke();
  } else if (id === 'golf') {
    x.fillStyle = '#d9d9d9';
    for (let i = 0; i < 700; i++) {
      x.beginPath();
      x.arc((i * 37) % 512, ((i * 53) % 256), 3, 0, Math.PI * 2);
      x.fill();
    }
  } else if (id === 'pingpong') {
    x.fillStyle = '#7a4a10';
    x.font = '700 40px system-ui';
    x.fillText('★★★', 200, 140);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Balls {
  constructor(app, floor) {
    this.app = app;
    this.floor = floor;
    // the shelf
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.02, 0.2), new THREE.MeshStandardMaterial({ color: 0x2a3560, roughness: 0.6 }));
    shelf.position.set(0, SHELF_Y - 0.01, 0.02);
    app.lab.add(shelf);

    let x = -0.405;
    this.list = BALL_IDS.map((id) => {
      const b = BALLS[id];
      x += b.r + 0.025;
      const home = new THREE.Vector3(x, SHELF_Y + b.r, 0.02);
      x += b.r + 0.025;
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(b.r, 32, 20), new THREE.MeshStandardMaterial({ map: ballTexture(id), roughness: id === 'rubber' || id === 'golf' ? 0.25 : id === 'tennis' ? 0.95 : 0.6 }));
      const ball = { id, mesh, home, flight: null, held: false };
      mesh.userData = { handler: this, ball };
      floor.group.add(mesh);
      const label = makeLabel(b.short, { height: 0.018, size: 40 });
      label.position.set(home.x, SHELF_Y - 0.035, 0.12);
      app.lab.add(label);
      return ball;
    });
    this.byId = Object.fromEntries(this.list.map((b) => [b.id, b]));
  }

  get targets() {
    return this.list.map((b) => b.mesh);
  }

  onShelf(ball) {
    return !ball.flight && !ball.held && !ball.out;
  }

  /** Every frame: balls on the shelf follow the lab. */
  update() {
    for (const b of this.list) {
      if (!this.onShelf(b)) continue;
      this.floor.group.worldToLocal(this.app.lab.localToWorld(b.mesh.position.copy(b.home)));
    }
  }

  home(ball) {
    ball.flight = null;
    ball.out = false;
    ball.mesh.scale.set(1, 1, 1);
  }

  describe(o) {
    const b = BALLS[o.userData.ball.id];
    return `${b.name} · lift it over a mat and let go`;
  }

  tap(o) {
    this.app.selectBall(o.userData.ball.id, true);
  }

  grab(o, mode, world) {
    const ball = o.userData.ball;
    const zone = this.floor.group;
    ball.flight = null;
    ball.held = true;
    ball.mesh.scale.set(1, 1, 1);
    const off = ball.mesh.position.clone().sub(zone.worldToLocal(world.clone()));
    this.app.selectBall(ball.id, true);
    return {
      move: (w) => {
        ball.mesh.position.copy(zone.worldToLocal(w.clone())).add(off);
        if (!this.app.presenting) ball.mesh.position.z = 0; // on a screen: up, down and sideways only
      },
      release: () => {
        ball.held = false;
        this.app.letGo(ball, ball.mesh.position.clone());
      },
    };
  }
}
