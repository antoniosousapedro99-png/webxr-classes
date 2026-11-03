// First 36 elements (H → Kr).
// radius: calculated atomic radius in picometres (Clementi et al.)
// A: mass number of the most common isotope
// shells: electrons per shell for the neutral atom
// stableN: neutron counts of the stable isotopes (used for stability hints)
// color: CPK / Jmol colour

const RAW = [
  // Z, sym, name, A, radius, color, category, shells, stableN, fact
  [1, 'H', 'Hydrogen', 1, 53, 0xffffff, 'nonmetal', [1], [0, 1], 'The most abundant element in the universe — about three quarters of all normal matter.'],
  [2, 'He', 'Helium', 4, 31, 0xd9ffff, 'noble', [2], [1, 2], 'Made in stars by fusing hydrogen. It is so light it escapes from Earth’s atmosphere.'],
  [3, 'Li', 'Lithium', 7, 167, 0xcc80ff, 'alkali', [2, 1], [3, 4], 'The lightest metal — soft enough to cut with a knife. It powers rechargeable batteries.'],
  [4, 'Be', 'Beryllium', 9, 112, 0xc2ff00, 'alkaline', [2, 2], [5], 'Light and very stiff: the James Webb Space Telescope’s mirrors are made of it.'],
  [5, 'B', 'Boron', 11, 87, 0xffb5b5, 'metalloid', [2, 3], [5, 6], 'Added to glass to make heat-proof lab beakers (borosilicate glass).'],
  [6, 'C', 'Carbon', 12, 67, 0x909090, 'nonmetal', [2, 4], [6, 7], 'Forms more compounds than any other element — the basis of all known life.'],
  [7, 'N', 'Nitrogen', 14, 56, 0x3050f8, 'nonmetal', [2, 5], [7, 8], 'About 78% of the air you are breathing right now is nitrogen.'],
  [8, 'O', 'Oxygen', 16, 48, 0xff0d0d, 'nonmetal', [2, 6], [8, 9, 10], 'About 21% of air, and the most abundant element in Earth’s crust by mass.'],
  [9, 'F', 'Fluorine', 19, 42, 0x90e050, 'halogen', [2, 7], [10], 'The most reactive non-metal. Fluoride compounds help strengthen tooth enamel.'],
  [10, 'Ne', 'Neon', 20, 38, 0xb3e3f5, 'noble', [2, 8], [10, 11, 12], 'Glows red-orange when electricity passes through it — the original neon signs.'],
  [11, 'Na', 'Sodium', 23, 190, 0xab5cf2, 'alkali', [2, 8, 1], [12], 'Reacts vigorously with water. With chlorine it makes table salt.'],
  [12, 'Mg', 'Magnesium', 24, 145, 0x8aff00, 'alkaline', [2, 8, 2], [12, 13, 14], 'Burns with a dazzling white flame and sits at the centre of chlorophyll.'],
  [13, 'Al', 'Aluminium', 27, 118, 0xbfa6a6, 'post', [2, 8, 3], [14], 'The most abundant metal in Earth’s crust; light and does not rust.'],
  [14, 'Si', 'Silicon', 28, 111, 0xf0c8a0, 'metalloid', [2, 8, 4], [14, 15, 16], 'The semiconductor inside computer chips. Sand is mostly silicon dioxide.'],
  [15, 'P', 'Phosphorus', 31, 98, 0xff8000, 'nonmetal', [2, 8, 5], [16], 'Part of the backbone of DNA and of ATP, the energy molecule in your cells.'],
  [16, 'S', 'Sulfur', 32, 88, 0xffff30, 'nonmetal', [2, 8, 6], [16, 17, 18, 20], 'Hydrogen sulfide (H₂S) gives rotten eggs their smell.'],
  [17, 'Cl', 'Chlorine', 35, 79, 0x1ff01f, 'halogen', [2, 8, 7], [18, 20], 'A toxic green gas — yet chloride ions are essential in your body.'],
  [18, 'Ar', 'Argon', 40, 71, 0x80d1e3, 'noble', [2, 8, 8], [18, 20, 22], 'Almost 1% of air. Used in light bulbs and welding because it is so unreactive.'],
  [19, 'K', 'Potassium', 39, 243, 0x8f40d4, 'alkali', [2, 8, 8, 1], [20, 22], 'Reacts with water so strongly the hydrogen ignites with a lilac flame.'],
  [20, 'Ca', 'Calcium', 40, 194, 0x3dff00, 'alkaline', [2, 8, 8, 2], [20, 22, 23, 24, 26, 28], 'Builds your bones and teeth.'],
  [21, 'Sc', 'Scandium', 45, 184, 0xe6e6e6, 'transition', [2, 8, 9, 2], [24], 'Mixed into aluminium to make strong, light bike frames.'],
  [22, 'Ti', 'Titanium', 48, 176, 0xbfc2c7, 'transition', [2, 8, 10, 2], [24, 25, 26, 27, 28], 'As strong as steel but about 45% lighter — used in implants and aircraft.'],
  [23, 'V', 'Vanadium', 51, 171, 0xa6a6ab, 'transition', [2, 8, 11, 2], [27, 28], 'Added to steel to make very tough tools.'],
  [24, 'Cr', 'Chromium', 52, 166, 0x8a99c7, 'transition', [2, 8, 13, 1], [26, 28, 29, 30], 'Makes stainless steel shiny and rust-proof. Rubies are red because of it.'],
  [25, 'Mn', 'Manganese', 55, 161, 0x9c7ac7, 'transition', [2, 8, 13, 2], [30], 'Essential for making steel and used in batteries.'],
  [26, 'Fe', 'Iron', 56, 156, 0xe06633, 'transition', [2, 8, 14, 2], [28, 30, 31, 32], 'Earth’s core is mostly iron, and iron in haemoglobin carries oxygen in your blood.'],
  [27, 'Co', 'Cobalt', 59, 152, 0xf090a0, 'transition', [2, 8, 15, 2], [32], 'Gives “cobalt blue” glass its colour and is used in battery cathodes.'],
  [28, 'Ni', 'Nickel', 58, 149, 0x50d050, 'transition', [2, 8, 16, 2], [30, 32, 33, 34, 36], 'Found in Earth’s core, coins and stainless steel.'],
  [29, 'Cu', 'Copper', 63, 145, 0xc88033, 'transition', [2, 8, 18, 1], [34, 36], 'A brilliant electrical conductor. The Statue of Liberty is green because its copper reacted with air.'],
  [30, 'Zn', 'Zinc', 64, 142, 0x7d80b0, 'transition', [2, 8, 18, 2], [34, 36, 37, 38, 40], 'Coats steel to stop it rusting (galvanising) and helps your immune system.'],
  [31, 'Ga', 'Gallium', 69, 136, 0xc28f8f, 'post', [2, 8, 18, 3], [38, 40], 'Melts at 29.8 °C — it would melt in your hand.'],
  [32, 'Ge', 'Germanium', 74, 125, 0x668f8f, 'metalloid', [2, 8, 18, 4], [38, 40, 41, 42, 44], 'A semiconductor used in early transistors and in fibre optics.'],
  [33, 'As', 'Arsenic', 75, 114, 0xbd80e3, 'metalloid', [2, 8, 18, 5], [42], 'A notorious poison, but also used in some semiconductors.'],
  [34, 'Se', 'Selenium', 80, 103, 0xffa100, 'nonmetal', [2, 8, 18, 6], [40, 42, 43, 44, 46], 'Its electrical conductivity changes with light; a trace nutrient you need.'],
  [35, 'Br', 'Bromine', 79, 94, 0xa62929, 'halogen', [2, 8, 18, 7], [44, 46], 'One of only two elements that are liquid at room temperature.'],
  [36, 'Kr', 'Krypton', 84, 88, 0x5cb8d1, 'noble', [2, 8, 18, 8], [42, 44, 46, 47, 48, 50], 'A noble gas that was once used to define the length of a metre.'],
];

