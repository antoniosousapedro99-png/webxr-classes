import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CanvasPanel } from './ui/CanvasPanel.js';
import { Interaction } from './ui/Interaction.js';
import { THEME } from './ui/CanvasPanel.js';
import { Presence, sessionFromURL } from './net/Presence.js';
import { newSessionCode } from './net/code.js';

// Everything every WebXR lesson needs, so each lesson only adds its own content:
//  • three.js scene, desktop camera + orbit controls, lights, floor grid
//  • a "lab" group holding the lesson, with a control panel (left), info panel (right)
//    and a floating explanation card (top)
//  • entering mixed reality / VR, placing the lab in front of the user or on a surface (hit-test)
//  • one input layer for mouse, touch, controllers and hands (shared/ui/Interaction.js)
//
// A lesson extends this class, sets up its content, then calls `this.start()`. Hooks it can provide:
//   refresh()            redraw 3D content + panels from state (call this.redrawPanels())
//   update(dt, frame)    per-frame animation
//   grabTargets()        objects that can be picked up / tapped
//   onXRStart(session, isAR), onXREnd(), onXRFrame(frame, refSpace)
//
// Shared sessions (?session=CODE in the URL): everyone keeps their own models and sees the others
// beside them. A lesson takes part by providing:
//   netState()           a small JSON snapshot of what it shows (sent to the others when it changes)
//   createReplica()      → { group, apply(snapshot), update(dt)?, heldObject(held)? } to show someone else's work
//   this.netHolding      { label, ... } while the user is holding something (shown in their avatar's hand)

export class LessonApp {
  constructor({ labPos = new THREE.Vector3(0, 1.2, 0), camPos = new THREE.Vector3(0, 1.45, 1.35), background = 0x0d1020 } = {}) {
    this.labPos = labPos.clone();
    this.camPos = camPos.clone();
    this.state = {
      explain: null, // { title, text } shown on the floating card
      placing: false,
      speak: false,
      seated: false, // seated students: lab placed closer and lower
      locked: false, // lab can't be moved by grabbing it
    };
    this.presenting = false;
    this.hitTestSource = null;
    this.needsPlacement = false;
    this.initThree(background);
    this.initLab();
  }

  /** Call at the end of the lesson's constructor. */
  start() {
    // always load the latest version of the site after an update (see sw.js)
    navigator.serviceWorker?.register(new URL('../../sw.js', location.href)).catch(() => {});
    this.interaction = new Interaction(this);
    this.lessonId = (location.pathname.match(/lessons\/([^/]+)/) || [])[1] || 'lesson';
    const session = sessionFromURL();
    if (session) {
      this.presence = new Presence(this, { lessonId: this.lessonId, ...session });
      this.sessionPanel = new CanvasPanel({ width: 0.5, height: session.sameRoom ? 0.19 : 0.14, name: 'session' });
      this.sessionPanel.mesh.position.set(-0.62, session.sameRoom ? -0.475 : -0.45, 0.14);
      this.sessionPanel.mesh.rotation.y = 0.42;
      this.lab.add(this.sessionPanel.mesh);
      this.sessionPanel.setBuilder((ui) => this.drawSession(ui));
      this.panels.push(this.sessionPanel);
      this.initPlayerList();
    }
    this.initSessionUI(session);
    this.initXRButtons();
    this.refresh();
    this.clock = new THREE.Clock();
    this.renderer.setAnimationLoop((t, frame) => this.frame(frame));
  }

  // ───────────── setup ─────────────

