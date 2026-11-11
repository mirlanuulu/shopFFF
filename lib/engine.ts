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
  turn: number; // free rotation while the product card is open
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

type Callbacks = { onIndex: (cat: CategoryId, i: number) => void; onOpen: () => void; onSwipe: (dir: "up" | "down") => void; onIntro: (phase: "clear" | "done") => void };

const TAU = Math.PI * 2;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const smooth = (t: number) => t * t * (3 - 2 * t);
const damp = (cur: number, to: number, rate: number, dt: number) => cur + (to - cur) * (1 - Math.exp(-rate * dt));

export class Engine {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 80);
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
  private drag: { id: number; x0: number; y0: number; p0: number; turn0: number; lastX: number; lastT: number; v: number; moved: number } | null = null;
  private reduced = false;
  private ro: ResizeObserver;
  private disposed = false;
  private keyLight: THREE.DirectionalLight;
  private viewW = 3;
  private awake = 120; // frames to keep drawing regardless of motion
  private energy = 0;
  private detail = false;
  private dm = 0; // 0..1, how far the product card is open
  private blur = -1;
  private dist = 9;
  private introT = -1; // seconds into the intro, -1 when it is not playing
  private introSpeed = 1;
  private introPhase = 0;
  private depot: THREE.Group | null = null;

  constructor(private canvas: HTMLCanvasElement, private cb: Callbacks, intro = false) {
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
    if (intro && !this.reduced) this.startIntro();

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
      return { group, inner, product, swing: 0, swingV: 0, hover: 0, spinT: 1, seed: i * 1.7 + 0.3, size: 1, sizeV: 0, sizeTo: 1, turn: 0 };
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

  /* ---------- intro: a flight down the warehouse aisle to the showroom ---------- */

  private startIntro() {
    this.introT = 0;
    this.stages.get("tops")!.side = 1; // the first rail rides in from the right at the end
    this.scene.fog = new THREE.Fog("#e9e2d6", 3, 16);
    this.canvas.style.filter = `blur(${INTRO_BLUR}px)`;

    // two storeys of conveyor rails on both sides of the aisle, all of it behind where the camera will stop
    const depot = new THREE.Group();
    const loader = new THREE.TextureLoader();
    const tops = CATEGORIES[0].products;
    const metal = chrome();
    const stemGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.3, 6);
    let n = 0;
    for (const [x, y, step] of [[-1.25, 2.1, 1.25], [1.25, 2.1, 1.25], [-2.7, 3.9, 1.6], [2.7, 3.9, 1.6]] as const) {
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(RAIL_R, RAIL_R, AISLE + 6, 10), metal);
      rail.rotation.x = Math.PI / 2;
      rail.position.set(x, y, AISLE / 2);
      depot.add(rail);
      for (let z = 1.2; z < AISLE + 4; z += step) {
        const p = tops[n++ % tops.length];
        const h = p.h * 0.95;
        const hang = new THREE.Group();
        hang.position.set(x, y, z + (n % 3) * 0.2);
        hang.rotation.y = -Math.sign(x) * 0.45;
        hang.userData.seed = n * 1.3;
        const stem = new THREE.Mesh(stemGeo, metal);
        stem.position.y = -0.15;
        hang.add(stem);
        loader.load(p.image, (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          const img = tex.image as { width: number; height: number };
          const m = new THREE.Mesh(
            new THREE.PlaneGeometry((h * img.width) / img.height, h),
            new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9 })
          );
          m.position.y = -0.28 - h / 2;
          hang.add(m);
        });
        depot.add(hang);
      }
    }
    this.depot = depot;
    this.scene.add(depot);
  }

  skipIntro() {
    if (this.introT >= 0) this.introSpeed = 7;
  }

  private stepIntro(dt: number, t: number) {
    this.introT += dt * this.introSpeed;
    const T = this.introT;
    const e = smooth(clamp(T / INTRO_FLY, 0, 1));
    const fly = 1 - e;
    // wide lens and speed at the start, the showroom's own lens and stillness at the end
    this.camera.fov = FOV + 40 * fly;
    this.camera.position.set(Math.sin(T * 1.7) * 0.12 * fly, 0.9 * fly, this.dist + AISLE * fly);
    this.camera.rotation.set(-0.05 * fly, 0, Math.sin(T * 1.3) * 0.035 * fly);
    this.camera.updateProjectionMatrix();
    const fog = this.scene.fog as THREE.Fog;
    fog.far = 16 + 120 * e * e;
    if (this.depot) {
      this.depot.position.z = this.dist + 0.6;
      // the conveyors keep running: clothes travel toward the viewer and sway on their hooks
      for (const o of this.depot.children) {
        if (o.userData.seed === undefined) continue;
        o.position.z += dt * 1.4;
        o.rotation.z = Math.sin(t * 3 + o.userData.seed) * 0.06;
      }
    }
    const k = 1 - smooth(clamp((T - INTRO_CLEAR) / 1.0, 0, 1));
    this.canvas.style.filter = k > 0.01 ? `blur(${(k * INTRO_BLUR).toFixed(1)}px)` : "";
    if (this.introPhase === 0 && T >= INTRO_CLEAR) {
      this.introPhase = 1;
      this.cb.onIntro("clear");
    }
    if (T >= INTRO_FLY + 0.25) {
      this.introT = -1;
      this.blur = -1;
      this.scene.fog = null;
      if (this.depot) {
        this.scene.remove(this.depot);
        this.depot.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
        this.depot = null;
      }
      this.camera.fov = FOV;
      this.camera.rotation.set(0, 0, 0);
      this.resize();
      this.cb.onIntro("done");
    }
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

  /** Product card: the thing moves up, its neighbours step aside, dragging turns it. */
  setDetail(open: boolean) {
    this.detail = open;
    if (!open) for (const s of this.stages.values()) for (const it of s.items) it.turn = ((((it.turn + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
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
    const it = s.items[Math.round(s.target)];
    this.drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, p0: s.p, turn0: it?.turn ?? 0, lastX: e.clientX, lastT: e.timeStamp, v: 0, moved: 0 };
  };

  private onMove = (e: PointerEvent) => {
    const r = this.canvas.getBoundingClientRect();
    this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
    const d = this.drag;
    if (d && d.id === e.pointerId) {
      const s = this.stages.get(this.active)!;
      const dx = e.clientX - d.x0;
      d.moved = Math.max(d.moved, Math.abs(dx));
      if (this.detail) {
        const it = s.items[Math.round(s.target)];
        if (it) it.turn = d.turn0 + dx * 0.012;
        return;
      }
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
    // a vertical swipe over the scene opens the product card (up) or folds it (down)
    const dy = e.clientY - d.y0;
    if (Math.abs(dy) > 44 && Math.abs(dy) > Math.abs(e.clientX - d.x0) * 1.4) {
      if (!this.detail) s.target = clamp(Math.round(s.target), 0, s.items.length - 1);
      this.cb.onSwipe(dy < 0 ? "up" : "down");
      return;
    }
    if (d.moved < 7) {
      const i = this.pick(e.clientX, e.clientY);
      if (i >= 0) {
        if (this.detail) s.items[Math.round(s.target)].spinT = 0;
        else if (i === Math.round(s.target)) this.cb.onOpen();
        else this.go(s, i);
      }
      s.target = clamp(Math.round(s.target), 0, s.items.length - 1);
      return;
    }
    if (this.detail) return;
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
    this.dist = this.viewH / (2 * Math.tan(THREE.MathUtils.degToRad(FOV / 2)));
    this.camera.position.set(0, 0, this.dist);
    this.camera.updateProjectionMatrix();
    // lift the stage: the lower part of the screen belongs to the controls
    this.baseY = this.viewH * (aspect < 0.8 ? 0.15 : 0.1);
  }

  private tick = (now: number) => {
    this.raf = requestAnimationFrame(this.tick);
    // the first frame can carry a timestamp from before the engine was built, so never step backwards
    const dt = clamp((now - this.last) / 1000, 0, 0.05);
    this.last = now;
    const t = now / 1000;
    this.energy = this.ptrSmooth.distanceTo(this.pointer);
    this.ptrSmooth.lerp(this.pointer, 1 - Math.exp(-6 * dt));

    const dmTo = this.detail ? 1 : 0;
    this.energy += Math.abs(dmTo - this.dm);
    this.dm = Math.abs(dmTo - this.dm) < 0.001 ? dmTo : damp(this.dm, dmTo, 7, dt);

    const intro = this.introT >= 0;
    if (intro) this.stepIntro(dt, t);
    const hold = this.introT >= 0 && this.introT < INTRO_RIDE; // the showroom waits for the camera

    for (const s of this.stages.values()) {
      const on = s.id === this.active && !hold;
      this.energy += Math.abs((on ? 1 : 0) - s.pres);
      s.pres = damp(s.pres, on ? 1 : 0, 5, dt);
      s.root.visible = s.pres > 0.004;
      if (!s.root.visible) continue;
      const e = smooth(clamp(s.pres, 0, 1));
      // far enough that the ring and the neighbouring clothes are off screen before the stage is switched off
      const dm = on ? this.dm : 0;
      s.root.position.set(s.side * (1 - e) * (this.viewW / 2 + 5.5), this.baseY + (this.viewH * 0.285 - this.baseY) * dm, -(1 - e) * 1.2);
      s.root.scale.setScalar(1 - 0.4 * dm);
      // the rail is far longer than the screen, so it travels its whole length and leaves with the clothes
      if (s.rail) s.rail.position.x = s.side * (1 - e) * RAIL_LEN;

      const prev = s.p;
      if (!(on && this.drag)) s.p = damp(s.p, s.target, 8.5, dt);
      const vel = (s.p - prev) / Math.max(dt, 1e-4);
      this.energy += Math.abs(s.p - prev) * 10;
      this.layout(s, vel, dt, t, on);
    }
    // while categories change places the whole scene goes soft, like motion blur
    const act = this.stages.get(this.active)!;
    const ea = smooth(clamp(act.pres, 0, 1));
    const k = this.reduced ? 0 : Math.round(4 * ea * (1 - ea) * 20) / 20;
    if (!intro && this.introT < 0 && k !== this.blur) {
      this.blur = k;
      this.canvas.style.filter = k > 0 ? `blur(${(k * 14).toFixed(1)}px)` : "";
      this.canvas.style.opacity = String(1 - 0.3 * k);
    }

    // tops and bottoms are still when nobody touches them, so there is nothing to redraw
    const drifting = !this.reduced && (this.active === "shoes" || this.active === "accessories");
    if (this.awake > 0) this.awake--;
    if (this.energy > 0.002 || this.drag || drifting || intro || this.awake > 0) this.renderer.render(this.scene, this.camera);
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
      const focused = on && i === Math.round(s.target);
      if (!this.detail && it.turn !== 0) {
        this.energy += Math.abs(it.turn);
        it.turn = Math.abs(it.turn) < 0.002 ? 0 : damp(it.turn, 0, 7, dt);
      }
      const spin = smooth(it.spinT) * TAU + it.turn;
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
      if (on && this.dm > 0 && !focused) g.position.x += Math.sign(d || 1) * this.dm * 5;
    }
  }
}

const RING_R = 2.5;
const RAIL_Y = 1.18;
const RAIL_LEN = 18;
const FOV = 32;
const AISLE = 17; // length of the intro flight
const INTRO_FLY = 3.3; // seconds until the camera stops
const INTRO_CLEAR = 1.4; // when the frosted glass starts to clear
const INTRO_RIDE = 2.0; // when the first rail rides in
const INTRO_BLUR = 16;
const RING_Y = 1.36;
