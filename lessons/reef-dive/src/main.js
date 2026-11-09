import * as THREE from 'three';
import { LessonApp } from '../../../shared/LessonApp.js';
import { CanvasPanel } from '../../../shared/ui/CanvasPanel.js';
import { makeLabel } from '../../../shared/ui/labels.js';
import { sound } from '../../../shared/util/sound.js';
import { SPECIES, ORDER, LINKS, KEY, ANSWERS } from './data/species.js';
import { Ecosystem, BASE_ENV } from './model/Ecosystem.js';
import { Reef } from './model/Reef.js';
import { Sea } from './model/Sea.js';
import { Water, OceanSound } from './model/Water.js';
import { loadModelOverrides } from './model/bodies.js';
import { drawControls, drawInfo, drawCard } from './ui/panels.js';

// Reef Dive: the classroom becomes the sea floor. One shared reef and its animals fill the room; in a
// same-room session everyone sees the same creatures in the same places, and each other through the water.

const LIMITS = { temp: [24, 33], ph: [7.6, 8.3], nutrients: [0, 1], turbidity: [0, 1] };
const RUN_MONTH_S = 0.9; // seconds per simulated month while running

class App extends LessonApp {
  constructor() {
    super({ labPos: new THREE.Vector3(0, 1.2, 1.1), camPos: new THREE.Vector3(0, 1.55, 2.6), background: 0x06344f });
    this.showAvatars = false; // you see real classmates (through the water), not avatars
    this.state = {
      ...this.state,
      mode: 'dive',
      selected: null,
      logbook: new Set(),
      sorted: new Set(),
      sort: null,
      names: false,
      pick: null,
      flow: true,
      prediction: null,
      result: null,
      bio: { qid: null, answer: null },
      explain: {
        title: 'Welcome to the reef',
        text: 'You are standing on the sea floor. Look around — and at your classmates. Every creature is shown at its real size (plankton are enlarged). Point at anything and pinch to photograph it for your logbook.',
      },
    };
    this.initLesson();
    this.start();
  }

  async initLesson() {
    this.lab.remove(this.explainPanel.mesh);
    this.explainPanel = new CanvasPanel({ width: 0.68, height: 0.26, name: 'card' });
    this.explainPanel.mesh.position.set(0, 0.45, -0.06);
    this.explainPanel.mesh.rotation.x = 0.2;
    this.lab.add(this.explainPanel.mesh);
    this.panels = [this.controlPanel, this.infoPanel, this.explainPanel];
    for (const p of this.panels) {
      p.mesh.renderOrder = 10; // drawn after the water tint, so they stay crisp
      p.mesh.material.fog = false;
    }
    this.grid.visible = false;

    // The ocean: origin on the floor at the reef.
    this.ocean = new THREE.Group();
    this.scene.add(this.ocean);
    this.eco = new Ecosystem();
    this.web = []; // food-web links found by the group: [food, eater, who]
    this.reef = new Reef(this);
    this.ocean.add(this.reef.group);
    this.water = new Water(this, this.ocean);
    this.sound = new OceanSound();
    this.sea = new Sea(this.ocean, this.reef, {}, this);
    this.sea.setPopulations(this.eco.pop, []);
    this.threads = new THREE.Group();
    this.ocean.add(this.threads);
    this.nameTags = new THREE.Group();
    this.ocean.add(this.nameTags);
    this.placeOcean();

    this.controlPanel.setBuilder((ui) => drawControls(ui, this));
    this.infoPanel.setBuilder((ui) => drawInfo(ui, this));
    this.explainPanel.setBuilder((ui) => drawCard(ui, this));
    document.addEventListener('pointerdown', () => this.sound.start(), { once: true });

    // Swap in any dropped-in 3D models (see models/manifest.json).
    const overrides = await loadModelOverrides(new URL('../models/', import.meta.url));
    this.reef.useCoralModels(overrides.coral?.pieces);
    if (Object.keys(overrides).length) {
      this.sea.overrides = overrides;
      for (const id of [...this.sea.agents.keys()]) this.sea.despawn(id);
      if (this.isHost) this.sea.setPopulations(this.eco.pop, [...this.eco.removed]);
    }
  }

