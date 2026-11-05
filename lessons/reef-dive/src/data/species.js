// The reef's species, pitched at IB Biology. `eats` lists food sources (energy flows from them to this species).
// `length` is real adult length in metres — the models swim around the room at life size.
// `move` drives behaviour: school | patrol | cruise | drift | crawl | fixed | cloud.

export const SPECIES = {
  phyto: {
    name: 'Phytoplankton', sci: 'e.g. diatoms, dinoflagellates', group: 'single-celled producer', trophic: 1, role: 'Producer',
    length: 0.0001, move: 'cloud', count: 1, eats: [],
    about: 'Microscopic photosynthetic cells drifting in the sunlit water. Shown thousands of times bigger as glowing green specks. They fix carbon by photosynthesis and produce roughly half of the oxygen on Earth.',
    adapt: 'Tiny size gives a huge surface-area-to-volume ratio for absorbing light and nutrients, and slows sinking out of the light.',
  },
  seagrass: {
    name: 'Seagrass', sci: 'e.g. Thalassia testudinum', group: 'plant / alga', trophic: 1, role: 'Producer',
    length: 0.35, move: 'fixed', count: 1, eats: [],
    about: 'A true flowering plant that lives underwater. Seagrass meadows are nurseries for young fish and store carbon in their sediments up to 35 times faster than rainforests.',
    adapt: 'Roots anchor it in sand and absorb nutrients; flexible blades bend with the waves.',
  },
  algae: {
    name: 'Turf algae', sci: 'filamentous macroalgae', group: 'plant / alga', trophic: 1, role: 'Producer (competitor of coral)',
    length: 0.03, move: 'fixed', count: 1, eats: [],
    about: 'Fast-growing algae that compete with coral for space and light. Kept short by grazers like parrotfish and urchins. If grazing falls or nutrients rise, algae overgrow and smother the coral (a phase shift).',
    adapt: 'Rapid growth and reproduction let it colonise any bare or dead surface quickly.',
  },
  coral: {
    name: 'Reef-building coral', sci: 'e.g. Acropora (staghorn), brain coral', group: 'cnidarian', trophic: 1.5, role: 'Ecosystem engineer (mixotroph)',
    length: 0.4, move: 'fixed', count: 1, eats: ['zoo', 'phyto'],
    about: 'Colonies of tiny polyps that build the reef from calcium carbonate. Zooxanthellae (algae) living inside their tissues photosynthesise and pass up to 90% of the coral’s energy to it — a mutualism. At night polyps also catch plankton with stinging tentacles.',
    adapt: 'Symbiotic algae provide energy in nutrient-poor tropical water; the limestone skeleton provides protection and the structure of the whole reef.',
  },
  zoo: {
    name: 'Zooplankton', sci: 'e.g. copepods, larvae', group: 'arthropod', trophic: 2, role: 'Primary consumer',
    length: 0.002, move: 'cloud', count: 1, eats: ['phyto'],
    about: 'Tiny animals drifting in the water that graze on phytoplankton. They are the key link passing energy from producers to fish, corals and jellyfish.',
    adapt: 'Many migrate down by day and up at night (diel vertical migration) to feed while avoiding predators.',
  },
  parrotfish: {
    name: 'Parrotfish', sci: 'Scarus spp.', group: 'bony fish', trophic: 2, role: 'Herbivore — keystone grazer',
    length: 0.4, move: 'school', count: 6, eats: ['algae', 'coral'],
    about: 'Scrapes algae off dead coral with a beak of fused teeth, keeping space clear for new coral to settle. It grinds limestone as it feeds — one parrotfish can produce hundreds of kilograms of white sand a year.',
    adapt: 'Fused beak-like teeth and grinding pharyngeal jaws; some sleep in a mucus cocoon that hides their scent from predators.',
  },
  turtle: {
    name: 'Green sea turtle', sci: 'Chelonia mydas', group: 'reptile', trophic: 2, role: 'Herbivore (grazer of seagrass)',
    length: 1.0, move: 'cruise', count: 1, eats: ['seagrass', 'algae'],
    about: 'Adults graze seagrass meadows like underwater lawnmowers, which keeps the meadows healthy. Endangered. The sex of hatchlings is set by nest temperature — warmer sand produces more females.',
    adapt: 'Streamlined shell, paddle-shaped front flippers, and it can hold its breath for hours while resting because its metabolism slows.',
  },
  urchin: {
    name: 'Long-spined sea urchin', sci: 'Diadema antillarum', group: 'echinoderm', trophic: 2, role: 'Herbivore (grazer)',
    length: 0.2, move: 'fixed', count: 4, eats: ['algae'],
    about: 'A night-time grazer of algae. When a disease killed most Diadema in the Caribbean in 1983, algae spread across many reefs — a classic example of a keystone grazer.',
    adapt: 'Long, mildly venomous spines for defence; tube feet and a five-toothed mouth (Aristotle’s lantern) underneath.',
  },
  clownfish: {
    name: 'Clownfish', sci: 'Amphiprion ocellaris', group: 'bony fish', trophic: 3, role: 'Omnivore — mutualist with anemone',
    length: 0.09, move: 'school', count: 3, eats: ['zoo', 'algae'],
    about: 'Lives among the anemone’s stinging tentacles, protected from predators. In return it cleans the anemone, chases off fish that eat anemones, and its waste fertilises it — mutualism.',
    adapt: 'A thick mucus coat stops the anemone’s stinging cells from firing. All are born male; the dominant fish of a group becomes female.',
  },
  anemone: {
    name: 'Sea anemone', sci: 'Heteractis magnifica', group: 'cnidarian', trophic: 3, role: 'Predator — mutualist with clownfish',
    length: 0.35, move: 'fixed', count: 1, eats: ['zoo'],
    about: 'A relative of coral and jellyfish. It catches plankton and small fish with stinging cells (nematocysts) on its tentacles. Many also host photosynthetic zooxanthellae, like corals.',
    adapt: 'Nematocysts fire a venomous thread in milliseconds; a sticky foot (pedal disc) holds it to the rock.',
  },
  wrasse: {
    name: 'Cleaner wrasse', sci: 'Labroides dimidiatus', group: 'bony fish', trophic: 3, role: 'Cleaner — mutualist with larger fish',
    length: 0.1, move: 'school', count: 4, eats: ['zoo'],
    about: 'Runs “cleaning stations” where large fish, even predators, wait to have parasites picked off. The wrasse gets food; the client gets healthier — mutualism. Reefs without cleaners have fewer, less healthy fish.',
    adapt: 'A bright blue stripe acts as an advert that predators recognise and don’t attack.',
  },
  jelly: {
    name: 'Moon jellyfish', sci: 'Aurelia aurita', group: 'cnidarian', trophic: 3, role: 'Predator of plankton',
    length: 0.25, move: 'drift', count: 4, eats: ['zoo'],
    about: 'Drifts with the current, catching zooplankton with short stinging tentacles. Jellyfish blooms often follow warming, overfishing (fewer competitors) and eutrophication — they tolerate low oxygen better than fish.',
    adapt: 'No brain, heart or bones — about 95% water; a nerve net coordinates the pulsing bell.',
  },
  crab: {
    name: 'Reef crab', sci: 'e.g. Carpilius spp.', group: 'arthropod', trophic: 2.5, role: 'Omnivore / scavenger (detritivore)',
    length: 0.12, move: 'crawl', count: 3, eats: ['algae'],
    about: 'Picks over the reef for algae, small animals and dead matter, recycling nutrients back into the ecosystem.',
    adapt: 'A hard exoskeleton of chitin and calcium carbonate for protection; it must moult to grow.',
  },
  cucumber: {
    name: 'Sea cucumber', sci: 'Holothuria spp.', group: 'echinoderm', trophic: 2, role: 'Detritivore',
    length: 0.35, move: 'crawl', count: 2, eats: [],
    about: 'Hoovers up sand, digests the organic matter (detritus) and returns cleaner sand and nutrients. Its digestion also releases carbonate that slightly offsets local acidification.',
    adapt: 'Can expel sticky threads or even its internal organs to escape a predator, then regrow them.',
  },
  octopus: {
    name: 'Day octopus', sci: 'Octopus cyanea', group: 'mollusc', trophic: 3.5, role: 'Predator',
    length: 0.5, move: 'crawl', count: 1, eats: ['crab', 'clownfish'],
    about: 'An intelligent hunter of crabs and small fish. It can change colour and texture in a fraction of a second to vanish against the reef.',
    adapt: 'Chromatophores for camouflage, eight arms with suckers that can taste, ink to escape, and no skeleton — it squeezes through any gap bigger than its beak.',
  },
  barracuda: {
    name: 'Great barracuda', sci: 'Sphyraena barracuda', group: 'bony fish', trophic: 4, role: 'Predator',
    length: 1.2, move: 'cruise', count: 2, eats: ['parrotfish', 'wrasse', 'clownfish'],
    about: 'An ambush predator that drifts motionless, then strikes at up to about 40 km/h.',
    adapt: 'Torpedo-shaped body and a large mouth of fang-like teeth; silver countershading hides it in open water.',
  },
  shark: {
    name: 'Blacktip reef shark', sci: 'Carcharhinus melanopterus', group: 'cartilaginous fish', trophic: 4.5, role: 'Apex predator',
    length: 1.6, move: 'patrol', count: 1, eats: ['barracuda', 'parrotfish', 'octopus'],
    about: 'The top predator here. By eating mid-level predators and keeping prey alert, it shapes the whole food web (a top-down, or trophic cascade, effect). Reefs with healthy shark populations tend to be more resilient.',
    adapt: 'Skeleton of cartilage, five gill slits, electroreceptors (ampullae of Lorenzini) to sense prey, and countershading.',
  },
};

