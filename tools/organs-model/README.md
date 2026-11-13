# Identifying Organs model build

Makes `lessons/organs-lab/models/body.glb`: the skeleton (`bones`, `ribcage`, and the top of the skull as
`skullcap`) and 17 organs, one node each, from the BodyParts3D parts. You only need this to change the model; the
lessons don't use it.

1. Download the STL files from
   [Kevin-Mattheus-Moerman/BodyParts3D](https://github.com/Kevin-Mattheus-Moerman/BodyParts3D)
   (`assets/BodyParts3D_data/stl/<id>.stl`) into one folder:
   - every id in `parts.mjs` (`SKELETON`: the skeletal system without ligaments and membranes, 226 files;
     `BRAIN`: the surface of the brain, 36 files);
   - the organs listed in `ORGANS` at the top of `build.mjs` (lungs, liver, stomach, intestines, kidneys, bladder,
     pancreas, spleen, gallbladder, oesophagus, trachea, diaphragm, and the heart wall and great vessels).
   About 170 MB in all.
2. `npm install`, then `node build.mjs <that folder> ../../lessons/organs-lab/models/body.glb`

What it does: converts millimetres to metres in body coordinates (x = the body's left, y = up from the soles of
the feet, z = forward), so every organ keeps its real place; removes scan specks; trims the great vessels a few
centimetres from the heart; cuts the top off the skull with a clean horizontal cut (the skull cap); simplifies for
Meta Quest (about 145,000 triangles in all) and compresses the result (meshopt), about 970 KB.

Licence of the data: CC BY-SA 2.1 Japan (see `lessons/organs-lab/CREDITS.md`).