  initThree(background) {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    document.body.appendChild(renderer.domElement);
    this.renderer = renderer;

    this.scene = new THREE.Scene();
    this.background = new THREE.Color(background);
    this.scene.background = this.background;

    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.01, 100000);
    this.camera.position.copy(this.camPos);
    this.controls = new OrbitControls(this.camera, renderer.domElement);
    this.controls.target.copy(this.labPos);
    this.controls.enableDamping = true;
    this.controls.maxDistance = 20;
    this.controls.update();

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x445066, 2.2));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(1, 3, 2);
    this.scene.add(sun);

    // Floor grid for on-screen / VR use; hidden in mixed reality where the real room is visible.
    this.grid = new THREE.GridHelper(20, 40, 0x334070, 0x1c2340);
    this.scene.add(this.grid);

    // Reticle for placing the lab on a real surface (AR hit-test).
    const ring = new THREE.RingGeometry(0.06, 0.08, 40).rotateX(-Math.PI / 2);
    this.reticle = new THREE.Mesh(ring, new THREE.MeshBasicMaterial({ color: 0xffffff }));
    this.reticle.matrixAutoUpdate = false;
    this.reticle.visible = false;
    this.scene.add(this.reticle);

    window.addEventListener('resize', () => {
      if (this.renderer.xr.isPresenting) return;
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  initLab() {
    // Everything in the lesson lives in one group so it can be moved / placed as a whole.
    this.lab = new THREE.Group();
    this.lab.position.copy(this.labPos);
    this.scene.add(this.lab);

    this.controlPanel = new CanvasPanel({ width: 0.5, height: 0.72, name: 'controls' });
    this.infoPanel = new CanvasPanel({ width: 0.5, height: 0.72, name: 'info' });
    this.controlPanel.mesh.position.set(-0.62, 0, 0.14);
    this.controlPanel.mesh.rotation.y = 0.42;
    this.infoPanel.mesh.position.set(0.62, 0, 0.14);
    this.infoPanel.mesh.rotation.y = -0.42;
    // Floating card above the model that explains whatever you just picked up or changed.
    this.explainPanel = new CanvasPanel({ width: 0.68, height: 0.25, name: 'explain' });
    this.explainPanel.mesh.position.set(0, 0.44, -0.04);
    this.explainPanel.mesh.rotation.x = 0.22;
    this.lab.add(this.controlPanel.mesh, this.infoPanel.mesh, this.explainPanel.mesh);
    this.panels = [this.controlPanel, this.infoPanel, this.explainPanel];
  }

  // ───────────── hooks (override in a lesson) ─────────────

  refresh() {
    this.redrawPanels();
  }

  redrawPanels() {
    for (const p of this.panels) p.redraw();
  }

  update() {}

  grabTargets() {
    return [];
  }

  // ───────────── shared actions ─────────────

  set(patch) {
    Object.assign(this.state, patch);
  }

  /** Show an explanation on the floating card (and read it out if voice is on). */
  explain(e) {
    if (!e) return;
    this.state.explain = e;
    this.say(`${e.title}. ${e.text}`);
    this.refresh();
  }

  say(text) {
    if (this.state.speak && 'speechSynthesis' in window) {
      speechSynthesis.cancel();
      speechSynthesis.speak(new SpeechSynthesisUtterance(text));
    }
  }

  toggleSpeak() {
    this.state.speak = !this.state.speak;
    if (!this.state.speak && 'speechSynthesis' in window) speechSynthesis.cancel();
  }

  toggleSeated() {
    this.state.seated = !this.state.seated;
    if (this.presenting) this.needsPlacement = true;
  }

  toggleLocked() {
    this.state.locked = !this.state.locked;
    if (this.state.locked) this.state.placing = false;
  }

  /** Standard buttons for the bottom of a control panel: move the lab, seated mode, lock, voice. */
  generalButtons() {
    const s = this.state;
    const b = [{ id: 'recenter', label: this.presenting ? 'Bring lab to me' : 'Reset view', onClick: () => this.recenter() }];
    if (this.hitTestSource) b.push({ id: 'place', label: s.placing ? 'Tap to drop here' : 'Place on surface', active: s.placing, disabled: s.locked, onClick: () => this.togglePlacing() });
    b.push({ id: 'seated', label: s.seated ? 'Seated: on' : 'Seated: off', active: s.seated, onClick: () => this.toggleSeated() });
    b.push({ id: 'lock', label: s.locked ? 'Lab locked' : 'Lab unlocked', active: s.locked, onClick: () => this.toggleLocked() });
    b.push({ id: 'speak', label: s.speak ? 'Voice: on' : 'Voice: off', active: s.speak, onClick: () => this.toggleSpeak(), disabled: !('speechSynthesis' in window) });
    b.push(this.lessonsButton());
    return b;
  }

  /** "← Lessons": back to the lessons page. Press twice (within 3 s) so nobody leaves by accident. */
  lessonsButton() {
    const armed = this.leaveArmed && performance.now() - this.leaveArmed < 3000;
    return { id: 'lessons', label: armed ? 'Tap again to leave' : '← Lessons', active: armed, color: '#3a2f55', onClick: () => this.backToLessons() };
  }

  backToLessons() {
    const armed = this.leaveArmed && performance.now() - this.leaveArmed < 3000;
    if (!armed) {
      this.leaveArmed = performance.now();
      setTimeout(() => this.refresh(), 3100); // the button goes back to "← Lessons"
      return;
    }
    const url = this.lessonsURL();
    const go = () => { location.href = url; };
    const session = this.renderer.xr.getSession();
    if (session) session.end().then(go, go); // leave the headset view first, then the page
    else go();
  }

  /** The lessons page (keeps a shared session's name so people don't retype it). */
  lessonsURL() {
    const url = new URL('../../', location.href);
    const name = new URLSearchParams(location.search).get('name');
    if (name) url.searchParams.set('name', name);
    return url.toString();
  }

  togglePlacing() {
    this.state.placing = !this.state.placing;
  }

  confirmPlacement() {
    this.state.placing = false;
    this.refresh();
  }

  recenter() {
    if (this.presenting) {
      this.needsPlacement = true;
      return;
    }
    this.lab.position.copy(this.labPos);
    this.lab.rotation.set(0, 0, 0);
    this.camera.position.copy(this.camPos);
    this.controls.target.copy(this.labPos);
  }

  /** The camera currently in use (headset or desktop). */
  viewCamera() {
    return this.presenting ? this.renderer.xr.getCamera() : this.camera;
  }

  // ───────────── shared sessions ─────────────

  drawSession(ui) {
    const pr = this.presence;
    ui.y = 18;
    if (pr.sameRoom) {
      const lined = !!pr.roomToWorld;
      const label = this.calibrating ? `Touch point ${this.calibrating.points.length === 0 ? 'A' : 'B'}…  (tap to cancel)` : lined ? 'Lined up ✓ · line up again' : 'Line up with the room';
      ui.button({ id: 'calibrate', label, active: !!this.calibrating, disabled: !this.presenting, onClick: () => this.toggleCalibration() }, ui.pad, ui.y, ui.contentWidth, 54, 24);
      ui.y += 66;
    }
    const status = pr.status === 'connected' ? (pr.peers.size ? '' : ' · waiting for others to join') : pr.status === 'failed' ? ' · could not connect' : ' · connecting…';
    ui.text(`SESSION ${pr.code}${status}`, { size: 24, weight: 700, color: pr.status === 'failed' ? '#ff6b6b' : THEME.accent });
    const ctx = ui.ctx;
    let x = ui.pad;
    for (const person of pr.people.slice(0, 6)) {
      ctx.font = '600 22px system-ui, sans-serif';
      const w = ctx.measureText(person.name).width + 34;
      if (x + w > ui.W - ui.pad) break;
      ctx.fillStyle = `#${person.color.toString(16).padStart(6, '0')}`;
      ctx.beginPath();
      ctx.arc(x + 9, ui.y + 14, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = THEME.text;
      ctx.textBaseline = 'top';
      ctx.fillText(person.name, x + 24, ui.y + 2);
      x += w + 14;
    }
  }

  // ───────────── player list (top right) ─────────────

  /** Who's in the session: a drop-down in the top-right corner of the screen, and of your view in the headset. */
  initPlayerList() {
    const css = document.createElement('style');
    css.textContent = `
      .players { position: fixed; top: 12px; right: 12px; z-index: 30; font: 14px system-ui, sans-serif; color: #eef1ff; text-align: left; display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
      .players-btn { background: rgba(14, 18, 32, 0.92); border: 1px solid rgba(124, 140, 255, 0.55); color: #eef1ff; border-radius: 12px; padding: 9px 14px; font: 600 14px system-ui, sans-serif; cursor: pointer; }
      .players-btn:hover { background: #36427a; }
      .players-list { list-style: none; margin: 0; padding: 6px 8px; background: rgba(14, 18, 32, 0.95); border: 1px solid rgba(124, 140, 255, 0.55); border-radius: 12px; min-width: 240px; max-height: 60vh; overflow-y: auto; }
      .players-list[hidden] { display: none; }
      .players-list li { display: flex; align-items: center; gap: 9px; padding: 7px 4px; }
      .players-list li + li { border-top: 1px solid rgba(124, 140, 255, 0.15); }
      .players-list .dot { width: 12px; height: 12px; border-radius: 50%; flex: none; }
      .players-list small { color: #a3abd1; margin-left: auto; padding-left: 10px; white-space: nowrap; }
      .players-list .head { color: #9aa8ff; font-weight: 700; font-size: 12px; letter-spacing: 0.08em; }`;
    document.head.appendChild(css);
    const el = document.createElement('div');
    el.className = 'players';
    el.innerHTML = '<button class="players-btn" aria-expanded="false"></button><ul class="players-list" hidden></ul>';
    document.body.appendChild(el);
    this.playersBtnEl = el.querySelector('button');
    this.playersListEl = el.querySelector('ul');
    this.playersBtnEl.onclick = () => this.togglePlayerList();

    // in the headset: a small button at the top right of your view; the list drops down below it
    const onTop = (panel) => {
      panel.mesh.material.depthTest = false; // never hidden behind the scene
      panel.mesh.renderOrder = 1000;
      panel.mesh.visible = false;
      this.scene.add(panel.mesh);
      this.panels.push(panel);
      return panel;
    };
    this.playersOpen = false;
    this.playersPanel = onTop(new CanvasPanel({ width: 0.2, height: 0.05, name: 'players' }));
    this.playersPanel.setBuilder((ui) => {
      const n = this.presence.people.length;
      ui.button({ id: 'players', label: `Players (${n}) ${this.playersOpen ? '▴' : '▾'}`, active: this.playersOpen, onClick: () => this.togglePlayerList() }, 6, 6, ui.W - 12, ui.H - 12, 30);
    });
    this.playersListPanel = onTop(new CanvasPanel({ width: 0.3, height: 0.3, name: 'players-list' }));
    this.playersListPanel.setBuilder((ui) => this.drawPlayerList(ui));
    this.refreshPlayerList();
  }

  togglePlayerList() {
    this.playersOpen = !this.playersOpen;
    this.refreshPlayerList();
  }

  /** A short note about a person: you / host, and (same room) whether they have lined up. */
  personNote(person) {
    const notes = [];
    if (person.you) notes.push('you');
    if (person.host) notes.push('host');
    if (this.presence.sameRoom) notes.push(person.lined ? '✓ lined up' : 'not lined up');
    return notes.join(' · ');
  }

  refreshPlayerList() {
    const pr = this.presence;
    if (!pr || !this.playersBtnEl) return;
    const people = pr.people;
    const key = JSON.stringify([this.playersOpen, pr.status, people.map((p) => [p.plain, p.color, this.personNote(p)])]);
    if (key === this.playersKey) return;
    this.playersKey = key;
    this.playersBtnEl.textContent = `👥 Players (${people.length}) ${this.playersOpen ? '▴' : '▾'}`;
    this.playersBtnEl.setAttribute('aria-expanded', String(this.playersOpen));
    this.playersListEl.hidden = !this.playersOpen;
    const list = this.playersListEl;
    list.replaceChildren();
    const head = document.createElement('li');
    head.className = 'head';
    head.textContent = `SESSION ${pr.code}${pr.status === 'connected' ? (pr.peers.size ? '' : ' · waiting for others') : pr.status === 'failed' ? ' · could not connect' : ' · connecting…'}`;
    list.appendChild(head);
    for (const person of people) {
      const li = document.createElement('li');
      const dot = document.createElement('span');
      dot.className = 'dot';
      dot.style.background = `#${person.color.toString(16).padStart(6, '0')}`;
      const name = document.createElement('span');
      name.textContent = person.plain; // names come from other people: text only, never HTML
      const note = document.createElement('small');
      note.textContent = this.personNote(person);
      li.append(dot, name, note);
      list.appendChild(li);
    }
    this.playersPanel.redraw();
    this.playersListPanel.redraw();
  }

  drawPlayerList(ui) {
    const pr = this.presence;
    const ctx = ui.ctx;
    ui.y = 20;
    ui.text(`SESSION ${pr.code}`, { size: 24, weight: 700, color: THEME.accent });
    for (const person of pr.people) {
      const y = ui.y + 4;
      ctx.fillStyle = `#${person.color.toString(16).padStart(6, '0')}`;
      ctx.beginPath();
      ctx.arc(ui.pad + 10, y + 18, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.textBaseline = 'top';
      ctx.fillStyle = THEME.text;
      ctx.font = '600 27px system-ui, sans-serif';
      ctx.fillText(person.plain.slice(0, 22), ui.pad + 32, y + 2);
      ctx.fillStyle = THEME.dim;
      ctx.font = '400 21px system-ui, sans-serif';
      ctx.fillText(this.personNote(person), ui.pad + 32, y + 34);
      ui.y += 68;
    }
  }

  /** Keep the headset drop-down at the top right of your view, following smoothly. */
  placePlayerList(dt) {
    if (!this.playersPanel) return;
    const show = this.presenting;
    this.playersPanel.mesh.visible = show;
    this.playersListPanel.mesh.visible = show && this.playersOpen;
    if (!show) {
      this.playersPlaced = false;
      return;
    }
    const cam = this.renderer.xr.getCamera();
    const q = cam.getWorldQuaternion(new THREE.Quaternion());
    const p = cam.getWorldPosition(new THREE.Vector3());
    const k = this.playersPlaced ? 1 - Math.exp(-dt * 10) : 1;
    this.playersPlaced = true;
    const put = (mesh, x, y) => {
      mesh.position.lerp(new THREE.Vector3(x, y, -0.8).applyQuaternion(q).add(p), k);
      mesh.quaternion.slerp(q, k);
    };
    put(this.playersPanel.mesh, 0.26, 0.2);
    put(this.playersListPanel.mesh, 0.21, 0.2 - 0.025 - 0.01 - 0.15); // right edges line up, just below the button
  }

  // ───────────── same room: line up with the room ─────────────

  toggleCalibration() {
    if (this.calibrating) {
      this.endCalibration();
      return;
    }
    this.calibrating = { points: [] };
    this.explain({
      title: 'Line up with the room',
      text: 'Agree with your colleagues on two points you can all reach, e.g. two corners of the same table. Touch point A with your fingertips and pinch (or put the controller tip on it and pull the trigger). Then do the same for point B. Everyone must use the same two points, in the same order.',
    });
  }

  /** Called by Interaction while lining up: the hand/controller tip was pressed here (world space). */
  calibrationPoint(p) {
    const cal = this.calibrating;
    if (!cal) return;
    cal.points.push(p.clone());
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.012, 16, 12), new THREE.MeshBasicMaterial({ color: cal.points.length === 1 ? 0xffd166 : 0x7ee2a8, toneMapped: false }));
    dot.position.copy(p);
    this.scene.add(dot);
    (this.calibrationMarks ??= []).push(dot);
    this.interaction.pulse(0.6, 60);
    if (cal.points.length === 1) {
      this.explain({ title: 'Point A marked', text: 'Now touch point B — the second point everyone agreed on — and pinch or pull the trigger.' });
      return;
    }
    const ok = this.presence.setRoomPoints(cal.points[0], cal.points[1]);
    this.endCalibration();
    this.explain(ok
      ? { title: 'Lined up with the room', text: 'Once your colleagues have lined up too, their work appears on their real desks and you see them through passthrough. If anything looks off, line up again.' }
      : { title: 'Points too close together', text: 'Choose two points at least 10 cm apart (e.g. opposite corners of a table) and try again.' });
  }

  endCalibration() {
    this.calibrating = null;
    setTimeout(() => {
      for (const m of this.calibrationMarks ?? []) this.scene.remove(m);
      this.calibrationMarks = [];
    }, 4000);
    this.refresh();
  }

  /** The 2D start screen: show the session code, or offer to start / join one. */
  initSessionUI(session) {
    const overlay = document.getElementById('overlay');
    if (!overlay) return;
    const back = document.createElement('a');
    back.href = this.lessonsURL();
    back.className = 'back-link';
    back.textContent = '← All lessons';
    back.style.cssText = 'display:inline-block;margin:0 0 10px;color:#9aa8ff;font-size:14px;text-decoration:none';
    overlay.prepend(back);
    const box = document.createElement('div');
    box.className = 'session-box';
    const url = new URL(location.href);
    if (session) {
      url.searchParams.set('session', session.code);
      url.searchParams.delete('host'); // the shared link makes others join, not host
      box.innerHTML = `<p><strong>Shared session <span class="code">${session.code}</span></strong> · ${session.sameRoom ? 'same room' : 'different rooms'}<br>Colleagues join from the lessons page with this code, or with this link.${session.sameRoom ? ' In the headset, everyone presses “Line up with the room” and touches the same two points.' : ''}</p>
        <div class="buttons"><button class="secondary" id="copy-link">Copy link</button><button class="secondary" id="leave-session">Leave session</button></div>`;
      box.querySelector('#copy-link').onclick = (e) => {
        navigator.clipboard?.writeText(url.toString()).then(() => { e.target.textContent = 'Link copied'; }).catch(() => prompt('Copy this link:', url.toString()));
      };
      box.querySelector('#leave-session').onclick = () => {
        url.searchParams.delete('session');
        url.searchParams.delete('room');
        location.href = url.toString();
      };
    } else {
      box.innerHTML = `<p>Working with someone? <button class="link" id="start-session">Start a shared session</button> or join one:</p>
        <form class="buttons" id="join-form"><input id="join-code" maxlength="8" placeholder="Code" autocomplete="off" aria-label="Session code"><button class="secondary">Join</button></form>
        <label class="same-room"><input type="checkbox" id="same-room"> We’re in the same room</label>`;
      const sameRoom = () => {
        if (box.querySelector('#same-room').checked) url.searchParams.set('room', 'same');
      };
      box.querySelector('#start-session').onclick = () => {
        url.searchParams.set('session', newSessionCode());
        url.searchParams.set('host', '1');
        sameRoom();
        location.href = url.toString();
      };
      box.querySelector('#join-form').onsubmit = (e) => {
        e.preventDefault();
        const code = box.querySelector('#join-code').value.trim().toUpperCase();
        if (!code) return;
        url.searchParams.set('session', code);
        sameRoom();
        location.href = url.toString();
      };
    }
    overlay.appendChild(box);
  }

  // ───────────── WebXR ─────────────

  async initXRButtons() {
    const arBtn = document.getElementById('btn-ar');
    const vrBtn = document.getElementById('btn-vr');
    const hint = document.getElementById('hint');
    if (!('xr' in navigator)) {
      arBtn.textContent = 'Mixed reality not available';
      hint.textContent = window.isSecureContext
        ? 'This browser has no WebXR. Open this page in the Meta Quest Browser (or Chrome on Android) for mixed reality — you can still explore on screen.'
        : 'WebXR needs a secure (https://) page. You can still explore on screen.';
      return;
    }
    const [ar, vr] = await Promise.all([
      navigator.xr.isSessionSupported('immersive-ar').catch(() => false),
      navigator.xr.isSessionSupported('immersive-vr').catch(() => false),
    ]);
    if (ar) {
      arBtn.disabled = false;
      arBtn.textContent = 'Enter Mixed Reality';
      arBtn.onclick = () => this.startSession('immersive-ar');
    } else {
      arBtn.textContent = 'Mixed reality not supported here';
    }
    if (vr) {
      vrBtn.hidden = false;
      vrBtn.onclick = () => this.startSession('immersive-vr');
    }
    hint.textContent = ar
      ? 'Put on your headset and press “Enter Mixed Reality”. The lab appears in front of you.'
      : 'Explore on screen, or open this page on a mixed reality headset.';
  }

  async startSession(type) {
    try {
      const session = await navigator.xr.requestSession(type, {
        optionalFeatures: ['local-floor', 'hand-tracking', 'hit-test', 'plane-detection'],
      });
      let refType = 'local-floor';
      try {
        await session.requestReferenceSpace('local-floor');
      } catch {
        refType = 'local';
      }
      this.renderer.xr.setReferenceSpaceType(refType);
      await this.renderer.xr.setSession(session);
      this.onSessionStart(session, type === 'immersive-ar');
    } catch (err) {
      console.error(err);
      document.getElementById('hint').textContent = `Could not start the session: ${err.message}`;
    }
  }

  onSessionStart(session, isAR) {
    this.presenting = true;
    this.scene.background = isAR ? null : this.background;
    this.grid.visible = !isAR;
    document.body.classList.add('in-xr');
    this.needsPlacement = true;
    this.framesSinceStart = 0;
    this.onXRStart?.(session, isAR);

    if (isAR && session.requestHitTestSource) {
      session.requestReferenceSpace('viewer')
        .then((space) => session.requestHitTestSource({ space }))
        .then((source) => {
          this.hitTestSource = source;
          this.refresh();
        })
        .catch(() => { /* hit-test not available: placement in front of the user still works */ });
    }
    session.addEventListener('end', () => this.onSessionEnd());
    this.refresh();
  }

  onSessionEnd() {
    this.presenting = false;
    this.hitTestSource = null;
    this.reticle.visible = false;
    this.state.placing = false;
    this.scene.background = this.background;
    this.grid.visible = true;
    document.body.classList.remove('in-xr');
    this.onXREnd?.();
    // Each new headset session has a new coordinate system, so the room line-up must be redone.
    this.presence?.clearRoom();
    this.calibrating = null;
    this.recenter();
    this.refresh();
  }

  /** Put the lab in front of the user, just below eye height, facing them (closer and lower when seated). */
  placeInFrontOfUser() {
    const cam = this.renderer.xr.getCamera();
    const pos = new THREE.Vector3();
    const dir = new THREE.Vector3();
    cam.getWorldPosition(pos);
    cam.getWorldDirection(dir);
    dir.y = 0;
    if (dir.lengthSq() < 1e-6) dir.set(0, 0, -1);
    dir.normalize();
    this.lab.position.copy(pos).addScaledVector(dir, this.state.seated ? 0.68 : 0.85);
    this.lab.position.y = pos.y - (this.state.seated ? 0.22 : 0.15);
    this.lab.rotation.set(0, Math.atan2(-dir.x, -dir.z), 0);
  }

  updateHitTest(frame) {
    if (!frame || !this.hitTestSource) return;
    const results = frame.getHitTestResults(this.hitTestSource);
    const pose = results.length && results[0].getPose(this.renderer.xr.getReferenceSpace());
    this.reticle.visible = !!pose && this.state.placing;
    if (!pose) return;
    this.reticle.matrix.fromArray(pose.transform.matrix);
    if (this.state.placing) {
      const p = new THREE.Vector3().setFromMatrixPosition(this.reticle.matrix);
      const cam = new THREE.Vector3();
      this.renderer.xr.getCamera().getWorldPosition(cam);
      this.lab.position.set(p.x, p.y + 0.3, p.z);
      this.lab.rotation.set(0, Math.atan2(cam.x - p.x, cam.z - p.z), 0);
    }
  }

  // ───────────── render loop ─────────────

  frame(frame) {
    const dt = Math.min(this.clock.getDelta(), 0.1);
    if (this.presenting) {
      this.framesSinceStart++;
      // Wait a few frames so the headset pose is valid before placing the lab.
      if (this.needsPlacement && this.framesSinceStart > 3) {
        this.placeInFrontOfUser();
        this.needsPlacement = false;
      }
      this.updateHitTest(frame);
      this.onXRFrame?.(frame, this.renderer.xr.getReferenceSpace());
    } else {
      this.controls.update();
    }
    this.interaction.update();
    this.update(dt, frame);
    if (this.presence) {
      this.presence.update(dt);
      this.sessionRedraw = (this.sessionRedraw ?? 0) + dt;
      if (this.sessionRedraw > 1) {
        this.sessionRedraw = 0;
        this.sessionPanel.redraw();
        this.refreshPlayerList();
      }
      this.placePlayerList(dt);
    }
    this.renderer.render(this.scene, this.camera);
  }
}

