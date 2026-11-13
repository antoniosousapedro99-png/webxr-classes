# Credits

Everything in the Bounce Lab is made in code for this project: the mats and their textures, the trampoline, the
ruler, the balls, the class board and the bounce sounds. There are no third-party models, images or sounds, so
there is nothing to licence or credit beyond the project's own licence. three.js (MIT) is loaded from jsDelivr,
as in every lesson.

The physics: each ball keeps a share of its speed at every bounce (its coefficient of restitution), which depends
on the ball, the surface and, for soft balls, a little on how hard it hits. Typical values were chosen to match
published figures where they exist (for example, a tennis ball must bounce back to 53-58% of a 2.54 m drop onto
concrete; a basketball dropped from 1.8 m bounces back to about 1.2-1.4 m). Air resistance is included (it matters
for the ping-pong ball); the Moon patch has a sixth of Earth's gravity and no air. Each drop has a small random
scatter, and now and then something goes wrong (the ball spins, or lands on the edge of a mat), so that students
have real anomalies to find.
