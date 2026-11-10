import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

// How classmates appear on the reef (shared sessions):
//  • in a headset: a scuba diver in their own colour (mask, snorkel, air tank, fins), whose arms and gloves
//    follow their real hands. It stands exactly where they really are once everyone has lined up with the room,
//    so you can find them even when the water hides the real room.
//  • on a computer: a little axolotl floating where their view is.
// Forward is −z, like every avatar in the shared session code (shared/net/Presence.js).

const AXOLOTL_URL = new URL('../../models/axolotl.glb', import.meta.url).toString();
let axolotl = null; // Promise<THREE.Object3D>, loaded once and cloned for each person

function loadAxolotl() {
  axolotl ??= new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(AXOLOTL_URL).then((g) => {
    g.scene.traverse((o) => {
      if (!o.isMesh) return;
      o.geometry.computeVertexNormals(); // the file leaves normals out to stay small
      o.material.emissive?.set(0x2a1418); // a little glow so it shows in deep water
    });
    return g.scene;
  });
  return axolotl;
}

export function makeAvatar(color) {
  const mine = new THREE.Color(color);
  const suit = new THREE.MeshStandardMaterial({ color: 0x2b3747, roughness: 0.75, emissive: 0x0d141c });
  const bright = new THREE.MeshStandardMaterial({ color: mine, roughness: 0.5, emissive: mine.clone().multiplyScalar(0.35) });
  const metal = new THREE.MeshStandardMaterial({ color: 0xc9d2dc, roughness: 0.3, metalness: 0.7, emissive: 0x1a2028 });
  const black = new THREE.MeshStandardMaterial({ color: 0x14181e, roughness: 0.5 });
  const mesh = (geo, mat, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    return m;
  };

  // head: hood, mask, snorkel, regulator
  const head = new THREE.Group();
  head.add(mesh(new THREE.SphereGeometry(0.1, 24, 16), suit));
  head.add(mesh(new THREE.BoxGeometry(0.17, 0.085, 0.05), bright, 0, 0.015, -0.085));
  const glass = new THREE.MeshStandardMaterial({ color: 0x0b2f3d, roughness: 0.05, metalness: 0.6, emissive: 0x062a33 });
  head.add(mesh(new THREE.BoxGeometry(0.145, 0.062, 0.012), glass, 0, 0.015, -0.112));
  const snorkel = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.26, 10), bright, -0.108, 0.07, -0.02);
  snorkel.rotation.z = 0.12;
  head.add(snorkel);
  head.add(mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.04, 12).rotateX(Math.PI / 2), black, 0, -0.06, -0.1));

  // body: wetsuit torso with a coloured vest, air tank on the back, legs and fins
  const body = new THREE.Group();
  body.add(mesh(new THREE.CapsuleGeometry(0.145, 0.34, 6, 16), suit));
  body.add(mesh(new THREE.BoxGeometry(0.31, 0.3, 0.26), bright, 0, 0.06, 0));
  body.add(mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.5, 16), metal, 0, 0.04, 0.19));
  body.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.06, 10), black, 0, 0.32, 0.19));
  for (const side of [-1, 1]) {
    const leg = mesh(new THREE.CapsuleGeometry(0.065, 0.36, 4, 12), suit, side * 0.075, -0.52, 0.02);
    leg.rotation.x = 0.12; // relaxed, a little behind, like a diver hovering
    body.add(leg);
    const fin = mesh(new THREE.BoxGeometry(0.11, 0.01, 0.28).translate(0, 0, 0.12), bright, side * 0.08, -0.76, 0.05);
    fin.rotation.x = 0.55; // fins trail backwards and down
    body.add(fin);
  }

  // gloves and arms (Presence stretches each arm from the shoulder to the hand)
  const hands = [0, 1].map(() => {
    const h = new THREE.Group();
    const glove = mesh(new THREE.SphereGeometry(0.042, 16, 12), bright);
    glove.scale.set(1, 0.75, 1.3);
    h.add(glove);
    return h;
  });
  const armGeo = new THREE.CylinderGeometry(0.036, 0.03, 1, 12).translate(0, 0.5, 0);
  const arms = [0, 1].map(() => new THREE.Mesh(armGeo, suit));

  // on a computer: an axolotl (about 0.55 m long), its head where their view is
  const desk = new THREE.Group();
  loadAxolotl().then((model) => {
    const a = model.clone();
    a.scale.setScalar(0.55);
    a.position.set(0, -0.43, 0.06);
    desk.add(a);
  }).catch((e) => console.warn('Axolotl avatar not loaded', e));
  const halo = mesh(new THREE.TorusGeometry(0.2, 0.012, 8, 40).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: mine, toneMapped: false }), 0, -0.45, 0.02);
  desk.add(halo);

  return { head, body, hands, arms, desk };
}
