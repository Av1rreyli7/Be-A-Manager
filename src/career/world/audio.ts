/**
 * The sound of the street, made in the browser (no sound files): the hum of the city, rain, birds in the day,
 * his footsteps, the traffic going by, his own engine (rising with the revs, dropping at each gear), a door
 * chime when he walks into a place, and the click of a fan's camera. Silent until he first presses a key or
 * clicks, as browsers ask, and it can be muted.
 */
export interface StreetSound {
  start: () => void;
  setMuted: (m: boolean) => void;
  muted: () => boolean;
  tick: (o: { dt: number; walk: number; driving: boolean; rpm: number; throttle: number; traffic: number; night: number; rain: number; inside: boolean }) => void;
  chime: () => void;
  click: () => void;
  thud: (k: number) => void;
  dispose: () => void;
}

export function makeStreetSound(): StreetSound {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let muted = false;
  try {
    muted = localStorage.getItem("pc_city_mute") === "1";
  } catch {
    /* no storage: sound on */
  }
  const nodes: { hum?: GainNode; rain?: GainNode; traffic?: GainNode; engine?: GainNode; o1?: OscillatorNode; o2?: OscillatorNode; lp?: BiquadFilterNode } = {};
  let stepClock = 0;
  let birdClock = 2;
  const noise = (c: AudioContext) => {
    const b = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      d[i] = w * 0.5 + last * 3;
    }
    const s = c.createBufferSource();
    s.buffer = b;
    s.loop = true;
    return s;
  };
  const loop = (c: AudioContext, type: BiquadFilterType, f: number, q: number) => {
    const src = noise(c);
    const filt = c.createBiquadFilter();
    filt.type = type;
    filt.frequency.value = f;
    filt.Q.value = q;
    const g = c.createGain();
    g.gain.value = 0;
    src.connect(filt).connect(g).connect(master!);
    src.start();
    return g;
  };
  const start = () => {
    if (ctx) {
      if (ctx.state === "suspended") void ctx.resume();
      return;
    }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.55;
    master.connect(ctx.destination);
    nodes.hum = loop(ctx, "lowpass", 380, 0.4);
    nodes.rain = loop(ctx, "highpass", 2200, 0.3);
    nodes.traffic = loop(ctx, "bandpass", 520, 0.7);
    // the engine: two detuned waves through a low pass that opens with the revs
    nodes.o1 = ctx.createOscillator();
    nodes.o2 = ctx.createOscillator();
    nodes.o1.type = "sawtooth";
    nodes.o2.type = "square";
    nodes.lp = ctx.createBiquadFilter();
    nodes.lp.type = "lowpass";
    nodes.lp.frequency.value = 400;
    nodes.engine = ctx.createGain();
    nodes.engine.gain.value = 0;
    nodes.o1.connect(nodes.lp);
    nodes.o2.connect(nodes.lp);
    nodes.lp.connect(nodes.engine).connect(master);
    nodes.o1.start();
    nodes.o2.start();
  };
  const blip = (freq: number, len: number, type: OscillatorType, vol: number, sweep = 1) => {
    if (!ctx || !master || muted) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    const t = ctx.currentTime;
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(freq * sweep, t + len);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + len + 0.02);
  };
  const tap = (vol: number, f: number, len = 0.07) => {
    if (!ctx || !master || muted) return;
    const src = noise(ctx);
    const filt = ctx.createBiquadFilter();
    filt.type = "bandpass";
    filt.frequency.value = f;
    filt.Q.value = 1.2;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    src.connect(filt).connect(g).connect(master);
    src.start(t);
    src.stop(t + len + 0.02);
  };
  const set = (g: GainNode | undefined, v: number) => {
    if (g && ctx) g.gain.setTargetAtTime(v, ctx.currentTime, 0.12);
  };
  return {
    start,
    setMuted: (m) => {
      muted = m;
      try {
        localStorage.setItem("pc_city_mute", m ? "1" : "0");
      } catch {
        /* fine */
      }
      if (master && ctx) master.gain.setTargetAtTime(m ? 0 : 0.55, ctx.currentTime, 0.05);
    },
    muted: () => muted,
    tick: (o) => {
      if (!ctx) return;
      const out = o.inside ? 0.25 : 1;
      set(nodes.hum, (0.05 + (1 - o.night) * 0.05) * out);
      set(nodes.rain, o.rain * 0.12 * out);
      set(nodes.traffic, Math.min(0.18, o.traffic * 0.18) * out);
      if (nodes.o1 && nodes.o2 && nodes.lp) {
        const f = 38 + o.rpm * 150;
        nodes.o1.frequency.setTargetAtTime(f, ctx.currentTime, 0.04);
        nodes.o2.frequency.setTargetAtTime(f * 0.501, ctx.currentTime, 0.04);
        nodes.lp.frequency.setTargetAtTime(260 + o.rpm * 1500 + o.throttle * 400, ctx.currentTime, 0.06);
        set(nodes.engine, o.driving ? 0.05 + o.rpm * 0.06 : 0);
      }
      // footsteps, one per stride
      if (o.walk > 0.3 && !o.driving) {
        stepClock -= o.dt * (o.walk > 4 ? 3.1 : 1.9);
        if (stepClock <= 0) {
          stepClock = 1;
          tap(o.inside ? 0.18 : 0.12, o.inside ? 1500 : 900);
        }
      } else stepClock = 0.2;
      // birds in the day, out in the street
      birdClock -= o.dt;
      if (birdClock <= 0) {
        birdClock = 2 + Math.random() * 6;
        if (!o.inside && o.night < 0.4 && o.rain < 0.2) {
          const f = 2600 + Math.random() * 1600;
          blip(f, 0.09, "sine", 0.025, 1.4);
          setTimeout(() => blip(f * 1.1, 0.07, "sine", 0.02, 0.8), 110);
        }
      }
    },
    chime: () => {
      blip(880, 0.35, "sine", 0.06);
      setTimeout(() => blip(1318, 0.5, "sine", 0.05), 160);
    },
    click: () => {
      tap(0.3, 3200, 0.04);
      setTimeout(() => tap(0.2, 2400, 0.05), 60);
    },
    thud: (k) => tap(0.25 * k, 140, 0.18),
    dispose: () => {
      if (ctx) void ctx.close();
      ctx = null;
    },
  };
}
