// The sound of your wave: one steady note made in the browser (no audio files). Its pitch follows the
// frequency and its loudness follows the amplitude.

export class Tone {
  constructor() {
    this.ctx = null;
    this.on = false;
  }

  /** Call every frame. */
  set(on, freq, gain) {
    if (!on && !this.ctx) return;
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.osc = this.ctx.createOscillator();
      this.osc.type = 'sine';
      this.gain = this.ctx.createGain();
      this.gain.gain.value = 0;
      this.osc.connect(this.gain).connect(this.ctx.destination);
      this.osc.start();
    }
    if (on && this.ctx.state === 'suspended') this.ctx.resume();
    const key = `${on}|${freq}|${gain}`;
    if (key === this.key) return;
    this.key = key;
    const t = this.ctx.currentTime;
    this.osc.frequency.setTargetAtTime(freq, t, 0.03);
    this.gain.gain.setTargetAtTime(on ? gain : 0, t, 0.05);
    this.on = on;
  }
}
