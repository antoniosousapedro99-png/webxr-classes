# 3D models

The lesson uses the `.glb` models listed in `manifest.json`. Anything not listed (or that fails to load) falls back
to the shape the lesson draws itself, so the lesson always works. Credits and licences: [CREDITS.md](CREDITS.md).

## manifest.json

Keys are species ids from `src/data/species.js` (shark, barracuda, turtle, parrotfish, wrasse, clownfish, jelly,
octopus, crab, cucumber, urchin), plus `coral` for the reef's coral colonies. A value can be just a file name, or:

```json
{
  "shark": { "file": "shark.glb", "animation": "swimming", "animSpeed": 0.6 },
  "parrotfish": { "file": "parrotfish.glb", "motion": "fish" },
  "crab": { "file": "crab.glb", "motion": "legs", "floor": true },
  "coral": { "files": ["coral-branch.glb", "coral-soft.glb"], "split": ["coral-soft.glb"] }
}
```

- `animation`: play the model's own animation clip whose name contains this text (`animSpeed` scales it).
- `motion`: for models without an animation, a cheap swim done on the graphics card:
  `fish` (body wave to the tail), `flippers` (turtle), `arms` (octopus), `legs` (crab), `crawl` (sea cucumber).
- `floor`: the model's bottom sits on the floor or rock (otherwise it is centred).
- `coral.files`: interchangeable coral colonies; files listed in `split` hold several separate corals.
  Coral models fade to white when they bleach and to grey-brown when they die.

## Preparing a new model

Each model is scaled to the species' real length. It must point its **nose along +z** with its **back along +y**.
For Quest 3, keep a fish under about 5,000 triangles (bigger animals up to about 16,000), with textures of
512–1024 px. Compress with [glTF-Transform](https://gltf-transform.dev/) (meshopt + WebP), for example:

```bash
npx @gltf-transform/cli optimize in.glb out.glb --simplify-ratio 0.1 --texture-compress webp --texture-size 512 --compress meshopt
```

Then record the source, author and licence in `CREDITS.md`.
