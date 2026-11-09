import { SPECIES, ORDER } from '../data/species.js';

// A monthly model of the reef. It is deliberately simple and transparent so students can reason about it,
// but every effect is the real mechanism:
//  • heat above ~29.5 °C → bleaching (zooxanthellae expelled) → coral starves and dies if it lasts
//  • lower pH → less carbonate → slower calcification, weaker coral
//  • nutrients → phytoplankton/algae blooms → decomposition uses oxygen → hypoxia (eutrophication)
//  • warm water holds less dissolved oxygen
//  • murky water (turbidity) → less light → less photosynthesis
//  • every animal needs food and habitat and is held down by its predators, so removing one species cascades
// Populations are relative: 1 = a healthy reef.

export const BASE_ENV = { temp: 27, ph: 8.1, nutrients: 0.1, turbidity: 0.1 };

const REEF_DWELLERS = ['parrotfish', 'clownfish', 'wrasse', 'octopus', 'crab', 'urchin', 'barracuda', 'anemone', 'cucumber'];
const OXYGEN_TOLERANT = ['jelly', 'phyto', 'algae', 'seagrass', 'coral', 'cucumber'];

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class Ecosystem {
  constructor() {
    this.predators = Object.fromEntries(ORDER.map((id) => [id, ORDER.filter((p) => SPECIES[p].eats.includes(id))]));
    this.scale = Object.fromEntries(ORDER.map((id) => [id, 1]));
    this.reset();
    // Calibrate so that a healthy reef settles at population 1 for every species.
    for (let i = 0; i < 80; i++) this.step();
    for (const id of ORDER) if (!['coral', 'algae'].includes(id)) this.scale[id] = 1 / Math.max(0.05, this.pop[id]);
    this.reset();
  }

  reset(env = BASE_ENV) {
    this.env = { ...env };
    this.pop = Object.fromEntries(ORDER.map((id) => [id, 1]));
    this.pop.coral = 0.6; // fraction of the reef covered by live coral
    this.pop.algae = 0.15; // fraction covered by algae
    this.bleach = 0; // fraction of coral bleached
    this.oxygen = 1;
    this.month = 0;
    this.removed = new Set();
    this.history = [];
    this.record();
  }

  get light() {
    return 1 - 0.85 * this.env.turbidity;
  }

  /** Is the reef's dissolved oxygen high enough for fish? (1 = normal) */
  computeOxygen() {
    const { temp } = this.env;
    const decay = Math.max(0, this.pop.phyto - 1.3) * 0.45 + Math.max(0, this.pop.algae - 0.45) * 0.6;
    return clamp(1 - 0.035 * (temp - 27) - decay, 0, 1.15);
  }

  step() {
    const e = this.env;
    const p = this.pop;
    const L = this.light;
    const O2 = (this.oxygen = this.computeOxygen());
    const heat = Math.max(0, e.temp - 29.5) / 2;
    const acid = Math.max(0, 8.1 - e.ph) / 0.5;

    // Bleaching: builds while it's too hot, recovers slowly when it cools.
    this.bleach = clamp(this.bleach + (heat > 0 ? 0.45 * heat : -0.2), 0, 1);

    // Coral and algae compete for the same reef surface; grazers keep algae down.
    // (Rates are set so a healthy reef sits at ~60% coral, ~15% algae, 25% bare rock.)
    const grazing = 0.5 * p.parrotfish + 0.35 * p.urchin + 0.15 * p.turtle;
    const free = Math.max(0, 1 - p.coral - p.algae);
    const hypoxia = O2 < 0.45 ? 0.25 : 0;
    const coralGrowth = 0.0874 * free * L * (1 - 0.8 * this.bleach) * (1 - 0.8 * acid) / 0.915;
    const coralDeath = 0.02 + 0.22 * this.bleach ** 2 + 0.05 * acid + hypoxia;
    const algaeGrowth = 0.69 * free * (0.6 + 1.6 * e.nutrients) * L;
    const algaeGrazed = 0.12 * grazing;
    const next = {
      coral: this.removed.has('coral') ? 0 : clamp(p.coral + p.coral * (coralGrowth - coralDeath) + 0.002 * free, 0, 0.95),
      algae: this.removed.has('algae') ? 0 : clamp(p.algae + p.algae * (algaeGrowth - algaeGrazed), 0.02, 0.95),
    };

    // Everyone else moves towards a target set by habitat, food, oxygen and predators.
    const habitat = 0.35 + 0.65 * clamp((p.coral + 0.15) / 0.75, 0, 1.1);
    const avail = (id) => (id === 'coral' ? p.coral / 0.6 : id === 'algae' ? p.algae / 0.15 : p[id]);
    for (const id of ORDER) {
      if (id === 'coral' || id === 'algae') continue;
      const s = SPECIES[id];
      let target;
      if (id === 'phyto') target = (0.55 + 1.8 * e.nutrients) * L * (1 + 0.1 * (e.temp - 27) / 3);
      else if (id === 'seagrass') target = L * (1 - 0.45 * e.nutrients) * (1.25 - 0.25 * p.turtle);
      else {
        const food = s.eats.length ? s.eats.reduce((a, f) => a + avail(f), 0) / s.eats.length : 1;
        target = Math.pow(clamp(food, 0, 1.6), 0.7);
        if (REEF_DWELLERS.includes(id)) target *= habitat;
        if (!OXYGEN_TOLERANT.includes(id)) target *= clamp((O2 - 0.25) / 0.55, 0, 1);
        if (id === 'jelly') target *= 1 + 0.15 * (e.temp - 27) + 0.8 * e.nutrients; // blooms in warm, nutrient-rich water
        if (id === 'cucumber') target *= 0.7 + 0.3 * p.algae / 0.15;
      }
      // Predators hold prey down. Those just one level up matter most: an apex predator mainly acts
      // through the mesopredators it controls (so removing it releases them — a trophic cascade).
      const preds = this.predators[id];
      if (preds.length) {
        const pressure = preds.reduce((a, q) => a + (SPECIES[q].trophic - s.trophic > 2 ? 0.3 : 1) * (p[q] - 1), 0);
        target /= 1 + 0.6 * Math.max(-0.6, pressure);
      }
      target *= this.scale[id];
      next[id] = clamp(p[id] + 0.3 * (target - p[id]), 0, 2.5);
    }
    for (const id of this.removed) next[id] = 0;
    this.pop = next;
    this.month++;
    this.record();
  }

  record() {
    const fish = ['parrotfish', 'clownfish', 'wrasse', 'barracuda', 'shark', 'hammer', 'manta'].map((f) => this.pop[f]);
    this.history.push({
      month: this.month,
      coral: this.pop.coral,
      algae: this.pop.algae,
      fish: fish.reduce((a, b) => a + b, 0) / fish.length,
      oxygen: this.oxygen,
      bleach: this.bleach,
    });
    if (this.history.length > 120) this.history.shift();
  }

  remove(id) {
    this.removed.add(id);
    this.pop[id] = 0;
  }

  restore(id) {
    this.removed.delete(id);
    this.pop[id] = id === 'coral' ? 0.1 : id === 'algae' ? 0.1 : 0.3;
  }

  /** Overall reef health 0–1, for a single headline number. */
  get health() {
    const fish = this.history.at(-1).fish;
    return clamp(0.45 * (this.pop.coral / 0.6) + 0.25 * Math.min(1, fish) + 0.2 * Math.min(1, this.oxygen) + 0.1 * (1 - this.bleach), 0, 1);
  }

  snapshot() {
    const r = (v) => Math.round(v * 1000) / 1000;
    return {
      env: this.env, month: this.month, bleach: r(this.bleach), oxygen: r(this.oxygen),
      pop: Object.fromEntries(Object.entries(this.pop).map(([k, v]) => [k, r(v)])),
      removed: [...this.removed], history: this.history.map((h) => Object.fromEntries(Object.entries(h).map(([k, v]) => [k, r(v)]))),
    };
  }

  load(s) {
    this.env = { ...s.env };
    this.month = s.month;
    this.bleach = s.bleach;
    this.oxygen = s.oxygen;
    this.pop = { ...s.pop };
    this.removed = new Set(s.removed);
    this.history = s.history;
  }
}
