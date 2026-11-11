import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { Product } from "./products";

type Pt = [number, number];

/* ---------- shared textures & materials ---------- */

let fabricBump: THREE.CanvasTexture | null = null;
function getFabricBump() {
  if (fabricBump) return fabricBump;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = "#808080";
  g.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 2) {
    for (let x = 0; x < 128; x += 2) {
      const v = 110 + Math.floor(Math.random() * 40) + ((x + y) % 4 === 0 ? 14 : 0);
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(x, y, 2, 2);
    }
  }
  fabricBump = new THREE.CanvasTexture(c);
  fabricBump.wrapS = fabricBump.wrapT = THREE.RepeatWrapping;
  fabricBump.repeat.set(7, 7);
  return fabricBump;
}

export function clothMaterial(color: string, glossy = false) {
  const base = new THREE.Color(color);
  const sheen = base.clone().lerp(new THREE.Color("#ffffff"), 0.45);
  return new THREE.MeshPhysicalMaterial({
    color: base,
    roughness: glossy ? 0.38 : 0.86,
    metalness: glossy ? 0.15 : 0,
    clearcoat: glossy ? 0.5 : 0,
    clearcoatRoughness: 0.35,
    sheen: glossy ? 0.2 : 1,
    sheenRoughness: 0.55,
    sheenColor: sheen,
    bumpMap: getFabricBump(),
    bumpScale: glossy ? 0.4 : 1.4,
  });
}

export const chrome = () =>
  new THREE.MeshStandardMaterial({ color: "#e4e8f2", metalness: 1, roughness: 0.16 });

function printTexture(text: string, color: string) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 256;
  const g = c.getContext("2d")!;
  g.clearRect(0, 0, 512, 256);
  g.fillStyle = color;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.font = `900 ${text.length > 2 ? 150 : 190}px "Unbounded Variable", "Arial Black", sans-serif`;
  g.fillText(text, 256, 136);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/* ---------- geometry helpers ---------- */

function mirrorShape(right: Pt[], neck = 0) {
  const s = new THREE.Shape();
  s.moveTo(right[0][0], right[0][1]);
  for (let i = 1; i < right.length; i++) s.lineTo(right[i][0], right[i][1]);
  for (let i = right.length - 1; i >= 0; i--) {
    if (right[i][0] === 0) continue;
    s.lineTo(-right[i][0], right[i][1]);
  }
  if (neck > 0) s.quadraticCurveTo(0, right[0][1] - neck * 2, right[0][0], right[0][1]);
  else s.lineTo(right[0][0], right[0][1]);
  return s;
}

const BEND = 0.16;
function bend(geo: THREE.BufferGeometry, k = BEND) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    p.setZ(i, p.getZ(i) - x * x * k);
  }
  p.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

const DEPTH = 0.17;
const BEVEL = 0.06;
const FRONT = DEPTH / 2 + BEVEL;

function extrude(shape: THREE.Shape, depth = DEPTH, bevel = BEVEL) {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel * 0.8,
    bevelSegments: 5,
    curveSegments: 20,
  });
  geo.translate(0, 0, -depth / 2);
  return bend(geo);
}

function decal(w: number, h: number, x: number, y: number, tex: THREE.Texture) {
  const geo = bend(new THREE.PlaneGeometry(w, h, 12, 1));
  const m = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -4 })
  );
  m.position.set(x, y, FRONT + 0.006 - x * x * BEND);
  return m;
}

function strip(w: number, h: number, x: number, y: number, mat: THREE.Material, d = 0.02) {
  const m = new THREE.Mesh(bend(new THREE.BoxGeometry(w, h, d, 10, 1, 1)), mat);
  m.position.set(x, y, FRONT + d / 2 - 0.004 - x * x * BEND);
  return m;
}

/* ---------- hangers ---------- */

export const HOOK_TOP = 0.3;

function hook(mat: THREE.Material) {
  const g = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.2, 10), mat);
  stem.position.y = 0.1;
  const arc = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.013, 10, 28, Math.PI * 1.45), mat);
  arc.position.set(0, 0.255, 0);
  arc.rotation.z = -Math.PI * 0.72;
  g.add(stem, arc);
  return g;
}

