import { getElement, CATEGORY_NAMES, VDW_RADII, IONIC_RADII } from '../data/elements.js';
import { MOLECULES, moleculeExtentA } from '../data/molecules.js';
import { describeAtom, atomToNucleusRatio, nucleusRadiusFm } from '../data/atomInfo.js';
import { COMPARE_PRESETS, NUCLEUS_OBJECTS } from '../models/ScaleExplorer.js';
import { formatLength, compareLength, formatNumber } from '../util/format.js';

// "Ask the Chemist": answers built from what is currently in front of the student.
// Works offline. If config.js sets `chemistEndpoint`, an extra "Ask AI" option sends
// the question plus a description of the scene to that endpoint (e.g. your LLM proxy).

export function questionsFor(state) {
  const remote = !!window.WEBXR_CLASSES_CONFIG?.chemistEndpoint;
  let qs;
  if (state.mode === 'atom') {
    const info = describeAtom(state.atom);
    qs = [
      { id: 'identity', label: 'What decides the element?' },
      { id: info.charge !== 0 ? 'ion' : 'isotope', label: info.charge !== 0 ? 'Why is it charged?' : 'What is an isotope?' },
      { id: 'shells', label: 'How do shells fill?' },
      { id: 'reactivity', label: 'Will it react?' },
      { id: 'atomSize', label: 'How big is it really?' },
      { id: 'fact', label: 'Fun fact' },
    ];
  } else if (state.mode === 'molecules') {
    qs = [
      { id: 'shape', label: 'Why this shape?' },
      { id: 'bonds', label: 'What is a bond?' },
      { id: 'polar', label: 'Is it polar?' },
      { id: 'models', label: 'Which model is “right”?' },
      { id: 'molSize', label: 'How big is it really?' },
      { id: 'molFact', label: 'Fun fact' },
    ];
  } else {
    qs = [
      { id: 'empty', label: 'Is an atom empty?' },
      { id: 'howKnow', label: 'How do we know?' },
      { id: 'trend', label: 'Why do sizes change?' },
      { id: 'mass', label: 'Where is the mass?' },
      { id: 'window', label: 'How far is the edge?' },
      { id: 'touch', label: 'Why can’t I walk through walls?' },
    ];
  }
  if (remote) qs.push({ id: 'ai', label: 'Ask AI about this' });
  return qs;
}

