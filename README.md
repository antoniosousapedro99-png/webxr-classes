# WebXR Classes

Mixed reality lessons built with [WebXR](https://immersiveweb.dev/) and [three.js](https://threejs.org/). They run straight in the browser: no app store, no install, and no build step.

| Lesson | Subject | Path |
| --- | --- | --- |
| **Atom Scale Lab** | Chemistry | [`lessons/atomic-models/`](lessons/atomic-models/) |
| **Acid Lab** | Chemistry | [`lessons/acid-lab/`](lessons/acid-lab/) |
| **Waves Lab** | Physics | [`lessons/waves-lab/`](lessons/waves-lab/) |
| **Bounce Lab** | Physics | [`lessons/bounce-lab/`](lessons/bounce-lab/) |
| **Radiation Lab** | Physics | [`lessons/radiation-lab/`](lessons/radiation-lab/) |
| **PC Builder Lab** | Computer Science | [`lessons/pc-builder/`](lessons/pc-builder/) |
| **Cell Explorer** | Biology | [`lessons/cell-explorer/`](lessons/cell-explorer/) |
| **Heart Lab** | Biology | [`lessons/heart-lab/`](lessons/heart-lab/) |
| **Enzyme Lab** | Biology | [`lessons/microscope-lab/
  src/data/micro.js                samples and stains, labels, microscope parts, quiz, answers
  src/model/                       Specimens (every sample drawn in code, and what can be labelled where), Bench (slides, pipette, coverslips, microscope), Board
lessons/enzyme-lab/`](lessons/enzyme-lab/) |
| **Microscope Lab** | Biology | [`lessons/microscope-lab/`](lessons/microscope-lab/) |
| **Reef Dive** | Biology (IB) | [`lessons/reef-dive/`](lessons/reef-dive/) |
| **Hintze Hall** | Museum visit (VR) | [`lessons/hintze-hall/`](lessons/hintze-hall/) |

**The lessons page** (`index.html`, titled *WebXR Library*) groups the lessons into subject sections (Chemistry, Physics, Biology, Computer Science, Museum visits), with a row of subject buttons that show one section at a time. To add a lesson, copy a `<button class="card">` block inside the right `<section>`; to add a subject, copy a whole `<section>` and give it a new `data-subject` (its button and counts appear by themselves; its colour is one line in the page’s styles).

**Getting around:** every lesson has a **← Lessons** button in its control panel (press it twice, so nobody leaves by accident) and an *All lessons* link on its start screen. Panels that hold more than fits get a scrollbar: use its ▲ ▼ buttons, the thumbstick while pointing at the panel, or pinch / pull the trigger on the panel and drag (mouse wheel or drag on a computer).

**Moving the project** to another GitHub account, organisation or computer, the outside services it uses, and which licences to check before commercial use: see [HANDOVER.md](HANDOVER.md).

## Shared sessions (work alongside colleagues)

Every lesson can be opened **solo** or in a **shared session**:

1. On the lessons page, enter your name, pick a lesson and choose **Start a shared session**. You get a 4-letter code, e.g. `K7QM`, shown in the lesson and on a small panel under the controls in the headset.
2. A colleague picks the same lesson and chooses **Join with code**, or opens the link from **Copy link**.

**Players panel:** under the info panel (mirroring the session panel under the controls) a **Players** button opens a list of everyone in the session: who is the admin and, in the same room, whether each headset has found the room.

Each person has **their own models**. Everyone else's work appears beside you at their own desk as a live copy: you can see their PC being built part by part, their atom or molecule, or their cell with its knock-outs. Desks sit side by side in the same order for everyone, so if you see someone on your right, they see you on their left. There are **no avatars**: the lessons are mixed reality, so you see the real people.

**Same room:** tick **"We're in the same room"** when starting or joining a session (Acid Lab, Waves Lab, Bounce Lab, Radiation Lab, Heart Lab, Enzyme Lab, Microscope Lab and Reef Dive tick it for you). Everyone then sees the same things in the same real places, with **nothing to press**:

- **Before class, once per headset:** scan the classroom with Quest **Settings › Physical space › Space Setup** (about 2 minutes; mark the walls, door, windows and tables). If the browser asks to use spatial data, allow it.
- In the lesson, each headset finds the room by itself from its scan (`shared/net/RoomAlign.js`): the room's walls give the directions, and the middle of the room, on the floor, is the shared origin. Which way round is settled by the door, windows, tables and other fittings, which every headset matches against the admin's headset. It checks again every second, so a headset that recentres or loses tracking puts itself right. In a simulation with realistic scan noise, headsets agreed to within about 5 cm and never got the room the wrong way round.
- The session panel and the Players list show each headset's room status: **in place ✓**, **needs Space Setup**, or **unsure which way round** (a very symmetric room with nothing in it to tell the ends apart: add the door and some furniture in Space Setup).

**Admin:** whoever starts the session (usually the teacher) is the admin and gets an **Admin** menu to the left of the controls:

- **Activity for everyone** (lesson-specific; in Reef Dive: Identify / Reef lab). Students see which activity is on, and can't switch it.
- **Cell Explorer:** **Cell for everyone** (Animal / Plant / Bacterium) and **Activity for everyone** (Explore / Label it / Follow a process / Compare sizes). Students see the admin's choice instead of those buttons; knock-outs, cut-away, names and process steps stay their own.
- **PC Builder:** **Case for everyone** (**Free choice**, the default, or one case that every student must use), **Turn all off** (switches off every computer) and **Empty all cases** (press twice; every student starts again with an empty case).
- **Acid Lab:** **Activity for everyone**, **Level for everyone**, the **Class board** position (same room) and each student’s progress (results recorded out of 18). Everyone gets the admin’s set of solutions; **New solutions** (in the admin’s own controls) deals a new set to the whole class.
- **Waves Lab:** **Activity for everyone** (Predict / Rope wave / Ripple tank / Mystery wave), **Level for everyone**, the **Class board** position (same room), and who has answered the question on the board (or each student’s investigation steps, out of 6). The board shows the teacher’s wave and question; the teacher’s own controls choose the prediction, deal a new mystery wave and reveal the answer.
- **Bounce Lab:** **Activity for everyone** (Predict / Drop + measure / Compare), **Level for everyone**, **Ball on the class chart**, the **Class board** position (same room), and who has answered the prediction (or how many drops each student has recorded). The teacher’s own controls choose the prediction and reveal the answer.
- **Radiation Lab:** **Activity for everyone** (The counter / Test sources / Half-life at Advanced / Class results), **Level for everyone**, **Reveal the answers** (class results), the **Class board** position (same room) and how many sources each student has decided about. The board shows the teacher’s Geiger counter, half-life graph or the class’s verdicts.
- **Enzyme Lab:** **Activity for everyone** (Starter quiz / Experiment / Class graph), **Level for everyone**, the **Class board** position (same room) and how many temperatures each student has done. The board shows everyone’s quiz scores, then the class graph.
- **Microscope Lab:** **Activity for everyone** (Microscope parts / Prepare + view / Quiz), **Level for everyone**, the **Class board** position (same room) and how many labels each student has placed. The board shows the part the teacher taps, the teacher’s view down the microscope, or everyone’s quiz scores.
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

## Acid Lab

A lab bench for every student, built entirely in code (no model files). The bench has a pH scale, six beakers of mystery solutions (A to F), dispensers of **red litmus**, **blue litmus** and **universal indicator** paper, a **digital pH meter**, distilled water for rinsing and, at the advanced level, a pH 7.00 buffer. Placed on a real table (*Place on surface*), the bench top sits on the table. Behind it, a **class board** about 2.6 m wide shows the pH scale and the teacher's current test in large print. In a same-room session (pre-selected for this lesson) the board is fixed in the classroom for every headset.

Everyone in a session gets the **same six solutions** as the teacher (chosen from 17 everyday and laboratory substances, always two clear acids, one weak acid, one about neutral and two alkalis), so the class can compare results. They all look like water: the only way to tell them apart is to test them.

### Lesson objectives → activities

| Objective | Activity |
| --- | --- |
| (starter) pH as a measure of acidity; everyday substances | **pH scale:** drag twelve bottles (lemon juice, cola, milk, blood, sea water, soap, bleach…) to where they belong on the scale. Close enough and each clicks into its true place and shows its pH; otherwise it comes back with a hint. |
| Measure the pH of unknown substances using litmus paper and digital tools | **Test papers:** take a strip, dip it, and it lands on the white tile in front of that beaker. Litmus behaves like the real thing: blue turns red only in acids, red turns blue only in alkalis, and neither changes for weak or neutral solutions. Universal indicator paper is matched by eye against the colour chart. **pH meter:** dip the probe, wait for the reading to settle (STABLE), record it. |
| Compare the accuracy and ease of traditional and modern techniques | **Compare:** *Check my results* shows the real pH and substance for each letter, ticks and crosses for every result, the average error of indicator paper and of the meter, which solutions litmus wrongly showed as neutral, and the pros and cons of the three methods. |
| Practical lab skills: accurate observation and data recording | Students record every result themselves in a table (6 solutions × 3 methods). Sloppy technique gives wrong numbers, as in a real lab: recording before the reading settles, **not rinsing the probe** (the reading is pulled towards the last sample), or at the advanced level **not calibrating** the meter first. **Safety:** nothing can be picked up until the goggles are on, and corrosive solutions are flagged when the answers are revealed. |

**Levels:** Core, and Advanced, which adds hydrogen-ion concentrations, the logarithmic scale (each step is ×10), a stricter sorting tolerance and meter calibration.

**Teacher (admin):** chooses the activity, the level and (with *New solutions*) the set of unknowns for everyone, places the class board, and sees how many of the 18 results each student has recorded. The class board mirrors the teacher's own bench: the substances the teacher has placed on the scale and the test the teacher is doing.

**Ask the chemist:** 8 pre-written answers (what pH measures, why each step is ×10, why litmus gives no number, rinsing, calibrating, neutralisation, who measures pH in real life, alkali safety). An AI chemist can be connected later with `chemistEndpoint` in `lessons/acid-lab/config.js`.

## Waves Lab

Every student has a **rope** and a **ripple tank**, built entirely in code. Behind them a **class board** (2.6 m wide) shows the teacher’s wave with its settings, and the class’s answers. In a same-room session (pre-selected) the board is fixed in the classroom for every headset. Two levels: **Core** (no numbers: “more / less”, what you see) and **Advanced** (hertz, centimetres, cm/s, the period, and *speed = frequency × wavelength* worked out live).

**Speed is set by the material, as in real physics:** students change how tight the rope is, or how deep the water is, and the speed follows. Changing the frequency changes the wavelength and never the speed. The rope is in slow motion (20–45 cm/s) so the wave can be followed by eye; the relationships are the real ones, and the wave really travels: a change made at the shaken end can be watched moving along the rope.

### Lesson objectives → activities

| Lesson plan | In the Waves Lab |
| --- | --- |
| (starter) A static wave; “what will happen if…?”; predictions | **Predict:** the wave on the board is frozen and a question asks what changing frequency, amplitude or speed (tension) will do. Every student picks an answer on their own panel; the teacher presses **Test it** and the wave unfreezes as BEFORE and AFTER, with the class’s answers counted on the board and each student told whether they were right. |
| Manipulate frequency, amplitude and speed (0–100 %) and observe | **Rope wave:** three controls in 10 % steps. A red bead shows that the rope only moves up and down. **See it as:** *Sound* (the headset plays the wave: pitch follows frequency, loudness follows amplitude), *Light* (frequency is the colour from red to violet, amplitude the brightness), *Ocean* (the same wave as the sea with a boat bobbing on it). |
| Guided investigations of each variable | A short explanation after every change says what changed and what stayed the same. A checklist on the info panel (6 steps) tracks the investigation. |
| Record observations with diagrams | **Freeze + measure:** drag two yellow markers onto neighbouring crests (they click onto them) to measure the wavelength, and a green line to the top of a crest for the amplitude. **Keep snapshot:** up to three still copies of earlier waves stand behind the rope, with arrows showing which settings differ. |
| Real-world waves (water) | **Ripple tank**, seen from above: frequency, amplitude and water depth, plus **Barrier** (reflection), **Gap** (diffraction, narrow or wide), **Two sources** (interference) and **Shallow patch** (refraction). It can be frozen and measured too. |
| (plenary) Diagrams: which variable was changed? | **Mystery wave:** BEFORE and AFTER on the board; students answer on their panel (Core: which variable; Advanced: which variable and which way, e.g. *Tension went down*), the teacher reveals the answer and the class’s results. |

**Ask the physicist:** 8 pre-written answers (what a wave is, the three properties, the wave equation, why speed is set by the material, transverse and longitudinal waves, sound, light, how realistic the rope is). An AI physicist can be connected later with `physicistEndpoint` in `lessons/waves-lab/config.js`.

## Bounce Lab

A row of seven surface mats lies on the **real classroom floor** in front of each student: concrete, a wooden floor, carpet, grass, sand, a trampoline and a patch of **the Moon** (a sixth of the gravity and no air). Six real-size balls sit on a shelf in the middle of the lab: rubber, tennis, basketball, golf, ping-pong and plasticine. A 2 m ruler stands at the back of whichever mat was last used. Behind it all, a **class board** shows the predictions and then the **class results chart**. Everything is built in code (no model files).

**Dropping:** pick a ball up, hold it over a mat at any height and let go (on a computer, drag it with the mouse), or choose a ball, a surface and a height (10–200 cm) and press **Drop**. Each drop is worked out with real physics: gravity, air resistance (it matters for the ping-pong ball, and there is none on the Moon), and a coefficient of restitution for every ball and surface that falls slightly for harder hits on soft balls. Values match published figures where they exist (a tennis ball bounces back to about 53% of a 2.54 m drop onto concrete, a basketball to about 1.2 m from 1.8 m). Sand keeps a dent, plasticine stays squashed, the trampoline sags, each surface has its own bounce sound, and the Moon is silent.

**Measuring:** after each drop a **slow-motion replay** (a ghost ball) stops at the top of the first bounce, with a yellow line from the bottom of the ball to the ruler. Students read the height and type it on a keypad. A reading more than 3 cm out (2 cm at Advanced) gets one *look again*; a second miss records the true value and says so.

**Realistic scatter and anomalies:** no two drops are identical (about ±2.5% in the bounce), about one drop in twelve goes wrong (the ball spins off sideways), and a ball let go over the edge of a mat lands on the edge and bounces much lower. Students tap a drop’s number to leave it out of their means; the lab then tells them whether something really went wrong in that drop.

| Lesson plan | In the Bounce Lab |
| --- | --- |
| (starter) Momentum; why does a ball bounce differently on concrete and grass? | **Predict:** four questions on the class board (surfaces, drop height, plasticine on a trampoline, the Moon). Students answer on their own panel; the teacher reveals the answer and the class’s choices. |
| Drop balls from different heights onto different surfaces; measure and record the rebound | **Drop + measure:** six balls, seven surfaces, drops up to 2 m by hand, read from the slow-motion replay and recorded in the student’s table with the bounce as a percentage. |
| Calculate momentum loss; energy transfer | **Core:** bounce % only. **Advanced:** for each drop, speed before and after, the starting energy (mgh), the % of energy lost, momentum before and after, momentum lost, and the change in momentum the floor gave the ball. |
| (plenary) Compare results, explain anomalies, real-world applications | **Compare:** the student’s means for every ball and surface, surfaces ranked from bounciest with the reason for each, and **Find odd results** (drops more than 10 points from the student’s other drops of the same ball and surface). The **class chart** on the board shows, for the ball the teacher picks, every student’s mean on each surface as a dot and the class mean as a bar; results that don’t fit the class are circled with the student’s name. |

**Ask the physicist:** 8 pre-written answers (why a ball bounces, where the energy goes, momentum, why never higher, why the ping-pong ball is odd, why repeat and average, anomalies, real-world uses). An AI physicist can be connected later with `physicistEndpoint` in `lessons/bounce-lab/config.js`.

## Radiation Lab

Every student has a radiation bench, built in code: a **lead box** with four sealed school sources (americium-241, strontium-90, cobalt-60, radium-226), a tray of **everyday things** (a smoke detector, an old luminous watch, uranium glass, granite, a banana, salt substitute and, as a control, table salt), a test stand (source holder, absorber slot and a clip that holds the Geiger probe 3 cm away), **paper, aluminium and lead** absorbers, **tongs**, and a **Geiger counter** with its probe on a cable. Behind it, a **class board**.

**The counter really counts:** every click is drawn at random from the count rate at the probe’s window (background plus every source out of the box: alpha only reaches about 5 cm, beta and gamma fall off with distance, the absorber in the slot stops its share). So counts vary from one 10 s count to the next, as real ones do. The probe can be picked up to explore (e.g. how far alpha reaches), but **only counts taken with the probe in its clip are recorded**, so that the tests are fair.

**Safety built in:** sources can only be picked up after taking the **tongs**, and they are drawn held in them; a **dose badge** adds up each student’s dose from the sources out of the box (real dose rates, falling with the square of the distance from the headset), with typical doses to compare (a banana, an X-ray, a flight); holding a source near your face gets a warning; **background** is measured first.

| Lesson plan | In the Radiation Lab |
| --- | --- |
| (starter) Alpha, beta, gamma and their properties; how a Geiger counter works (clicks and counts) | **The counter:** it is already clicking: students measure the **background** three times (and see that it varies). The info panel lists what each kind of radiation is, what stops it, its range and how strongly it ionises; the class board shows the teacher’s counter in big numbers beside the same table. |
| Test materials with the Geiger counter; decide alpha, beta, gamma or a mix | **Test sources:** put a source in the holder (tongs), count for 10 s with no absorber, paper, aluminium and lead. Each count fills the **count table** by itself; students tick **α β γ** (or ∅, not radioactive) for each source. **X-ray vision** shows the radiation as streaks being stopped (or not) by the absorber. |
| Advanced extras | The **nuclear equation** of each source, with mass and atomic numbers, and its half-life. **Half-life:** shake a protactinium generator and the counter counts every 10 s by itself, plotting a decay graph (real time or ×4); students estimate the half-life (70 s) and check it. |
| (plenary) Share results; penetration, ionisation, safety; real-world uses | **Class results:** the board collects everyone’s verdicts for every source; the teacher reveals the answers. The info panel has discussion questions (smoke detectors, gamma for tumours, nuclear power, results close to background). |

**Ask the physicist:** 8 pre-written answers (what radioactivity is, how the counter works, background, random decay, ionising, which radiation is most dangerous inside and outside the body, staying safe, uses). An AI physicist can be connected later with `physicistEndpoint` in `lessons/radiation-lab/config.js`.

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

## Enzyme Lab

Rebuilt from the original EngageVR lesson, with the same set-up and steps: a piece of liver and a scalpel on a tile, a conical flask of hydrogen peroxide on a hot plate (− / + on the plate, 0–80 °C in steps of 10), and a stopper whose delivery tube runs to an upside-down measuring cylinder standing in a trough of water. Everything is built in code.

**The steps (as in the original):** cut the liver in half with the scalpel, put one half in the flask (it fizzes straight away), put the stopper on. The oxygen bubbles across and pushes the water down the cylinder. The stopper has to go on after the liver, and the temperature can’t be changed during a run (fair test). **Next run** gives a fresh flask and refilled cylinder, using the other half of the liver or a new piece.

**Readings:** the stopwatch starts when the stopper goes on and the run lasts 2 minutes. Every 30 s a red ring marks the water level on the cylinder (labelled 30 s, 60 s, 90 s, 120 s), and students read each ring on a keypad (within 1.5 cm³; a second miss records the true value). The 2-minute volume is their result for that temperature.

**The reaction:** catalase activity roughly doubles every 10 °C and falls away above about 45 °C as the enzyme denatures. Oxygen after 2 minutes: about 6 cm³ at 0 °C, 21 at 20 °C, 35 at 30 °C, 46 at 40 °C, 30 at 50 °C, 5 at 60 °C and almost none at 70–80 °C, with a few per cent of variation between runs.

| Lesson plan | In the Enzyme Lab |
| --- | --- |
| (starter) Quiz on enzymes and reaction rates; predict what happens | **Starter quiz:** 6 questions (8 at Advanced) answered on each student’s panel, with an explanation after each; everyone’s score is on the class board. |
| Prepare the experiment: liver, hydrogen peroxide, apparatus; observe and analyse | **Experiment:** the original steps by hand, the hot plate, the readings every 30 s, and the 2-minute result for each temperature. |
| (plenary) Explain how the oxygen shows an enzyme is present; summarise; real-life uses | **Class graph:** every student’s 2-minute volumes against temperature on the board, with the class mean joined up and the best temperature named; each student also sees their own graph, with discussion questions. |

**Advanced:** the equation 2 H₂O₂ → 2 H₂O + O₂ on the panel, two extra quiz questions, and the **rate of reaction** worked out from the first 30 s (cm³ per minute), checked on the keypad.

**Ask the biologist:** 8 pre-written answers (what an enzyme is, lock and key, why liver, why heat speeds it up, denaturing, why collect over water, fair testing, uses of enzymes). An AI biologist can be connected later with `biologistEndpoint` in `lessons/enzyme-lab/config.js`.

## Microscope Lab

Rebuilt from the original EngageVR lesson, with the same bench and steps: a row of sample slides, a pipette, coverslips and a microscope with − / + focus buttons; the view down the microscope is on a screen above it. Everything is built in code, including every sample seen through the eyepiece.

**Steps (as in the original):** hold the pipette over a slide to add a drop (the right stain for that sample, or water), put a coverslip on it, move it onto the stage, focus. A slide without its drop and coverslip can’t go on the stage.

**The microscope:** three objective lenses (×4, ×10, ×40; ×10 eyepiece, so ×40, ×100 and ×400), coarse and fine focus (the − / + buttons on the microscope use coarse at low power and fine at ×40). Each lens is sharp at a slightly different place, so switching needs a little refocusing; the coarse focus is refused at ×40 (it could crack the slide). Fields of view are realistic (4, 1.6 and 0.4 mm).

**Samples:** onion skin (iodine), cheek cells (methylene blue), pondweed (water: chloroplasts), human blood (stained smear), pond water (paramecia swimming with beating cilia, and algae) and small intestine (pink and purple stain, like the original’s slide).

**Labelling:** pick a label, then tap that structure in the view (at ×100 or ×400, in focus). Core: cell wall / membrane, nucleus, cytoplasm, chloroplast, red and white blood cells, single-celled organism, algae, villus. Advanced adds vacuole, bacteria, platelets, cilia, goblet cells and epithelium.

| Lesson plan | In the Microscope Lab |
| --- | --- |
| (starter) How a microscope works; why microscopes matter | **Microscope parts:** tap each of the 10 parts (eyepiece, objectives, nosepiece, stage, clips, coarse and fine focus, light, arm, base) to learn its job; the class board shows a labelled diagram with the part highlighted. |
| Prepare cell samples; focus; identify what is seen | **Prepare + view:** the original steps, the lenses and focus, and labelling. The teacher’s view is big on the class board. |
| (plenary) Discussion; quick quiz on parts, functions and slide preparation | **Quiz:** 7 questions (9 at Advanced) on each student’s panel, with scores on the board; discussion prompts at the end. |

**Ask the biologist:** 8 pre-written answers (why microscopes matter, how they work, magnification, starting at low power, stains, coverslips, plant vs animal cells, real uses).

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
lessons/acid-lab/
  src/data/acid.js                 substances and pH values, paper colours, the unknown sets, method comparison, answers
  src/model/                       Bench (beakers, papers, pH meter), Sorter (pH scale), Board (class board)
lessons/waves-lab/
  src/data/waves.js                how the controls become a wave, ripple tank set-ups, predictions, mystery waves, answers
  src/model/                       Rope (the travelling wave), Tank (ripple tank shader), Rulers, Board (class board), tone
lessons/bounce-lab/
  src/data/bounce.js               the balls and surfaces (restitution, mass, air resistance), predictions, answers
  src/model/                       Floor (mats, ruler, the physics of a drop, slow-motion replay), Balls, Board (class chart), sounds
lessons/radiation-lab/
  src/data/radiation.js            alpha/beta/gamma, sources and their count rates, absorbers, doses, equations, answers
  src/model/                       Bench (sources, absorbers, tongs, Geiger counter), Rays (X-ray vision), Board (class board)
lessons/enzyme-lab/
  src/data/enzymes.js              catalase activity against temperature, the steps, the quiz, answers
  src/model/                       Bench (liver, scalpel, flask, hot plate, stopper and tube, trough and cylinder), Board (class board)
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
