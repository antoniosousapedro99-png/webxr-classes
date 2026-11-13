# Credits

Everything in the Radiation Lab is made in code for this project: the bench, the lead box, the sources and
everyday objects, the absorbers, the tongs, the Geiger counter and its clicks, the "X-ray vision" streaks and
the class board. There are no third-party models, images or sounds, so there is nothing to licence or credit
beyond the project's own licence. three.js (MIT) is loaded from jsDelivr, as in every lesson.

The physics: counts are drawn at random (a Poisson process) from the count rate at the probe, so repeated
counts vary as real ones do. Background is 0.4 counts per second (about 24 per minute, typical for a school
Geiger counter). Alpha reaches about 5 cm in air; beta and gamma fall off with the square of the distance.
Paper stops alpha, 3 mm of aluminium stops 98% of beta, 2 cm of lead stops 70% of gamma. The school sources
are like the usual sealed 37-185 kBq sources; the everyday objects are a little stronger than real ones so that
they stand out from background in a 10-second count. Doses use real dose rates for such sources (for example
about 0.07 microsieverts per hour at 1 m from cobalt-60), falling with the square of the distance from the
headset. Protactinium-234m has a half-life of 70 s (real value 1.17 minutes).