  // ───────────── shared world ─────────────

  get isHost() {
    return !this.presence || this.presence.isHost;
  }

  /** Can this person change the shared reef? (the host — usually the teacher — or anyone solo) */
  get canControl() {
    return this.isHost;
  }

  get hostName() {
    const pr = this.presence;
    if (!pr || pr.isHost) return 'You';
    return pr.peers.get(pr.hostId)?.name ?? 'The host';
  }

  /** Put the reef ring around you, on the floor, with its front outcrop straight ahead (host / solo). */
  placeOcean() {
    const p = this.viewCamera().getWorldPosition(new THREE.Vector3());
    this.ocean.position.set(p.x, 0, p.z); // centred on you, on the floor (local-floor space: y = 0)
    this.ocean.rotation.set(0, this.lab.rotation.y, 0);
    this.oceanPlaced = true;
  }

  placeInFrontOfUser() {
    super.placeInFrontOfUser();
    // the host places the shared reef; others get it from the host once lined up with the room
    if (!this.oceanFromHost) this.placeOcean();
  }

  /** The host's reef, in the shared room frame (so lined-up headsets can put it in the same real place). */
  oceanAnchor() {
    const pr = this.presence;
    if (!pr?.worldToRoom) return null;
    const m = pr.worldToRoom.clone().multiply(this.ocean.matrixWorld);
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    m.decompose(p, q, new THREE.Vector3());
    return [p.x, p.y, p.z, new THREE.Euler().setFromQuaternion(q, 'YXZ').y].map((v) => Math.round(v * 1000) / 1000);
  }

  ecoMessage() {
    return { k: 'eco', eco: this.eco.snapshot(), web: this.web, running: !!this.running, start: this.runStart ?? null };
  }

  broadcastEco(to) {
    if (this.presence && this.isHost) this.presence.sendWorld(this.ecoMessage(), to);
  }

  onPeerJoinedWorld(id) {
    this.broadcastEco(id);
  }