export function answerFor(id, state) {
  const { p, n, e } = state.atom;
  const info = describeAtom(state.atom);
  const el = info.element;
  const mol = MOLECULES[state.molecule];

  switch (id) {
    // ── Atom ──────────────────────────────────────────────
    case 'identity': {
      if (!el) return 'With no protons there is no element at all! The number of protons (the atomic number) is what makes an atom hydrogen, carbon, gold… Add a proton to make hydrogen.';
      const next = getElement(p + 1);
      const prev = getElement(p - 1);
      return `Protons decide the element. Every ${el.name} atom has exactly ${p} proton${p > 1 ? 's' : ''}.${next ? ` Add one and it becomes ${next.name}` : ''}${prev ? `; take one away and it becomes ${prev.name}` : ''}. Changing neutrons or electrons never changes the element.`;
    }
    case 'isotope':
      if (!el) return 'Isotopes are versions of the same element with different numbers of neutrons. Add a proton first!';
      return `Isotopes are atoms of the same element with different numbers of neutrons. This is ${info.isotopeName} (${p} protons + ${n} neutrons = mass number ${info.A}). ${info.stability}. Try adding or removing neutrons — the element stays ${el.name}, only the mass changes.`;
    case 'ion':
      return `Charge = protons − electrons = ${p} − ${e} = ${info.chargeStr}. ${info.charge > 0 ? 'It has lost electrons, so it is a positive ion (cation).' : 'It has gained electrons, so it is a negative ion (anion).'} ${el ? `Written as ${info.ionSymbol}.` : ''} Atoms often gain or lose electrons to get a full outer shell.`;
    case 'shells':
      if (!e) return 'There are no electrons yet. Add some: the first shell holds 2, the next holds 8, and in this simple model the third holds 8 before the fourth starts.';
      return `The shells here hold ${info.shells.join(', ')} electrons. Electrons fill the shell nearest the nucleus first (it holds 2), then the next (8)… The outer shell has ${info.valence} electron${info.valence > 1 ? 's' : ''} — these are the ones involved in chemical reactions.`;
    case 'reactivity': {
      if (!el) return 'Build an element first, then ask again!';
      const v = info.valence;
      const full = (info.shells.length === 1 && v === 2) || v === 8;
      if (el.category === 'noble' || full) return `${el.name} has a full outer shell, so it is very stable and barely reacts — that is why noble gases are called “inert”.`;
      if (v <= 2) return `${el.name} (${CATEGORY_NAMES[el.category]}) has just ${v} outer electron${v > 1 ? 's' : ''}. It tends to LOSE ${v > 1 ? 'them' : 'it'} to reach a full shell, forming a positive ion. Metals like this can be very reactive.`;
      if (v >= 6) return `${el.name} has ${v} outer electrons — only ${8 - v} short of a full shell. It tends to GAIN or SHARE electrons, forming negative ions or covalent bonds.`;
      return `${el.name} has ${v} outer electrons. Rather than gain or lose that many, it usually SHARES electrons in covalent bonds — carbon does this to build the molecules of life.`;
    }
    case 'atomSize': {
      if (!el) return 'Add some protons first!';
      const realD = el.radius * 2e-12;
      const ratio = atomToNucleusRatio(el, info.A);
      return `A ${el.name} atom is about ${formatLength(realD)} across — you could line up ${formatNumber(1e-3 / realD)} of them across 1 mm. Its nucleus is about ${formatNumber(ratio)} times smaller than the whole atom. Open “Scale” to see what that means in your room.`;
    }
    case 'fact':
      return el ? el.fact : 'Free neutrons are used in nuclear reactors to split uranium atoms.';

    // ── Molecules ─────────────────────────────────────────
    case 'shape':
      return mol.crystal
        ? 'Ionic compounds form repeating 3D lattices. In salt, ions of opposite charge sit next to each other in a cubic pattern, because opposite charges attract and like charges repel.'
        : `${mol.name} is ${mol.shape.toLowerCase()}${mol.angle !== '—' ? ` with a bond angle of ${mol.angle}` : ''}. Electron pairs around the central atom repel each other and spread out as far as possible — lone pairs push a little harder than bonding pairs.`;
    case 'bonds':
      return `${mol.bondText}. A covalent bond is a pair of electrons shared between two atoms; double and triple bonds share 2 or 3 pairs and are shorter and stronger. Ionic bonds are the attraction between oppositely charged ions.`;
    case 'polar':
      return `${mol.polar}. A molecule is polar when electrons are pulled more towards one end, giving it a slightly negative and a slightly positive side.`;
    case 'models':
      return 'Both are models! Ball-and-stick (same-size balls) shows clearly which atoms are bonded and the angles between them. Space-filling uses each atom’s real relative size, so it shows the molecule’s true shape and how crowded it is. Switch between them to compare.';
    case 'molSize': {
      const m = moleculeExtentA(mol, VDW_RADII, IONIC_RADII) * 1e-10;
      return `${mol.name} is about ${formatLength(m)} across — about ${formatNumber(1e-3 / m)} of them would fit side by side across 1 mm. Magnified a billion times (1 Å → 10 cm) like these models, a grain of sand would be ${formatLength(5e-4 * 1e9)} wide — ${compareLength(5e-4 * 1e9)}.`;
    }
    case 'molFact':
      return mol.fact;

    // ── Scale ─────────────────────────────────────────────
    case 'empty':
      return 'Almost! If you could remove all the empty space from the atoms in every human on Earth, all 8 billion of us would fit inside a sugar cube. The nucleus is tiny and electrons are spread out thinly around it.';
    case 'howKnow':
      return 'In 1909 Geiger and Marsden (working with Rutherford) fired alpha particles at thin gold foil. Most went straight through — so atoms are mostly empty — but about 1 in 8,000 bounced back, revealing a tiny, dense, positive nucleus.';
    case 'trend': {
      const z = COMPARE_PRESETS[state.comparePreset].z.map(getElement);
      const big = z.reduce((a, b) => (b.radius > a.radius ? b : a));
      const small = z.reduce((a, b) => (b.radius < a.radius ? b : a));
      return `In this set ${big.name} is biggest (${big.radius} pm) and ${small.name} smallest (${small.radius} pm). Going DOWN a group, atoms grow because they have more shells. Going ACROSS a period they shrink: more protons pull the same number of shells in tighter.`;
    }
    case 'mass':
      return 'More than 99.9% of an atom’s mass is in its nucleus. Nuclear matter is so dense that a teaspoon of it would weigh about a billion tonnes — like a mountain in a spoon.';
    case 'window': {
      const r = roomScale(state);
      return `With the nucleus of ${r.name} the size of a ${r.object.label.toLowerCase()}, the edge of the electron cloud is ${formatLength(r.R)} away — ${compareLength(r.R)}. Look out of the window: the atom’s edge is far beyond it. Everything in between is almost empty space.`;
    }
    case 'touch':
      return 'Because the electron clouds of your hand and the wall push each other away (they are both negative). You never actually touch anything — you feel that electric repulsion!';
    default:
      return '';
  }
}

function roomScale(state) {
  const Z = Math.max(1, state.atom.p);
  const el = getElement(Z);
  const A = state.atom.p ? state.atom.p + state.atom.n : 1;
  const object = NUCLEUS_OBJECTS[state.nucleusObject];
  const ratio = atomToNucleusRatio(el, A);
  return { name: `${el.name}-${A}`, object, R: object.radius * ratio, ratio, nucleusFm: nucleusRadiusFm(A) };
}
export { roomScale };

/** Plain-text description of the scene, sent to an optional AI endpoint as context. */
export function sceneContext(state) {
  if (state.mode === 'atom') {
    const i = describeAtom(state.atom);
    return `Student is building an atom: ${state.atom.p} protons, ${state.atom.n} neutrons, ${state.atom.e} electrons` +
      (i.element ? ` (${i.isotopeName}, charge ${i.chargeStr}, shells ${i.shells.join(',')}).` : '.');
  }
  if (state.mode === 'molecules') {
    const m = MOLECULES[state.molecule];
    return `Student is looking at a ${state.molStyle === 'space' ? 'space-filling' : 'ball-and-stick'} model of ${m.name} (${m.formula}), shape ${m.shape}.`;
  }
  if (state.scaleSub === 'compare') {
    return `Student is comparing atomic radii of: ${COMPARE_PRESETS[state.comparePreset].z.map((z) => getElement(z).name).join(', ')}.`;
  }
  const r = roomScale(state);
  return `Student is in mixed reality seeing the nucleus of ${r.name} scaled to a ${r.object.label}; the electron cloud edge is ${formatLength(r.R)} away.`;
}

export async function askRemote(question, state) {
  const endpoint = window.WEBXR_CLASSES_CONFIG?.chemistEndpoint;
  if (!endpoint) throw new Error('No chemistEndpoint configured');
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question,
      context: sceneContext(state),
      audience: 'secondary school chemistry students; answer in under 80 words',
    }),
  });
  if (!res.ok) throw new Error(`Chemist endpoint returned ${res.status}`);
  const data = await res.json();
  return data.answer ?? data.text ?? JSON.stringify(data);
}
