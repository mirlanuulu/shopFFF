import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { CATEGORIES, type CategoryId, type Product } from "./products";
import { buildProduct, chrome, RAIL_R } from "./builders";

type Item = {
  group: THREE.Group; // placed by the layout
  inner: THREE.Group; // turned to face the viewer
  product: Product;
  swing: number;
  swingV: number;
  hover: number;
  spinT: number; // 0..1 while spinning, otherwise 1
  seed: number;
  size: number; // scale from the chosen size, on a spring
  sizeV: number;
  sizeTo: number;
  hook?: THREE.Object3D;
  mid?: THREE.Object3D;
};

type Stage = {
  id: CategoryId;
  root: THREE.Group;
  items: Item[];
  p: number; // scroll position in item units
  target: number;
  pres: number; // 0..1 presence
  side: number; // which side it slides in from / out to
  rail?: THREE.Object3D;
};

type Callbacks = { onIndex: (cat: CategoryId, i: number) => void };

const TAU = Math.PI * 2;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const smooth = (t: number) => t * t * (3 - 2 * t);
const damp = (cur: number, to: number, rate: number, dt: number) => cur + (to - cur) * (1 - Math.exp(-rate * dt));

export class Engine {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(32, 1, 0.1, 80);
  private stages = new Map<CategoryId, Stage>();
  private active: CategoryId = "tops";
  private raf = 0;
  private last = 0;
  private viewH = 5;
  private baseY = 0;
  private pointer = new THREE.Vector2(0, 0);
  private ptrSmooth = new THREE.Vector2(0, 0);
  private ray = new THREE.Raycaster();
  private hovered = -1;
  private drag: { id: number; x0: number; p0: number; lastX: number; lastT: number; v: number; moved: number } | null = null;
  private reduced = false;
  private ro: ResizeObserver;
  private disposed = false;
  private keyLight: THREE.DirectionalLight;
  private viewW = 3;
  private awake = 120; // frames to keep drawing regardless of motion
  private energy = 0;

