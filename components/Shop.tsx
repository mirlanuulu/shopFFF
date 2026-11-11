"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Engine } from "@/lib/engine";
import Dots from "./Dots";
import { CATEGORIES, formatPrice, type CategoryId, type Product } from "@/lib/products";

type CartLine = { key: string; product: Product; size: string; qty: number };

export default function Shop() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const [cat, setCat] = useState<CategoryId>("tops");
  const [indexes, setIndexes] = useState<Record<CategoryId, number>>({ tops: 0, bottoms: 0, shoes: 0, accessories: 0 });
  const [sizes, setSizes] = useState<Record<string, string>>({});
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [nudge, setNudge] = useState(false);
  const [touched, setTouched] = useState(false);
  const [webgl, setWebgl] = useState(true);

  const category = useMemo(() => CATEGORIES.find((c) => c.id === cat)!, [cat]);
  const index = indexes[cat];
  const product = category.products[index];
  const size = product.sizes.length === 1 ? product.sizes[0] : sizes[product.id];
  const count = cart.reduce((n, l) => n + l.qty, 0);
  const total = cart.reduce((n, l) => n + l.qty * l.product.price, 0);

  useEffect(() => {
    let engine: Engine | undefined;
    let dead = false;
    import("@/lib/engine")
      .then(({ Engine }) => {
        if (dead || !canvasRef.current) return;
        engine = new Engine(canvasRef.current, {
          onIndex: (c, i) => {
            setIndexes((s) => ({ ...s, [c]: i }));
            setTouched(true);
          },
        });
        engineRef.current = engine;
      })
      .catch(() => setWebgl(false));
    return () => {
      dead = true;
      engine?.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") engineRef.current?.step(1);
      if (e.key === "ArrowLeft") engineRef.current?.step(-1);
      if (e.key === "Escape") setCartOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  const chooseCategory = useCallback((id: CategoryId) => {
    setCat(id);
    engineRef.current?.setCategory(id);
  }, []);

  const add = () => {
    if (!size) {
      setNudge(true);
      setTimeout(() => setNudge(false), 500);
      return;
    }
    const key = product.id + "/" + size;
    setCart((c) => {
      const hit = c.find((l) => l.key === key);
      return hit ? c.map((l) => (l === hit ? { ...l, qty: l.qty + 1 } : l)) : [...c, { key, product, size, qty: 1 }];
    });
    setToast("Добавлено в корзину");
  };

  return (
    <main className="shop">
      <div className="bg" aria-hidden="true">
        <i /><i /><i /><i />
      </div>
      <div className="ghost" key={cat} style={{ "--n": category.ghost.length } as React.CSSProperties} aria-hidden="true">
        {category.ghost}
      </div>

      <canvas ref={canvasRef} className="stage" aria-label={`Витрина: ${category.label}. Листайте влево и вправо.`} />
      {!webgl && <p className="nogl">Браузер не поддерживает 3D. Откройте сайт в свежем Chrome или Safari.</p>}

      <header className="top">
        <span className="mark">FFF</span>
        <button className="cartbtn" onClick={() => setCartOpen(true)} aria-label={`Корзина, товаров: ${count}`}>
          Корзина <b>{count}</b>
        </button>
      </header>

      {!touched && <p className="swipe" aria-hidden="true">Листайте в сторону</p>}

      <section className="dock">
        <div className="info" key={product.id}>
          <div className="title">
            <h1>{product.name}</h1>
            <p>{product.note}</p>
          </div>
          <div className="meta">
            <strong aria-label={formatPrice(product.price)}>
              <Dots text={formatPrice(product.price).replace(" сом", "")} height={22} />
              <small>сом</small>
            </strong>
            <span>
              {index + 1} из {category.products.length}
            </span>
          </div>
        </div>

        <div className={"sizes" + (nudge ? " nudge" : "")} role="radiogroup" aria-label="Размер">
          {product.sizes.map((s) => (
            <button
              key={s}
              role="radio"
              aria-checked={size === s}
              className={size === s ? "on" : ""}
              aria-label={s}
              onClick={() => setSizes((v) => ({ ...v, [product.id]: s }))}
            >
              <Dots text={s === "Один размер" ? "ONE" : s} height={20} grid />
            </button>
          ))}
        </div>

        <div className="actions">
          <button className="arrow" onClick={() => engineRef.current?.step(-1)} disabled={index === 0} aria-label="Предыдущая вещь">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
          </button>
          <button className="add" onClick={add}>
            {size ? "Добавить в корзину" : "Выберите размер"}
          </button>
          <button
            className="arrow"
            onClick={() => engineRef.current?.step(1)}
            disabled={index === category.products.length - 1}
            aria-label="Следующая вещь"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>

        <nav className="cats" aria-label="Категории">
          {CATEGORIES.map((c) => (
            <button key={c.id} className={c.id === cat ? "on" : ""} aria-current={c.id === cat} onClick={() => chooseCategory(c.id)}>
              {c.label}
            </button>
          ))}
        </nav>
      </section>

      <div className={"toast" + (toast ? " show" : "")} role="status">
        {toast}
      </div>

      {cartOpen && (
        <div className="scrim" onClick={() => setCartOpen(false)}>
          <aside className="cart" onClick={(e) => e.stopPropagation()} aria-label="Корзина">
            <div className="carthead">
              <h2>Корзина</h2>
              <button onClick={() => setCartOpen(false)}>Закрыть</button>
            </div>
            {cart.length === 0 ? (
              <p className="empty">Пока пусто. Выберите вещь на витрине и добавьте её сюда.</p>
            ) : (
              <>
                <ul>
                  {cart.map((l) => (
                    <li key={l.key}>
                      <i style={{ background: l.product.tint ?? l.product.color }} />
                      <div>
                        <b>{l.product.name}</b>
                        <span>
                          {l.size}, {l.qty} шт.
                        </span>
                      </div>
                      <em>{formatPrice(l.product.price * l.qty)}</em>
                      <button onClick={() => setCart((c) => c.filter((x) => x !== l))} aria-label={`Убрать ${l.product.name}`}>
                        Убрать
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="sum">
                  <span>Итого</span>
                  <strong>{formatPrice(total)}</strong>
                </div>
                <p className="soon">Оформление заказа появится на следующем этапе.</p>
              </>
            )}
          </aside>
        </div>
      )}
    </main>
  );
}
