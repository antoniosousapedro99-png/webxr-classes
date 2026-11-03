// What the "Chemist explains" card says when students pick up, pull apart or join pieces.
// Every function returns { title, text }.

import { getElement, bySymbol } from '../data/elements.js';
import { describeAtom } from '../data/atomInfo.js';
import { BUILD_ATOMS, bondEnergy, KNOWN } from '../data/bonding.js';
import { MOLECULES } from '../data/molecules.js';

// ── Subatomic particles ─────────────────────────────────

export const PARTICLES = {
  proton: {
    name: 'Proton',
    what: 'Positive charge (+1), mass ≈ 1 unit, lives in the nucleus. The number of protons is the atomic number — it decides which element the atom is.',
  },
  neutron: {
    name: 'Neutron',
    what: 'No charge, mass ≈ 1 unit, lives in the nucleus. Neutrons add mass and help hold the nucleus together with the strong nuclear force. Changing them makes a different isotope.',
  },
  electron: {
    name: 'Electron',
    what: 'Negative charge (−1), about 1/1836 of a proton’s mass. Electrons fill shells around the nucleus — the outer ones decide how the atom bonds and reacts.',
  },
};

/** What changed between two atoms (before/after a particle moved). */
export function atomChange(before, after) {
  const a = describeAtom(before);
  const b = describeAtom(after);
  const out = [];
  if (before.p !== after.p) {
    if (!b.element) out.push(`With no protons left there is no element at all!`);
    else if (!a.element) out.push(`One proton makes it ${b.element.name}!`);
    else out.push(`It was ${a.element.name} — now it is ${b.element.name}, because the number of protons changed.`);
  } else if (before.n !== after.n && b.element) {
    out.push(`Now ${b.isotopeName}: the same element, a different isotope. ${b.stability}.`);
  }
  if (a.charge !== b.charge && b.element) {
    out.push(b.charge === 0
      ? 'Protons and electrons now balance: it is a neutral atom.'
      : `Charge is now ${b.chargeStr} (${b.charge > 0 ? 'more protons than electrons' : 'more electrons than protons'}), so it is an ion: ${b.ionSymbol}.`);
  }
  return out.join(' ');
}

export function particlePicked(kind, removedFromAtom, before, after) {
  const p = PARTICLES[kind];
  if (!removedFromAtom) return { title: `${p.name} (from the tray)`, text: `${p.what} Drop it ${kind === 'electron' ? 'near the shells' : 'into the nucleus'} to add it.` };
  return { title: `${p.name} removed`, text: `${p.what} ${atomChange(before, after)}` };
}

export function particleDropped(kind, added, before, after) {
  const p = PARTICLES[kind];
  if (added) return { title: `${p.name} added`, text: atomChange(before, after) || `${p.name} added.` };
  return { title: `${p.name} let go`, text: `The ${p.name.toLowerCase()} drifted away. Drop it ${kind === 'electron' ? 'close to the electron shells' : 'right on the nucleus'} to add it to the atom.` };
}

export function particleLimit(kind) {
  return { title: 'That’s the limit here', text: `This lab goes up to krypton (36 protons, 36 electrons, 60 neutrons), so the ${kind} was not added.` };
}

// ── Molecule building ───────────────────────────────────

const BOND_NAMES = { 1: 'single', 2: 'double', 3: 'triple' };
const SYMBOL = { 1: '–', 2: '=', 3: '≡' };
const cap = (s) => s[0].toUpperCase() + s.slice(1);

function nameOf(sym) {
  return bySymbol(sym)?.name ?? sym;
}

export function atomPicked(sym, used, fromTray) {
  const b = BUILD_ATOMS[sym];
  const el = getElement(bySymbol(sym).Z);
  const free = b.valence - used;
  return {
    title: `${el.name} atom (${sym})${fromTray ? ' — new' : ''}`,
    text: `It has ${b.outer} outer electron${b.outer > 1 ? 's' : ''}, so it makes ${b.valence} bond${b.valence > 1 ? 's' : ''} to fill its outer shell. ${b.role} ` +
      (fromTray ? 'Bring it close to another atom to bond.' : free ? `It still has ${free} free bonding site${free > 1 ? 's' : ''}.` : 'All its bonds are in use.'),
  };
}

export function bondBroken(a, b, order) {
  const e = bondEnergy(a, b, order);
  const feel = e >= 700 ? ' Did you feel how hard that was? It is one of the strongest bonds there is.' : e && e < 260 ? ' That one gave way easily — it is a weak bond.' : '';
  return {
    title: `Bond broken: ${a}${SYMBOL[order]}${b}`,
    text: `A covalent bond is a pair of electrons shared by two atoms${order > 1 ? ` (a ${BOND_NAMES[order]} bond shares ${order} pairs)` : ''}. Pulling them apart takes energy${e ? ` — about ${e} kJ per mole` : ''}.${feel} Each atom now has a free bonding site again.`,
  };
}

