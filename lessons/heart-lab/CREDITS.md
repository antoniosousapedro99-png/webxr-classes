# Credits

## The heart model

`models/heart.glb` (and its landmarks, `models/heart.json`) is made from **BodyParts3D**:

> BodyParts3D, © The Database Center for Life Science, licensed under
> [CC Attribution-Share Alike 2.1 Japan](https://creativecommons.org/licenses/by-sa/2.1/jp/deed.en).
> Original: https://lifesciencedb.jp/bp3d/ — files taken from
> [Kevin-Mattheus-Moerman/BodyParts3D](https://github.com/Kevin-Mattheus-Moerman/BodyParts3D).

Changes made for this project (`tools/heart-model/`): the parts of the heart were combined, trimmed a few
centimetres from the heart, simplified and compressed for Meta Quest; the heart wall was divided into the four
chambers and the septum; landmarks were measured for the animations. As the licence requires (share-alike),
`heart.glb` and `heart.json` are shared under the same CC BY-SA 2.1 Japan licence. This applies only to those two
files, not to the rest of the project.

Commercial use is allowed, with this credit kept.

## Everything else

The aortic valve (not in the scan), the conduction system, the blood flow, the ECG and the heart sounds
(synthesised with the Web Audio API) are made in code for this project. The heart built in code
(`src/model/Heart.js`) is shown until the model has loaded, or if it can't be loaded.

Medical content (timings of the cardiac cycle, pressures, heart rates and stroke volumes) uses standard textbook
values for a healthy adult at rest, simplified for teaching.
