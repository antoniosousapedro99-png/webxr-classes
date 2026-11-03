# WebXR Classes

Mixed reality lessons built with [WebXR](https://immersiveweb.dev/) and [three.js](https://threejs.org/). They run straight in the browser: no app store, no install, and no build step.

| Lesson | Subject | Path |
| --- | --- | --- |
| **Atom Scale Lab** | Chemistry | [`lessons/atomic-models/`](lessons/atomic-models/) |

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

**Ask the Chemist:** every tab has context-aware questions ("Why is it charged?", "Will it react?", "Why this shape?", "How do we know?" and more). Answers are built from what the student is looking at, they work offline, and they can be read aloud. An optional AI endpoint can be added (see below).

### Controls

| Device | Press a button | Move the lab |
| --- | --- | --- |
| Quest controllers | Point and pull the trigger | Hold the grip and move |
| Hand tracking | Point and pinch | "Bring lab to me" button |
| Phone AR | Tap | "Place on a surface", then tap |
| Desktop / tablet | Click or tap | Drag to orbit, scroll to zoom |

## Running it

WebXR only works on **HTTPS** (or `localhost`).

**GitHub Pages (recommended).** Under *Settings → Pages*, set *Source* to **GitHub Actions**. Every push to `main` then deploys via `.github/workflows/pages.yml`. Open `https://<user>.github.io/webxr-classes/` in the **Meta Quest Browser** and press **Enter Mixed Reality**.

**Locally:**

```bash
python3 -m http.server 8080
```

Then open http://localhost:8080/lessons/atomic-models/ on your computer. To test on a Quest over USB, forward the port so the headset sees it as `localhost`:

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
lessons/atomic-models/
  index.html, style.css, config.js
  src/main.js                      app, WebXR session, placement, render loop
  src/data/                        elements (Z 1–36), molecules, atom maths
  src/models/                      AtomModel, MoleculeModel, ScaleExplorer
  src/ui/                          canvas-texture panels, labels, XR/mouse input
  src/chemist/Chemist.js           "Ask the Chemist" answers (+ optional AI endpoint)
```

three.js (r160) is loaded from jsDelivr through an import map, so there is nothing to install.
