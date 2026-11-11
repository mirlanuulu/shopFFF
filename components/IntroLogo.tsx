"use client";

import { useEffect, useRef } from "react";

/** Box of the letters themselves (cap height, ink width), not of the text line around them. */
export function glyphBox(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return { x: r.left, y: r.top, w: r.width, h: r.height };
  ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  if ("letterSpacing" in ctx) ctx.letterSpacing = cs.letterSpacing;
  const t = ctx.measureText(el.textContent ?? "");
  // the baseline sits where the line's ascent ends; the text box is centred in the line by line-height
  const lh = parseFloat(cs.lineHeight) || r.height;
  const baseline =
    r.top +
    (lh - (t.fontBoundingBoxAscent + t.fontBoundingBoxDescent)) / 2 +
    t.fontBoundingBoxAscent;
  return {
    x: r.left - t.actualBoundingBoxLeft,
    y: baseline - t.actualBoundingBoxAscent,
    w: t.actualBoundingBoxLeft + t.actualBoundingBoxRight,
    h: t.actualBoundingBoxAscent + t.actualBoundingBoxDescent,
  };
}

type Dot = {
  tx: number; // where it lands in the word
  ty: number;
  r: number;
  a0: number; // its place on the entry ring
  rr: number;
  w: number; // ring speed
  bx: number; // how far out it is flung when the ring bursts
  by: number;
  d: number; // delay after the tap
  dur: number;
  sx: number; // set at launch: where the flight starts
  sy: number;
  live: boolean;
};

const TAU = Math.PI * 2;
const INK = "#2a2422";
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const outQuart = (u: number) => 1 - Math.pow(1 - u, 4);
const outBack = (u: number) =>
  1 + 2.2 * Math.pow(u - 1, 3) + 1.2 * Math.pow(u - 1, 2);
const inOutCubic = (u: number) =>
  u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;

/**
 * The intro's dots. Before the tap they orbit as a slow ring on the entry screen.
 * On the tap (startAt) the ring bursts across the whole screen and the dots swirl into FFF,
 * set in the header's own typeface; on landing they fly onto the header mark and fade into it.
 */
