/**
 * PRIZE FIGHTER's sound, made with WebAudio at run time (no sound files): the whoosh of a punch, the thud of one
 * landing (deeper and with a crunch for a big one, duller to the body), leather on leather for a block, the bell,
 * the referee's count, a heartbeat when you are hurt, and the crowd: a constant murmur that swells with the cheer
 * and roars at a knockdown. Starts on the first key or click (browsers require it) and never throws.
 */
export class FightAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private crowdGain: GainNode | null = null;
  private crowdFilter: BiquadFilterNode | null = null;
  private noise: AudioBuffer | null = null;
  private crowdSrc: AudioBufferSourceNode | null = null;
  private volume = 0.8;
  private on = true;
  private lastHeart = 0;

  setVolume(v: number, on: boolean) {
    this.volume = v;
    this.on = on;
    if (this.master) this.master.gain.value = on ? v * 0.9 : 0;
  }

  /** call from a user gesture; safe to call again */
  start() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.on ? this.volume * 0.9 : 0;
        this.master.connect(this.ctx.destination);
        // two seconds of noise, shared by everything
        const len = this.ctx.sampleRate * 2;
        this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noise.getChannelData(0);
        let b = 0;
        for (let i = 0; i < len; i++) {
          // a little pink: smoother than white noise
          b = 0.97 * b + 0.03 * (Math.random() * 2 - 1);
          d[i] = (Math.random() * 2 - 1) * 0.5 + b * 4;
        }
        // the crowd: looping filtered noise
        this.crowdFilter = this.ctx.createBiquadFilter();
        this.crowdFilter.type = "bandpass";
        this.crowdFilter.frequency.value = 600;
        this.crowdFilter.Q.value = 0.5;
        this.crowdGain = this.ctx.createGain();
        this.crowdGain.gain.value = 0;
        this.crowdSrc = this.ctx.createBufferSource();
        this.crowdSrc.buffer = this.noise;
        this.crowdSrc.loop = true;
        this.crowdSrc.connect(this.crowdFilter).connect(this.crowdGain).connect(this.master);
        this.crowdSrc.start();
      }
      if (this.ctx.state === "suspended") void this.ctx.resume().catch(() => {});
    } catch {
      this.ctx = null;
    }
  }

  suspend() {
    try {
      if (this.ctx && this.ctx.state === "running") void this.ctx.suspend().catch(() => {});
    } catch {
      /* fine */
    }
  }

  private ok() {
    return !!(this.ctx && this.master && this.noise && this.ctx.state === "running" && this.on);
  }

  private burst(dur: number, freq: number, q: number, gain: number, type: BiquadFilterType = "bandpass", sweepTo?: number) {
    if (!this.ok()) return;
    const c = this.ctx!;
    const t = c.currentTime;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master!);
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.05);
  }

  private tone(freq: number, dur: number, gain: number, toFreq?: number, type: OscillatorType = "sine", delay = 0) {
    if (!this.ok()) return;
    const c = this.ctx!;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (toFreq) o.frequency.exponentialRampToValueAtTime(toFreq, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master!);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  /** a punch thrown: a short whoosh, quicker for a jab */
  whoosh(power: number, mine: boolean) {
    this.burst(0.13 + power * 0.06, 900, 0.8, (mine ? 0.12 : 0.07) * (0.6 + power), "bandpass", 2400);
  }

  /** a punch landing: dmg about 1 to 14 */
  hit(dmg: number, body: boolean, onMe: boolean) {
    const p = Math.min(1, dmg / 10);
    const g = (onMe ? 1 : 0.85) * (0.35 + p * 0.65);
    this.tone(body ? 95 : 130, 0.16 + p * 0.12, g * 0.9, body ? 45 : 60);
    this.burst(0.08 + p * 0.05, body ? 420 : 900, 0.9, g * 0.7, "lowpass");
    // the crunch of a big one
    if (p > 0.55) this.burst(0.06, 2600, 2.5, g * 0.35 * (p - 0.4), "bandpass", 1200);
  }

  /** a punch taken on the gloves */
  block(dmg: number) {
    const p = Math.min(1, dmg / 8);
    this.burst(0.07, 1500, 1.3, 0.12 + p * 0.18, "bandpass");
    this.tone(180, 0.07, 0.08 + p * 0.1, 120);
  }

  whiff() {
    this.burst(0.18, 600, 0.7, 0.05, "bandpass", 1800);
  }

  /** the bell: one ding to start, three to end */
  bell(times = 1) {
    for (let i = 0; i < times; i++) {
      const d = i * 0.42;
      for (const [f, gn, dur] of [[1046, 0.22, 2.4], [2093, 0.08, 1.6], [2962, 0.05, 1.1], [523, 0.06, 2.2]] as [number, number, number][]) this.tone(f, dur, gn, undefined, "sine", d);
    }
  }

  /** the referee's count */
  count(n: number) {
    this.burst(0.05, 2200, 3, 0.18, "bandpass");
    this.tone(n >= 8 ? 520 : 420, 0.08, 0.06, undefined, "triangle");
  }

  /** a beat in the get up mini game: right on it or a miss */
  tap(hit: boolean) {
    if (hit) this.tone(880, 0.09, 0.14, 1320, "triangle");
    else this.tone(200, 0.12, 0.12, 120, "square");
  }

  heartbeat(level: number) {
    if (!this.ok() || level <= 0.05) return;
    const now = this.ctx!.currentTime;
    if (now - this.lastHeart < 0.85 - level * 0.3) return;
    this.lastHeart = now;
    this.tone(55, 0.12, 0.18 * level, 40);
    this.tone(55, 0.12, 0.12 * level, 40, "sine", 0.17);
  }

  /** the crowd's level, 0 to 1, every frame */
  crowd(level: number) {
    if (!this.ok() || !this.crowdGain || !this.crowdFilter) return;
    const t = this.ctx!.currentTime;
    this.crowdGain.gain.setTargetAtTime(0.05 + level * 0.32, t, 0.25);
    this.crowdFilter.frequency.setTargetAtTime(450 + level * 700, t, 0.3);
  }

  dispose() {
    try {
      this.crowdSrc?.stop();
      void this.ctx?.close().catch(() => {});
    } catch {
      /* already closed */
    }
    this.ctx = null;
  }
}
