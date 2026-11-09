# 3D models

The lesson uses the `.glb` models listed in `manifest.json`. Anything not listed (or that fails to load) falls back
to the shape the lesson draws itself, so the lesson always works. Credits and licences: [CREDITS.md](CREDITS.md).

## manifest.json

Keys are species ids from `src/data/species.js` (shark, barracuda, turtle, parrotfish, wrasse, clownfish, jelly,
octopus, crab, cucumber, urchin, anemone), plus `coral` for the reef’s coral colonies. A value can be just a file name, or:

```json
{
  "shark": { "file": "shark.glb", "motion": "fish", "beat": 4 },
  "parrotfish": { "file": "parrotfish.glb", "motion": "fish" },
  "crab": { "file": "crab.glb", "motion": "legs", "floor": true },
  "coral": { "files": ["coral-branch.glb", "coral-soft.glb"], "split": ["coral-soft.glb"] }
}
```

- `motion`: a cheap swim done on the graphics card: `fish` (body wave to the tail), `flippers` (turtle),
  `arms` (octopus), `legs` (crab), `crawl` (sea cucumber), `pulse` (jellyfish), `sway` (anemone tentacles). `beat` sets its speed
  (radians per second, e.g. 4 for the shark, 14 for the small wrasse).
- `animation`: instead, play the model's own animation clip whose name contains this text (`animSpeed` scales it;
  `lockRoot` lists bones whose movement is dropped, so the clip cannot carry the animal away from where the lesson steers it).
  Most downloaded clips move the whole body around, so `motion` usually looks better.
- `floor`: the model's bottom sits on the floor or rock (otherwise it is centred).
- `coral.files`: interchangeable coral colonies; files listed in `split` hold several separate corals.
  Coral models fade to white when they bleach and to grey-brown when they die.

## Preparing a new model

Each model is scaled to the species' real length. It must point its **nose along +z** with its **back along +y**.
The motions bend the model by position, so it should be one rigid mesh in that pose (a rigged model can be frozen in its rest pose).
For Quest 3, keep a fish under about 5,000 triangles (bigger animals up to about 16,000), with textures of
512–1024 px. Compress with [glTF-Transform](https://gltf-transform.dev/) (meshopt + WebP), for example:

```bash
npx @gltf-transform/cli optimize in.glb out.glb --simplify-ratio 0.1 --texture-compress webp --texture-size 512 --compress meshopt
```

Then record the source, author and licence in `CREDITS.md`.