/** Who pulls the shared electrons harder (electronegativity). */
export function polarity(a, b) {
  const d = BUILD_ATOMS[a].chi - BUILD_ATOMS[b].chi;
  if (Math.abs(d) < 0.4) return 'The electrons are shared almost equally (non-polar).';
  const [more, less] = d > 0 ? [a, b] : [b, a];
  return `${nameOf(more)} pulls the shared electrons closer (see the blue dot), so it is slightly negative (δ−) and ${nameOf(less).toLowerCase()} slightly positive (δ+) — a polar bond.`;
}

export function bondFormed(a, b) {
  const e = bondEnergy(a, b, 1);
  return {
    title: `Bond formed: ${a}–${b}`,
    text: `${nameOf(a)} and ${nameOf(b)} now share a pair of electrons, bringing each closer to a full outer shell. Forming a bond releases energy${e ? ` (about ${e} kJ/mol)` : ''}. ${polarity(a, b)}`,
  };
}

export function cannotDestroy(sym) {
  return {
    title: 'Atoms can’t be destroyed!',
    text: `In a chemical reaction atoms are only rearranged — never created or destroyed. ${sym ? `That ${nameOf(sym).toLowerCase()} atom` : 'Every atom'} has to end up in one of the products.`,
  };
}

export function bondFull(sym) {
  const b = BUILD_ATOMS[sym];
  return { title: 'No room for another bond', text: `${nameOf(sym)} can only make ${b.valence} bond${b.valence > 1 ? 's' : ''} and they are all used, so no new bond formed. Break one of its bonds first.` };
}

export function bondOrderChanged(a, b, order, blocked) {
  if (blocked) return { title: `${a}–${b} stays single`, text: `To make a double bond both atoms need a spare bonding site. Remove an atom (e.g. a hydrogen) from one of them first.` };
  if (order === 1) return { title: `Back to a single bond: ${a}–${b}`, text: 'One shared pair of electrons. Tap again to make it double.' };
  const e = bondEnergy(a, b, order);
  return {
    title: `${cap(BOND_NAMES[order])} bond: ${a}${SYMBOL[order]}${b}`,
    text: `${order} shared pairs of electrons. Multiple bonds are shorter and stronger${e ? ` (about ${e} kJ/mol)` : ''}, and each uses up an extra bonding site on both atoms.`,
  };
}

export function bondTapped(a, b, order) {
  const e = bondEnergy(a, b, order);
  return {
    title: `${cap(BOND_NAMES[order])} bond: ${a}${SYMBOL[order]}${b}`,
    text: `${order} shared pair${order > 1 ? 's' : ''} of electrons holds these atoms together${e ? ` (about ${e} kJ/mol to break)` : ''}. ${polarity(a, b)}`,
  };
}

export function atomRemoved(sym) {
  return { title: `${nameOf(sym)} removed`, text: 'Its bonds were broken and the atom went back in the tray.' };
}

export function movedWhole(formula) {
  return { title: `Moving ${formula}`, text: 'The whole molecule moves as one piece — the shared electrons in its bonds hold the atoms together.' };
}

/** Extra sentence about what is now on the workbench. */
export function statusLine(components) {
  const done = components.find((c) => c.complete && c.known && c.justCompleted);
  if (done) {
    const fact = done.known.fact ?? MOLECULES[done.known.preset]?.fact ?? '';
    return { title: `You built ${done.known.name} (${done.formula})!`, text: `Every atom has a full outer shell. ${fact}` };
  }
  const fresh = components.find((c) => c.complete && c.justCompleted && c.atoms.length > 1);
  if (fresh) return { title: `Stable molecule: ${fresh.formula}`, text: 'Every atom has all the bonds it needs, so this is a complete molecule.' };
  return null;
}

export function needsText(component) {
  return component.needs.map(([sym, n]) => `${sym} needs ${n} more bond${n > 1 ? 's' : ''}`).join(', ');
}

export { KNOWN };

// ── Forces inside the atom ──────────────────────────────

export const FORCES = {
  proton: {
    title: 'Feel that push?',
    text: 'The nucleus is positive and so is your proton — like charges repel. Push it all the way in: once it touches, the strong nuclear force (far stronger, but only over tiny distances) grabs it.',
  },
  electron: {
    title: 'Feel the pull?',
    text: 'Opposite charges attract: the positive nucleus pulls on your negative electron. That attraction is what keeps electrons in their shells.',
  },
  neutron: {
    title: 'No push, no pull',
    text: 'A neutron has no charge, so the nucleus neither repels nor attracts it electrically — it slides straight in.',
  },
};

// ── Reactions ───────────────────────────────────────────

export function reactionStart(r) {
  return { title: `${r.name}: ${r.equation}`, text: `${r.hint} Breaking bonds takes energy in, making bonds gives energy out — watch the energy meter. No atoms can be added or thrown away.` };
}

export function reactionDone(r, energy) {
  const net = energy.out - energy.in;
  const exo = net >= 0;
  return {
    title: exo ? `Exothermic! ${Math.round(net)} kJ released` : `Endothermic: ${Math.round(-net)} kJ taken in`,
    text: `Breaking bonds took in ${Math.round(energy.in)} kJ; making new ones gave out ${Math.round(energy.out)} kJ (per mole). ${exo ? 'More came out than went in, so the surroundings heat up — the products are shaking with that energy.' : 'More went in than came out, so the surroundings cool down.'} ${r.fact}`,
  };
}
