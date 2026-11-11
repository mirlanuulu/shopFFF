// Звук и вибрация на каждое действие. Звуки синтезируются на лету, файлов нет.

export type Fx =
  | "tick"
  | "swap"
  | "size"
  | "add"
  | "open"
  | "close"
  | "plus"
  | "minus"
  | "remove"
  | "deny";

let ctx: AudioContext | null = null;
let muted = false;

export function setMuted(v: boolean) {
  muted = v;
  if (v) stopIntroSound();
}

function audio() {
  ctx ??= new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/**
 * Может ли страница играть звук без касания. На телефонах при заходе — почти всегда нет.
 * Браузер решает это не сразу, поэтому ответ приходит через мгновение.
 */
export async function soundUnlocked(): Promise<boolean> {
  try {
    const nav = navigator as Navigator & {
      getAutoplayPolicy?: (type: string) => string;
    };
    if (nav.getAutoplayPolicy)
      return nav.getAutoplayPolicy("audiocontext") === "allowed";
    ctx ??= new AudioContext();
    const c = ctx;
    if (c.state === "running") return true;
    await new Promise((r) => {
      c.addEventListener("statechange", r, { once: true });
      setTimeout(r, 200);
    });
    return (c.state as AudioContextState) === "running";
  } catch {
    return false;
  }
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

function tone(
  c: AudioContext,
  from: number,
  to: number,
  at: number,
  dur: number,
  gain: number,
  type: OscillatorType = "sine",
) {
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
    const c = audio();
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

/* ---------- intro: a riser that opens up when the glass clears and lands with the camera ---------- */

let introBus: GainNode | null = null;
let introBuzz = 0;

function noise(c: AudioContext, dur: number) {
  const n = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, n, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  return src;
}

/** gain envelope: silent → peak after `attack` → silent after `decay` */
function env(
  g: GainNode,
  at: number,
  peak: number,
  attack: number,
  decay: number,
) {
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(peak, at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
}

function partial(
  c: AudioContext,
  out: AudioNode,
  f: number,
  at: number,
  peak: number,
  attack: number,
  decay: number,
  type: OscillatorType = "sine",
) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = f;
  env(g, at, peak, attack, decay);
  o.connect(g).connect(out);
  o.start(at);
  o.stop(at + attack + decay + 0.05);
}

/** clear, arrive: секунды от этого момента до того, как оттает стекло и камера доедет; sparkle: искры под сбор точек */
export function introSound(clear: number, arrive: number, sparkle: boolean) {
  clearTimeout(introBuzz);
  introBuzz = window.setTimeout(() => {
    try {
      if (navigator.userActivation?.hasBeenActive)
        navigator.vibrate?.([18, 50, 34]);
    } catch {}
  }, arrive * 1000);
  if (muted) return;
  try {
    const c = audio();
    const t0 = c.currentTime + 0.03;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 4;
    const bus = c.createGain();
    bus.gain.value = 0.9;
    bus.connect(comp).connect(c.destination);
    introBus?.disconnect();
    introBus = bus;
    const tc = t0 + Math.max(0.6, clear);
    const ta = t0 + Math.max(clear + 0.6, arrive);

    // 1. a detuned pad slides up and opens its filter until the glass clears
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.Q.value = 5;
    lp.frequency.setValueAtTime(200, t0);
    lp.frequency.exponentialRampToValueAtTime(2600, tc);
    lp.frequency.exponentialRampToValueAtTime(700, ta);
    const pad = c.createGain();
    pad.gain.setValueAtTime(0.0001, t0);
    pad.gain.exponentialRampToValueAtTime(0.05, tc);
    pad.gain.setValueAtTime(0.05, ta - 0.15);
    pad.gain.exponentialRampToValueAtTime(0.0001, ta + 0.25);
    lp.connect(pad).connect(bus);
    for (const [f, cents] of [
      [110, -9],
      [110, 8],
      [164.81, 4],
      [220, -6],
    ] as const) {
      const o = c.createOscillator();
      o.type = "sawtooth";
      o.detune.value = cents;
      o.frequency.setValueAtTime(f * 0.92, t0);
      o.frequency.exponentialRampToValueAtTime(f, tc);
      o.connect(lp);
      o.start(t0);
      o.stop(ta + 0.3);
    }

    // 2. air rising underneath, peaking with the glass
    const air = noise(c, ta - t0 + 0.5);
    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 0.9;
    bp.frequency.setValueAtTime(300, t0);
    bp.frequency.exponentialRampToValueAtTime(6000, tc);
    bp.frequency.exponentialRampToValueAtTime(1200, tc + 0.6);
    const ag = c.createGain();
    ag.gain.setValueAtTime(0.0001, t0);
    ag.gain.exponentialRampToValueAtTime(0.07, tc);
    ag.gain.exponentialRampToValueAtTime(0.0001, tc + 0.7);
    air.connect(bp).connect(ag).connect(bus);
    air.start(t0);

    // 3. tiny glints while the dots gather, denser as they arrive
    if (sparkle) {
      for (let i = 0; i < 48; i++) {
        const at = t0 + Math.pow(Math.random(), 0.6) * Math.min(1.7, clear);
        partial(
          c,
          bus,
          2600 + Math.random() * 3600,
          at,
          0.006 + Math.random() * 0.014,
          0.003,
          0.05,
        );
      }
    }

    // 4. a bright chord when the glass clears
    [880, 1108.73, 1318.51, 1760].forEach((f, i) =>
      partial(c, bus, f, tc + i * 0.045, 0.022, 0.01, 1.6),
    );

    // 5. a soft impact and a warm chord as the camera arrives
    const sub = c.createOscillator();
    const sg = c.createGain();
    sub.frequency.setValueAtTime(96, ta);
    sub.frequency.exponentialRampToValueAtTime(42, ta + 0.6);
    env(sg, ta, 0.32, 0.006, 1.3);
    sub.connect(sg).connect(bus);
    sub.start(ta);
    sub.stop(ta + 1.4);
    const click = noise(c, 0.05);
    const hp = c.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 2200;
    const cg = c.createGain();
    env(cg, ta, 0.06, 0.002, 0.04);
    click.connect(hp).connect(cg).connect(bus);
    click.start(ta);
    for (const f of [110, 164.81, 246.94, 277.18, 415.3])
      partial(c, bus, f, ta + 0.01, 0.028, 0.02, 2.6, "triangle");
  } catch {}
}

export function stopIntroSound() {
  clearTimeout(introBuzz);
  if (!introBus || !ctx) return;
  introBus.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.06);
  introBus = null;
}
