# Heart Lab model build

Makes `lessons/heart-lab/models/heart.glb` (the heart, one node per part) and `heart.json` (landmarks the lesson
uses: valve rings, chamber centres, vessel centre lines, the coronary artery, the four-chamber cutting plane) from
the BodyParts3D heart parts. You only need this to change the model; the lessons don't use it.

1. Download these 25 STL files from
   [Kevin-Mattheus-Moerman/BodyParts3D](https://github.com/Kevin-Mattheus-Moerman/BodyParts3D)
   (`assets/BodyParts3D_data/stl/`) into one folder:
   `FMA7274` (wall of heart), `FMA66326` (pulmonary artery), `FMA66643` (pulmonary veins), `FMA7234` (tricuspid valve),
   `FMA7235` (mitral valve), `FMA7246` (pulmonary valve), `FMA3736`, `FMA3768`, `FMA3784` (aorta),
   `FMA4720`, `FMA10951` (venae cavae), `FMA3802`, `FMA3818`, `FMA3840nsn`, `FMA4685`, `FMA3862nsn`, `FMA3895`
   (coronary arteries), `FMA4706`, `FMA4707`, `FMA4713` (cardiac veins), `FMA7260`, `FMA7261`, `FMA7262`, `FMA7266`,
   `FMA9352nsn` (papillary muscles).
2. `npm install`, then `node build.mjs <that folder> ../../lessons/heart-lab/models/heart.glb`

What it does: converts millimetres to the lesson's units (1 = 10 cm; x = the patient's left, y = up, z = forward),
trims the vessels a few centimetres from the heart (measured along each vessel), removes scan specks, simplifies
for Meta Quest (about 140,000 triangles in all), splits the heart wall into right/left atrium, right/left ventricle
and septum (`split.mjs`: the coronary grooves, the valve rings and the cavity each inner surface faces), measures
the landmarks (`finalize.mjs`), and compresses the result (meshopt).

Licence of the data: CC BY-SA 2.1 Japan (see `lessons/heart-lab/CREDITS.md`).
