import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { Product } from "./products";

export const chrome = () => new THREE.MeshStandardMaterial({ color: "#f4f1ec", metalness: 1, roughness: 0.2 });

/** Радиус трубы, на которой висят вешалки. */
export const RAIL_R = 0.024;
const HOOK_R = 0.06;
const WIRE = 0.013;
/** Расстояние от центра трубы до точки, где начинается вещь. */
const HANG = 0.28;

function bend(geo: THREE.BufferGeometry, k: number) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    p.setZ(i, p.getZ(i) - x * x * k);
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Вешалка. Начало координат — центр трубы: крючок лежит на ней сверху.
 * Дуга крючка вынесена в "hookPivot", чтобы сцена держала её поперёк трубы,
 * пока сама вещь поворачивается к зрителю.
 */
function hanger(clipWidth?: number) {
  const mat = chrome();
  const g = new THREE.Group();
  const pivot = new THREE.Group();
  pivot.name = "hookPivot";
  const arc = new THREE.Mesh(new THREE.TorusGeometry(HOOK_R, WIRE, 10, 28, Math.PI * 1.45), mat);
  arc.position.y = RAIL_R - (HOOK_R - WIRE);
  arc.rotation.z = -Math.PI / 2;
  pivot.add(arc);
  const stemTop = arc.position.y - HOOK_R;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(WIRE, WIRE, HANG + stemTop, 10), mat);
  stem.position.y = (stemTop - HANG) / 2;
  g.add(pivot, stem);
  if (clipWidth) {
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, clipWidth, 10), mat);
    bar.rotation.z = Math.PI / 2;
    bar.position.y = -HANG;
    g.add(bar);
    for (const s of [-1, 1]) {
      const clip = new THREE.Mesh(new RoundedBoxGeometry(0.08, 0.12, 0.13, 3, 0.02), mat);
      clip.position.set(s * clipWidth * 0.38, -HANG - 0.05, 0);
      g.add(clip);
    }
  }
  return g;
}

const textures = new THREE.TextureLoader();
const LAYERS = 10;
const THICK = 0.06;

/**
 * Вырезанное фото товара с объёмом: изогнуто как ткань и сложено из слоёв,
 * поэтому при повороте у вещи видно ребро. Средние слои лежат в группе "mid" —
 * сцена прячет их у дальних вещей.
 */
export function buildProduct(p: Product): THREE.Object3D {
  const g = new THREE.Group();
  const body = new THREE.Group();
  const mid = new THREE.Group();
  mid.name = "mid";
  body.add(mid);
  g.add(body);
  const hung = p.hang !== "none";
  body.position.y = hung ? -HANG - p.h / 2 + (p.hang === "hook" ? 0.03 : -0.02) : 0;
  const k = p.hang === "hook" ? 0.16 : p.hang === "clip" ? 0.07 : 0.04;

  textures.load(p.image, (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const img = tex.image as { width: number; height: number };
    const w = (p.h * img.width) / img.height;
    if (hung) g.add(hanger(p.hang === "clip" ? w * 0.85 : undefined));
    const geo = bend(new THREE.PlaneGeometry(w, p.h, 16, 1), k);
    const faceMat = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.5, alphaToCoverage: true, side: THREE.DoubleSide, roughness: 0.85 });
    const edgeMat = new THREE.MeshStandardMaterial({ map: tex, color: "#6f6a66", alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.85 });
    for (let i = 0; i < LAYERS; i++) {
      const face = i === 0 || i === LAYERS - 1;
      const m = new THREE.Mesh(geo, face ? faceMat : edgeMat);
      m.position.z = THICK / 2 - (i * THICK) / (LAYERS - 1);
      (face ? body : mid).add(m);
    }
  });
  return g;
}