  constructor(private canvas: HTMLCanvasElement, private cb: Callbacks) {
    this.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, window.matchMedia("(pointer: coarse)").matches ? 1.5 : 2));
    THREE.DefaultLoadingManager.onLoad = () => (this.awake = 30);
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.75;
    pmrem.dispose();

    this.keyLight = new THREE.DirectionalLight("#fff2e0", 2.4);
    this.keyLight.position.set(2.5, 4, 6);
    const rim = new THREE.DirectionalLight("#3b5bff", 1.8);
    rim.position.set(-5, 2, -3);
    const ember = new THREE.PointLight("#ffd9b8", 6, 12);
    ember.position.set(1.5, -2.2, 2.5);
    this.scene.add(this.keyLight, rim, ember);

    for (const c of CATEGORIES) this.buildStage(c.id, c.products);
    this.stages.get("tops")!.pres = 0; // animates in on load

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas);
    this.resize();
    this.bind();
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  /* ---------- construction ---------- */

  private buildStage(id: CategoryId, products: Product[]) {
    const root = new THREE.Group();
    root.visible = false;
    const items: Item[] = products.map((product, i) => {
      const group = new THREE.Group();
      const inner = new THREE.Group();
      inner.add(buildProduct(product));
      group.add(inner);
      root.add(group);
      group.traverse((o) => (o.userData.item = i));
      return { group, inner, product, swing: 0, swingV: 0, hover: 0, spinT: 1, seed: i * 1.7 + 0.3, size: 1, sizeV: 0, sizeTo: 1 };
    });

    if (id === "tops") {
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(RAIL_R, RAIL_R, RAIL_LEN, 16), chrome());
      rail.rotation.z = Math.PI / 2;
      rail.position.y = RAIL_Y;
      rail.name = "rail";
      root.add(rail);
    }
    if (id === "bottoms") {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(RING_R, RAIL_R, 12, 120), chrome());
      ring.rotation.x = Math.PI / 2;
      ring.position.set(0, RING_Y, -RING_R);
      root.add(ring);
    }
    if (id === "shoes") {
      for (const it of items) {
        const disc = new THREE.Mesh(
          new THREE.CylinderGeometry(0.62, 0.62, 0.03, 64),
          new THREE.MeshPhysicalMaterial({ color: "#ffffff", metalness: 0, roughness: 0.3, transparent: true, opacity: 0.55 })
        );
        disc.position.y = -0.62;
        const halo = new THREE.Mesh(
          new THREE.TorusGeometry(0.64, 0.012, 8, 80),
          new THREE.MeshBasicMaterial({ color: "#2a2422", transparent: true })
        );
        halo.rotation.x = Math.PI / 2;
        halo.position.y = -0.6;
        halo.name = "halo";
        it.group.add(disc, halo);
      }
    }
    this.scene.add(root);
    this.stages.set(id, { id, root, items, p: 0, target: 0, pres: 0, side: 0, rail: root.getObjectByName("rail") });
  }

  /* ---------- public api ---------- */

  setCategory(id: CategoryId) {
    if (id === this.active) return;
    // categories behave like one long strip: the next one arrives from the side its tab is on
    const order = CATEGORIES.map((c) => c.id);
    const dir = Math.sign(order.indexOf(id) - order.indexOf(this.active));
    const next = this.stages.get(id)!;
    this.stages.get(this.active)!.side = -dir;
    next.side = dir;
    for (const it of next.items) it.swingV -= dir * 5;
    this.active = id;
    this.hovered = -1;
  }

  /** k: 0..1 across the size run, or null when nothing is chosen */
  setSize(i: number, k: number | null) {
    const it = this.stages.get(this.active)!.items[i];
    if (!it) return;
    it.sizeTo = k === null ? 1 : 0.93 + 0.14 * k;
    it.sizeV += 1.6; // a small pop even when the size barely changes
  }

  spin() {
    const s = this.stages.get(this.active)!;
    const it = s.items[Math.round(s.target)];
    if (it) it.spinT = 0;
  }

  setIndex(i: number) {
    const s = this.stages.get(this.active)!;
    s.target = clamp(i, 0, s.items.length - 1);
  }

  step(dir: number) {
    const s = this.stages.get(this.active)!;
    this.go(s, Math.round(s.target) + dir);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.unbind();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.geometry.dispose();
    });
    this.renderer.dispose();
  }

  /* ---------- input ---------- */

  private go(s: Stage, i: number) {
    const t = clamp(i, 0, s.items.length - 1);
    if (t !== s.target) {
      s.target = t;
      this.cb.onIndex(s.id, t);
    }
  }

  private pxPerItem() {
    return Math.min(this.canvas.clientWidth * 0.46, 340);
  }

  private pick(clientX: number, clientY: number) {
    const r = this.canvas.getBoundingClientRect();
    const v = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(v, this.camera);
    const hit = this.ray.intersectObject(this.stages.get(this.active)!.root, true)[0];
    let o: THREE.Object3D | null = hit?.object ?? null;
    while (o && typeof o.userData.item !== "number") o = o.parent;
    return o ? (o.userData.item as number) : -1;
  }

  private onDown = (e: PointerEvent) => {
    const s = this.stages.get(this.active)!;
    this.canvas.setPointerCapture(e.pointerId);
    this.drag = { id: e.pointerId, x0: e.clientX, p0: s.p, lastX: e.clientX, lastT: e.timeStamp, v: 0, moved: 0 };
  };

  private onMove = (e: PointerEvent) => {
    const r = this.canvas.getBoundingClientRect();
    this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
    const d = this.drag;
    if (d && d.id === e.pointerId) {
      const s = this.stages.get(this.active)!;
      const dx = e.clientX - d.x0;
      d.moved = Math.max(d.moved, Math.abs(dx));
      let p = d.p0 - dx / this.pxPerItem();
      const max = s.items.length - 1;
      if (p < 0) p *= 0.35;
      if (p > max) p = max + (p - max) * 0.35;
      s.p = p;
      const dt = Math.max(1, e.timeStamp - d.lastT);
      d.v = d.v * 0.6 + ((-(e.clientX - d.lastX) / this.pxPerItem()) / dt) * 1000 * 0.4;
      d.lastX = e.clientX;
      d.lastT = e.timeStamp;
    } else if (e.pointerType === "mouse") {
      this.hovered = this.pick(e.clientX, e.clientY);
      this.canvas.style.cursor = this.hovered >= 0 ? "pointer" : "grab";
    }
  };

  private onUp = (e: PointerEvent) => {
    const d = this.drag;
    if (!d || d.id !== e.pointerId) return;
    this.drag = null;
    const s = this.stages.get(this.active)!;
    if (d.moved < 7) {
      const i = this.pick(e.clientX, e.clientY);
      if (i >= 0) {
        if (i === Math.round(s.target)) s.items[i].spinT = 0;
        else this.go(s, i);
      }
      s.target = clamp(Math.round(s.target), 0, s.items.length - 1);
      return;
    }
    const flick = clamp(d.v * 0.22, -2.4, 2.4);
    this.go(s, Math.round(s.p + flick));
  };

  private onLeave = () => {
    this.hovered = -1;
  };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    this.wheelAcc += d;
    if (Math.abs(this.wheelAcc) > 60) {
      this.step(Math.sign(this.wheelAcc));
      this.wheelAcc = 0;
    }
  };
  private wheelAcc = 0;

  private bind() {
    const c = this.canvas;
    c.addEventListener("pointerdown", this.onDown);
    c.addEventListener("pointermove", this.onMove);
    c.addEventListener("pointerup", this.onUp);
    c.addEventListener("pointercancel", this.onUp);
    c.addEventListener("pointerleave", this.onLeave);
    c.addEventListener("wheel", this.onWheel, { passive: false });
  }

  private unbind() {
    const c = this.canvas;
    c.removeEventListener("pointerdown", this.onDown);
    c.removeEventListener("pointermove", this.onMove);
    c.removeEventListener("pointerup", this.onUp);
    c.removeEventListener("pointercancel", this.onUp);
    c.removeEventListener("pointerleave", this.onLeave);
    c.removeEventListener("wheel", this.onWheel);
  }

  /* ---------- frame ---------- */

  private resize() {
    const w = this.canvas.clientWidth || 1;
    const h = this.canvas.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    this.camera.aspect = aspect;
    // keep ~2.5 world units across on phones, never less than 4.3 units tall
    this.viewH = Math.max(4.3, 2.5 / aspect);
    this.viewW = this.viewH * aspect;
    this.awake = 30;
    const dist = this.viewH / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)));
    this.camera.position.set(0, 0, dist);
    this.camera.updateProjectionMatrix();
    // lift the stage: the lower part of the screen belongs to the controls
    this.baseY = this.viewH * (aspect < 0.8 ? 0.15 : 0.1);
  }

  private tick = (now: number) => {
    this.raf = requestAnimationFrame(this.tick);
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const t = now / 1000;
    this.energy = this.ptrSmooth.distanceTo(this.pointer);
    this.ptrSmooth.lerp(this.pointer, 1 - Math.exp(-6 * dt));

    for (const s of this.stages.values()) {
      const on = s.id === this.active;
      this.energy += Math.abs((on ? 1 : 0) - s.pres);
      s.pres = damp(s.pres, on ? 1 : 0, 5, dt);
      s.root.visible = s.pres > 0.004;
      if (!s.root.visible) continue;
      const e = smooth(clamp(s.pres, 0, 1));
      s.root.position.set(s.side * (1 - e) * (this.viewW + 1.2), this.baseY, -(1 - e) * 1.2);
      // the rail is far longer than the screen, so it travels its whole length and leaves with the clothes
      if (s.rail) s.rail.position.x = s.side * (1 - e) * RAIL_LEN;

      const prev = s.p;
      if (!(on && this.drag)) s.p = damp(s.p, s.target, 8.5, dt);
      const vel = (s.p - prev) / Math.max(dt, 1e-4);
      this.energy += Math.abs(s.p - prev) * 10;
      this.layout(s, vel, dt, t, on);
    }
    // tops and bottoms are still when nobody touches them, so there is nothing to redraw
    const drifting = !this.reduced && (this.active === "shoes" || this.active === "accessories");
    if (this.awake > 0) this.awake--;
    if (this.energy > 0.002 || this.drag || drifting || this.awake > 0) this.renderer.render(this.scene, this.camera);
  };

  private layout(s: Stage, vel: number, dt: number, t: number, on: boolean) {
    const calm = this.reduced ? 0 : 1;
    for (const [i, it] of s.items.entries()) {
      const d = i - s.p;
      const ad = Math.abs(d);
      const w = smooth(clamp(1 - ad, 0, 1)); // focus weight
      it.hover = damp(it.hover, on && this.hovered === i ? 1 : 0, 9, dt);
      const face = Math.max(w, smooth(it.hover));

      // pendulum driven by rail velocity
      it.swingV += (-70 * it.swing - 7 * it.swingV - vel * 9) * dt;
      it.swing = clamp(it.swing + it.swingV * dt, -0.6, 0.6);

      it.sizeV += (-140 * (it.size - it.sizeTo) - 11 * it.sizeV) * dt;
      it.size += it.sizeV * dt;
      this.energy += Math.abs(it.swing) + Math.abs(it.swingV) * 0.05 + Math.abs(it.sizeV) + Math.abs(it.size - it.sizeTo);
      this.energy += Math.abs((on && this.hovered === i ? 1 : 0) - it.hover) * 0.2;
      if (it.spinT < 1) this.energy += 1;
      it.hook ??= it.inner.getObjectByName("hookPivot");
      it.mid ??= it.inner.getObjectByName("mid");
      if (it.mid) it.mid.visible = ad < 2.2;

      if (it.spinT < 1) it.spinT = Math.min(1, it.spinT + dt / 0.95);
      const spin = smooth(it.spinT) * TAU;
      const look = face * this.ptrSmooth.x * 0.32;
      const g = it.group;
      const n = it.inner;

      switch (s.id) {
        case "tops": {
          // straight rail: garments hang edge-on, the one in focus turns to the viewer
          g.position.set(d * 1.12, RAIL_Y, 0);
          n.rotation.set(0, 1.28 * (1 - face) + look + spin, it.swing * 0.5 * calm);
          g.scale.setScalar((0.92 + face * 0.1) * it.size);
          if (it.hook) it.hook.rotation.y = Math.PI / 2 - n.rotation.y; // stays across the rail
          g.visible = ad < 4;
          break;
        }
        case "bottoms": {
          // dry-cleaner carousel: a ring that carries trousers around to the front
          const a = d * 0.42;
          g.position.set(Math.sin(a) * RING_R, RING_Y, Math.cos(a) * RING_R - RING_R);
          n.rotation.set(0, a + 1.2 * (1 - face) + look + spin, it.swing * 0.45 * calm);
          g.scale.setScalar((0.9 + face * 0.06) * it.size);
          if (it.hook) it.hook.rotation.y = a + Math.PI / 2 - n.rotation.y; // stays across the ring
          g.visible = Math.abs(a) < Math.PI * 0.9;
          break;
        }
        case "shoes": {
          // levitation: shoes rest in profile on a disc; in focus one lifts and turns its toe to you
          const bob = Math.sin(t * 1.3 + it.seed) * 0.05 * calm;
          g.position.set(d * 1.3, -0.1 - Math.min(ad, 2) * 0.22, -Math.min(ad, 3) * 0.9);
          n.position.y = face * 0.34 + bob;
          n.rotation.set(0, (1 - face) * 1.05 + look * 1.2 + spin, it.swing * 0.2);
          n.scale.setScalar((0.86 + face * 0.2) * it.size);
          const halo = g.getObjectByName("halo") as THREE.Mesh | undefined;
          if (halo) (halo.material as THREE.MeshBasicMaterial).opacity = 0.15 + face * 0.85;
          g.visible = ad < 4;
          break;
        }
        default: {
          // zero gravity: objects drift and tumble; in focus one steadies and faces you
          const free = (1 - face) * calm;
          g.position.set(d * 1.2, Math.sin(d * 1.25) * 0.55 + Math.sin(t * 0.7 + it.seed) * 0.08 * calm, -Math.min(ad, 3) * 0.85 + face * 0.4);
          n.rotation.set(
            free * Math.sin(t * 0.5 + it.seed) * 0.35,
            free * (t * 0.45 + it.seed * 2) + look * 1.3 + spin,
            free * Math.sin(t * 0.35 + it.seed) * 0.5 + it.swing * 0.25
          );
          g.scale.setScalar((0.72 + face * 0.42) * it.size);
          g.visible = ad < 4;
        }
      }
    }
  }
}

const RING_R = 2.5;
const RAIL_Y = 1.18;
const RAIL_LEN = 18;
const RING_Y = 1.36;
