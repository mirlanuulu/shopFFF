// Звук и вибрация на каждое действие. Звуки синтезируются на лету, файлов нет.

export type Fx = "tick" | "swap" | "size" | "add" | "open" | "close" | "plus" | "minus" | "remove" | "deny";

let ctx: AudioContext | null = null;
let muted = false;

export function setMuted(v: boolean) {
  muted = v;
}

const VIBRATION: Record<Fx, number | number[]> = {
  tick: 6,
  swap: [10, 30, 10],
  size: 10,
  add: [14, 40, 24],
  open: 8,
  close: 8,
  plus: 8,
  minus: 8,
  remove: [20, 30, 20],
  deny: [30, 40, 30],
};

function tone(c: AudioContext, from: number, to: number, at: number, dur: number, gain: number, type: OscillatorType = "sine") {
  const o = c.createOscillator();
  const g = c.createGain();
  const t = c.currentTime + at;
  o.type = type;
  o.frequency.setValueAtTime(from, t);
  o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function whoosh(c: AudioContext, dur: number, gain: number) {
  const n = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, n, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = "bandpass";
  f.Q.value = 1.2;
  const t = c.currentTime;
  f.frequency.setValueAtTime(300, t);
  f.frequency.exponentialRampToValueAtTime(2600, t + dur * 0.6);
  f.frequency.exponentialRampToValueAtTime(700, t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + dur * 0.4);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(c.destination);
  src.start(t);
}

/** k уточняет звук: для размера это положение в размерном ряду от 0 до 1. */
export function fx(name: Fx, k = 0) {
  if (typeof window === "undefined") return;
  try {
    navigator.vibrate?.(VIBRATION[name]);
  } catch {}
  if (muted) return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    const c = ctx;
    switch (name) {
      case "tick":
        tone(c, 1700, 1100, 0, 0.035, 0.035);
        break;
      case "swap":
        whoosh(c, 0.32, 0.05);
        tone(c, 200, 320, 0, 0.3, 0.025);
        break;
      case "size": {
        const f = 480 * Math.pow(2, k * 0.75);
        tone(c, f, f, 0, 0.09, 0.05, "triangle");
        tone(c, f * 2, f * 2, 0, 0.06, 0.02);
        break;
      }
      case "add":
        tone(c, 660, 660, 0, 0.16, 0.06);
        tone(c, 990, 990, 0.09, 0.22, 0.06);
        tone(c, 1980, 1980, 0.09, 0.12, 0.015);
        break;
      case "open":
        tone(c, 320, 640, 0, 0.13, 0.04);
        break;
      case "close":
        tone(c, 640, 320, 0, 0.13, 0.04);
        break;
      case "plus":
        tone(c, 880, 920, 0, 0.05, 0.045, "triangle");
        break;
      case "minus":
        tone(c, 660, 620, 0, 0.05, 0.045, "triangle");
        break;
      case "remove":
        tone(c, 520, 170, 0, 0.2, 0.05);
        break;
      case "deny":
        tone(c, 170, 160, 0, 0.07, 0.03, "square");
        tone(c, 170, 150, 0.11, 0.09, 0.03, "square");
        break;
    }
  } catch {}
}