  /** Messages from the host (everyone else). */
  onWorld(d) {
    if (this.isHost) return;
    if (d.k === 'sea') {
      this.sea.apply(d.a);
      const pr = this.presence;
      if (d.anchor && pr.roomToWorld) {
        const [x, y, z, yaw] = d.anchor;
        const m = pr.roomToWorld.clone().multiply(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(1, 1, 1)));
        m.decompose(this.ocean.position, this.ocean.quaternion, new THREE.Vector3());
        this.oceanFromHost = true;
      }
    } else if (d.k === 'eco') {
      this.eco.load(d.eco);
      this.web = d.web;
      this.running = d.running;
      if (d.start != null) this.runStart = d.start;
      this.showEco();
      this.refresh();
    }
  }

  /** Requests from others (host only). */
  onAsk(d, from) {
    if (d.k === 'link') this.addLink(d.a, d.b, d.by);
  }

  // ───────────── the ecosystem ─────────────

  showEco() {
    const s = this.eco.snapshot();
    this.reef.show(s);
    this.water.setConditions({ murk: this.eco.env.turbidity, bloom: Math.max(0, Math.min(1, (this.eco.pop.phyto - 1) / 1.2)) });
  }

  setEnv(key, delta) {
    if (!this.canControl || this.running) return;
    const [lo, hi] = LIMITS[key];
    this.eco.env[key] = Math.round(Math.min(hi, Math.max(lo, this.eco.env[key] + delta)) * 100) / 100;
    this.state.result = null;
    this.showEco();
    this.broadcastEco();
  }

  /** Simulate months one by one so everyone watches the reef change. */
  simulate(months, done) {
    this.running = true;
    this.runStart = this.eco.pop.coral; // everyone's prediction is checked against this
    let left = months;
    const tick = () => {
      this.eco.step();
      this.sea.setPopulations(this.eco.pop, [...this.eco.removed]);
      this.showEco();
      this.broadcastEco();
      this.refresh();
      if (--left > 0) this.runTimer = setTimeout(tick, RUN_MONTH_S * 1000);
      else {
        this.running = false;
        done?.();
        this.broadcastEco();
        this.refresh();
      }
    };
    this.runTimer = setTimeout(tick, 300);
  }

  runYear() {
    if (!this.canControl || this.running) return;
    const before = this.eco.pop.coral;
    sound.click();
    this.explain({ title: 'Running one year…', text: describeEnv(this.eco.env) });
    this.simulate(12, () => {
      const after = this.eco.pop.coral;
      const change = after - before;
      const outcome = change > 0.03 ? 'rise' : change < -0.03 ? 'fall' : 'stay';
      this.explain({ title: `After one year: coral ${outcome === 'stay' ? 'stayed about the same' : outcome === 'rise' ? 'rose' : 'fell'} (${Math.round(before * 100)}% → ${Math.round(after * 100)}%)`, text: explainYear(this.eco) });
      this.broadcastEco();
    });
  }

  /** Each person's own prediction is checked when the shared run ends. */
  checkPrediction(before, after) {
    const p = this.state.prediction;
    if (!p) return;
    const change = after - before;
    const outcome = change > 0.03 ? 'rise' : change < -0.03 ? 'fall' : 'stay';
    this.state.result = p === outcome ? `Your prediction (“${p}”) was right.` : `You predicted “${p}”, but coral cover ${outcome === 'stay' ? 'stayed about the same' : outcome === 'rise' ? 'rose' : 'fell'}. Why might that be?`;
    this.state.prediction = null;
  }

  resetReef() {
    if (!this.canControl || this.running) return;
    this.eco.reset(BASE_ENV);
    this.state.result = null;
    this.sea.setPopulations(this.eco.pop, []);
    this.showEco();
    this.broadcastEco();
    this.explain({ title: 'Reef reset', text: 'A healthy reef: about 60% live coral, little algae, clear water at 27 °C and pH 8.1.' });
  }

  removeSpecies(sp) {
    if (!this.canControl || this.running) return;
    this.eco.remove(sp);
    this.sea.setPopulations(this.eco.pop, [...this.eco.removed]);
    sound.refuse();
    this.explain({ title: `${SPECIES[sp].name} removed`, text: 'Watch the next two years unfold. Which populations rise, which fall — and why? Think about who ate it, and what it ate.' });
    this.simulate(24, () => this.explain({ title: `Two years without the ${SPECIES[sp].name.toLowerCase()}`, text: cascadeText(this.eco, sp) }));
  }

  restoreSpecies(sp) {
    if (!this.canControl || this.running) return;
    this.eco.restore(sp);
    this.simulate(12, () => this.explain({ title: `${SPECIES[sp].name} back`, text: 'The populations move back towards balance — though recovery takes time, and some changes (like dead coral overgrown with algae) can take years to reverse.' }));
  }

  // ───────────── tapping creatures ─────────────

  describe(o) {
    const sp = o.userData.species;
    return sp ? SPECIES[sp].name : '';
  }

  tap(o) {
    const sp = o.userData.species;
    if (!sp) return;
    this.sound.start();
    if (this.state.mode === 'web') this.webTap(sp);
    else this.photograph(sp);
  }

  photograph(sp) {
    const s = this.state;
    const isNew = !s.logbook.has(sp);
    s.logbook.add(sp);
    s.selected = sp;
    s.sort = null;
    sound.click();
    this.interaction.pulse(0.4, 30);
    this.flash();
    const d = SPECIES[sp];
    this.explain({ title: `${isNew ? 'New: ' : ''}${d.name}`, text: `${d.role}. ${d.about}` });
  }

  /** A quick camera-flash on the water tint. */
  flash() {
    this.water.flash();
  }

  // ── sort it (dichotomous key) ──
  startSort() {
    if (!this.state.selected) return;
    this.state.sort = { sp: this.state.selected, node: 'start' };
  }

  answerKey(yes) {
    const sort = this.state.sort;
    const next = KEY[sort.node][yes ? 'yes' : 'no'];
    if (KEY[next]) {
      sort.node = next;
      return;
    }
    const d = SPECIES[sort.sp];
    this.state.sort = null;
    if (next === d.group) {
      this.state.sorted.add(sort.sp);
      sound.bond();
      this.explain({ title: `Correct: ${d.name} → ${next}`, text: `${d.name} is a ${next}. ${groupNote(next)}` });
    } else {
      sound.refuse();
      this.explain({ title: `The key led to “${next}”, but the ${d.name.toLowerCase()} is a ${d.group}`, text: `Check the question where your answer differed. ${groupNote(d.group)}` });
    }
  }

  // ── food web ──
  webTap(sp) {
    const s = this.state;
    s.selected = sp;
    if (!s.pick) {
      s.pick = sp;
      sound.click();
      this.explain({ title: `${SPECIES[sp].name} selected`, text: `Now pinch something that eats the ${SPECIES[sp].name.toLowerCase()}. (Producers and plankton count too.)` });
      return;
    }
    const food = s.pick;
    s.pick = null;
    if (food === sp) return;
    const right = LINKS.some(([a, b]) => a === food && b === sp);
    const reversed = LINKS.some(([a, b]) => a === sp && b === food);
    if (right) {
      if (this.web.some(([a, b]) => a === food && b === sp)) {
        this.explain({ title: 'Already found', text: `${SPECIES[sp].name} eats ${SPECIES[food].name.toLowerCase()} — that link is already on the web.` });
      } else if (this.isHost) this.addLink(food, sp, this.presence?.name ?? 'You');
      else this.presence.ask({ k: 'link', a: food, b: sp, by: this.presence.name });
      sound.bond();
      this.explain({ title: `${SPECIES[food].name} → ${SPECIES[sp].name}`, text: `Energy flows from the ${SPECIES[food].name.toLowerCase()} to the ${SPECIES[sp].name.toLowerCase()} (trophic level ${SPECIES[food].trophic} → ${SPECIES[sp].trophic}). Only about 10% of the energy passes on; most is lost as heat from respiration.` });
    } else if (reversed) {
      sound.refuse();
      this.explain({ title: 'Other way round!', text: `Arrows in a food web show energy flow: from the food to the eater. Pinch the ${SPECIES[sp].name.toLowerCase()} first, then the ${SPECIES[food].name.toLowerCase()}.` });
    } else {
      sound.refuse();
      const eats = SPECIES[sp].eats.map((e) => SPECIES[e].name.toLowerCase());
      this.explain({ title: `The ${SPECIES[sp].name.toLowerCase()} doesn’t eat ${SPECIES[food].name.toLowerCase()}`, text: eats.length ? `Think about its diet: what is its trophic level (${SPECIES[sp].trophic}) and its role (${SPECIES[sp].role.toLowerCase()})?` : `${SPECIES[sp].name} is a producer or detritivore — it doesn’t eat other living things on this reef.` });
    }
  }

  addLink(a, b, by) {
    if (this.web.some(([x, y]) => x === a && y === b)) return;
    if (!LINKS.some(([x, y]) => x === a && y === b)) return;
    this.web.push([a, b, by]);
    this.broadcastEco();
    this.refresh();
  }

  // ───────────── UI actions ─────────────

  setMode(mode) {
    this.set({ mode, pick: null, sort: null, result: null, bio: { qid: null, answer: null } });
    const intro = {
      dive: ['Dive & discover', 'Point at a creature and pinch to photograph it and see its ID card. Then use “Sort it” to classify it with a key.'],
      web: ['Build the food web — together', 'Pinch a living thing, then pinch something that eats it. Correct links glow for everyone, with energy flowing from food to eater.'],
      lab: ['Reef lab', this.canControl ? 'Change the conditions, ask everyone to predict, then run a year and watch the reef respond.' : `${this.hostName} controls the conditions. Predict what will happen to the coral, then watch.`],
    }[mode];
    this.state.explain = { title: intro[0], text: intro[1] };
  }

  /** How strongly the water tints the real room (your own view only). */
  cycleWater() {
    const lv = this.water.cycleLevel();
    sound.click();
    this.explain({ title: `Water: ${lv.label.toLowerCase()}`, text: { light: 'Clear, shallow water: you can see the room well.', medium: 'Open water: the room fades into the blue.', deep: 'Deeper water: the room is only just visible, so the reef stands out.' }[lv.id] });
  }

  toggleNames() {
    this.state.names = !this.state.names;
    this.drawNames();
  }

  drawNames() {
    for (const t of [...this.nameTags.children]) {
      t.userData.dispose?.();
      this.nameTags.remove(t);
    }
    if (!this.state.names) return;
    for (const sp of ORDER) {
      const tag = makeLabel(SPECIES[sp].name, { height: 0.04, size: 40 });
      tag.material.fog = false;
      tag.renderOrder = 11;
      tag.userData.sp = sp;
      this.nameTags.add(tag);
    }
  }

  ask(qid) {
    this.state.bio = { qid, answer: ANSWERS[qid] ?? '' };
    this.say(this.state.bio.answer);
  }

  explain(e) {
    this.state.bio = { qid: null, answer: null };
    super.explain(e);
  }

  grabTargets() {
    return [...this.reef.group.children, ...this.sea.root.children].flatMap((g) => {
      const t = [];
      g.traverse((o) => {
        if ((o.isMesh || o.isInstancedMesh) && o.userData.species && o.userData.handler) t.push(o);
      });
      return t;
    });
  }

  refresh() {
    this.redrawPanels();
  }

  onXRStart() {
    this.sound.start();
  }

  // ───────────── every frame ─────────────

  update(dt) {
    if (this.isHost) {
      this.sea.simulate(dt, Math.max(0.3, Math.min(1, this.eco.oxygen)), this.headsInOcean());
      this.sea.draw(dt, false);
      if (this.presence?.peers.size) {
        this.sendClock = (this.sendClock ?? 0) + dt;
        if (this.sendClock > 0.1) {
          this.sendClock = 0;
          this.presence.sendWorld({ k: 'sea', a: this.sea.serialize(), anchor: this.oceanAnchor() });
        }
      }
    } else {
      this.sea.draw(dt, true);
    }
    this.reef.update(dt);
    this.water.update(dt);
    this.updateThreads(dt);
    for (const t of this.nameTags.children) {
      const p = this.sea.anchor(t.userData.sp);
      t.visible = !!p;
      if (p) t.position.copy(p).add(new THREE.Vector3(0, 0.12, 0));
    }
    // check each person's prediction when a shared run finishes
    if (this.wasRunning && !this.running && this.runStart != null) {
      this.checkPrediction(this.runStart, this.eco.pop.coral);
      this.refresh();
    }
    this.wasRunning = this.running;
  }

  /** Everyone's head position in ocean coordinates (you, and classmates in the session). */
  headsInOcean() {
    const heads = [this.ocean.worldToLocal(this.viewCamera().getWorldPosition(new THREE.Vector3()))];
    for (const p of this.presence?.peers.values() ?? []) {
      if (p.pose) heads.push(this.ocean.worldToLocal(p.head.getWorldPosition(new THREE.Vector3())));
    }
    return heads;
  }

  /** Food-web threads: lines from food to eater with energy dots flowing along them. */
  updateThreads(dt) {
    const show = this.state.mode === 'web';
    this.threads.visible = show;
    if (!show) return;
    this.threadT = (this.threadT ?? 0) + dt;
    while (this.threads.children.length < this.web.length) {
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.7, fog: false }));
      const dots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.012, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff2a8, toneMapped: false, fog: false }), 6);
      line.add(dots);
      line.userData.dots = dots;
      this.threads.add(line);
    }
    const m = new THREE.Object3D();
    this.threads.children.forEach((line, i) => {
      const link = this.web[i];
      const a = link && this.sea.anchor(link[0]);
      const b = link && this.sea.anchor(link[1]);
      line.visible = !!(a && b);
      if (!line.visible) return;
      line.geometry.setFromPoints([a, b]);
      const dots = line.userData.dots;
      dots.visible = this.state.flow;
      for (let k = 0; k < 6; k++) {
        m.position.copy(a).lerp(b, ((this.threadT * 0.35 + k / 6) % 1));
        m.updateMatrix();
        dots.setMatrixAt(k, m.matrix);
      }
      dots.instanceMatrix.needsUpdate = true;
    });
  }
}

