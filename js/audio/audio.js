'use strict';
// Procedural WebAudio sound effects and ambient music.

/* =========================================================
   Audio (procedural WebAudio)
   ========================================================= */
const audio = {
  ctx: null, master: null, rev: null, noise: null, wind: null, rain: null, drone: null, last: {},
  music: { on: false, next: 0, chord: 0, until: 0, gain: null, cool: 0 },
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
    const ctx = this.ctx = new C();
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3;
    this.master = ctx.createGain(); this.master.gain.value = SETTINGS.vol;
    this.master.connect(comp); comp.connect(ctx.destination);
    // reverb
    const len = ctx.sampleRate * 3.2, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    this.rev = ctx.createConvolver(); this.rev.buffer = ir;
    this.revIn = ctx.createGain(); this.revIn.gain.value = 0.5; this.revIn.connect(this.rev); this.rev.connect(this.master);
    // noise buffer
    const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const nd = nb.getChannelData(0);
    let b0 = 0; for (let i = 0; i < nd.length; i++) { const w = Math.random() * 2 - 1; b0 = 0.97 * b0 + 0.03 * w; nd[i] = w * 0.6 + b0 * 3; }
    this.noise = nb;
    const loop = (freq, q, type) => { const s = ctx.createBufferSource(); s.buffer = nb; s.loop = true; const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; const g = ctx.createGain(); g.gain.value = 0; s.connect(f); f.connect(g); g.connect(this.master); s.start(); return { s, f, g }; };
    this.wind = loop(420, 0.7, 'bandpass');
    this.rain = loop(2600, 0.4, 'highpass');
    this.water = loop(900, 0.6, 'bandpass');
    // echo drone
    const dg = ctx.createGain(); dg.gain.value = 0; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380;
    [55, 55.7, 82.6].forEach((f) => { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(lp); o.start(); });
    lp.connect(dg); dg.connect(this.master); dg.connect(this.revIn);
    this.drone = dg;
    this.music.gain = ctx.createGain(); this.music.gain.gain.value = 0; this.music.gain.connect(this.master); this.music.gain.connect(this.revIn);
    this.delay = ctx.createDelay(1.5); this.delay.delayTime.value = 0.43; const fb = ctx.createGain(); fb.gain.value = 0.38; this.delay.connect(fb); fb.connect(this.delay); this.delay.connect(this.music.gain);
  },
  setVol(v) { SETTINGS.vol = v; if (this.master) this.master.gain.value = v; },
  env(g, t, a, peak, dec) { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); },
  blip(freq, dur, type = 'sine', vol = 0.06, dest) {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain(); o.type = type; o.frequency.value = freq;
    o.connect(g); g.connect(dest || this.master); this.env(g, t, 0.005, vol, dur); o.start(t); o.stop(t + dur + 0.05);
  },
  noiseHit(freq, q, dur, vol, type = 'bandpass', t0 = 0) {
    if (!this.ctx) return; const t = this.ctx.currentTime + t0;
    const s = this.ctx.createBufferSource(); s.buffer = this.noise; const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = this.ctx.createGain(); s.connect(f); f.connect(g); g.connect(this.master); this.env(g, t, 0.004, vol, dur);
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.1);
  },
  thump(freq, vol, dur = 0.12) {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain(); o.frequency.setValueAtTime(freq * 1.8, t); o.frequency.exponentialRampToValueAtTime(freq, t + 0.05);
    o.connect(g); g.connect(this.master); this.env(g, t, 0.003, vol, dur); o.start(t); o.stop(t + dur + 0.05);
  },
  step(speed, wet, load) {
    if (!this.ctx) return;
    const v = 0.05 + speed * 0.02 + load * 0.04;
    if (wet > 0.1) { this.noiseHit(700 + Math.random() * 400, 0.8, 0.22, v * 1.6); return; }
    this.thump(70 + Math.random() * 15, v * 1.3);
    this.noiseHit(1800 + Math.random() * 900, 1.2, 0.05, v * 0.8);
    if (Math.random() < 0.6) { const t = this.ctx.currentTime; const o = this.ctx.createOscillator(), g = this.ctx.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(900 + Math.random() * 300, t); o.frequency.linearRampToValueAtTime(1300, t + 0.08); const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 6; o.connect(f); f.connect(g); g.connect(this.master); this.env(g, t, 0.01, 0.012, 0.09); o.start(t); o.stop(t + 0.15); }
  },
  thud(v) { this.thump(55, 0.25 * v, 0.25); this.noiseHit(500, 0.8, 0.15, 0.15 * v); },
  fall() { this.thump(45, 0.4, 0.5); this.noiseHit(400, 0.6, 0.4, 0.3); this.noiseHit(1500, 1, 0.2, 0.12, 'bandpass', 0.1); },
  crash() { this.noiseHit(900, 0.5, 0.5, 0.3); this.blip(180, 0.4, 'sawtooth', 0.05); },
  pickup() { this.blip(520, 0.08, 'triangle', 0.06); setTimeout(() => this.blip(780, 0.1, 'triangle', 0.05), 60); this.thump(90, 0.12); },
  place() { this.thump(70, 0.3, 0.3); this.noiseHit(2000, 1, 0.1, 0.1); setTimeout(() => this.blip(990, 0.15, 'sine', 0.05), 120); },
  deny() { this.blip(180, 0.15, 'square', 0.04); },
  ui(f = 700) { this.blip(f, 0.06, 'sine', 0.045); },
  ack() { [880, 1108, 1318].forEach((f, i) => setTimeout(() => this.blip(f, 0.25, 'sine', 0.05, this.revIn), i * 70)); },
  warn(m) { const now = performance.now(); const gap = lerp(420, 110, clamp((m - 0.62) / 0.38, 0, 1)); if (now - (this.last.warn || 0) < gap) return; this.last.warn = now; this.blip(1250 + m * 400, 0.05, 'square', 0.03); rumble(0, 0.2 + (m - 0.62), 60); },
  maint() {
    for (let i = 0; i < 14; i++) setTimeout(() => { this.noiseHit(2600 + Math.random() * 2000, 3, 0.05, 0.05); if (i % 3 === 0) this.blip(520 + Math.random() * 300, 0.18, 'sawtooth', 0.012); }, i * 190 + Math.random() * 80);
    setTimeout(() => this.blip(880, 0.4, 'sine', 0.05, this.revIn), 2900);
  },
  shutdown() {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain(), f = this.ctx.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(520, t); o.frequency.exponentialRampToValueAtTime(40, t + 1.8);
    f.type = 'lowpass'; f.frequency.value = 900; o.connect(f); f.connect(g); g.connect(this.master);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.06, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.0);
    o.start(t); o.stop(t + 2.1); this.thump(50, 0.3, 0.4);
  },
  archive() { [659, 988].forEach((f, i) => setTimeout(() => this.blip(f, 0.9, 'sine', 0.045, this.revIn), i * 140)); },
  scan() {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(300, t); o.frequency.exponentialRampToValueAtTime(1600, t + 0.6);
    o.connect(g); g.connect(this.master); g.connect(this.revIn); this.env(g, t, 0.02, 0.07, 1.0); o.start(t); o.stop(t + 1.2);
    for (let i = 0; i < 6; i++) setTimeout(() => this.blip(2200 + Math.random() * 800, 0.03, 'sine', 0.02, this.revIn), 300 + i * 160 + Math.random() * 80);
  },
  sensorTick(level, alert) {
    const now = performance.now(); const gap = lerp(900, 90, level);
    if (now - (this.last.sensor || 0) < gap) return; this.last.sensor = now;
    this.noiseHit(alert ? 3200 : 2400, 8, 0.03, 0.05 + level * 0.06);
  },
  echoAlert() { this.blip(110, 0.8, 'sawtooth', 0.06, this.revIn); this.blip(116, 0.8, 'sawtooth', 0.05, this.revIn); },
  hijack(on) { if (!this.ctx) return; this.hijackOn = on; if (on) { this.noiseHit(300, 0.4, 1.2, 0.3); this.blip(70, 1.5, 'sawtooth', 0.12); } },
  deliver() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.blip(f, 0.5, 'triangle', 0.05, this.revIn), i * 110)); },
  connect() {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    [146.8, 220, 277.2, 329.6, 440].forEach((f, i) => { const o = this.ctx.createOscillator(), g = this.ctx.createGain(); o.type = i < 2 ? 'sawtooth' : 'triangle'; o.frequency.value = f; const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(300, t); lp.frequency.linearRampToValueAtTime(2200, t + 3); o.connect(lp); lp.connect(g); g.connect(this.master); g.connect(this.revIn); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.035, t + 1.5); g.gain.exponentialRampToValueAtTime(0.0001, t + 6); o.start(t); o.stop(t + 6.2); });
    [1318, 1760, 2217].forEach((f, i) => setTimeout(() => this.blip(f, 1.2, 'sine', 0.04, this.revIn), 1200 + i * 240));
  },
  thunder() { if (!this.ctx) return; this.noiseHit(90, 0.5, 2.8, 0.45, 'lowpass'); this.noiseHit(200, 0.4, 1.6, 0.25, 'lowpass', 0.15); },
  update(dt) {
    if (!this.ctx) return;
    const P = player, T = this.ctx.currentTime;
    const alt = clamp((P.pos.y - 20) / 80, 0, 1);
    const under = G.mode === 'room' ? 0 : 1;
    this.wind.g.gain.setTargetAtTime((0.05 + alt * 0.07 + (G.mode === 'title' ? 0.03 : 0)) * under, T, 0.5);
    this.wind.f.frequency.setTargetAtTime(350 + Math.sin(G.time * 0.3) * 120 + alt * 200, T, 0.8);
    this.rain.g.gain.setTargetAtTime(envRain * 0.16 * under, T, 0.4);
    this.water.g.gain.setTargetAtTime(clamp(P.depth, 0, 1) * 0.12 * (P.speed > 0.1 ? 1 : 0.4), T, 0.2);
    this.drone.gain.setTargetAtTime((envEcho * 0.018 + (P.sensor || 0) * 0.02 + (this.hijackOn ? 0.05 : 0)) * under, T, 0.6);
    this.updateMusic(dt);
  },
  // ambient score: slow chords + sparse plucked melody, played during long walks
  updateMusic(dt) {
    const M = this.music, ctx = this.ctx, t = ctx.currentTime;
    const walking = G.mode === 'play' && P_walkTime > 28 && envEcho < 0.3 && envRain < 0.5;
    M.cool -= dt;
    if (!M.on && walking && M.cool <= 0) { M.on = true; M.until = t + 110; M.next = t + 0.5; M.gain.gain.setTargetAtTime(0.55, t, 3); }
    const menu = G.mode === 'title' || G.mode === 'intro' || G.mode === 'ending' || G.mode === 'room';
    if (menu && !M.on) { M.on = true; M.until = t + 1e6; M.next = t + 0.5; M.gain.gain.setTargetAtTime(0.45, t, 3); M.title = true; }
    if (M.on && ((!M.title && (t > M.until || envEcho > 0.5 || envRain > 0.7)) || (M.title && !menu))) { M.cool = M.title ? 20 : 160; M.on = false; M.title = false; M.gain.gain.setTargetAtTime(0, t, 3); }
    if (!M.on && M.gain.gain.value < 0.01) return;
    if (t < M.next - 0.1) return;
    const chords = [[50, 57, 61, 66, 69], [47, 54, 57, 62, 66], [43, 50, 54, 59, 64], [45, 52, 57, 59, 64]];
    const ch = chords[M.chord % 4]; M.chord++;
    const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
    const dur = 8.4;
    ch.forEach((m, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
      o.type = i === 0 ? 'triangle' : 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = (Math.random() - 0.5) * 10;
      f.type = 'lowpass'; f.frequency.value = i === 0 ? 400 : 900;
      o.connect(f); f.connect(g); g.connect(M.gain);
      g.gain.setValueAtTime(0.0001, M.next); g.gain.linearRampToValueAtTime(i === 0 ? 0.05 : 0.018, M.next + 2.6); g.gain.linearRampToValueAtTime(0.0001, M.next + dur + 2);
      o.start(M.next); o.stop(M.next + dur + 2.2);
    });
    const scale = [62, 64, 66, 69, 71, 74, 76, 78, 81];
    let tt = M.next + 1.2;
    while (tt < M.next + dur - 0.5) {
      if (Math.random() < 0.55) {
        const m = scale[Math.floor(Math.random() * scale.length)];
        const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.value = mtof(m);
        o.connect(g); g.connect(M.gain); g.connect(this.delay);
        g.gain.setValueAtTime(0.0001, tt); g.gain.linearRampToValueAtTime(0.03, tt + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, tt + 1.6);
        o.start(tt); o.stop(tt + 1.7);
      }
      tt += [0.7, 1.05, 1.4][Math.floor(Math.random() * 3)];
    }
    M.next += dur;
  },
};
let P_walkTime = 0;
