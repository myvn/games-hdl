let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let muted = false;

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);
    const len = Math.floor(ctx.sampleRate * 0.6);
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export function unlockAudio() {
  ac();
}

export function setMuted(m: boolean) {
  muted = m;
  if (master) master.gain.value = m ? 0 : 0.35;
}

export function isMuted() {
  return muted;
}

function tone(
  type: OscillatorType,
  f0: number,
  f1: number,
  dur: number,
  vol = 0.2,
  delay = 0,
) {
  const c = ac();
  if (!c || !master || muted) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  o.connect(g);
  g.connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur: number, vol = 0.25, f = 900, delay = 0, q = 1) {
  const c = ac();
  if (!c || !master || !noiseBuf || muted) return;
  const t = c.currentTime + delay;
  const s = c.createBufferSource();
  s.buffer = noiseBuf;
  const flt = c.createBiquadFilter();
  flt.type = 'lowpass';
  flt.frequency.setValueAtTime(f, t);
  flt.frequency.exponentialRampToValueAtTime(Math.max(60, f * 0.15), t + dur);
  flt.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(flt);
  flt.connect(g);
  g.connect(master);
  s.start(t);
  s.stop(t + dur + 0.02);
}

export const sfx = {
  shoot(kind: string) {
    if (kind === 'L') tone('sawtooth', 1400, 260, 0.14, 0.14);
    else if (kind === 'S') {
      tone('square', 900, 300, 0.1, 0.12);
      noise(0.08, 0.12, 1800);
    } else if (kind === 'M') tone('square', 1100, 520, 0.05, 0.09);
    else tone('square', 1300, 600, 0.07, 0.11);
  },
  jump() {
    tone('square', 340, 760, 0.13, 0.12);
  },
  hit() {
    noise(0.07, 0.18, 2600);
  },
  enemyShot() {
    tone('sawtooth', 500, 180, 0.11, 0.07);
  },
  explode(big = false) {
    noise(big ? 0.55 : 0.28, big ? 0.4 : 0.26, big ? 1100 : 1500);
    tone('triangle', big ? 180 : 260, 40, big ? 0.45 : 0.22, big ? 0.22 : 0.13);
  },
  death() {
    tone('square', 620, 70, 0.55, 0.2);
    noise(0.4, 0.2, 900, 0.05);
  },
  power() {
    tone('square', 620, 620, 0.07, 0.16);
    tone('square', 880, 880, 0.07, 0.16, 0.07);
    tone('square', 1240, 1240, 0.12, 0.16, 0.14);
  },
  bossHurt() {
    tone('square', 220, 120, 0.09, 0.1);
    noise(0.1, 0.14, 700);
  },
  slash() {
    noise(0.09, 0.22, 3600, 0, 2.4);
    tone('triangle', 900, 260, 0.08, 0.14);
  },
  guardBlock() {
    tone('square', 1500, 900, 0.06, 0.12);
    noise(0.05, 0.1, 2600);
  },
  missileLaunch() {
    tone('sawtooth', 260, 500, 0.22, 0.13);
    noise(0.2, 0.1, 1400);
  },
  lock() {
    tone('square', 1800, 1800, 0.05, 0.08);
  },
  start() {
    const seq = [523, 659, 784, 1046];
    seq.forEach((f, i) => tone('square', f, f, 0.1, 0.16, i * 0.09));
  },
  win() {
    const seq = [523, 659, 784, 1046, 880, 1046, 1318];
    seq.forEach((f, i) => tone('square', f, f, 0.16, 0.16, i * 0.13));
  },
  gameover() {
    const seq = [440, 392, 330, 262];
    seq.forEach((f, i) => tone('triangle', f, f * 0.98, 0.3, 0.18, i * 0.2));
  },
};
