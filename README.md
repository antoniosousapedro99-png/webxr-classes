# WebXR Classes

Mixed reality lessons built with [WebXR](https://immersiveweb.dev/) and [three.js](https://threejs.org/). They run straight in the browser: no app store, no install, and no build step.

| Lesson | Subject | Path |
| --- | --- | --- |
| **Atom Scale Lab** | Chemistry | [`lessons/atomic-models/`](lessons/atomic-models/) |
| **PC Builder Lab** | Computer Science | [`lessons/pc-builder/`](lessons/pc-builder/) |
| **Cell Explorer** | Biology | [`lessons/cell-explorer/`](lessons/cell-explorer/) |
| **Heart Lab** | Biology | [`lessons/heart-lab/`](lessons/heart-lab/) |
| **Reef Dive** | Biology (IB) | [`lessons/reef-dive/`](lessons/reef-dive/) |
| **Hintze Hall** | Museum visit (VR) | [`lessons/hintze-hall/`](lessons/hintze-hall/) |

**Getting around:** every lesson has a **← Lessons** button in its control panel (press it twice, so nobody leaves by accident) and an *All lessons* link on its start screen. Panels that hold more than fits get a scrollbar: use its ▲ ▼ buttons, the thumbstick while pointing at the panel, or pinch / pull the trigger on the panel and drag (mouse wheel or drag on a computer).

**Moving the project** to another GitHub account, organisation or computer, the outside services it uses, and which licences to check before commercial use: see [HANDOVER.md](HANDOVER.md).

## Shared sessions (work alongside colleagues)

Every lesson can be opened **solo** or in a **shared session**:

1. On the lessons page, enter your name, pick a lesson and choose **Start a shared session**. You get a 4-letter code, e.g. `K7QM`, shown in the lesson and on a small panel under the controls in the headset.
2. A colleague picks the same lesson and chooses **Join with code**, or opens the link from **Copy link**.

**Players panel:** under the info panel (mirroring the session panel under the controls) a **Players** button opens a list of everyone in the session: who is the admin and, in the same room, whether each headset has found the room.

Each person has **their own models**. Everyone else's work appears beside you at their own desk as a live copy: you can see their PC being built part by part, their atom or molecule, or their cell with its knock-outs. Desks sit side by side in the same order for everyone, so if you see someone on your right, they see you on their left. There are **no avatars**: the lessons are mixed reality, so you see the real people.

**Same room:** tick **"We're in the same room"** when starting or joining a session (Heart Lab and Reef Dive tick it for you). Everyone then sees the same things in the same real places, with **nothing to press**:

- **Before class, once per headset:** scan the classroom with Quest **Settings › Physical space › Space Setup** (about 2 minutes; mark the walls, door, windows and tables). If the browser asks to use spatial data, allow it.
- In the lesson, each headset finds the room by itself from its scan (`shared/net/RoomAlign.js`): the room's walls give the directions, and the middle of the room, on the floor, is the shared origin. Which way round is settled by the door, windows, tables and other fittings, which every headset matches against the admin's headset. It checks again every second, so a headset that recentres or loses tracking puts itself right. In a simulation with realistic scan noise, headsets agreed to within about 5 cm and never got the room the wrong way round.
- The session panel and the Players list show each headset's room status: **in place ✓**, **needs Space Setup**, or **unsure which way round** (a very symmetric room with nothing in it to tell the ends apart: add the door and some furniture in Space Setup).

**Admin:** whoever starts the session (usually the teacher) is the admin and gets an **Admin** menu to the left of the controls:

- **Activity for everyone** (lesson-specific; in Reef Dive: Identify / Reef lab). Students see which activity is on, and can't switch it.
- **Cell Explorer:** **Cell for everyone** (Animal / Plant / Bacterium) and **Activity for everyone** (Explore / Label it / Follow a process / Compare sizes). Students see the admin's choice instead of those buttons; knock-outs, cut-away, names and process steps stay their own.
- **PC Builder:** **Case for everyone** (**Free choice**, the default, or one case that every student must use), **Turn all off** (switches off every computer) and **Empty all cases** (press twice; every student starts again with an empty case).
- **Heart Lab:** **Activity for everyone**, **Level for everyone** (Core / Advanced) and, in the same room, **Class heart** position (middle of the room, or in front of the teacher). The class heart mirrors the teacher’s own heart; a part the teacher taps lights up for everyone. While students label, the menu shows each student’s score.
- **Reef position** (Reef Dive, same room): in the middle of the room (default) or **Put it here** (centred where the admin stands). It stays fixed in the room for everyone.
- **Students:** **Menus: locked** hides students' settings (moving the panels, placing, seated mode, water level, leaving with ← Lessons; only Voice stays). **Re-find room (all)** makes every headset read its room scan again. Each student is listed with their room status and a **Remove** button (press twice) that takes them out of the session.

Only the person who started the session is ever admin. If their headset drops out (for example it goes to sleep), nobody else gets admin powers: everything carries on as they left it, students see “Your teacher isn’t connected right now”, and the admin gets everything back when they return (same page or link, which keeps `host=1`). The shared world (e.g. the reef) keeps running on another device meanwhile.

**Hiding the menus:** press **B** on the right controller to hide or show all the panels (anyone, any lesson).

**How it connects:** peer-to-peer (WebRTC) using [Trystero](https://github.com/dmotz/trystero), bundled in `shared/vendor/`. No server of our own is needed, so it works on GitHub Pages. Settings are in `shared/net/config.js`.

1. **Same network only.** Each device asks a STUN server for its network's public address. Devices behind the same school router share it, so it becomes part of the session's name (as a one-way hash; the address isn't sent anywhere). Only devices on the same network can find each other, even with the right code. No Wi-Fi name (SSID) is needed. A school with several public addresses side by side still works: only the first three numbers must match (`networkPrefix`).
2. **Introductions** go through three fixed public Nostr relays (`relayUrls`). Only short, encrypted connection notes pass through them.
3. **Lesson data** then flows directly between the devices, inside the school network.

Measured in tests: joining takes about 2 seconds once the lesson has loaded; a teacher's change reaches students in under a second; someone leaving is noticed in under a second.

If something is wrong, the session panel says so in plain words: the network can't be checked (STUN blocked), devices found each other but can't connect (Wi-Fi "client isolation"), nobody found yet (wrong code or a different Wi-Fi), or the teacher isn't connected.

**For the school's IT / web filter (e.g. Lightspeed):** allow the site (`*.github.io`, or wherever it is hosted), `cdn.jsdelivr.net`, the relays `nos.lol`, `relay.primal.net` and `nostr.mom` (secure WebSockets, port 443), and outgoing UDP to the STUN servers (`stun.l.google.com` and `stun1.l.google.com` port 19302, `stun.cloudflare.com` port 3478). Devices on the headsets' Wi-Fi must be able to reach each other (client isolation off). If direct connections are impossible, add a TURN server in `config.js`.

- To test on one computer, open the same session in two tabs with `&net=local` added to the URL.

## Atom Scale Lab

> Build and explore atomic models, while also learning about the actual scale of models, relative to each other. All you need to do is look out the window…
> *Requested by King's InterHigh*

The lab appears in front of the student in their real room (passthrough mixed reality). Two floating panels hold the controls and the information, and the model sits between them.

### Lesson objectives → features

| Objective | What students do |
| --- | --- |
| Build and explore 3D atomic models, identifying protons, neutrons and electrons | **Atom** tab: add or remove protons (red), neutrons (grey) and electrons (blue), or pick any of the first 36 elements from a mini periodic table. The info panel shows the element, mass number, isotope name, charge/ion symbol, shell configuration and whether the isotope is stable. You can switch between Bohr shells and an electron-cloud view. |
| Understand the relative scale of atomic structures and their components | Every atom shows its real size and how much the model is magnified. It also says how far away the electrons *really* would be if the nucleus were the size shown. |
| Compare the sizes of different atoms and molecules | **Scale → Compare atom sizes**: sets of atoms (across period 2, down group 1, everyday atoms, noble gases) drawn to one true scale, with a 100 pm scale bar. **Molecules** tab: 10 molecules plus a salt lattice. In ball-and-stick mode the balls and bonds stay the same size across all models so they compare fairly. Space-filling mode uses real van der Waals sizes. |
| Relate atomic models to real-world objects | **Scale → Nucleus in the room**: the nucleus is shown at the size of a pea, marble, golf ball, tennis ball or football, sitting in your room. The edge of the atom is drawn at its true relative distance, often hundreds of metres away, as a bubble, a ring and a beacon. *Look out the window* to find it. Distances are also compared to football pitches, the Eiffel Tower, London → Paris and so on. |

**Build it with your hands:**
- **Atom tab:** reach into the atom and pinch a proton, neutron or electron to pull it out. A tray below the model holds new particles to drop into the nucleus or shells.
- **Molecules tab:** every molecule (except the salt lattice) can be edited:
  - Pull an atom away and the bond stretches, then breaks.
  - Let go of an atom near another to bond them. A green preview means a bond will form; red means one of the atoms has no free bonding site left.
  - Tap a bond to cycle single → double → triple.
  - Grip (or Shift-drag on screen) to move a whole molecule.
  - Drop atoms in the bin to remove them, and take new ones (H, C, N, O, Cl) from the tray.
- Bond lengths and VSEPR angles are simulated, so molecules settle into their real shapes: bent water, pyramidal ammonia, tetrahedral methane, linear CO₂.
- The builder recognises over 20 molecules, including water, ethanol, hydrogen peroxide and hydrogen cyanide.
- **Chemist explains card:** floats above the model and says what each part does every time you pick something up, pull it apart or join it. For example: what a proton is and that removing one turned carbon into boron, or that breaking an O–H bond takes 463 kJ/mol. Dashed yellow rings mark atoms that still need bonds.

**Reactions tab:** students perform real reactions with their hands by breaking the reactants apart and rebuilding them into products. The reactions are 2H₂ + O₂ → 2H₂O, CH₄ + 2O₂ → CO₂ + 2H₂O, H₂ + Cl₂ → 2HCl, N₂ + 3H₂ → 2NH₃ and C₂H₄ + H₂ → C₂H₆.
- A live energy meter shows energy in (breaking bonds) and energy out (making bonds), using average bond enthalpies. The results land close to measured values: methane gives 802 kJ/mol.
- Atoms can't be thrown in the bin or taken from the tray, so conservation of mass is something students feel. The panel tracks atoms at the start and now.
- Finishing the products sets off a flash of light, a glow and a shockwave ring. Sound and haptics scale with the energy released, and the products shake with heat.

**Feel the forces:**
- Stronger bonds must be pulled further before they snap, and the controller buzzes harder as you stretch them: N≡N fights back far more than H–H.
- Blue dots show each shared electron pair, sitting closer to the more electronegative atom, with δ+/δ− explained.
- In the atom, a proton is pushed back as it nears the (positive) nucleus until the strong force grabs it. An electron is pulled in. A neutron feels nothing.

**Your real room** (WebXR plane detection; needs Space Setup on Quest):
- *Scale → What's my room made of?* tags your real table, walls, floor, window and door. Tap a tag to see its material, its atoms and roughly how many atoms it holds.
- *Nucleus in the room* points its "edge of the atom" beacon out through your real window.
- *Put lab on my table* moves the lab onto your table.
- On a normal screen an example room is shown instead.

**Ask the Chemist:** every tab has context-aware questions ("Why is it charged?", "Will it react?", "Why this shape?", "How do we know?" and more). Answers are built from what the student is looking at, they work offline, and they can be read aloud. An optional AI endpoint can be added (see below).

### Controls

| Device | Press a button | Pick up an atom / particle | Move a whole molecule | Move the lab |
| --- | --- | --- | --- | --- |
| Quest controllers | Point + trigger | Reach in (or point) + trigger | Grip on a molecule | Grip on empty space |
| Hand tracking | Point + pinch | Reach in (or point) + pinch | — | "Bring lab to me" button |
| Phone AR | Tap | Touch and drag | — | "Place on a surface", then tap |
| Desktop / tablet | Click | Drag | Shift-drag | Drag empty space to orbit |

## PC Builder Lab

**4 cases and 42 parts** (6 motherboards, 7 CPUs, 6 coolers, 6 memory sticks, 5 drives, 5 graphics cards, 7 power supplies), with plenty of look-alikes so students can make realistic mistakes. Trays with more than five parts get a second row.

Students build a working computer from real, life-size parts on their table, Lego-style. They take a part from the tray, bring it to the case, and let go when the preview turns green.

### Lesson objectives → features

| Objective | What students do |
| --- | --- |
| Identify the different components in a computer | Every part is a realistic 3D model (motherboard, CPU, cooler, RAM, NVMe/SATA SSD, hard drive, graphics card, power supply, case). Pointing at a part names it, and **Labels** tags everything installed. |
| Describe the purpose of each component | Picking up a part shows what it does, with a running kitchen analogy (CPU = chef, RAM = worktop, storage = pantry…), and where it goes. Installing it shows what it connects to. **Ask the technician** answers common questions. |
| Explain how the components work together | **Power on** runs a realistic start-up on a floating monitor: PSU → BIOS/POST → memory test → graphics → loading the OS from storage into RAM → load test. **How it works** then animates power, data, image and heat flowing between the parts in six steps. |

### Compatibility (the "make sure everything fits" part)

- **Refused when you try to install them, with the reason:**
  - wrong CPU socket (AM4 / AM5 / LGA1700)
  - DDR4 vs DDR5 memory
  - motherboard size (ATX / Micro-ATX / Mini-ITX) vs case
  - graphics card too long
  - cooler too tall, or a liquid cooler with no radiator mount
  - 3.5-inch drive in a 2.5-inch bay
  - NVMe drive in a SATA bay (and the other way round)
  - full-size PSU in an SFX-only case, or an SFX PSU in a case with an ATX mount (needs a bracket)
  - old DDR3 memory, or laptop memory (SO-DIMM) in a desktop board
  - a 360 mm liquid-cooler radiator in a case with room for 240 mm only
  - an M.2 drive in a drive bay
- **Found when you press Power, like in real life:**
  - no PSU / motherboard / CPU
  - no cooler: overheats and shuts down
  - no RAM: beep code
  - CPU without built-in graphics and no graphics card: black screen
  - no storage: "no bootable device"
  - PSU too weak: shuts down under load
  - cooler too small: thermal throttling
  - big CPU on a budget motherboard (H610M, 65 W power delivery): held back
  - M.2 SATA SSD in an NVMe-only M.2 slot: fits, but “no drive detected”
  - Intel “F” CPU (e.g. i3-12100F) with no graphics card: black screen
- **Live checklist:** shown on the right panel, with a power budget bar.
- **Changing the case:** keeps every part that still fits and returns the rest to the tray.
- **Taking out the motherboard:** brings everything attached to it.
- **Safety:** reaching inside a running PC switches it off first, with a safety note.

## Cell Explorer

Accurate 3D models of an **animal cell**, a **plant cell** and a **bacterium**, magnified thousands of times and cut open like a textbook cross-section. Organelles are in realistic proportions; the only exception is ribosomes, which are drawn enlarged so they can be seen, and the app says so.

### Lesson objectives → features

| Objective | What students do |
| --- | --- |
| Recognise and name key components of cell structures | **Explore:** point at any part to see its name, or switch on **Names**. **Label it:** drag floating name tags onto the right parts. Right answers stick; wrong ones come back with a hint ("look for the stack of curved yellow sacs"). |
| Describe the purpose of key components | Tap a part for its purpose, real size and a city analogy (nucleus = city hall, mitochondria = power stations, Golgi = post office…). **Pull an organelle out** of the cell and it moves to a specimen stand, enlarged and turning. |
| Explain how components work together to support cellular processes | **"What if it was missing?"** knocks an organelle out and the cell's processes fail live, with visible effects: no mitochondria stops transport and greys the cell; no Golgi stops vesicle delivery; no vacuole makes the plant cell shrink from its wall (plasmolysis); no flagellum stops the bacterium moving. **Follow a process** animates protein synthesis and secretion, respiration, photosynthesis, turgor and gene sharing between organelles step by step. |

Also included:
- **Compare sizes:** every cell at the same 10,000× magnification, with a scale bar and the GCSE magnification formula.
- **Ask the biologist:** offline Q&A, plus an optional AI endpoint (`biologistEndpoint` in `lessons/cell-explorer/config.js`, same contract as the chemistry lesson).
- **Seated mode and lab lock:** in every lesson's shared toolbar, used here.

## Heart Lab

A beating human heart for every student and a big one for the whole class. The heart is a **real human heart** from the BodyParts3D anatomy database (CC BY-SA 2.1 Japan, credited in `lessons/heart-lab/CREDITS.md`), about 850 KB, split into its parts so every one can be tapped, highlighted, cut open and animated: the chambers squeeze in order (worked out on the graphics card, so the wall never cracks), the real tricuspid, mitral and pulmonary valves open and shut, and **Open it up** cuts it along the four-chamber plane and turns it to face you, like a textbook section. Until the model has loaded (or if a network blocks it) a simpler heart built in code is shown, and everything still works. How the model was made, and how to rebuild it: `tools/heart-model/README.md`. Each student has **their own heart** on the desk (about 32 cm tall) to turn by hand, open up and label. Behind it, a **class heart** about 1.3 m tall beats for everyone. In a shared session the teacher (the admin) controls the class heart, and in a same-room session (pre-selected for this lesson) it stands in the middle of the classroom, or wherever the teacher puts it. Every headset's class heart beats in step, because the beat is timed from the clock.

**Two looks:** **Realistic** (muscle with fibres, fat in the grooves, pale arteries, purple veins, red coronary arteries) and **Textbook** (blue = deoxygenated side, red = oxygenated side). **Open it up** removes the front of the heart, showing the four chambers, the septum and the valves, while the great vessels turn see-through so the blood inside shows. **Names** labels every part. Two levels: **Core** (ages 14–16) and **Advanced** (16–18, IB / A-level). Advanced adds the conduction system (SA node, AV node, bundle of His, Purkinje fibres), the chordae tendineae and papillary muscles, ECG wave names, pressure graphs and more detail in every explanation.

### Lesson objectives → activities

| Objective | Activity |
| --- | --- |
| Identify and explain the functions of the parts of the heart | **Explore:** tap any part (chambers, septum, the four valves, aorta, pulmonary artery and veins, venae cavae, coronary arteries) for its function. **Label it** (plenary): drag the names onto your own heart. Right answers stick; wrong ones come back with a hint. The teacher sees every student's score in the Admin menu. |
| Explain how the heart works, using scientific terms | **Blood flow:** blue and red blood cells wait behind shut valves and surge through when they open, following *the journey of the blood* in 7 steps. **Cardiac cycle:** atrial systole, ventricular systole and diastole (5 stages at Advanced), with the valves opening and shutting, a live ECG, valve and chamber status, **slow motion**, **pause** and the real "lub-dub" sounds. **Exercise:** resting to sprinting, with heart rate, stroke volume and cardiac output. |
| (from the plan) healthy vs clogged arteries | **Conditions:** coronary heart disease (plaque in the artery, with healthy and narrowed arteries side by side and the blood slowing), **heart attack** (a clot blocks it, the muscle beyond darkens and stops pulling its weight, and the ECG shows ST elevation), a **leaky mitral valve** (blood squirts back, with a murmur) and a **hole in the septum** (blood crosses from left to right). |

**Demo (teacher):** the class heart shows exactly what the teacher's own heart shows: look, opened up, activity, journey step, cardiac-cycle stage, exercise level and condition. **◀ Turn / Turn ▶** rotate it. When the teacher taps a part, it lights up on everyone's class heart and every student gets its explanation ("Your teacher is showing…"). Students keep full control of their own heart.

**Ask the cardiologist:** 8 pre-written answers (why the left side is thicker, why the heart needs its own arteries, what makes lub-dub, double circulation, valves, heart attacks, the ECG, exercise). An AI cardiologist can be connected later with `cardiologistEndpoint` in `lessons/heart-lab/config.js` (same contract as the chemistry lesson).

All timings (chambers, valves, blood, sounds, ECG, pressures) come from one table in `src/data/heart.js`, so they always agree.

## Reef Dive

The classroom becomes the sea floor. Through passthrough, the water fades the real room into teal-to-navy depths (the **Water** button in the Dive panel sets it to light, medium or deep; in a shared session only the admin has it, and it applies to everyone). A sandy sea bed covers the real floor. Sunlight shimmers on the surface overhead, light rays and sun shafts slant down, light ripples across the sand, soft marine snow and glowing plankton drift past, bubbles rise from your hands, and far-off animals fade into blue haze, all with muffled ocean sound. You stand in a sandy clearing with seagrass meadows, ringed by a coral reef: ten coral-covered outcrops about 2.4–2.8 m away, with narrow gaps between them. Nineteen species live there at **real size**, including a 1.6 m reef shark, a 3 m great hammerhead, a young giant manta ray (3 m across), a turtle, barracuda, a parrotfish school, clownfish in their anemone, cleaner wrasse, jellyfish, an octopus, crabs, urchins and sea cucumbers. Crabs and sea cucumbers live on the sand of the clearing, jellyfish drift overhead, parrotfish graze their way round the reef, and the shark, barracudas and turtle cruise outside the ring in the blue. Animals steer around people and never swim through the reef.

**One shared ocean.** In a same-room session (pre-selected for this lesson), the person who started the session (usually the teacher) is the admin: they run the reef and stream it to everyone, pick the activity and the water level for the whole class, and can place the reef. Everyone sees the same reef in the same real place (the middle of the classroom, or where the admin put it; every headset finds it from its room scan), with the same animals in the same places, and the same coral health, water colour, light shafts and drifting particles. To keep it identical: the reef layout and the water effects are built from fixed seeds, every animal's motion and animation phase comes from the host (or from its id), the host's animation clock is shared, and the reef's state is re-sent every 3 seconds so nobody drifts out of step after a lost message. Late joiners get everything straight away. Only personal things differ: your own photos, logbook, selection glow, name labels and predictions.

### Lesson objectives → activities

| Objective | Activity |
| --- | --- |
| Identify marine organisms and their characteristics | **Identify:** pinch any creature (including plankton and the reef itself) to photograph it into your own logbook. Its ID card shows the scientific name, group, trophic level, role, real size and a key adaptation. **Sort it:** classify each species with a dichotomous key (vertebrate? lungs? cartilage? nematocysts?). The selected species glows so you can find every one of them. |
| Understand the roles of species in their ecosystems | Each ID card gives the species’ trophic level and role (producer, grazer, predator, cleaner…), and **Ask the marine biologist** explains food chains, keystone species and mutualism. |
| Analyse how environmental factors affect marine life | **Reef lab:** the teacher sets temperature, pH, nutrients and turbidity. Every student records a prediction, then they run a year together. Coral bleaches white and dies, algae take over (phase shift), the water turns green in a bloom and murky with sediment, and oxygen crashes in eutrophication. A live chart tracks coral, algae, fish and oxygen, and each prediction is checked. |

The reef runs on a transparent monthly model in `src/model/Ecosystem.js`, using real mechanisms: a bleaching threshold around 29.5 °C, carbonate loss at low pH, nutrient-driven blooms and hypoxia, light limitation, competition for space between coral and algae, grazing, and predator–prey links.

**3D models:** the animals and coral colonies are realistic 3D models in `lessons/reef-dive/models/`, listed in `manifest.json`. They are optimised for Quest 3 (about 5 MB in total, compressed with meshopt and WebP). Each animal moves with a vertex-shader motion suited to it: a travelling tail wave for the fish and shark, wing-like flipper strokes for the turtle, curling arms for the octopus, sideways-stepping legs for the crab, a pulsing bell for the jellyfish and waves of contraction for the sea cucumber. Coral models still bleach white and die grey-brown in the reef lab. Any model that fails to load falls back to a shape the lesson draws itself. Sources and licences are in [`models/CREDITS.md`](lessons/reef-dive/models/CREDITS.md); how to add or replace a model is in the README there.

## Hintze Hall

A virtual-reality visit to the great central hall of the Natural History Museum, London, built from a 3D scan (“Hintze Hall” by artfletch, CC BY 4.0). Unlike the other lessons it is **VR, not mixed reality**: the hall replaces your room. It is a solo visit (no shared sessions).

**Getting around**
- **Headset:** left thumbstick to walk (it follows the floor up and down the stairs, and stops at walls, balustrades and balcony edges); right thumbstick to turn (snap 30° or 45°, or smooth). Point at any floor and pull the trigger or pinch to **teleport** there. The panels follow you; **B / Y** hides or shows them.
- **Screen:** W A S D or the arrow keys to walk, drag to look, click a floor to go there, **H** hides the panels.
- **Floors:** the ground floor, the main staircase up to Darwin’s landing, its two side flights to the **west and east first-floor balconies**, the bridge over the entrance, and the second floor with the giant sequoia. The panel’s *Floors* buttons jump straight to each.

**Exhibits** (point at one, or at its ⓘ marker, for its story; the *Exhibits* buttons take you there): Hope the blue whale, the Charles Darwin statue, the giant sequoia slice, the painted ceiling, the building itself, the American mastodon, the giraffes, the Turbinaria coral, the Atlantic blue marlin and a meteorite. Facts come from the Museum’s own pages (see `lessons/hintze-hall/models/CREDITS.md`).

**The model:** the 2-million-triangle scan with 8K textures is reduced to 1M triangles and keeps its full 8K textures, GPU-compressed as KTX2 (ETC1S, about 45 MB of GPU memory each), so it runs on a Quest 3 (about 40 MB download). It is drawn unlit because its lighting is baked into the textures. Walking and teleporting use the scan itself as floor and walls, via fast raycasts ([three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh), MIT, loaded from jsDelivr).

## Running it

WebXR only works on **HTTPS** (or `localhost`).

**GitHub Pages (recommended).** Under *Settings → Pages*, set *Source* to **GitHub Actions**. Every push to `main` then deploys via `.github/workflows/pages.yml`. Open `https://<user>.github.io/webxr-classes/` in the **Meta Quest Browser** and press **Enter Mixed Reality**.

**Locally:**

```bash
python3 -m http.server 8080
```

Then open http://localhost:8080/ on your computer and choose a lesson. To test on a Quest over USB, forward the port so the headset sees it as `localhost`:

```bash
adb reverse tcp:8080 tcp:8080
```

**Without a headset:** the [Immersive Web Emulator](https://chromewebstore.google.com/detail/immersive-web-emulator/cgffilbpcibhmcfbgggfhfolhkfbhmik) (IWER) for Chrome emulates a Quest 3, including controllers and hands.

## Optional: AI Chemistry expert

`lessons/atomic-models/config.js` has a `chemistEndpoint` setting. Set it to a server URL that accepts

```json
POST { "question": "...", "context": "Student is building an atom: 6 protons ...", "audience": "..." }
```

and returns `{ "answer": "..." }`. An **Ask AI about this** button then appears. Keep API keys on the server and never put them in this repository, because everything here is served publicly.

## Project layout

```
index.html                         landing page listing the lessons
shared/                            used by every lesson
  LessonApp.js                     three.js + WebXR setup, lab + panels, placement, render loop
  net/                             shared sessions: transport (P2P / same-device), presence (people, desks, copies),
                                   RoomAlign (each headset finds the shared room frame from its room scan), config
  vendor/                          Trystero (MIT) bundled as one file
  ui/                              canvas panels, labels, mouse/touch/controller/hand input
  util/sound.js                    synthesised sound effects
  fx/Flows.js                      animated flows between points (used for processes)
lessons/heart-lab/
  models/heart.glb, heart.json     the anatomical heart (BodyParts3D, CC BY-SA) and its landmarks
  src/data/heart.js                parts, journey of the blood, cardiac-cycle timings, exercise, conditions, answers
  src/model/                       RealHeart (the anatomical model), Heart (backup built in code), blood flow, ECG, arteries, labelling quiz, heart sounds
tools/heart-model/                 rebuilds the Heart Lab model from the BodyParts3D files (not needed to run anything)
lessons/pc-builder/
  src/data/parts.js, rules.js      the parts catalogue and compatibility rules
  src/model/                       life-size part models, the case + slots, tray, power-on + tour
  src/ui/                          panels and "technician explains" texts
lessons/atomic-models/
  index.html, style.css, config.js
  src/main.js                      app, WebXR session, placement, render loop
  src/data/                        elements (Z 1–36), molecules, atom maths
  src/models/                      AtomModel, MoleculeModel, ScaleExplorer,
                                   MoleculeBuilder + AtomBuilder (hands-on editing), Tray (parts + bin)
  src/ui/                          canvas-texture panels, labels, XR/mouse input
  src/chemist/Chemist.js           "Ask the Chemist" answers (+ optional AI endpoint)
  src/chemist/explain.js           "Chemist explains" texts for picking up / separating / joining parts
  src/data/bonding.js              valences, electronegativity, bond lengths & energies, molecules the builder recognises
  src/data/reactions.js            the reactions in the Reactions tab
  src/data/materials.js            what room surfaces are made of
  src/room/RoomScan.js             reads the headset's room data (planes) and tags surfaces
  src/models/Effects.js            reaction flash / glow / shockwave;  src/util/sound.js: synthesised sounds
```

three.js (r160) is loaded from jsDelivr through an import map, so there is nothing to install.
