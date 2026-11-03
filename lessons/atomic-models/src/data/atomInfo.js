import { getElement, shellsFor } from './elements.js';
import { sup } from '../util/format.js';

/** Proton radius is measured (0.84 fm); heavier nuclei follow r ≈ 1.2 fm × A^(1/3). */
export function nucleusRadiusFm(A) {
  return A <= 1 ? 0.84 : 1.2 * Math.cbrt(A);
}

/** How many times bigger the atom (electron cloud) is than its nucleus. */
export function atomToNucleusRatio(element, A) {
  return (element.radius * 1000) / nucleusRadiusFm(Math.max(1, A));
}

/** Everything we can say about an atom made of p protons, n neutrons and e electrons. */
export function describeAtom({ p, n, e }) {
  const element = getElement(p);
  const A = p + n;
  const charge = p - e;
  const chargeStr = charge === 0 ? '0' : `${charge > 0 ? '+' : '−'}${Math.abs(charge)}`;
  const ionSymbol = element
    ? `${element.symbol}${charge === 0 ? '' : sup(`${Math.abs(charge) === 1 ? '' : Math.abs(charge)}${charge > 0 ? '+' : '-'}`)}`
    : '';
  const shells = shellsFor(e);

  let stability = null;
  let stable = false;
  if (element) {
    if (element.stableN.includes(n)) {
      stable = true;
      stability = 'Stable isotope';
    } else {
      const nearest = element.stableN.reduce((a, b) => (Math.abs(b - n) < Math.abs(a - n) ? b : a));
      const diff = n - nearest;
      stability = Math.abs(diff) <= 4
        ? `Unstable — this isotope is radioactive (${diff > 0 ? 'too many' : 'too few'} neutrons)`
        : `Very unstable — far ${diff > 0 ? 'too many' : 'too few'} neutrons, it would fall apart almost instantly`;
    }
  } else if (n > 0) {
    stability = 'Only neutrons: a lone neutron decays in about 15 minutes';
  }

  return {
    element, A, charge, chargeStr, ionSymbol, shells, stability, stable,
    isotopeName: element ? `${element.name}-${A}` : null,
    valence: shells.length ? shells[shells.length - 1] : 0,
  };
}