function shoulderHanger() {
  const mat = chrome();
  const g = hook(mat);
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.5, -0.17, 0),
    new THREE.Vector3(-0.22, -0.05, 0),
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.22, -0.05, 0),
    new THREE.Vector3(0.5, -0.17, 0),
  ]);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 32, 0.017, 10), mat));
  return g;
}

function clipHanger(width: number) {
  const mat = chrome();
  const g = hook(mat);
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, width, 10), mat);
  bar.rotation.z = Math.PI / 2;
  g.add(bar);
  for (const s of [-1, 1]) {
    const clip = new THREE.Mesh(new RoundedBoxGeometry(0.09, 0.14, 0.3, 3, 0.02), mat);
    clip.position.set(s * width * 0.36, -0.06, 0);
    g.add(clip);
  }
  return g;
}

/* ---------- garments (origin = hanger point, garment hangs below) ---------- */

const TEE: Pt[] = [[0.17, 0], [0.5, -0.09], [0.84, -0.36], [0.7, -0.6], [0.5, -0.47], [0.5, -1.42], [0, -1.42]];
const LONG: Pt[] = [[0.17, 0], [0.5, -0.09], [0.98, -1.12], [0.8, -1.22], [0.5, -0.52], [0.5, -1.45], [0, -1.45]];
const WIDE: Pt[] = [[0.18, 0], [0.54, -0.09], [1.02, -1.08], [0.82, -1.2], [0.56, -0.55], [0.56, -1.42], [0, -1.42]];

function buildTop(p: Product) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = -0.04;
  g.add(shoulderHanger(), body);
  const accent = p.accent ?? "#ffffff";

  if (p.kind === "tee" || p.kind === "longsleeve") {
    const pts = p.kind === "tee" ? TEE : LONG;
    body.add(new THREE.Mesh(extrude(mirrorShape(pts, 0.085)), clothMaterial(p.color)));
    if (p.print) body.add(decal(0.62, 0.31, 0, -0.55, printTexture(p.print, accent)));
    body.add(strip(0.12, 0.035, 0.3, -1.3, new THREE.MeshStandardMaterial({ color: accent, roughness: 0.5 }), 0.008));
  }

  if (p.kind === "hoodie") {
    const mat = clothMaterial(p.color);
    body.add(new THREE.Mesh(extrude(mirrorShape(LONG, 0.07), 0.2), mat));
    const hood = new THREE.Shape();
    hood.absellipse(0, 0, 0.3, 0.36, 0, Math.PI * 2);
    const hm = new THREE.Mesh(extrude(hood, 0.12, 0.07), mat);
    hm.position.set(0, -0.06, -0.16);
    body.add(hm);
    const pocket = new THREE.Shape();
    pocket.moveTo(-0.3, 0);
    pocket.lineTo(0.3, 0);
    pocket.lineTo(0.38, -0.3);
    pocket.lineTo(-0.38, -0.3);
    pocket.closePath();
    const pk = new THREE.Mesh(extrude(pocket, 0.03, 0.02), mat);
    pk.position.set(0, -0.92, FRONT + 0.03);
    body.add(pk);
    const cord = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.6 });
    for (const s of [-1, 1]) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.36, 8), cord);
      c.position.set(s * 0.09, -0.3, FRONT + 0.04);
      body.add(c);
    }
    body.add(strip(1.0, 0.1, 0, -1.4, mat, 0.03));
  }

  if (p.kind === "puffer" || p.kind === "bomber") {
    const puffer = p.kind === "puffer";
    const mat = clothMaterial(p.color, true);
    body.add(new THREE.Mesh(extrude(mirrorShape(WIDE, 0.05), puffer ? 0.26 : 0.2, puffer ? 0.09 : 0.06), mat));
    const front = (puffer ? 0.13 + 0.09 : 0.1 + 0.06) - FRONT;
    const trim = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.4, metalness: 0.3 });
    const zip = strip(0.035, 1.34, 0, -0.74, trim, 0.02);
    zip.position.z += front;
    body.add(zip);
    if (puffer) {
      const seam = new THREE.MeshStandardMaterial({ color: "#000000", roughness: 1 });
      for (let i = 0; i < 5; i++) {
        const s = strip(1.1, 0.012, 0, -0.42 - i * 0.2, seam, 0.006);
        s.position.z += front - 0.004;
        body.add(s);
      }
      const collar = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.085, 12, 24, Math.PI), mat);
      collar.rotation.x = Math.PI / 2 - 0.5;
      collar.rotation.z = Math.PI;
      collar.position.set(0, 0.0, 0.02);
      body.add(collar);
    } else {
      const rib = clothMaterial(accent);
      const hem = strip(1.12, 0.1, 0, -1.4, rib, 0.03);
      hem.position.z += front;
      body.add(hem);
      const neck = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.045, 10, 24, Math.PI), rib);
      neck.rotation.x = Math.PI / 2 - 0.6;
      neck.rotation.z = Math.PI;
      neck.position.set(0, -0.02, 0.03);
      body.add(neck);
    }
  }
  return g;
}

