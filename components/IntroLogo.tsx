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
  tx: number; // where it lands
  ty: number;
  r: number;
  sx: number; // where it starts, anywhere on screen
  sy: number;
  cx: number; // bend of its path, so the swarm swirls in
  cy: number;
  d: number; // delay
  dur: number;
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
 * The intro logo: about a thousand and a half fine dots that swirl in from the whole screen,
 * leave short trails, settle into FFF in the header's own typeface, and then fly onto the header mark.
 */
export default function IntroLogo({
  mark,
  landing,
  onReady,
}: {
  mark: React.RefObject<HTMLElement | null>;
  landing: boolean;
  onReady: () => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const landAt = useRef(-1);
  const ready = useRef(onReady);

  useEffect(() => {
    ready.current = onReady;
  });
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

      // set the word in the header's typeface, sized to fill most of the screen width
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

      // halftone sampling: offset rows, dot size follows how much of the letter is under it
      const left = W / 2 - inkW / 2;
      const top = H * 0.4 - inkH / 2;
      const step = Math.max(2.6, inkW / 100);
      const dots: Dot[] = [];
      for (let j = 0, y = 0; y <= inkH; j++, y = j * step * 0.866) {
        for (let x = j % 2 ? step / 2 : 0; x <= inkW; x += step) {
          const a =
            alpha[
              (Math.round(pad + y) * off.width + Math.round(pad + x)) * 4 + 3
            ];
          if (a < 50) continue;
          const tx = left + x;
          const ty = top + y;
          const sx = -0.1 * W + Math.random() * 1.2 * W;
          const sy = -0.1 * H + Math.random() * 1.2 * H;
          const bend = 0.25 + Math.random() * 0.35;
          dots.push({
            tx,
            ty,
            r: step * 0.36 * (0.45 + (0.55 * a) / 255),
            sx,
            sy,
            cx: (sx + tx) / 2 - (ty - sy) * bend,
            cy: (sy + ty) / 2 + (tx - sx) * bend,
            d: (x / inkW) * 0.3 + Math.random() * 0.25,
            dur: 0.8 + Math.random() * 0.4,
          });
        }
      }
      const settle = Math.max(...dots.map((p) => p.d + p.dur));
      const t0 = performance.now();
      let told = false;
      let land: ReturnType<typeof glyphBox> | null = null;
      const paths = Array.from({ length: 8 }, () => new Path2D());

      const frame = (now: number) => {
        raf = requestAnimationFrame(frame);
        const t = (now - t0) / 1000;
        // fade the previous frame instead of wiping it: moving dots leave short trails
        const lt = landAt.current >= 0 ? (now - landAt.current) / 1000 : -1;
        ctx.globalCompositeOperation = "destination-out";
        ctx.fillStyle = lt >= 0 ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.38)"; // shorter trails on the flight to the header
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
        // a sheen sweeps across the word once it has formed, and again every few seconds
        const sweep = t > settle - 0.2 ? ((t - settle + 0.2) % 2.6) / 0.9 : -1;
        const band = left - 60 + sweep * (inkW + 120);
        const scale = land ? 1 + (land.w / inkW - 1) * le : 1;

        for (let i = 0; i < 8; i++) paths[i] = new Path2D();
        for (const p of dots) {
          const u = clamp01((t - p.d) / p.dur);
          if (u <= 0) continue;
          const e = outQuart(u);
          const k = 1 - e;
          let x = k * k * p.sx + 2 * k * e * p.cx + e * e * p.tx;
          let y = k * k * p.sy + 2 * k * e * p.cy + e * e * p.ty;
          let r = p.r * (0.3 + 0.7 * outBack(u));
          if (sweep >= 0 && sweep <= 1)
            r *= 1 - 0.4 * Math.exp(-Math.pow((p.tx - band) / 46, 2)); // dots thin out: a light sheen passes
          if (land) {
            x += (land.x + ((p.tx - left) / inkW) * land.w - x) * le;
            y += (land.y + ((p.ty - top) / inkH) * land.h - y) * le;
            r = Math.max(0.35, r * scale);
          }
          const a = Math.min(1, u * 3) * fade;
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
        if (!told && t >= settle) {
          told = true;
          ready.current();
        }
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
