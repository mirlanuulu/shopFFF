"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Engine } from "@/lib/engine";
import Cart, { type CartLine } from "./Cart";
import Dots from "./Dots";
import { fx, setMuted } from "@/lib/feedback";
import { CATEGORIES, formatPrice, type CategoryId } from "@/lib/products";

export default function Shop() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const [cat, setCat] = useState<CategoryId>("tops");
  const [indexes, setIndexes] = useState<Record<CategoryId, number>>({
    tops: 0,
    bottoms: 0,
    shoes: 0,
    accessories: 0,
  });
  const [sizes, setSizes] = useState<Record<string, string>>({});
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [added, setAdded] = useState(false);
  const [open, setOpen] = useState(false);
  const [muted, setMute] = useState(false);
  const quiet = useRef(true); // no sounds for the state the page loads with
  const [fly, setFly] = useState<{
    key: number;
    src: string;
    dx: number;
    dy: number;
  } | null>(null);
  const cartRef = useRef<HTMLButtonElement>(null);
  const cartOpenRef = useRef(false);
  const dockDrag = useRef<{ x: number; y: number; scroll: boolean } | null>(
    null,
  );
  useEffect(() => {
    cartOpenRef.current = cartOpen;
  }, [cartOpen]);
  const [nudge, setNudge] = useState(false);
  const [touched, setTouched] = useState(false);
  const [webgl, setWebgl] = useState(true);
  // pending: решаем, показывать ли интро; play: матовое стекло; clear: стекло оттаивает; off: обычная витрина
  const [intro, setIntro] = useState<"pending" | "play" | "clear" | "off">(
    "pending",
  );
  const [morph, setMorph] = useState<{
    frost: React.CSSProperties;
    logo: React.CSSProperties;
  } | null>(null);
  const dockRef = useRef<HTMLElement>(null);
  const markRef = useRef<HTMLSpanElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);

  const category = useMemo(() => CATEGORIES.find((c) => c.id === cat)!, [cat]);
  const index = indexes[cat];
  const product = category.products[index];
  const size =
    product.sizes.length === 1 ? product.sizes[0] : sizes[product.id];
  const count = cart.reduce((n, l) => n + l.qty, 0);

  useEffect(() => {
    let engine: Engine | undefined;
    let dead = false;
    import("@/lib/engine")
      .then(({ Engine }) => {
        if (dead || !canvasRef.current) return;
        // интро играет при каждом открытии сайта, кроме случая, когда в системе отключены анимации
        const play = !window.matchMedia("(prefers-reduced-motion: reduce)")
          .matches;
        setIntro(play ? "play" : "off");
        const options = {
          onIntro: (phase: "clear" | "done") => {
            if (phase === "done") return setIntro("off");
            // стекло сжимается в нижнюю панель, логотип уезжает на своё место в шапке
            const d = dockRef.current?.getBoundingClientRect();
            const m = markRef.current?.getBoundingClientRect();
            const l = logoRef.current?.getBoundingClientRect();
            if (d && m && l) {
              const k = m.height / l.height;
              setMorph({
                frost: {
                  top: d.top,
                  left: d.left,
                  width: d.width,
                  height: d.height,
                  borderRadius: 36,
                },
                logo: {
                  transform: `translate(${m.left + m.width / 2 - (l.left + l.width / 2)}px, ${m.top + m.height / 2 - (l.top + l.height / 2)}px) scale(${k})`,
                  opacity: 0,
                },
              });
            }
            setIntro("clear");
          },
          onOpen: () => setOpen(true),
          onSwipe: (dir: "up" | "down") => setOpen(dir === "up"),
          onIndex: (c: CategoryId, i: number) => {
            fx("tick");
            setIndexes((s) => ({ ...s, [c]: i }));
            setTouched(true);
          },
        };
        engine = new Engine(canvasRef.current, options, play);
        engineRef.current = engine;
      })
      .catch(() => {
        setWebgl(false);
        setIntro("off");
      });
    return () => {
      dead = true;
      engine?.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" && !cartOpenRef.current)
        engineRef.current?.step(1);
      if (e.key === "ArrowLeft" && !cartOpenRef.current)
        engineRef.current?.step(-1);
      if (e.key === "Escape") {
        setCartOpen(false);
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    engineRef.current?.setDetail(open);
    if (!quiet.current) fx(open ? "open" : "close");
  }, [open]);

  useEffect(() => {
    if (!quiet.current) fx(cartOpen ? "open" : "close");
    quiet.current = false;
  }, [cartOpen]);

  const pickSize = (s: string) => {
    setSizes((v) => ({ ...v, [product.id]: s }));
    const n = product.sizes.length;
    const k = n > 1 ? product.sizes.indexOf(s) / (n - 1) : null;
    engineRef.current?.setSize(index, k);
    fx("size", k ?? 0.5);
  };

  const chooseCategory = useCallback((id: CategoryId) => {
    setOpen(false);
    fx("swap");
    setCat(id);
    engineRef.current?.setCategory(id);
  }, []);

  const add = () => {
    if (!size) {
      fx("deny");
      setNudge(true);
      setTimeout(() => setNudge(false), 500);
      return;
    }
    const key = product.id + "/" + size;
    setCart((c) => {
      const hit = c.find((l) => l.key === key);
      return hit
        ? c.map((l) => (l === hit ? { ...l, qty: l.qty + 1 } : l))
        : [...c, { key, product, size, qty: 1 }];
    });
    // the thing itself flies into the cart, so it is obvious where it went
    const r = cartRef.current?.getBoundingClientRect();
    if (r) {
      const x = window.innerWidth / 2;
      const y = window.innerHeight * 0.32;
      setFly({
        key: Date.now(),
        src: product.image,
        dx: r.left + r.width / 2 - x,
        dy: r.top + r.height / 2 - y,
      });
    }
    engineRef.current?.spin();
    fx("add");
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <main
      className={
        "shop" +
        (open ? " detail" : "") +
        (cartOpen ? " carting" : "") +
        ` intro-${intro}`
      }
    >
      <div className="bg" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </div>
      <div
        className="ghost"
        key={cat + (intro === "off" || intro === "clear")}
        style={{ "--n": category.ghost.length } as React.CSSProperties}
        aria-hidden="true"
      >
        {category.ghost}
      </div>

      <canvas
        ref={canvasRef}
        className="stage"
        aria-label={`Витрина: ${category.label}. Листайте влево и вправо.`}
      />
      {!webgl && (
        <p className="nogl">
          Браузер не поддерживает 3D. Откройте сайт в свежем Chrome или Safari.
        </p>
      )}

      <header className="top">
        <span className="mark" ref={markRef}>
          FFF
        </span>
        <div className="tools">
          <button
            className="mute"
            aria-pressed={!muted}
            aria-label="Звук"
            onClick={() => {
              setMuted(!muted);
              setMute(!muted);
              if (muted) fx("tick");
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 9.5v5h3.5L12 18V6L7.5 9.5z" />
              {muted ? (
                <path d="M16 9.5l5 5M21 9.5l-5 5" />
              ) : (
                <path d="M15.5 9a4.5 4.5 0 010 6M18 6.5a8 8 0 010 11" />
              )}
            </svg>
          </button>
          <button
            ref={cartRef}
            className="cartbtn"
            onClick={() => setCartOpen(true)}
            aria-label={`Корзина, товаров: ${count}`}
          >
            Корзина{" "}
            <b key={count} className={count ? "bump" : ""}>
              {count}
            </b>
          </button>
        </div>
      </header>

      {!touched && !open && (
        <p className="swipe" aria-hidden="true">
          Листайте в сторону
        </p>
      )}

      <section
        ref={dockRef}
        className={
          "dock" + (open ? " open" : "") + (category.guide ? " guided" : "")
        }
        onPointerDown={(e) => {
          const sc = (e.target as HTMLElement).closest(".scroll");
          dockDrag.current = {
            x: e.clientX,
            y: e.clientY,
            scroll: !!sc && sc.scrollHeight > sc.clientHeight,
          };
        }}
        onPointerUp={(e) => {
          // смахнуть панель вверх — открыть карточку, вниз — свернуть
          const d = dockDrag.current;
          dockDrag.current = null;
          if (!d || d.scroll) return;
          const dy = e.clientY - d.y;
          if (
            Math.abs(dy) > 36 &&
            Math.abs(dy) > Math.abs(e.clientX - d.x) * 1.3
          )
            setOpen(dy < 0);
        }}
      >
        <button
          className="more"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <i aria-hidden="true" />
          {open ? "Свернуть" : "Подробнее"}
        </button>
        <div className="info" key={product.id}>
          <div className="title">
            <h1>{product.name}</h1>
            <p>{product.note}</p>
          </div>
          <div className="meta">
            <strong aria-label={formatPrice(product.price)}>
              <Dots
                text={formatPrice(product.price).replace(" сом", "")}
                height={19}
              />
              <small>сом</small>
            </strong>
            <span>
              {index + 1} из {category.products.length}
            </span>
          </div>
        </div>

        <div className="details" aria-hidden={!open}>
          <div className="scroll" key={product.id}>
            <p className="turn">Потяните вещь в сторону, чтобы повернуть её.</p>
            <dl>
              <dt>Состав</dt>
              <dd>{product.material}</dd>
              <dt>Уход</dt>
              <dd>{category.care}</dd>
            </dl>
            {category.guide && (
              <table>
                <caption>Размеры, см</caption>
                <thead>
                  <tr>
                    <th scope="col">Размер</th>
                    {category.guide.cols.map((c) => (
                      <th scope="col" key={c}>
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {product.sizes.map((s) => (
                    <tr
                      key={s}
                      className={size === s ? "on" : ""}
                      onClick={() => pickSize(s)}
                    >
                      <th scope="row">
                        <Dots text={s} height={14} />
                      </th>
                      {category.guide!.rows[s].map((n, i) => (
                        <td key={i}>{String(n).replace(".", ",")}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div
          className={"sizes" + (nudge ? " nudge" : "")}
          role="radiogroup"
          aria-label="Размер"
        >
          {product.sizes.map((s) => (
            <button
              key={s}
              role="radio"
              aria-checked={size === s}
              className={size === s ? "on" : ""}
              aria-label={s}
              onClick={() => pickSize(s)}
            >
              <Dots text={s === "Один размер" ? "ONE" : s} height={20} grid />
            </button>
          ))}
        </div>

        <div className="actions">
          <button
            className="arrow"
            onClick={() => engineRef.current?.step(-1)}
            disabled={index === 0}
            aria-label="Предыдущая вещь"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
          <button className={"add" + (added ? " ok" : "")} onClick={add}>
            {added ? (
              <>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
                В корзине
              </>
            ) : size ? (
              "Добавить в корзину"
            ) : (
              "Выберите размер"
            )}
          </button>
          <button
            className="arrow"
            onClick={() => engineRef.current?.step(1)}
            disabled={index === category.products.length - 1}
            aria-label="Следующая вещь"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <nav className="cats" aria-label="Категории">
          <span
            className="pill"
            style={{
              transform: `translateX(${CATEGORIES.findIndex((c) => c.id === cat) * 100}%)`,
            }}
            aria-hidden="true"
          />
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              className={c.id === cat ? "on" : ""}
              aria-current={c.id === cat}
              onClick={() => chooseCategory(c.id)}
            >
              {c.label}
            </button>
          ))}
        </nav>
      </section>

      {(intro === "play" || intro === "clear") && (
        <div
          className="intro"
          onPointerDown={() => engineRef.current?.skipIntro()}
        >
          <div className="frost" style={morph?.frost} />
          <div className="logo" ref={logoRef} style={morph?.logo}>
            <Dots text="FFF" height={84} gather />
          </div>
          {intro === "play" && (
            <p className="skip">Коснитесь, чтобы пропустить</p>
          )}
        </div>
      )}

      <div className="sr" role="status">
        {added ? `${product.name} в корзине` : ""}
      </div>
      {fly && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={fly.key}
          className="fly"
          src={fly.src}
          alt=""
          style={
            {
              "--dx": `${fly.dx}px`,
              "--dy": `${fly.dy}px`,
            } as React.CSSProperties
          }
          onAnimationEnd={() => setFly(null)}
        />
      )}

      {cartOpen && (
        <Cart
          lines={cart}
          onClose={() => setCartOpen(false)}
          onRemove={(key) => {
            fx("remove");
            setCart((c) => c.filter((l) => l.key !== key));
          }}
          onQty={(key, d) => {
            const line = cart.find((l) => l.key === key);
            fx(line && line.qty + d <= 0 ? "remove" : d > 0 ? "plus" : "minus");
            setCart((c) =>
              c.flatMap((l) =>
                l.key !== key
                  ? [l]
                  : l.qty + d > 0
                    ? [{ ...l, qty: l.qty + d }]
                    : [],
              ),
            );
          }}
        />
      )}
    </main>
  );
}