export const ORDER = Object.keys(SPECIES);

/** Every correct food-web link, as [food, eater]. */
export const LINKS = ORDER.flatMap((eater) => SPECIES[eater].eats.map((food) => [food, eater]));

// ── Classification key (a simple dichotomous key) ──────────
export const KEY = {
  start: { q: 'Does it make its own food by photosynthesis (and have no mouth)?', yes: 'cells', no: 'backbone' },
  cells: { q: 'Is each individual a single microscopic cell?', yes: 'single-celled producer', no: 'plant / alga' },
  backbone: { q: 'Does it have a backbone (vertebral column)?', yes: 'lungs', no: 'radial' },
  lungs: { q: 'Does it breathe air with lungs?', yes: 'reptile', no: 'cartilage' },
  cartilage: { q: 'Is its skeleton made of cartilage (with several gill slits, not one gill cover)?', yes: 'cartilaginous fish', no: 'bony fish' },
  radial: { q: 'Is it radially symmetrical with stinging cells (nematocysts)?', yes: 'cnidarian', no: 'jointed' },
  jointed: { q: 'Does it have jointed legs and a hard exoskeleton?', yes: 'arthropod', no: 'spiny' },
  spiny: { q: 'Does it have a spiny or leathery skin with five-part symmetry and tube feet?', yes: 'echinoderm', no: 'mollusc' },
};