function buildBottom(p: Product) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = -0.03;
  const mat = clothMaterial(p.color);
  const accent = p.accent ?? p.color;
  let waist = 0.44;

  if (p.kind === "skirt") {
    waist = 0.38;
    body.add(new THREE.Mesh(extrude(mirrorShape([[0.38, 0], [0.74, -1.05], [0, -1.05]])), mat));
    body.add(strip(0.03, 0.9, 0.2, -0.55, new THREE.MeshStandardMaterial({ color: accent, roughness: 0.5 }), 0.008));
  } else {
    const len = p.kind === "shorts" ? -0.86 : -1.9;
    const wide = p.kind === "pants" ? 0.56 : 0.5;
    const pts: Pt[] = [[0.44, 0], [0.5, -0.3], [wide, len], [wide - 0.36, len], [0, -0.58]];
    body.add(new THREE.Mesh(extrude(mirrorShape(pts)), mat));
    if (p.kind === "cargo") {
      for (const s of [-1, 1]) {
        body.add(strip(0.24, 0.3, s * 0.36, -0.95, mat, 0.05));
        body.add(strip(0.24, 0.035, s * 0.36, -0.82, new THREE.MeshStandardMaterial({ color: accent, roughness: 0.5 }), 0.058));
      }
    }
    if (p.kind === "shorts") {
      for (const s of [-1, 1])
        body.add(strip(0.03, 0.8, s * 0.46, -0.44, new THREE.MeshStandardMaterial({ color: accent, roughness: 0.5 }), 0.008));
    }
    if (p.kind === "pants") {
      const crease = new THREE.MeshStandardMaterial({ color: "#000", transparent: true, opacity: 0.18 });
      for (const s of [-1, 1]) body.add(strip(0.008, 1.5, s * 0.33, -1.12, crease, 0.004));
    }
  }
  body.add(strip(waist * 2 + 0.04, 0.09, 0, -0.045, mat, 0.03));
  g.add(clipHanger(waist * 2), body);
  return g;
}

/* ---------- accessories (origin = centre of object) ---------- */

