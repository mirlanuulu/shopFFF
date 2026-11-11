export type CategoryId = "tops" | "bottoms" | "shoes" | "accessories";

export type Kind =
  | "tee"
  | "hoodie"
  | "puffer"
  | "longsleeve"
  | "bomber"
  | "pants"
  | "cargo"
  | "shorts"
  | "skirt"
  | "shoe"
  | "cap"
  | "tote"
  | "shades"
  | "beanie"
  | "crossbody"
  | "photo";

export type Product = {
  id: string;
  name: string;
  note: string;
  price: number;
  kind: Kind;
  color: string;
  accent?: string;
  print?: string;
  /** shoe only: material variant name from the model, or a tint */
  variant?: string;
  tint?: string;
  sizes: string[];
  /** фото товара с прозрачным фоном и его высота в сцене */
  image?: string;
  h?: number;
  hang?: "hook" | "clip" | "none";
};

export type Category = {
  id: CategoryId;
  label: string;
  ghost: string;
  hint: string;
  products: Product[];
};

const TOP = ["S", "M", "L", "XL"];
const BOTTOM = ["28", "30", "32", "34"];
const SHOE = ["39", "40", "41", "42", "43", "44"];
const ONE = ["Один размер"];

export const PALETTE = {
  ink: "#150807",
  ember: "#ff5a1f",
  cobalt: "#2340ff",
  cream: "#fff1dc",
  chrome: "#c9cfdd",
};

// Черновой каталог: фото-заглушки. Перед релизом заменить на свои товары.
export const CATEGORIES: Category[] = [
  {
    id: "tops",
    label: "Верх",
    ghost: "ВЕРХ",
    hint: "Рейл с вешалками",
    products: [
      { id: "coat", name: "Пальто Mono", note: "Шерсть, прямой крой", price: 18900, kind: "photo", color: "#1c1b1b", sizes: TOP, image: "/products/coat.webp", h: 1.8, hang: "hook" },
      { id: "sweater", name: "Свитер Moss", note: "Меланжевая шерсть", price: 6900, kind: "photo", color: "#4a423c", sizes: TOP, image: "/products/sweater.webp", h: 1.2, hang: "hook" },
      { id: "jacket", name: "Куртка Utility", note: "Хлопок и шерсть, четыре кармана", price: 9900, kind: "photo", color: "#3a3938", sizes: TOP, image: "/products/jacket.webp", h: 1.2, hang: "hook" },
      { id: "sweatshirt", name: "Свитшот Fog", note: "Плотный футер", price: 4900, kind: "photo", color: "#c9c9c9", sizes: TOP, image: "/products/sweatshirt.webp", h: 1.2, hang: "hook" },
      { id: "puffer", name: "Пуховик Cloud", note: "Лёгкий пух, воротник-стойка", price: 12900, kind: "photo", color: "#1e1e1f", sizes: TOP, image: "/products/puffer.webp", h: 1.2, hang: "hook" },
      { id: "tee", name: "Футболка Zero", note: "Плотный хлопок", price: 2900, kind: "photo", color: "#141414", sizes: TOP, image: "/products/tee.webp", h: 1.15, hang: "hook" },
      { id: "vneck", name: "Джемпер V", note: "Свободная посадка", price: 6400, kind: "photo", color: "#333333", sizes: TOP, image: "/products/vneck.webp", h: 1.2, hang: "hook" },
      { id: "longsleeve", name: "Лонгслив Ash", note: "Мягкий трикотаж", price: 3400, kind: "photo", color: "#9a9a98", sizes: TOP, image: "/products/longsleeve.webp", h: 1.2, hang: "hook" },
      { id: "trench", name: "Тренч Shade", note: "Двубортный, с поясом", price: 16900, kind: "photo", color: "#1b1b1c", sizes: TOP, image: "/products/trench.webp", h: 1.8, hang: "hook" },
      { id: "polo", name: "Поло Knit", note: "Тонкая вязка", price: 5900, kind: "photo", color: "#151515", sizes: TOP, image: "/products/polo.webp", h: 1.2, hang: "hook" },
    ],
  },
  {
    id: "bottoms",
    label: "Низ",
    ghost: "НИЗ",
    hint: "Карусель по кругу",
    products: [
      { id: "jeans-blue", name: "Джинсы Indigo", note: "Прямые, варёный деним", price: 5900, kind: "photo", color: "#4d6f95", sizes: BOTTOM, image: "/products/jeans-blue.webp", h: 1.5, hang: "clip" },
      { id: "pants-black", name: "Брюки Wide", note: "Широкие, плотный хлопок", price: 5900, kind: "photo", color: "#2b2826", sizes: BOTTOM, image: "/products/pants-black.webp", h: 1.5, hang: "clip" },
      { id: "jeans-dark", name: "Джинсы Raw", note: "Прямые, сырой деним", price: 6400, kind: "photo", color: "#262a33", sizes: BOTTOM, image: "/products/jeans-dark.webp", h: 1.5, hang: "clip" },
      { id: "jogger", name: "Джоггеры Pleat", note: "Защипы, резинка на поясе", price: 4900, kind: "photo", color: "#1d1d1d", sizes: BOTTOM, image: "/products/jogger.webp", h: 1.5, hang: "clip" },
    ],
  },
  {
    id: "shoes",
    label: "Обувь",
    ghost: "ОБУВЬ",
    hint: "Левитация над подиумом",
    products: [
      { id: "boots", name: "Челси Gloss", note: "Гладкая кожа", price: 11900, kind: "photo", color: "#2a1c1b", sizes: SHOE, image: "/products/boots.webp", h: 0.95, hang: "none" },
      { id: "sneakers", name: "Кеды Suede", note: "Замша, тонкая подошва", price: 7900, kind: "photo", color: "#3b3027", sizes: SHOE, image: "/products/sneakers.webp", h: 0.7, hang: "none" },
    ],
  },
  {
    id: "accessories",
    label: "Детали",
    ghost: "ДЕТАЛИ",
    hint: "Невесомость",
    products: [
      { id: "tote", name: "Сумка Carry", note: "Канвас, внешние карманы", price: 4900, kind: "photo", color: "#161616", sizes: ONE, image: "/products/tote.webp", h: 1.15, hang: "none" },
      { id: "bandana", name: "Платок Dot", note: "Шёлк, 55×55 см", price: 1900, kind: "photo", color: "#2c2c2e", sizes: ONE, image: "/products/bandana.webp", h: 1.05, hang: "none" },
      { id: "socks", name: "Носки Rib", note: "Шерсть, две пары", price: 1200, kind: "photo", color: "#1f2433", sizes: ONE, image: "/products/socks.webp", h: 1.1, hang: "none" },
    ],
  },
];

export function formatPrice(n: number) {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " сом";
}
