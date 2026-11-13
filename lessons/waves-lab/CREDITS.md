# Credits

Everything in the Waves Lab is made in code for this project: the rope, the ripple tank (a shader), the rulers,
the boat, the class board and the sounds. There are no third-party models, images or sounds, so there is nothing
to licence or credit beyond the project's own licence. three.js (MIT) is loaded from jsDelivr, as in every lesson.

The physics: the rope obeys speed = frequency x wavelength, with a speed that depends only on its tension
(speed proportional to the square root of the tension). It is a slow-motion rope (20 to 45 cm/s) so that the wave
can be followed by eye; a real rope is several metres per second. The ripple tank uses the shallow-water rule
speed = square root of (g x depth) for depths of 1 to 5 mm. Reflection, diffraction, interference and refraction
are calculated from the usual textbook wave models, not simulated drop by drop.