// ── explanations ───────────────────────────────────────

function groupNote(group) {
  return {
    'single-celled producer': 'Unicellular photosynthetic organisms: the base of the open-ocean food web.',
    'plant / alga': 'Multicellular producers that photosynthesise.',
    reptile: 'Air-breathing vertebrate with scaly skin; lays amniotic eggs on land.',
    'cartilaginous fish': 'Class Chondrichthyes: skeleton of cartilage, 5–7 gill slits, no swim bladder.',
    'bony fish': 'Class Osteichthyes: bony skeleton, a gill cover (operculum) and usually a swim bladder.',
    cnidarian: 'Phylum Cnidaria: radial symmetry, stinging cells (nematocysts), one body opening.',
    arthropod: 'Phylum Arthropoda: jointed legs and a chitin exoskeleton.',
    echinoderm: 'Phylum Echinodermata: five-part radial symmetry, tube feet and a water vascular system.',
    mollusc: 'Phylum Mollusca: soft body with a muscular foot and mantle; octopuses have lost the shell.',
  }[group] ?? '';
}

function describeEnv(env) {
  const bits = [];
  if (env.temp > 29.5) bits.push(`${env.temp} °C is above the bleaching threshold (~29.5 °C here).`);
  if (env.ph < 8.05) bits.push(`pH ${env.ph} means fewer carbonate ions for building skeletons.`);
  if (env.nutrients > 0.3) bits.push('High nutrients will feed algae and plankton blooms.');
  if (env.turbidity > 0.3) bits.push('Murky water cuts the light reaching the coral’s zooxanthellae.');
  return bits.length ? bits.join(' ') : 'Conditions are close to normal for a healthy reef.';
}

