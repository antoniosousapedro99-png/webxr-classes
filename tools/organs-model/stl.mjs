// Binary STL → indexed mesh (welded), plus small helpers.
import fs from 'node:fs';

export function readSTL(file) {
  const b = fs.readFileSync(file);
  const n = b.readUInt32LE(80);
  const map = new Map();
  const pos = [];
  const idx = new Uint32Array(n * 3);
  let o = 84;
  for (let t = 0; t < n; t++) {
    o += 12; // normal
    for (let k = 0; k < 3; k++) {
      const x = b.readFloatLE(o), y = b.readFloatLE(o + 4), z = b.readFloatLE(o + 8);
      o += 12;
      const key = `${Math.round(x * 1000)},${Math.round(y * 1000)},${Math.round(z * 1000)}`;
      let i = map.get(key);
      if (i === undefined) {
        i = pos.length / 3;
        pos.push(x, y, z);
        map.set(key, i);
      }
      idx[t * 3 + k] = i;
    }
    o += 2;
  }
  return { pos: new Float32Array(pos), idx };
}

export function bbox(pos) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < pos.length; i += 3) for (let k = 0; k < 3; k++) {
    min[k] = Math.min(min[k], pos[i + k]);
    max[k] = Math.max(max[k], pos[i + k]);
  }
  return { min, max };
}

/** Connected components (by shared vertices): an array of component ids per triangle. */
export function components(mesh) {
  const nv = mesh.pos.length / 3;
  const parent = new Int32Array(nv).map((_, i) => i);
  const find = (a) => { while (parent[a] !== a) a = parent[a] = parent[parent[a]]; return a; };
  const { idx } = mesh;
  for (let t = 0; t < idx.length; t += 3) {
    const a = find(idx[t]), b = find(idx[t + 1]), c = find(idx[t + 2]);
    parent[b] = a;
    parent[find(c)] = a;
  }
  const ids = new Map();
  const comp = new Int32Array(idx.length / 3);
  for (let t = 0; t < comp.length; t++) {
    const r = find(idx[t * 3]);
    if (!ids.has(r)) ids.set(r, ids.size);
    comp[t] = ids.get(r);
  }
  return { comp, count: ids.size };
}
