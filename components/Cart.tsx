"use client";

import { useRef, useState } from "react";
import Dots from "./Dots";
import { formatPrice, type Product } from "@/lib/products";

export type CartLine = {
  key: string;
  product: Product;
  size: string;
  qty: number;
};

type Props = {
  lines: CartLine[];
  onQty: (key: string, delta: number) => void;
  onRemove: (key: string) => void;
  onClose: () => void;
};

type Drag = { x: number; y: number; axis: "" | "x" | "y" };

const digits = (n: number) => formatPrice(n).replace(" сом", "");

/** Строка корзины: смахните влево, чтобы убрать. */
function Line({
  line,
  onQty,
  onRemove,
}: {
  line: CartLine;
  onQty: Props["onQty"];
  onRemove: Props["onRemove"];
}) {
  const drag = useRef<Drag | null>(null);
  const [dx, setDx] = useState(0);
  const [gone, setGone] = useState(false);
  const [live, setLive] = useState(false);
  const end = () => {
    if (!drag.current) return;
    drag.current = null;
    setLive(false);
    if (dx < -90) {
      setGone(true);
      setTimeout(() => onRemove(line.key), 260);
    } else setDx(0);
  };
  return (
    <li
      className={gone ? "gone" : ""}
      style={{
        transform: `translateX(${gone ? -110 : 0}%) translateX(${gone ? 0 : dx}px)`,
        opacity: 1 + dx / 260,
        transition: live ? "none" : undefined,
      }}
      onPointerDown={(e) => {
        if (!(e.target as HTMLElement).closest("button"))
          drag.current = { x: e.clientX, y: e.clientY, axis: "" };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        const mx = e.clientX - d.x;
        const my = e.clientY - d.y;
        if (!d.axis && Math.abs(mx) + Math.abs(my) > 10)
          d.axis = Math.abs(mx) > Math.abs(my) ? "x" : "y";
        if (d.axis === "x") {
          setLive(true);
          setDx(Math.min(0, mx));
        }
      }}
      onPointerUp={end}
      onPointerCancel={end}
      onPointerLeave={end}
    >
      <i style={{ backgroundImage: `url(${line.product.image})` }} />
      <div>
        <b>{line.product.name}</b>
        <span>
          <em>{line.size}</em>
          {formatPrice(line.product.price)}
        </span>
      </div>
      <div className="qty">
        <button
          onClick={() => onQty(line.key, -1)}
          aria-label={line.qty === 1 ? `Убрать ${line.product.name}` : "Меньше"}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 12h12" />
          </svg>
        </button>
        <span key={line.qty} aria-label={`${line.qty} шт.`}>
          <Dots text={String(line.qty)} height={16} />
        </span>
        <button onClick={() => onQty(line.key, 1)} aria-label="Больше">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 12h12M12 6v12" />
          </svg>
        </button>
      </div>
    </li>
  );
}

export default function Cart({ lines, onQty, onRemove, onClose }: Props) {
  const drag = useRef<Drag | null>(null);
  const [dy, setDy] = useState(0);
  const [closing, setClosing] = useState(false);
  const [live, setLive] = useState(false);
  const total = lines.reduce((n, l) => n + l.qty * l.product.price, 0);
  const count = lines.reduce((n, l) => n + l.qty, 0);

  const close = () => {
    setClosing(true);
    setTimeout(onClose, 300);
  };
  const end = () => {
    if (!drag.current) return;
    drag.current = null;
    setLive(false);
    if (dy > 90) close();
    else setDy(0);
  };

  return (
    <div className={"scrim" + (closing ? " out" : "")} onClick={close}>
      <aside
        className="cart"
        aria-label="Корзина"
        style={{
          transform: closing ? undefined : `translateY(${dy}px)`,
          transition: live ? "none" : undefined,
        }}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => {
          const t = e.target as HTMLElement;
          const list = t.closest("ul");
          if (t.closest("button") || (list && list.scrollTop > 0)) return;
          drag.current = { x: e.clientX, y: e.clientY, axis: "" };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          const mx = e.clientX - d.x;
          const my = e.clientY - d.y;
          if (!d.axis && Math.abs(mx) + Math.abs(my) > 10)
            d.axis = Math.abs(mx) > Math.abs(my) ? "x" : "y";
          if (d.axis === "y") {
            setLive(true);
            setDy(Math.max(0, my));
          }
        }}
        onPointerUp={end}
        onPointerCancel={end}
      >
        <button className="grab" onClick={close} aria-label="Закрыть корзину">
          <i aria-hidden="true" />
        </button>
        <div className="carthead">
          <h2>Корзина</h2>
          {count > 0 && (
            <span aria-label={`Товаров: ${count}`}>
              <Dots text={String(count)} height={20} />
            </span>
          )}
        </div>

        {lines.length === 0 ? (
          <p className="empty">
            Пока пусто. Смахните корзину вниз, выберите вещь на витрине и
            добавьте её сюда.
          </p>
        ) : (
          <>
            <ul style={{ touchAction: lines.length > 3 ? "pan-y" : "none" }}>
              {lines.map((l) => (
                <Line key={l.key} line={l} onQty={onQty} onRemove={onRemove} />
              ))}
            </ul>
            <p className="tip">Смахните вещь влево, чтобы убрать.</p>
            <div className="sum">
              <span>Итого</span>
              <strong aria-label={formatPrice(total)}>
                <Dots key={total} text={digits(total)} height={30} />
                <small>сом</small>
              </strong>
            </div>
            <p className="soon">Оформление заказа появится следующим шагом.</p>
          </>
        )}
      </aside>
    </div>
  );
}
