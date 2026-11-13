import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CanvasPanel } from './ui/CanvasPanel.js';
import { Interaction } from './ui/Interaction.js';
import { THEME } from './ui/CanvasPanel.js';
import { Presence, sessionFromURL } from './net/Presence.js';
import { RoomScan, solveRoom, fingerprint } from './net/RoomAlign.js';
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
// Shared sessions (?session=CODE in the URL): everyone keeps their own models and sees the others' work
// beside them (no avatars: in mixed reality you see the real people). A lesson takes part by providing:
//   netState()           a small JSON snapshot of what it shows (sent to the others when it changes)
//   createReplica()      → { group, apply(snapshot), update(dt)? } to show someone else's work

// Where the side panels sit (lab coordinates): far enough out to the sides, and high enough, to stay clear of
// the bench and anything on it (benches are up to about 0.92 m wide).
export const PANEL_X = 0.74;
export const PANEL_Y = 0.04;
export const PANEL_Z = 0.14;

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
      this.sessionPanel.mesh.position.set(-PANEL_X, PANEL_Y + (session.sameRoom ? -0.475 : -0.45), PANEL_Z);
      this.sessionPanel.mesh.rotation.y = 0.42;
      this.lab.add(this.sessionPanel.mesh);
      this.sessionPanel.setBuilder((ui) => this.drawSession(ui));
      this.panels.push(this.sessionPanel);
      this.initPlayerList();
      this.initAdmin();
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
    this.controlPanel.mesh.position.set(-PANEL_X, PANEL_Y, PANEL_Z);
    this.controlPanel.mesh.rotation.y = 0.42;
    this.infoPanel.mesh.position.set(PANEL_X, PANEL_Y, PANEL_Z);
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
    if (this.lockedByAdmin) return;
    this.state.locked = !this.state.locked;
    if (this.state.locked) this.state.placing = false;
  }

  /** Standard buttons for the bottom of a control panel: move the lab, seated mode, lock, voice. */
  generalButtons() {
    const s = this.state;
    if (this.lockedByAdmin) return [{ id: 'speak', label: s.speak ? 'Voice: on' : 'Voice: off', active: s.speak, onClick: () => this.toggleSpeak(), disabled: !('speechSynthesis' in window) }];
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

  /** A headset's room status in a few words (see RoomAlign.js). */
  roomNote(room) {
    return { ok: '✓ in place', unsure: '⚠ unsure which way round', 'no-scan': '⚠ needs Space Setup', waiting: '… finding the room', screen: 'on a computer' }[room] ?? '';
  }

  /** How the session is doing: a few words for the title line, and help text when something is wrong. */
  sessionStatus() {
    const pr = this.presence;
    if (pr.status === 'failed') return { text: ' · could not connect', help: pr.error ?? 'Couldn’t start the shared session.', bad: true };
    if (pr.status !== 'connected') return { text: ' · connecting…', help: null };
    if (pr.peers.size) return { text: '', help: this.adminHere ? null : 'Your teacher isn’t connected right now. Everything carries on as they left it.' };
    if (pr.everJoined) {
      return { text: ' · waiting for others', help: this.isAdmin ? 'Everyone else has left. They can rejoin with the same code.' : 'Your teacher isn’t connected right now. Everything carries on as they left it.' };
    }
    const long = performance.now() - (pr.connectedAt ?? 0) > 20000;
    const help = pr.problem ?? (!long ? null : this.isAdmin
      ? 'Students join with this code, on the same Wi-Fi as you.'
      : 'Nobody found yet. Check the code, and that you’re on the same Wi-Fi as your teacher.');
    return { text: ' · waiting for others', help };
  }

  drawSession(ui) {
    const pr = this.presence;
    ui.y = 18;
    const st = this.sessionStatus();
    ui.text(`SESSION ${pr.code}${st.text}`, { size: 24, weight: 700, color: st.bad ? '#ff6b6b' : THEME.accent });
    if (st.help) {
      ui.text(st.help, { size: 21, color: st.bad ? '#ff9a9a' : '#ffd166' });
      return;
    }
    if (pr.sameRoom) {
      const r = pr.roomStatus ?? 'waiting';
      const text = {
        ok: 'Room: in place ✓',
        unsure: 'Room: found, but not sure which way round. Tell your teacher.',
        'no-scan': 'Room: this headset has not scanned the room (Space Setup). Tell your teacher.',
        waiting: 'Room: finding the room…',
        screen: 'Room: lines up by itself in the headset',
      }[r];
      ui.text(text, { size: 22, color: r === 'ok' || r === 'screen' ? '#7ee2a8' : '#ffd166' });
    }
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

  // ───────────── player list (a panel beside the others) ─────────────

  /**
   * Who's in the session: a "Players" button under the info panel (mirroring the session panel under the
   * controls); the list drops down below it.
   */
  initPlayerList() {
    this.playersOpen = false;
    const add = (panel, y) => {
      panel.mesh.position.set(PANEL_X, PANEL_Y + y, PANEL_Z);
      panel.mesh.rotation.y = -0.42;
      this.lab.add(panel.mesh);
      this.panels.push(panel);
      return panel;
    };
    this.playersPanel = add(new CanvasPanel({ width: 0.5, height: 0.07, name: 'players' }), -0.36 - 0.02 - 0.035);
    this.playersPanel.setBuilder((ui) => {
      const n = this.presence.people.length;
      ui.button({ id: 'players', label: `Players (${n}) ${this.playersOpen ? '▴' : '▾'}`, active: this.playersOpen, onClick: () => this.togglePlayerList() }, 10, 10, ui.W - 20, ui.H - 20, 34);
    });
    this.playersListPanel = add(new CanvasPanel({ width: 0.5, height: 0.34, name: 'players-list' }), -0.465 - 0.01 - 0.17);
    this.playersListPanel.setBuilder((ui) => this.drawPlayerList(ui));
    this.playersListPanel.mesh.visible = false;
    this.matchPanelLook(this.playersPanel, this.playersListPanel);
  }

  /** New panels look like the lesson's own (draw order, fog). */
  matchPanelLook(...panels) {
    for (const p of panels) {
      p.mesh.renderOrder = this.controlPanel.mesh.renderOrder;
      p.mesh.material.fog = this.controlPanel.mesh.material.fog;
    }
  }

  togglePlayerList() {
    this.playersOpen = !this.playersOpen;
    this.playersListPanel.mesh.visible = this.playersOpen;
    this.playersKey = null;
    this.refreshPlayerList();
  }

  /** A short note about a person: you / admin, and (same room) whether their headset found the room. */
  personNote(person) {
    const notes = [];
    if (person.you) notes.push('you');
    if (person.host) notes.push('admin');
    if (this.presence.sameRoom) notes.push(this.roomNote(person.room));
    return notes.join(' · ');
  }

  refreshPlayerList() {
    const pr = this.presence;
    if (!pr || !this.playersPanel) return;
    const key = JSON.stringify([this.playersOpen, pr.status, this.sessionStatus().help, pr.people.map((p) => [p.plain, p.color, this.personNote(p)]), this.isAdmin, this.admin, this.kickArmed]);
    if (key === this.playersKey) return;
    this.playersKey = key;
    this.playersPanel.redraw();
    if (this.playersOpen) this.playersListPanel.redraw();
    if (this.adminPanel?.mesh.visible) this.adminPanel.redraw();
  }

  /** A row per person: colour, name, note. Returns nothing; advances ui.y. */
  drawPerson(ui, person, right = ui.right) {
    const ctx = ui.ctx;
    const y = ui.y + 2;
    ctx.fillStyle = `#${person.color.toString(16).padStart(6, '0')}`;
    ctx.beginPath();
    ctx.arc(ui.pad + 10, y + 18, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.textBaseline = 'top';
    ctx.fillStyle = THEME.text;
    ctx.font = '600 27px system-ui, sans-serif';
    ctx.fillText(person.plain.slice(0, 22), ui.pad + 32, y + 2, right - ui.pad - 40);
    ctx.fillStyle = THEME.dim;
    ctx.font = '400 21px system-ui, sans-serif';
    ctx.fillText(this.personNote(person), ui.pad + 32, y + 34, right - ui.pad - 40);
  }

  drawPlayerList(ui) {
    const pr = this.presence;
    ui.y = 22;
    const st = this.sessionStatus();
    ui.text(`SESSION ${pr.code}${st.text}`, { size: 24, weight: 700, color: st.bad ? '#ff6b6b' : THEME.accent });
    if (st.help) ui.text(st.help, { size: 21, color: st.bad ? '#ff9a9a' : '#ffd166' });
    ui.y += 6;
    for (const person of pr.people) {
      this.drawPerson(ui, person);
      ui.y += 66;
    }
  }

  // ───────────── same room: the room frame (automatic) ─────────────

  /**
   * Re-read the room scan and work out where the shared room frame is (RoomAlign.js). The admin's headset
   * uses the shared rule and sends its room "fingerprint"; everyone else matches it. Nothing to press.
   */
  updateRoomFrame() {
    const pr = this.presence;
    const scan = this.roomScan;
    const admin = pr.isHost;
    const sol = scan.hasRoom ? solveRoom(scan, admin ? null : pr.roomRef) : null;
    const changed = pr.setRoomFrame(sol?.matrix ?? null, !scan.hasRoom || !sol ? 'no-scan' : sol.sure ? 'ok' : 'unsure');
    if (admin && sol) {
      const ref = { size: sol.size, features: fingerprint(scan, sol.matrix) };
      const fresh = JSON.stringify(ref) !== JSON.stringify(this.roomRefOut);
      this.roomRefOut = ref;
      if (fresh) pr.roomCh?.send(ref);
    }
    if (changed) this.onRoomFrame?.();
    this.playersKey = null;
  }

  /**
   * The headset recentred (long press on the Meta button) or lost tracking: its coordinates jumped. The room
   * scan comes back in the new coordinates, so just read it again now: the room frame puts itself right.
   */
  onTrackingReset() {
    if (this.roomScan) this.roomScan.last = 0;
  }

  // ───────────── admin (whoever opened the session) ─────────────

  /**
   * Whoever opened the session. Only they are ever admin: if their headset drops out (e.g. it goes to sleep),
   * nobody else gets admin powers; students keep the last settings until the admin is back.
   */
  get isAdmin() {
    const pr = this.presence;
    if (!pr?.host) return false;
    return pr.selfId ? pr.isHost : true;
  }

  /** Is the admin (whoever opened the session) here? */
  get adminHere() {
    const pr = this.presence;
    return !!pr && (pr.host || [...pr.peers.values()].some((p) => p.host));
  }

  /** A student in a shared session: the admin chooses some things for everyone. */
  get followsAdmin() {
    return !!this.presence && !this.isAdmin;
  }

  /** Who the admin is, for "chosen by …" notes. */
  get adminName() {
    const pr = this.presence;
    if (!pr || this.isAdmin) return 'you';
    const admin = [...pr.peers.values()].filter((p) => p.host).sort((a, b) => (a.id < b.id ? -1 : 1))[0];
    return admin?.name ?? 'the teacher';
  }

  /** The Admin menu: to the left of the controls, only for the admin. */
  initAdmin() {
    this.admin = { lock: false }; // what the admin has set for everyone
    this.lockedByAdmin = false; // (students) the admin has locked my menus
    this.adminPanel = new CanvasPanel({ width: 0.5, height: 0.72, name: 'admin' });
    this.adminPanel.mesh.position.set(-1.0 - (PANEL_X - 0.62), PANEL_Y, 0.46);
    this.adminPanel.mesh.rotation.y = 0.95;
    this.adminPanel.mesh.visible = false;
    this.adminPanel.setBuilder((ui) => this.drawAdmin(ui));
    this.lab.add(this.adminPanel.mesh);
    this.panels.push(this.adminPanel);
    this.matchPanelLook(this.adminPanel);
    this.adminClock = 0;
  }

  drawAdmin(ui) {
    ui.title('Admin', { size: 40 });
    ui.text('You opened this session, so you run it for everyone.', { size: 21, color: THEME.dim });
    for (const section of this.adminLessonButtons?.() ?? []) {
      ui.heading(section.heading);
      if (section.text) ui.text(section.text, { size: 20, color: THEME.dim });
      ui.buttons(section.buttons, { cols: section.cols ?? 2, height: 52, size: 21, gap: 8 });
    }
    ui.heading('Students');
    ui.buttons([
      { id: 'lock-students', label: this.admin.lock ? 'Menus: locked' : 'Menus: unlocked', active: this.admin.lock, onClick: () => this.toggleStudentLock() },
      ...(this.presence.sameRoom ? [{ id: 'refind', label: 'Re-find room (all)', onClick: () => this.adminSend({ k: 'refind' }) }] : []),
    ], { height: 52, size: 21, gap: 8 });
    const students = this.presence.people.filter((p) => !p.you);
    if (!students.length) ui.text('Nobody else has joined yet.', { size: 21, color: THEME.dim });
    for (const person of students) {
      const armed = this.kickArmed?.id === person.id && performance.now() - this.kickArmed.t < 3000;
      this.drawPerson(ui, person, ui.right - 160);
      ui.button({ id: `kick-${person.id}`, label: armed ? 'Sure?' : 'Remove', active: armed, color: '#5a2f3a', onClick: () => this.kick(person.id) }, ui.right - 150, ui.y + 6, 150, 50, 21);
      ui.y += 66;
    }
  }

  adminSend(d, to) {
    this.presence?.adminCh?.send(d, to);
  }

  /** Everything the admin has set, sent to everyone now and then (and to anyone who joins). */
  broadcastAdmin(to) {
    if (this.isAdmin) this.adminSend({ k: 'state', lock: this.admin.lock, lesson: this.adminLessonState?.() ?? null }, to);
  }

  onPeerJoinedAdmin(id) {
    this.broadcastAdmin(id);
    if (this.roomRefOut) this.presence.roomCh?.send(this.roomRefOut, id);
  }

  toggleStudentLock() {
    this.admin.lock = !this.admin.lock;
    this.broadcastAdmin();
    this.refresh();
  }

  /** Remove someone from the session (press twice). */
  kick(id) {
    const armed = this.kickArmed?.id === id && performance.now() - this.kickArmed.t < 3000;
    if (!armed) {
      this.kickArmed = { id, t: performance.now() };
      setTimeout(() => this.refreshPlayerList(), 3100);
      this.refreshPlayerList();
      return;
    }
    this.kickArmed = null;
    this.adminSend({ k: 'kick' }, id);
  }

  /** Messages from the admin (students only). */
  onAdmin(d) {
    if (d.k === 'state') {
      const lock = !!d.lock;
      if (lock !== this.lockedByAdmin) {
        this.lockedByAdmin = lock;
        this.state.locked = lock; // locked: the lab and its panels can't be moved
        if (lock) this.state.placing = false;
        this.refresh();
      }
      this.onAdminLesson?.(d.lesson);
    } else if (d.k === 'kick') {
      this.presence.leave();
      this.explain({ title: 'You have left the session', text: 'Your teacher removed you from the shared session. Going back to the lessons…' });
      const go = () => { location.href = this.lessonsURL(); };
      setTimeout(() => {
        const session = this.renderer.xr.getSession();
        if (session) session.end().then(go, go);
        else go();
      }, 3500);
    } else if (d.k === 'refind' && this.roomScan) {
      this.roomScan.last = 0;
      this.presence.clearRoom('waiting');
    }
  }

  /** Every frame: the admin menu shows for the admin only; the admin re-sends its settings now and then. */
  updateAdmin(dt) {
    if (!this.adminPanel) return;
    const show = this.isAdmin && !this.menusHidden;
    if (show !== this.adminPanel.mesh.visible) {
      this.adminPanel.mesh.visible = show;
      if (show) this.adminPanel.redraw();
    }
    if (!this.isAdmin) return;
    this.adminClock += dt;
    if (this.adminClock > 3) {
      this.adminClock = 0;
      this.broadcastAdmin(); // in case a message was lost, or the admin changed
      if (this.roomRefOut) this.presence.roomCh?.send(this.roomRefOut);
    }
  }

  // ───────────── B (right controller): hide / show all menus ─────────────

  updateMenuButton() {
    if (!this.presenting || this.ownMenuToggle) return;
    let pressed = false;
    for (const src of this.renderer.xr.getSession()?.inputSources ?? []) {
      if (src.handedness === 'right' && src.gamepad?.buttons[5]?.pressed) pressed = true;
    }
    if (pressed && !this.menuButtonDown) this.toggleMenus();
    this.menuButtonDown = pressed;
  }

  toggleMenus() {
    this.menusHidden = !this.menusHidden;
    if (!this.menusHidden) {
      for (const p of this.panels) {
        if (p.mesh.userData.hiddenByMenu) p.mesh.visible = true;
        p.mesh.userData.hiddenByMenu = false;
      }
      if (this.playersListPanel) this.playersListPanel.mesh.visible = this.playersOpen;
      this.refresh();
    }
  }

  /** While menus are hidden, keep every panel hidden (lessons may show some again when they refresh). */
  hideMenus() {
    if (!this.menusHidden) return;
    for (const p of this.panels) {
      if (!p.mesh.visible) continue;
      p.mesh.visible = false;
      p.mesh.userData.hiddenByMenu = true;
    }
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
      box.innerHTML = `<p><strong>Shared session <span class="code">${session.code}</span></strong> · ${session.sameRoom ? 'same room' : 'different rooms'}<br>Colleagues join from the lessons page with this code, or with this link.${session.sameRoom ? ' Each headset lines itself up with the room automatically (it needs to have scanned the room once: Quest Settings › Physical space › Space Setup).' : ''}</p>
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
    // recentring (or lost tracking) moves the headset's coordinates: the room line-up must be redone
    this.renderer.xr.getReferenceSpace()?.addEventListener?.('reset', () => this.onTrackingReset());

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
    // Each new headset session has a new coordinate system: the room frame is found again from the scan.
    this.presence?.clearRoom();
    this.roomScan = null;
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
      // same room: every headset lines itself up from its room scan (nothing to press)
      if (this.presence?.sameRoom && (this.roomScan ??= new RoomScan()).update(frame, this.renderer.xr.getReferenceSpace())) this.updateRoomFrame();
      this.updateMenuButton();
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
      if (this.presence.sameRoom && !this.presenting && this.presence.roomStatus !== 'screen') {
        this.presence.clearRoom('screen');
        this.onRoomFrame?.();
      }
      this.updateAdmin(dt);
    }
    this.hideMenus();
    this.renderer.render(this.scene, this.camera);
  }
}