export default function IntroLogo({
  mark,
  startAt,
  landing,
}: {
  mark: React.RefObject<HTMLElement | null>;
  startAt: number | null;
  landing: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const start = useRef<number | null>(null);
  const landAt = useRef(-1);

  useEffect(() => {
    start.current = startAt;
  }, [startAt]);
  useEffect(() => {
    if (landing && landAt.current < 0) landAt.current = performance.now();
  }, [landing]);

  useEffect(() => {
    const cv = ref.current;
    const el = mark.current;
    if (!cv || !el) return;
    let raf = 0;
    let dead = false;

    (async () => {
      const cs = getComputedStyle(el);
      const font = (px: number) => `${cs.fontWeight} ${px}px ${cs.fontFamily}`;
      try {
        await document.fonts.load(font(100));
      } catch {}
      if (dead) return;

      const W = innerWidth;
      const H = innerHeight;
      const dpr = Math.min(devicePixelRatio || 1, 2);
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
      const ctx = cv.getContext("2d")!;
      ctx.scale(dpr, dpr);

      // set the word in the header's typeface, sized to most of the screen width
      const spacing =
        (parseFloat(cs.letterSpacing) || 0) / parseFloat(cs.fontSize);
      const probe = document.createElement("canvas").getContext("2d")!;
      const setFont = (c: CanvasRenderingContext2D, px: number) => {
        c.font = font(px);
        if ("letterSpacing" in c) c.letterSpacing = `${spacing * px}px`;
      };
      setFont(probe, 100);
      const m100 = probe.measureText("FFF");
      const F =
        (100 * Math.min(W * 0.74, 340)) /
        (m100.actualBoundingBoxLeft + m100.actualBoundingBoxRight);
      setFont(probe, F);
      const m = probe.measureText("FFF");
      const inkW = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
      const inkH = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
      const pad = 4;
      const off = document.createElement("canvas");
      off.width = Math.ceil(inkW + pad * 2);
      off.height = Math.ceil(inkH + pad * 2);
      const oc = off.getContext("2d", { willReadFrequently: true })!;
      setFont(oc, F);
      oc.fillStyle = "#000";
      oc.fillText(
        "FFF",
        pad + m.actualBoundingBoxLeft,
        pad + m.actualBoundingBoxAscent,
      );
      const alpha = oc.getImageData(0, 0, off.width, off.height).data;

      const cx = W / 2;
      const cy = H * 0.4;
      const left = cx - inkW / 2;
      const top = cy - inkH / 2;
      const ring = Math.min(W, H) * 0.19;
      const reach = Math.hypot(W, H) / 2;
      const step = Math.max(2.6, inkW / 100);
      const dots: Dot[] = [];
      // halftone sampling: offset rows, dot size follows how much of the letter is under it
      for (let j = 0, y = 0; y <= inkH; j++, y = j * step * 0.866) {
        for (let x = j % 2 ? step / 2 : 0; x <= inkW; x += step) {
          const a =
            alpha[
              (Math.round(pad + y) * off.width + Math.round(pad + x)) * 4 + 3
            ];
          if (a < 50) continue;
          // thicker in the middle of the band, thinning out to both edges
          const band =
            (Math.random() + Math.random() + Math.random()) / 3 - 0.5;
          const rr = ring * (1 + band * 0.62);
          const out = reach * (0.55 + Math.random() * 0.6);
          const ang = Math.random() * TAU;
          dots.push({
            tx: left + x,
            ty: top + y,
            r: step * 0.36 * (0.45 + (0.55 * a) / 255),
            a0: Math.random() * TAU,
            rr,
            w: (0.5 * ring) / rr, // inner dots turn faster, like a small galaxy
            bx: cx + Math.cos(ang) * out,
            by: cy + Math.sin(ang) * out,
            d: (x / inkW) * 0.3 + Math.random() * 0.25,
            dur: 0.85 + Math.random() * 0.4,
            sx: 0,
            sy: 0,
            live: false,
          });
        }
      }
      const t0 = performance.now();
      let land: ReturnType<typeof glyphBox> | null = null;
      const paths = Array.from({ length: 8 }, () => new Path2D());

      const onRing = (p: Dot, t: number) => {
        const a = p.a0 + p.w * t;
        const r = p.rr * (1 + 0.035 * Math.sin(t * 1.4 + p.a0 * 3));
        return [cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.96] as const;
      };

      const frame = (now: number) => {
        raf = requestAnimationFrame(frame);
        const t = (now - t0) / 1000;
        const s0 = start.current;
        const ts = s0 === null ? -1 : (now - s0) / 1000; // seconds since the tap
        const lt = landAt.current >= 0 ? (now - landAt.current) / 1000 : -1;

        // fade the last frame instead of wiping it: moving dots leave short trails
        ctx.globalCompositeOperation = "destination-out";
        ctx.fillStyle =
          ts < 0
            ? "rgba(0,0,0,0.5)"
            : lt >= 0
              ? "rgba(0,0,0,0.6)"
              : "rgba(0,0,0,0.34)";
        ctx.fillRect(0, 0, W, H);
        ctx.globalCompositeOperation = "source-over";

        if (lt >= 0 && !land) land = glyphBox(el);
        const le = lt < 0 ? 0 : inOutCubic(clamp01(lt / 1.0));
        const fade = lt < 0 ? 1 : 1 - clamp01((lt - 0.85) / 0.3);
        if (fade <= 0) {
          cancelAnimationFrame(raf);
          ctx.clearRect(0, 0, W, H);
          return;
        }
        const appear = clamp01(t / 0.9); // the ring fades in when the page opens
        const sweep = ts > 1.55 ? (ts - 1.55) / 0.9 : -1; // a light sheen once the word has formed
        const bandX = left - 60 + sweep * (inkW + 120);
        const scale = land ? 1 + (land.w / inkW - 1) * le : 1;

        for (let i = 0; i < 8; i++) paths[i] = new Path2D();
        for (const p of dots) {
          let x: number;
          let y: number;
          let r: number;
          let a: number;
          const u = ts < 0 ? 0 : clamp01((ts - p.d) / p.dur);
          if (u <= 0) {
            [x, y] = onRing(p, t);
            r = p.r * 0.75;
            a = 0.8 * appear;
          } else {
            if (!p.live) {
              [p.sx, p.sy] = onRing(p, t);
              p.live = true;
            }
            // flung out toward the edge of the screen, then pulled into its place in the word
            const e = outQuart(u);
            const k = 1 - e;
            x = k * k * p.sx + 2 * k * e * p.bx + e * e * p.tx;
            y = k * k * p.sy + 2 * k * e * p.by + e * e * p.ty;
            r = p.r * (0.75 + 0.25 * outBack(u));
            a = 0.8 + 0.2 * u;
            if (sweep >= 0 && sweep <= 1)
              r *= 1 - 0.4 * Math.exp(-Math.pow((p.tx - bandX) / 46, 2));
          }
          if (land) {
            x += (land.x + ((p.tx - left) / inkW) * land.w - x) * le;
            y += (land.y + ((p.ty - top) / inkH) * land.h - y) * le;
            r = Math.max(0.35, r * scale);
          }
          a *= fade;
          const b = Math.min(7, Math.floor(a * 8));
          paths[b].moveTo(x + r, y);
          paths[b].arc(x, y, r, 0, TAU);
        }
        ctx.fillStyle = INK;
        for (let i = 0; i < 8; i++) {
          ctx.globalAlpha = (i + 1) / 8;
          ctx.fill(paths[i]);
        }
        ctx.globalAlpha = 1;
      };
      raf = requestAnimationFrame(frame);
    })();

    return () => {
      dead = true;
      cancelAnimationFrame(raf);
    };
  }, [mark]);

  return <canvas ref={ref} className="introcanvas" aria-hidden="true" />;
}
