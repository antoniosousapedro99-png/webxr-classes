// Formatting helpers that turn tiny / huge numbers into something students can picture.

const SUP = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '+': '⁺', '-': '⁻' };
export const sup = (s) => String(s).split('').map((c) => SUP[c] ?? c).join('');

const sig = (x, digits = 3) => Number(x.toPrecision(digits)).toLocaleString('en-GB');

export function formatLength(m) {
  const a = Math.abs(m);
  if (a >= 1000) return `${sig(m / 1000)} km`;
  if (a >= 1) return `${sig(m)} m`;
  if (a >= 0.01) return `${sig(m * 100)} cm`;
  if (a >= 1e-3) return `${sig(m * 1e3)} mm`;
  if (a >= 1e-6) return `${sig(m * 1e6)} µm`;
  if (a >= 1e-9) return `${sig(m * 1e9)} nm`;
  if (a >= 1e-12) return `${sig(m * 1e12)} pm`;
  return `${sig(m * 1e15)} fm`;
}

export function formatNumber(n) {
  if (n >= 1e12) return `${sig(n / 1e12, 2)} trillion`;
  if (n >= 1e9) return `${sig(n / 1e9, 2)} billion`;
  if (n >= 1e6) return `${sig(n / 1e6, 2)} million`;
  return Math.round(n).toLocaleString('en-GB');
}

// Real-world yardsticks, smallest to largest.
const LANDMARKS = [
  { size: 80e-6, one: 'the width of a human hair', many: 'human hairs side by side' },
  { size: 5e-4, one: 'a grain of sand', many: 'grains of sand in a row' },
  { size: 0.023, one: 'a coin', many: 'coins in a row' },
  { size: 1.7, one: 'a person', many: 'people lying head to toe' },
  { size: 11, one: 'a double-decker bus', many: 'buses end to end' },
  { size: 105, one: 'a football pitch', many: 'football pitches' },
  { size: 330, one: 'the Eiffel Tower', many: 'Eiffel Towers stacked up' },
  { size: 8849, one: 'Mount Everest', many: 'Mount Everests stacked up' },
  { size: 344e3, one: 'the distance from London to Paris', many: 'times the distance from London to Paris' },
  { size: 12.742e6, one: 'the Earth', many: 'Earths side by side' },
  { size: 384.4e6, one: 'the distance to the Moon', many: 'times the distance to the Moon' },
  { size: 1.496e11, one: 'the distance to the Sun', many: 'times the distance to the Sun' },
];

/** "about 6 football pitches" style comparison for a length in metres. */
export function compareLength(m) {
  let best = LANDMARKS[0];
  for (const l of LANDMARKS) if (l.size <= m * 1.3) best = l;
  const ratio = m / best.size;
  if (ratio < 1.5) return `about the size of ${best.one}`;
  return `about ${formatNumber(ratio)} ${best.many}`;
}
