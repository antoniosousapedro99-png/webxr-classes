import * as THREE from 'three';
import { LessonApp } from '../../../shared/LessonApp.js';
import { CanvasPanel } from '../../../shared/ui/CanvasPanel.js';
import { makeLabel } from '../../../shared/ui/labels.js';
import { sound } from '../../../shared/util/sound.js';
import { SPECIES, ORDER, KEY, ANSWERS } from './data/species.js';
import { Ecosystem, BASE_ENV } from './model/Ecosystem.js';
import { Reef } from './model/Reef.js';
import { Sea } from './model/Sea.js';
import { Water, OceanSound, addBlend } from './model/Water.js';
import { loadModelOverrides, makeBody } from './model/bodies.js';
import { drawControls, drawInfo, drawCard } from './ui/panels.js';

// Reef Dive: the classroom becomes the sea floor. One shared reef and its animals fill the room; in a
// same-room session everyone sees the same creatures in the same places, and each other through the water.

const LIMITS = { temp: [24, 33], ph: [7.6, 8.3], nutrients: [0, 1], turbidity: [0, 1] };
const RUN_MONTH_S = 0.9; // seconds per simulated month while running
const GLOW_SELECTED = new THREE.Color(0x8af6ff); // the species you photographed / selected

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
      prediction: null,
      result: null,
      bio: { qid: null, answer: null },
      explain: {
        title: 'Welcome to the reef',
        text: 'You are standing in a clearing on the sea floor, ringed by a coral reef. Look around — and at your classmates. Every creature is shown at its real size (plankton are enlarged).',
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
    this.reef = new Reef(this);
    this.ocean.add(this.reef.group);
    this.water = new Water(this, this.ocean);
    this.sound = new OceanSound();
    this.sea = new Sea(this.ocean, this.reef, {}, this);
    this.sea.setPopulations(this.eco.pop, []);
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
    if (overrides.anemone?.scene) this.reef.useAnemoneModel(makeBody('anemone', overrides, SPECIES.anemone.length));
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
    return { k: 'eco', eco: this.eco.snapshot(), running: !!this.running, start: this.runStart ?? null };
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
      this.running = d.running;
      if (d.start != null) this.runStart = d.start;
      this.showEco();
      this.refresh();
    }
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

  // ───────────── tapping creatures ─────────────

  describe(o) {
    const sp = o.userData.species;
    return sp ? SPECIES[sp].name : '';
  }

  tap(o) {
    const sp = o.userData.species;
    if (!sp) return;
    this.sound.start();
    this.photograph(sp);
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
    this.explain({
      // the species name is the ID card's title on the right, so the card here only says what happened
      title: isNew ? 'New species photographed!' : 'Already in your logbook',
      text: isNew
        ? `Its ID card is on the right, and every one of this species is glowing.${s.sorted.has(sp) ? '' : ' Next: classify it with “Sort it”.'}`
        : 'Every one of this species is glowing, so you can spot them all.',
    });
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

  // ───────────── UI actions ─────────────

  setMode(mode) {
    this.set({ mode, sort: null, result: null, bio: { qid: null, answer: null } });
    const intro = {
      dive: ['Identify', 'Identify the reef’s organisms: every photo opens an ID card with its scientific name, group and role. Can you find all ' + ORDER.length + ' species?'],
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
    this.updateGlow(dt);
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

  /** The selected species glows (pulsing cyan, with a soft halo around each animal). */
  updateGlow(dt) {
    const want = new Map();
    if (this.state.selected) want.set(this.state.selected, GLOW_SELECTED);
    const key = [...want].map(([sp, c]) => sp + c.getHexString()).join(',');
    this.glowClock = (this.glowClock ?? 0) + dt;
    if (key !== this.glowKey || this.glowClock > 1) {
      // (re)collect the glowing materials: the selection changed, or animals were born / removed
      this.glowClock = 0;
      this.glowKey = key;
      for (const [m, g] of this.glowMats ?? []) m.emissive.copy(g.base);
      if (this.glowPlankton) this.glowPlankton.pts.material.uniforms.uOpacity.value = this.glowPlankton.base;
      this.glowMats = new Map();
      this.glowPlankton = null;
      const add = (o, color) => o.traverse((x) => {
        if (!(x.isMesh || x.isInstancedMesh)) return;
        for (const m of [x.material].flat()) if (m.emissive && !this.glowMats.has(m)) this.glowMats.set(m, { base: m.emissive.clone(), color });
      });
      for (const [sp, color] of want) {
        for (const a of this.sea.agents.values()) if (a.sp === sp) add(a.body, color);
        this.reef.group.traverse((x) => { if (x.userData.species === sp && (x.isMesh || x.isInstancedMesh)) add(x, color); });
        const pts = sp === 'phyto' ? this.reef.phyto : sp === 'zoo' ? this.reef.zoo : null;
        if (pts) this.glowPlankton = { pts, base: pts.material.uniforms.uOpacity.value };
      }
    }
    const k = 0.75 + 0.3 * Math.sin(performance.now() / 1000 * 5);
    const c = new THREE.Color();
    for (const [m, g] of this.glowMats) m.emissive.copy(g.base).add(c.copy(g.color).multiplyScalar(k * 0.75));
    // a soft halo of light around each glowing animal, so it stands out against the blue from across the room
    this.halos ??= [];
    let n = 0;
    for (const a of this.sea.agents.values()) {
      const color = want.get(a.sp);
      if (!color) continue;
      const h = (this.halos[n++] ??= this.makeHalo());
      h.visible = true;
      h.position.copy(a.body.position);
      h.material.color.copy(color);
      h.material.opacity = 0.35 + 0.25 * k;
      h.scale.setScalar(Math.max(0.12, SPECIES[a.sp].length * 1.7) * (0.95 + 0.08 * k));
    }
    for (let i = n; i < this.halos.length; i++) this.halos[i].visible = false;
    if (this.glowPlankton) this.glowPlankton.pts.material.uniforms.uOpacity.value = Math.min(1, this.glowPlankton.base * (1.3 + k));
  }

  makeHalo() {
    if (!this.haloTex) {
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const g = c.getContext('2d');
      const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      grad.addColorStop(0, 'rgba(255,255,255,0.9)');
      grad.addColorStop(0.35, 'rgba(255,255,255,0.45)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, 128, 128);
      this.haloTex = new THREE.CanvasTexture(c);
    }
    const s = new THREE.Sprite(addBlend(new THREE.SpriteMaterial({ map: this.haloTex, transparent: true, depthWrite: false, fog: false })));
    s.renderOrder = 4;
    this.ocean.add(s);
    return s;
  }

  /** Everyone's head position in ocean coordinates (you, and classmates in the session). */
  headsInOcean() {
    const heads = [this.ocean.worldToLocal(this.viewCamera().getWorldPosition(new THREE.Vector3()))];
    for (const p of this.presence?.peers.values() ?? []) {
      if (p.pose) heads.push(this.ocean.worldToLocal(p.head.getWorldPosition(new THREE.Vector3())));
    }
    return heads;
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

window.app = new App();