function buildAccessory(p: Product) {
  const g = new THREE.Group();
  const mat = clothMaterial(p.color);
  const accent = p.accent ?? "#ffffff";

  if (p.kind === "cap") {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.5, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), mat);
    dome.scale.set(1, 0.82, 1.08);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.035, 40, 1, false, -Math.PI / 2, Math.PI), mat);
    brim.scale.set(0.92, 1, 1.25);
    brim.rotation.x = 0.12;
    brim.position.set(0, 0.0, 0.42);
    const btn = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), clothMaterial(accent));
    btn.position.y = 0.41;
    const badge = decal(0.3, 0.15, 0, 0.18, printTexture("FFF", accent));
    badge.position.z = 0.515;
    badge.rotation.x = -0.35;
    g.add(dome, brim, btn, badge);
    g.position.y = -0.15;
    g.rotation.x = 0.25;
    const wrap = new THREE.Group();
    wrap.add(g);
    return wrap;
  }

  if (p.kind === "beanie") {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.46, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), mat);
    dome.scale.set(1, 1.25, 1);
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.49, 0.49, 0.26, 48, 1, true), mat);
    (cuff.material as THREE.Material).side = THREE.DoubleSide;
    cuff.position.y = 0.06;
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      const rib = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.26, 6), mat);
      rib.position.set(Math.cos(a) * 0.495, 0.06, Math.sin(a) * 0.495);
      g.add(rib);
    }
    g.add(dome, cuff);
    g.position.y = -0.3;
    const wrap = new THREE.Group();
    wrap.add(g);
    return wrap;
  }

  if (p.kind === "tote") {
    const bag = new THREE.Mesh(new RoundedBoxGeometry(0.95, 1.0, 0.22, 4, 0.05), mat);
    bag.position.y = -0.22;
    const strap = clothMaterial(accent);
    for (const z of [-0.09, 0.09]) {
      const h = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.022, 8, 28, Math.PI), strap);
      h.scale.y = 1.5;
      h.position.set(0, 0.27, z);
      g.add(h);
    }
    if (p.print) {
      const d = new THREE.Mesh(
        new THREE.PlaneGeometry(0.6, 0.3),
        new THREE.MeshStandardMaterial({ map: printTexture(p.print, accent), transparent: true, roughness: 0.7 })
      );
      d.position.set(0, -0.22, 0.116);
      g.add(d);
    }
    g.add(bag);
    return g;
  }

  if (p.kind === "shades") {
    const frame = new THREE.MeshPhysicalMaterial({ color: p.color, roughness: 0.2, clearcoat: 1 });
    const lens = new THREE.MeshPhysicalMaterial({ color: accent, metalness: 0.9, roughness: 0.08, clearcoat: 1 });
    for (const s of [-1, 1]) {
      const l = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.03, 40), lens);
      l.rotation.x = Math.PI / 2;
      l.scale.set(1.15, 1, 0.82);
      l.position.set(s * 0.3, 0, 0);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.028, 10, 40), frame);
      rim.scale.set(1.15, 0.82, 1);
      rim.position.copy(l.position);
      const temple = new THREE.Mesh(new RoundedBoxGeometry(0.03, 0.04, 0.72, 2, 0.012), frame);
      temple.position.set(s * 0.58, 0.05, -0.36);
      g.add(l, rim, temple);
    }
    const bridge = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.022, 8, 16, Math.PI), frame);
    bridge.position.y = 0.03;
    g.add(bridge);
    g.scale.setScalar(1.15);
    return g;
  }

  // crossbody
  const pod = new THREE.Mesh(new RoundedBoxGeometry(0.86, 0.52, 0.3, 6, 0.14), clothMaterial(p.color, true));
  pod.position.y = -0.28;
  const zipM = new THREE.MeshStandardMaterial({ color: accent, metalness: 1, roughness: 0.2 });
  const zip = new THREE.Mesh(new RoundedBoxGeometry(0.6, 0.022, 0.02, 2, 0.008), zipM);
  zip.position.set(0, -0.16, 0.155);
  const strap = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.016, 8, 48, Math.PI), clothMaterial("#2a2a30"));
  strap.scale.y = 1.35;
  strap.position.y = -0.1;
  for (const s of [-1, 1]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.009, 8, 16), zipM);
    ring.position.set(s * 0.42, -0.1, 0);
    g.add(ring);
  }
  g.add(pod, zip, strap);
  return g;
}

export function buildProduct(p: Product): THREE.Object3D {
  switch (p.kind) {
    case "tee":
    case "hoodie":
    case "puffer":
    case "longsleeve":
    case "bomber":
      return buildTop(p);
    case "pants":
    case "cargo":
    case "shorts":
    case "skirt":
      return buildBottom(p);
    case "shoe":
      return new THREE.Group(); // filled in asynchronously by the engine
    default:
      return buildAccessory(p);
  }
}