export const ELEMENTS = RAW.map(([Z, symbol, name, A, radius, color, category, shells, stableN, fact]) => ({
  Z, symbol, name, A, radius, color, category, shells, stableN, fact,
  ...tablePosition(Z),
}));

export const MAX_Z = ELEMENTS.length;

function tablePosition(Z) {
  if (Z === 1) return { period: 1, group: 1 };
  if (Z === 2) return { period: 1, group: 18 };
  if (Z <= 10) return { period: 2, group: Z <= 4 ? Z - 2 : Z + 8 };
  if (Z <= 18) return { period: 3, group: Z <= 12 ? Z - 10 : Z };
  return { period: 4, group: Z - 18 };
}

export function getElement(Z) {
  return Z >= 1 && Z <= MAX_Z ? ELEMENTS[Z - 1] : null;
}

const BY_SYMBOL = Object.fromEntries(ELEMENTS.map((e) => [e.symbol, e]));
export function bySymbol(symbol) {
  return BY_SYMBOL[symbol] || null;
}

/** Electron shell occupancy for `count` electrons (uses the configuration of the neutral atom with Z = count). */
export function shellsFor(count) {
  if (count <= 0) return [];
  return getElement(Math.min(count, MAX_Z)).shells;
}

export const CATEGORY_COLORS = {
  alkali: '#8c3b3b',
  alkaline: '#8c6a3b',
  transition: '#3b5a8c',
  post: '#4a6b5a',
  metalloid: '#6b6b3b',
  nonmetal: '#2f7a4a',
  halogen: '#2f7373',
  noble: '#5a3b8c',
};

export const CATEGORY_NAMES = {
  alkali: 'alkali metal',
  alkaline: 'alkaline earth metal',
  transition: 'transition metal',
  post: 'post-transition metal',
  metalloid: 'metalloid',
  nonmetal: 'non-metal',
  halogen: 'halogen',
  noble: 'noble gas',
};

// Van der Waals radii (pm) for space-filling models.
export const VDW_RADII = { H: 120, C: 170, N: 155, O: 152, F: 147, S: 180, Cl: 175, Na: 227, P: 180 };
// Ionic radii (pm) for the salt crystal.
export const IONIC_RADII = { Na: 102, Cl: 181 };
