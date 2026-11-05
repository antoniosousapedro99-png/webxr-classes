# Optional 3D models

The lesson draws every animal itself, so nothing is needed here. To use realistic models instead,
put CC0 (or otherwise licensed) `.glb` files in this folder and list them in `manifest.json`:

```json
{ "shark": "shark.glb", "turtle": "green-sea-turtle.glb", "octopus": "octopus.glb" }
```

Keys are species ids from `src/data/species.js` (shark, barracuda, turtle, parrotfish, wrasse,
clownfish, jelly, octopus, crab, cucumber, urchin). Each model is scaled to the species' real length;
point its nose along +Z. Good free sources: Quaternius (CC0), Poly Pizza (filter by CC0).