function explainYear(eco) {
  const e = eco.env;
  const why = [];
  if (eco.bleach > 0.3) why.push('Heat stress made corals expel their zooxanthellae (bleaching); without that energy many starved, and algae colonised the dead skeletons.');
  if (e.ph < 8.05) why.push('Lower pH reduced carbonate ions, slowing calcification so coral could not keep up.');
  if (eco.oxygen < 0.6) why.push('Decomposition of excess algae and plankton used up dissolved oxygen (eutrophication → hypoxia), and fish declined.');
  if (e.turbidity > 0.3) why.push('Less light reached the zooxanthellae and seagrass, so photosynthesis and growth fell.');
  if (eco.pop.algae > 0.35) why.push('Algae are winning the competition for space — a phase shift away from a coral-dominated reef.');
  return why.length ? why.join(' ') : 'With normal conditions, coral, algae and grazers stay in balance.';
}

function cascadeText(eco, sp) {
  const rows = ORDER.filter((x) => x !== sp && !eco.removed.has(x) && !['coral', 'algae'].includes(x))
    .map((x) => [x, eco.pop[x]])
    .filter(([, v]) => Math.abs(v - 1) > 0.15)
    .sort((a, b) => Math.abs(b[1] - 1) - Math.abs(a[1] - 1))
    .slice(0, 4)
    .map(([x, v]) => `${SPECIES[x].name} ${v > 1 ? '▲' : '▼'} ${Math.round(v * 100)}%`);
  const coral = `Coral cover ${Math.round(eco.pop.coral * 100)}%, algae ${Math.round(eco.pop.algae * 100)}%.`;
  return `${rows.length ? rows.join(' · ') + '. ' : 'Little changed — this species has few strong links. '}${coral} Trace the links: which changes are direct (predator or prey) and which are indirect (a trophic cascade)?`;
}

window.app = new App();
