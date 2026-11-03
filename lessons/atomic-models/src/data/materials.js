// What the surfaces in a typical room are made of — used by "What's my room made of?".
// thickness (m) and density (kg/m³) give a rough mass; gPerAtom = average mass per atom (g/mol),
// so atoms ≈ mass / gPerAtom × Avogadro.

export const MATERIALS = {
  table: {
    name: 'Table', material: 'wood (cellulose)', formula: '(C₆H₁₀O₅)ₙ', elements: 'carbon, hydrogen and oxygen',
    thickness: 0.025, density: 600, gPerAtom: 7.7,
    note: 'Cellulose is a very long chain of sugar rings — built from the same C, H and O atoms you can build with.',
  },
  wall: {
    name: 'Wall', material: 'plasterboard (gypsum)', formula: 'CaSO₄·2H₂O', elements: 'calcium, sulfur, oxygen and hydrogen',
    thickness: 0.0125, density: 700, gPerAtom: 14.3,
    note: 'Gypsum crystals hold water molecules inside them — that is why plasterboard slows down fire.',
  },
  ceiling: null, // same as wall
  floor: {
    name: 'Floor', material: 'concrete (under the covering)', formula: 'mostly SiO₂ and CaCO₃', elements: 'oxygen, silicon and calcium',
    thickness: 0.1, density: 2400, gPerAtom: 20,
    note: 'Concrete is made from sand, gravel and cement — mostly oxygen atoms locked up with silicon and calcium.',
  },
  window: {
    name: 'Window', material: 'glass', formula: 'SiO₂ (+ Na and Ca)', elements: 'silicon, oxygen, sodium and calcium',
    thickness: 0.004, density: 2500, gPerAtom: 20,
    note: 'Glass is sand melted and cooled so fast its atoms never line up into a crystal.',
  },
  door: {
    name: 'Door', material: 'wood', formula: '(C₆H₁₀O₅)ₙ', elements: 'carbon, hydrogen and oxygen',
    thickness: 0.04, density: 500, gPerAtom: 7.7,
    note: 'Wood is about half carbon by mass — carbon the tree pulled out of the air as CO₂.',
  },
  couch: {
    name: 'Sofa', material: 'fabric and foam (polymers)', formula: 'long C, H, O, N chains', elements: 'carbon, hydrogen, oxygen and nitrogen',
    thickness: 0.3, density: 40, gPerAtom: 6.5,
    note: 'Foam is mostly air trapped in a polymer — the atoms are spread very thinly.',
  },
  screen: {
    name: 'Screen', material: 'glass, plastic and semiconductors', formula: 'SiO₂, polymers, In₂O₃/SnO₂', elements: 'silicon, oxygen, carbon, indium and tin',
    thickness: 0.006, density: 2500, gPerAtom: 20,
    note: 'A see-through layer of indium tin oxide conducts electricity so the screen can light each pixel.',
  },
};
MATERIALS.ceiling = { ...MATERIALS.wall, name: 'Ceiling' };

/** Map a WebXR plane / mesh semantic label to one of the materials above. */
export function materialFor(label = '') {
  const l = label.toLowerCase();
  if (l.includes('window')) return MATERIALS.window;
  if (l.includes('door')) return MATERIALS.door;
  if (l.includes('table') || l.includes('desk')) return MATERIALS.table;
  if (l.includes('wall')) return MATERIALS.wall;
  if (l.includes('floor')) return MATERIALS.floor;
  if (l.includes('ceiling')) return MATERIALS.ceiling;
  if (l.includes('couch') || l.includes('sofa') || l.includes('bed')) return MATERIALS.couch;
  if (l.includes('screen') || l.includes('monitor') || l.includes('tv')) return MATERIALS.screen;
  return null;
}
