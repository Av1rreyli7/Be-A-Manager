// Floodlights 3D match view: the sound of the ground, made in the browser (no sound files). Player Career only
// (a match with a venue); Manager Career matches stay silent as they always were.
// A school game: a quiet field, shouts from the touchline, claps, the referee's whistle. A college game: a murmur
// from the stand, more voices, cheers. An academy game: a small crowd. A pro game: the roar of a full stadium
// that swells with every chance and erupts for a goal.

const LEVEL = { school: 0.015, college: 0.05, academy: 0.06, pro: 0.3 };

export function createMatchSound(venue, win) {
  const AC = win && (win.AudioContext || win.webkitAudioContext);
  if (!AC) return null;
  let muted = false;
  try { muted = win.localStorage && win.localStorage.getItem("pc_city_mute") === "1"; } catch (e) { /* no storage: sound on */ }
  let ctx;
  try { ctx = new AC(); } catch (e) { return null; }
  const kind = venue && LEVEL[venue.kind] !== undefined ? venue.kind : "pro";
  const big = kind === "pro" ? 0.4 + (Number(venue.crowd) || 0.8) * 0.6 : 0;
  const master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.55;
  master.connect(ctx.destination);
  // a few seconds of noise, used for the crowd, the cheers and the claps
  const noise = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
  {
    const d = noise.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.099; b1 = 0.963 * b1 + w * 0.2965; b2 = 0.57 * b2 + w * 1.0526;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.18;
    }
  }
  // the crowd bed: always there, louder for a bigger ground
  const bed = ctx.createBufferSource();
  bed.buffer = noise;
  bed.loop = true;
  const bedF = ctx.createBiquadFilter();
  bedF.type = "bandpass"; bedF.frequency.value = kind === "pro" ? 420 : 650; bedF.Q.value = 0.5;
  const bedG = ctx.createGain();
  const bedLevel = LEVEL[kind] * (kind === "pro" ? 0.6 + big * 0.5 : 1);
  bedG.gain.value = bedLevel;
  bed.connect(bedF); bedF.connect(bedG); bedG.connect(master);
  bed.start();
  const now = () => ctx.currentTime;

  // a swell of voices: noise through a vocal band, up and back down
  function swell(level, rise, hold, fall, freq) {
    const src = ctx.createBufferSource();
    src.buffer = noise; src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass"; f.frequency.value = freq || 700; f.Q.value = 0.7;
    const g = ctx.createGain();
    const t = now();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(level, t + rise);
    g.gain.setValueAtTime(level, t + rise + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + rise + hold + fall);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t, Math.random() * 2);
    src.stop(t + rise + hold + fall + 0.1);
  }
  // one voice from the touchline: a short buzz shaped like a vowel
  function shout(level) {
    const t = now() + Math.random() * 0.15;
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    const f0 = 150 + Math.random() * 170;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.linearRampToValueAtTime(f0 * (1.15 + Math.random() * 0.2), t + 0.12);
    o.frequency.linearRampToValueAtTime(f0 * 0.9, t + 0.32);
    const f1 = ctx.createBiquadFilter();
    f1.type = "bandpass"; f1.frequency.value = 700 + Math.random() * 500; f1.Q.value = 4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(level, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34 + Math.random() * 0.15);
    o.connect(f1); f1.connect(g); g.connect(master);
    o.start(t); o.stop(t + 0.6);
  }
  // hands clapping: little bright bursts
  function claps(n, level) {
    for (let i = 0; i < n; i++) {
      const t = now() + i * (0.14 + Math.random() * 0.12);
      const src = ctx.createBufferSource();
      src.buffer = noise;
      const f = ctx.createBiquadFilter();
      f.type = "highpass"; f.frequency.value = 1400;
      const g = ctx.createGain();
      g.gain.setValueAtTime(level, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
      src.connect(f); f.connect(g); g.connect(master);
      src.start(t, Math.random() * 2); src.stop(t + 0.08);
    }
  }
  // the referee's whistle: a pea whistle trill, short or long, once or three times
  function whistle(len, times) {
    for (let k = 0; k < (times || 1); k++) {
      const t = now() + k * (len + 0.18);
      const o = ctx.createOscillator();
      o.type = "sine"; o.frequency.value = 2900;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 26;
      const lg = ctx.createGain();
      lg.gain.value = 140;
      lfo.connect(lg); lg.connect(o.frequency);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.12, t + 0.02);
      g.gain.setValueAtTime(0.12, t + len - 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      o.connect(g); g.connect(master);
      o.start(t); lfo.start(t); o.stop(t + len + 0.05); lfo.stop(t + len + 0.05);
    }
  }
  // a school touchline is mostly quiet with voices now and then; the pros hum and surge
  let nextVoice = 2;
  function tick(dt, excite) {
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const e = Math.max(0, Math.min(1, excite || 0));
    bedG.gain.setTargetAtTime(bedLevel * (1 + e * (kind === "pro" ? 1.2 : 0.6)), now(), 0.4);
    if (kind === "pro") return;
    nextVoice -= dt;
    if (nextVoice <= 0) {
      nextVoice = (kind === "school" ? 2.5 : 1.6) + Math.random() * 3;
      shout(kind === "school" ? 0.05 : 0.04);
    }
  }
  function react(type, home) {
    if (muted) return;
    if (type === "goal") {
      if (kind === "pro") { swell(0.55 * (0.6 + big * 0.4), 0.25, 2.6, 2.4, 650); swell(0.25, 0.4, 2.2, 2, 1100); }
      else { for (let i = 0; i < (kind === "school" ? 5 : 9); i++) shout(0.09); claps(kind === "school" ? 10 : 18, 0.14); if (kind !== "school") swell(0.12, 0.2, 1, 1.5, 800); }
    } else if (type === "chance") {
      if (kind === "pro") swell(0.3, 0.15, 0.5, 1.2, 600);
      else { shout(0.08); shout(0.06); }
    } else if (type === "foul") {
      whistle(0.22, 1);
      if (kind === "pro") swell(0.14, 0.2, 0.4, 0.9, 380);
      else shout(0.07);
    } else if (type === "kickoff") whistle(0.35, 1);
    else if (type === "half") whistle(0.5, 2);
    else if (type === "full") whistle(0.55, 3);
  }
  function dispose() {
    try { bed.stop(); } catch (e) { /* stopped */ }
    try { ctx.close(); } catch (e) { /* closed */ }
  }
  return { tick, react, dispose, kind };
}
