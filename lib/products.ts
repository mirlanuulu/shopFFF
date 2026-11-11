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
  | "crossbody";

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

// Черновой каталог. Перед релизом заменить на свои товары.
export const CATEGORIES: Category[] = [
  {
    id: "tops",
    label: "Верх",
    ghost: "ВЕРХ",
    hint: "Рейл с вешалками",
    products: [
      { id: "t1", name: "Футболка Zero", note: "Плотный хлопок 240 г", price: 2900, kind: "tee", color: "#fff1dc", accent: "#ff5a1f", print: "FFF", sizes: TOP },
      { id: "t2", name: "Худи Orbit", note: "Футер с начёсом, оверсайз", price: 5900, kind: "hoodie", color: "#2340ff", accent: "#fff1dc", sizes: TOP },
      { id: "t3", name: "Пуховик Ember", note: "Лёгкий утеплитель, до −15°", price: 12900, kind: "puffer", color: "#17171c", accent: "#ff5a1f", sizes: TOP },
      { id: "t4", name: "Лонгслив 06", note: "Тонкий трикотаж", price: 3900, kind: "longsleeve", color: "#ff5a1f", accent: "#150807", print: "06", sizes: TOP },
      { id: "t5", name: "Бомбер Chrome", note: "Нейлон с отливом", price: 9900, kind: "bomber", color: "#aeb6c8", accent: "#2340ff", sizes: TOP },
      { id: "t6", name: "Футболка Night", note: "Плотный хлопок 240 г", price: 2900, kind: "tee", color: "#17171c", accent: "#2340ff", print: "FFF", sizes: TOP },
    ],
  },
  {
    id: "bottoms",
    label: "Низ",
    ghost: "НИЗ",
    hint: "Карусель по кругу",
    products: [
      { id: "b1", name: "Карго Shift", note: "Рипстоп, шесть карманов", price: 6900, kind: "cargo", color: "#3a3d2c", accent: "#ff5a1f", sizes: BOTTOM },
      { id: "b2", name: "Брюки Wide", note: "Свободный крой, стрелки", price: 5900, kind: "pants", color: "#fff1dc", sizes: BOTTOM },
      { id: "b3", name: "Шорты Lap", note: "Быстросохнущая ткань", price: 3400, kind: "shorts", color: "#2340ff", accent: "#fff1dc", sizes: BOTTOM },
      { id: "b4", name: "Юбка Arc", note: "Трапеция, плотная саржа", price: 4900, kind: "skirt", color: "#17171c", accent: "#ff5a1f", sizes: BOTTOM },
      { id: "b5", name: "Брюки Signal", note: "Прямой крой", price: 5900, kind: "pants", color: "#c2410c", sizes: BOTTOM },
    ],
  },
  {
    id: "shoes",
    label: "Обувь",
    ghost: "ОБУВЬ",
    hint: "Левитация над подиумом",
    products: [
      { id: "s1", name: "Runner Street", note: "Сетка и замша", price: 8900, kind: "shoe", color: "#888", variant: "street", sizes: SHOE },
      { id: "s2", name: "Runner Midnight", note: "Сетка и замша", price: 8900, kind: "shoe", color: "#223", variant: "midnight", sizes: SHOE },
      { id: "s3", name: "Runner Beach", note: "Сетка и замша", price: 8900, kind: "shoe", color: "#eca", variant: "beach", sizes: SHOE },
      { id: "s4", name: "Runner Ember", note: "Лимитированный цвет", price: 9900, kind: "shoe", color: "#f52", variant: "street", tint: "#ff7a3d", sizes: SHOE },
      { id: "s5", name: "Runner Cobalt", note: "Лимитированный цвет", price: 9900, kind: "shoe", color: "#24f", variant: "street", tint: "#5b74ff", sizes: SHOE },
    ],
  },
  {
    id: "accessories",
    label: "Детали",
    ghost: "ДЕТАЛИ",
    hint: "Невесомость",
    products: [
      { id: "a1", name: "Кепка Dome", note: "Шесть клиньев, застёжка", price: 1900, kind: "cap", color: "#2340ff", accent: "#fff1dc", sizes: ONE },
      { id: "a2", name: "Очки Visor", note: "Линзы UV400", price: 3900, kind: "shades", color: "#17171c", accent: "#ff5a1f", sizes: ONE },
      { id: "a3", name: "Шопер Cargo", note: "Плотный канвас, 18 л", price: 2400, kind: "tote", color: "#fff1dc", accent: "#150807", print: "FFF", sizes: ONE },
      { id: "a4", name: "Шапка Rib", note: "Шерсть мериноса", price: 1700, kind: "beanie", color: "#ff5a1f", sizes: ONE },
      { id: "a5", name: "Сумка Pod", note: "Через плечо, 2 л", price: 3200, kind: "crossbody", color: "#17171c", accent: "#c9cfdd", sizes: ONE },
    ],
  },
];

export function formatPrice(n: number) {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " сом";
}
