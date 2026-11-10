import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

// Everyone in a shared session appears as a little axolotl floating where their eyes are, facing the
// way they look, with a ring in their colour. Model: "Axolotl - Standing 3D Animal Model" by Pigcraft
// (Sketchfab, CC BY 4.0), reduced to 6k triangles (shared/models/CREDITS.md).

const URL_GLB = new URL('../models/axolotl.glb', import.meta.url).toString();
const LENGTH = 0.6; // metres, nose to tail
let model = null; // Promise<THREE.Object3D>, loaded once and cloned for each person

function load() {
  model ??= new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(URL_GLB).then((g) => {
    g.scene.traverse((o) => {
      if (!o.isMesh) return;
      o.geometry.computeVertexNormals(); // the file leaves normals out to stay small
      o.material.emissive?.set(0x2a1418); // a little glow so it shows in dim scenes and deep water
    });
    return g.scene;
  });
  return model;
}

/** A group whose origin is where the person's eyes are; forward is −z. */
export function makeAxolotl(color) {
  const g = new THREE.Group();
  load().then((m) => {
    const a = m.clone();
    a.scale.setScalar(LENGTH / 0.98);
    a.position.set(0, -0.47 * LENGTH / 0.55, 0.06); // its head where their eyes are
    g.add(a);
  }).catch((e) => console.warn('Axolotl avatar not loaded', e));
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.22, 0.012, 8, 40).rotateX(Math.PI / 2),
    new THREE.MeshBasicMaterial({ color, toneMapped: false }),
  );
  ring.position.set(0, -0.5 * LENGTH / 0.55, 0.02);
  g.add(ring);
  return g;
}
