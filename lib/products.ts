export type CategoryId = "tops" | "bottoms" | "shoes" | "accessories";

export type Product = {
  id: string;
  name: string;
  note: string;
  price: number;
  sizes: string[];
  /** фото товара с прозрачным фоном */
  image: string;
  /** фото со спины, если есть */
  back?: string;
  /** состав */
  material: string;
  /** высота вещи в сцене */
  h: number;
  /** как вещь висит: на крючке, на прищепках или парит сама */
  hang: "hook" | "clip" | "none";
};


export type Category = {
  id: CategoryId;
  label: string;
  ghost: string;
  /** уход, общий для категории */
  care: string;
  /** таблица размеров: названия мерок и значения в сантиметрах по каждому размеру */
  guide?: { cols: string[]; rows: Record<string, number[]> };
  products: Product[];
};

const TOP = ["S", "M", "L", "XL"];
const BOTTOM = ["28", "30", "32", "34"];
const SHOE = ["39", "40", "41", "42", "43", "44"];
const ONE = ["Один размер"];

// Черновой каталог: фото-заглушки. Перед релизом заменить на свои товары.
export const CATEGORIES: Category[] = [
  {
    id: "tops",
    label: "Верх",
    ghost: "ВЕРХ",
    care: "Стирка при 30°, сушить в расправленном виде. Шерсть и пух — деликатный режим или химчистка.",
    guide: { cols: ["Грудь", "Длина", "Рукав"], rows: { S: [104, 68, 61], M: [110, 70, 62], L: [116, 72, 63], XL: [122, 74, 64] } },
    products: [
      { id: "coat", name: "Пальто Mono", note: "Шерсть, прямой крой", price: 18900, sizes: TOP, image: "/products/coat.webp", material: "70% шерсть, 30% полиамид", h: 1.8, hang: "hook" },
      { id: "sweater", name: "Свитер Moss", note: "Меланжевая шерсть", price: 6900, sizes: TOP, image: "/products/sweater.webp", material: "60% шерсть, 40% альпака", h: 1.2, hang: "hook" },
      { id: "jacket", name: "Куртка Utility", note: "Хлопок и шерсть, четыре кармана", price: 9900, sizes: TOP, image: "/products/jacket.webp", material: "65% хлопок, 35% шерсть", h: 1.2, hang: "hook" },
      { id: "sweatshirt", name: "Свитшот Fog", note: "Плотный футер", price: 4900, sizes: TOP, image: "/products/sweatshirt.webp", material: "100% хлопок", h: 1.2, hang: "hook" },
      { id: "puffer", name: "Пуховик Cloud", note: "Лёгкий пух, воротник-стойка", price: 12900, sizes: TOP, image: "/products/puffer.webp", material: "Верх — полиамид, наполнитель — пух", h: 1.2, hang: "hook" },
      { id: "tee", name: "Футболка Zero", note: "Плотный хлопок", price: 2900, sizes: TOP, image: "/products/tee.webp", material: "100% хлопок", h: 1.15, hang: "hook" },
      { id: "vneck", name: "Джемпер V", note: "Свободная посадка", price: 6400, sizes: TOP, image: "/products/vneck.webp", material: "80% шерсть, 20% полиамид", h: 1.2, hang: "hook" },
      { id: "longsleeve", name: "Лонгслив Ash", note: "Мягкий трикотаж", price: 3400, sizes: TOP, image: "/products/longsleeve.webp", material: "95% хлопок, 5% эластан", h: 1.2, hang: "hook" },
      { id: "trench", name: "Тренч Shade", note: "Двубортный, с поясом", price: 16900, sizes: TOP, image: "/products/trench.webp", material: "100% хлопок, пропитка", h: 1.8, hang: "hook" },
      { id: "polo", name: "Поло Knit", note: "Тонкая вязка", price: 5900, sizes: TOP, image: "/products/polo.webp", material: "100% шерсть мериноса", h: 1.2, hang: "hook" },
    ],
  },
  {
    id: "bottoms",
    label: "Низ",
    ghost: "НИЗ",
    care: "Стирка при 30° наизнанку, не отбеливать. Деним первые разы стирать отдельно.",
    guide: { cols: ["Талия", "Бёдра", "Длина"], rows: { "28": [72, 96, 102], "30": [77, 101, 104], "32": [82, 106, 106], "34": [87, 111, 108] } },
    products: [
      { id: "jeans-blue", name: "Джинсы Indigo", note: "Прямые, варёный деним", price: 5900, sizes: BOTTOM, image: "/products/jeans-blue.webp", material: "100% хлопок", h: 1.5, hang: "clip" },
      { id: "pants-black", name: "Брюки Wide", note: "Широкие, плотный хлопок", price: 5900, sizes: BOTTOM, image: "/products/pants-black.webp", material: "98% хлопок, 2% эластан", h: 1.5, hang: "clip" },
      { id: "jeans-dark", name: "Джинсы Raw", note: "Прямые, сырой деним", price: 6400, sizes: BOTTOM, image: "/products/jeans-dark.webp", material: "100% хлопок", h: 1.5, hang: "clip" },
      { id: "jogger", name: "Джоггеры Pleat", note: "Защипы, резинка на поясе", price: 4900, sizes: BOTTOM, image: "/products/jogger.webp", material: "80% хлопок, 20% полиэстер", h: 1.5, hang: "clip" },
    ],
  },
  {
    id: "shoes",
    label: "Обувь",
    ghost: "ОБУВЬ",
    care: "Чистить сухой щёткой, беречь от сильной влаги. Кожу раз в месяц обрабатывать кремом.",
    guide: { cols: ["Длина стопы"], rows: { "39": [25], "40": [25.7], "41": [26.3], "42": [27], "43": [27.7], "44": [28.3] } },
    products: [
      { id: "boots", name: "Челси Gloss", note: "Гладкая кожа", price: 11900, sizes: SHOE, image: "/products/boots.webp", material: "Верх — кожа, подошва — резина", h: 0.95, hang: "none" },
      { id: "sneakers", name: "Кеды Suede", note: "Замша, тонкая подошва", price: 7900, sizes: SHOE, image: "/products/sneakers.webp", material: "Верх — замша, подошва — резина", h: 0.7, hang: "none" },
    ],
  },
  {
    id: "accessories",
    label: "Детали",
    ghost: "ДЕТАЛИ",
    care: "Ручная стирка в прохладной воде, не выкручивать.",
    products: [
      { id: "tote", name: "Сумка Carry", note: "Канвас, внешние карманы", price: 4900, sizes: ONE, image: "/products/tote.webp", material: "100% хлопок, ручки — кожа", h: 1.15, hang: "none" },
      { id: "bandana", name: "Платок Dot", note: "Шёлк, 55×55 см", price: 1900, sizes: ONE, image: "/products/bandana.webp", material: "100% шёлк", h: 1.05, hang: "none" },
      { id: "socks", name: "Носки Rib", note: "Шерсть, две пары", price: 1200, sizes: ONE, image: "/products/socks.webp", material: "70% шерсть, 28% полиамид, 2% эластан", h: 1.1, hang: "none" },
    ],
  },
];

export function formatPrice(n: number) {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " сом";
}