export const QUESTIONS = [
  { id: 'energy', label: 'Why are food chains short?' },
  { id: 'keystone', label: 'What is a keystone species?' },
  { id: 'bleach', label: 'Why does coral bleach?' },
  { id: 'acid', label: 'How does CO₂ acidify the sea?' },
  { id: 'eutro', label: 'What is eutrophication?' },
  { id: 'mutual', label: 'Examples of mutualism here?' },
];

export const ANSWERS = {
  energy: 'Only about 10% of the energy at one trophic level ends up as biomass in the next: the rest is lost as heat from respiration, in uneaten parts and in faeces. After 4–5 transfers too little energy is left to support another level, so apex predators like sharks are always few in number.',
  keystone: 'A species with an effect on its ecosystem far larger than its numbers suggest. Remove it and the community changes dramatically. Here: parrotfish and urchins (grazers that stop algae smothering coral) and the reef shark (a top predator that controls the food web from the top down).',
  bleach: 'When water stays about 1 °C above the usual summer maximum for a few weeks, the zooxanthellae inside coral produce harmful reactive oxygen. The coral expels them, losing its colour and up to 90% of its energy supply. If the heat lasts, the coral starves and dies; if it ends soon enough, the algae can return.',
  acid: 'The ocean absorbs about a quarter of the CO₂ we emit. CO₂ + H₂O → H₂CO₃ (carbonic acid) → H⁺ + HCO₃⁻. The extra H⁺ lowers pH and combines with carbonate ions (CO₃²⁻), so less carbonate is available for corals and shellfish to build CaCO₃ skeletons. Ocean pH has fallen from about 8.2 to 8.1 since 1750 — a 30% rise in H⁺.',
  eutro: 'Extra nutrients (nitrates, phosphates from fertiliser and sewage) cause an algal bloom. When the algae die, decomposing bacteria use up dissolved oxygen in respiration (high biological oxygen demand), creating hypoxic “dead zones” where fish and invertebrates suffocate. Warm water makes it worse because it holds less oxygen.',
  mutual: 'Coral and zooxanthellae (sugar for shelter and CO₂), clownfish and anemone (protection for cleaning and defence), and cleaner wrasse with larger fish (food for parasite removal). In each case both species benefit.',
};
