import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { CATEGORIES, type CategoryId, type Product } from "./products";
import { buildProduct, chrome, HOOK_TOP } from "./builders";

type Item = {
  group: THREE.Group; // placed by the layout
  inner: THREE.Group; // turned to face the viewer
  product: Product;
  swing: number;
  swingV: number;
  hover: number;
  spinT: number; // 0..1 while spinning, otherwise 1
  seed: number;
};

type Stage = {
  id: CategoryId;
  root: THREE.Group;
  items: Item[];
  p: number; // scroll position in item units
  target: number;
  pres: number; // 0..1 presence
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

  constructor(private canvas: HTMLCanvasElement, private cb: Callbacks) {
    this.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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
    const ember = new THREE.PointLight("#ff5a1f", 14, 12);
    ember.position.set(1.5, -2.2, 2.5);
    this.scene.add(this.keyLight, rim, ember);

    for (const c of CATEGORIES) this.buildStage(c.id, c.products);
    this.stages.get("tops")!.pres = 0; // animates in on load
    this.loadShoes();

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
      return { group, inner, product, swing: 0, swingV: 0, hover: 0, spinT: 1, seed: i * 1.7 + 0.3 };
    });

    if (id === "tops") {
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 40, 16), chrome());
      rail.rotation.z = Math.PI / 2;
      rail.position.y = 0.9 + HOOK_TOP - 0.045;
      root.add(rail);
    }
    if (id === "bottoms") {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(RING_R, 0.024, 12, 120), chrome());
      ring.rotation.x = Math.PI / 2;
      ring.position.set(0, 1.08 + HOOK_TOP - 0.045, -RING_R);
      root.add(ring);
    }
    if (id === "shoes") {
      for (const it of items) {
        const disc = new THREE.Mesh(
          new THREE.CylinderGeometry(0.62, 0.62, 0.03, 64),
          new THREE.MeshPhysicalMaterial({ color: "#1b0c0a", metalness: 0.9, roughness: 0.25, clearcoat: 1 })
        );
        disc.position.y = -0.62;
        const halo = new THREE.Mesh(
          new THREE.TorusGeometry(0.64, 0.012, 8, 80),
          new THREE.MeshBasicMaterial({ color: "#ff5a1f", transparent: true })
        );
        halo.rotation.x = Math.PI / 2;
        halo.position.y = -0.6;
        halo.name = "halo";
        it.group.add(disc, halo);
      }
    }
    this.scene.add(root);
    this.stages.set(id, { id, root, items, p: 0, target: 0, pres: 0 });
  }

  private async loadShoes() {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    let gltf: GLTF;
    try {
      gltf = await loader.loadAsync("/models/shoe.glb");
    } catch (e) {
      console.warn("shoe model failed to load", e);
      return;
    }
    if (this.disposed) return;
    const ext = (gltf.parser.json.extensions?.KHR_materials_variants?.variants ?? []) as { name: string }[];
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const scale = 1.45 / Math.max(size.x, size.y, size.z);
    // the model's long axis should run along X so the resting pose is a profile view
    const longZ = size.z > size.x;

    const stage = this.stages.get("shoes")!;
    for (const [i, it] of stage.items.entries()) {
      const model = gltf.scene.clone(true);
      const vi = ext.findIndex((v) => v.name === it.product.variant);
      const jobs: Promise<void>[] = [];
      model.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const maps = mesh.userData.gltfExtensions?.KHR_materials_variants?.mappings as
          | { material: number; variants: number[] }[]
          | undefined;
        const m = maps?.find((x) => x.variants.includes(vi));
        const apply = (mat: THREE.Material) => {
          if (it.product.tint) {
            const c = (mat as THREE.MeshStandardMaterial).clone();
            c.color.multiply(new THREE.Color(it.product.tint));
            mesh.material = c;
          } else mesh.material = mat;
        };
        if (m) jobs.push(gltf.parser.getDependency("material", m.material).then(apply));
        else if (it.product.tint) apply(mesh.material as THREE.Material);
      });
      await Promise.all(jobs);
      model.position.sub(center).multiplyScalar(scale);
      model.scale.setScalar(scale);
      const holder = new THREE.Group();
      holder.add(model);
      if (longZ) holder.rotation.y = Math.PI / 2;
      holder.traverse((o) => (o.userData.item = i));
      it.inner.add(holder);
    }
  }

  /* ---------- public api ---------- */

  setCategory(id: CategoryId) {
    this.active = id;
    this.hovered = -1;
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
    return hit && typeof hit.object.userData.item === "number" ? (hit.object.userData.item as number) : -1;
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
    this.ptrSmooth.lerp(this.pointer, 1 - Math.exp(-6 * dt));

    for (const s of this.stages.values()) {
      const on = s.id === this.active;
      s.pres = damp(s.pres, on ? 1 : 0, on ? 4.2 : 6.5, dt);
      s.root.visible = s.pres > 0.004;
      if (!s.root.visible) continue;
      const e = smooth(clamp(s.pres, 0, 1));
      s.root.position.set(0, this.baseY + (on ? -(1 - e) * 1.4 : (1 - e) * 2.2), -(1 - e) * 6);
      s.root.scale.setScalar(0.55 + 0.45 * e);

      const prev = s.p;
      if (!(on && this.drag)) s.p = damp(s.p, s.target, 8.5, dt);
      const vel = (s.p - prev) / Math.max(dt, 1e-4);
      this.layout(s, vel, dt, t, on);
    }
    this.renderer.render(this.scene, this.camera);
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

      if (it.spinT < 1) it.spinT = Math.min(1, it.spinT + dt / 0.95);
      const spin = smooth(it.spinT) * TAU;
      const look = face * this.ptrSmooth.x * 0.32;
      const g = it.group;
      const n = it.inner;

      switch (s.id) {
        case "tops": {
          // straight rail: garments hang edge-on, the one in focus turns to the viewer
          g.position.set(d * 1.12, 0.9, -Math.min(ad, 3) * 0.12 + face * 0.35);
          n.rotation.set(0, 1.28 * (1 - face) + look + spin, it.swing * 0.5 * calm);
          n.rotation.x = Math.abs(it.swing) * 0.15;
          g.scale.setScalar(0.92 + face * 0.1);
          g.visible = ad < 6;
          break;
        }
        case "bottoms": {
          // dry-cleaner carousel: a ring that carries trousers around to the front
          const a = d * 0.42;
          g.position.set(Math.sin(a) * RING_R, 1.08, Math.cos(a) * RING_R - RING_R + face * 0.3);
          n.rotation.set(0, a + 1.2 * (1 - face) + look + spin, it.swing * 0.45 * calm);
          g.scale.setScalar(0.9 + face * 0.06);
          g.visible = Math.abs(a) < Math.PI * 0.9;
          break;
        }
        case "shoes": {
          // levitation: shoes rest in profile on a disc; in focus one lifts and turns its toe to you
          const bob = Math.sin(t * 1.3 + it.seed) * 0.05 * calm;
          g.position.set(d * 1.3, -0.1 - Math.min(ad, 2) * 0.22, -Math.min(ad, 3) * 0.9);
          n.position.y = face * 0.34 + bob;
          n.rotation.set(face * 0.22, face * -0.85 + look * 1.4 + spin + (1 - face) * Math.sin(t * 0.4 + it.seed) * 0.12 * calm, face * 0.08 + it.swing * 0.2);
          n.scale.setScalar(0.86 + face * 0.2);
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
            free * (0.5 + Math.sin(t * 0.5 + it.seed) * 0.5) + face * 0.12,
            free * (t * 0.45 + it.seed * 2) + face * -0.35 + look * 1.3 + spin,
            free * Math.sin(t * 0.35 + it.seed) * 0.5 + it.swing * 0.25
          );
          g.scale.setScalar(0.72 + face * 0.42);
          g.visible = ad < 4;
        }
      }
    }
  }
}

const RING_R = 2.5;
