import { DOT_FONT, DOT_ROWS } from "@/lib/dotfont";

// Знаки из точек. Форма букв берётся из округлого шрифта (см. scripts/make-dotfont.py),
// а размер каждой точки — из того, сколько буквы попало в клетку, поэтому края мягкие.

/** gather: точки слетаются на свои места со всех сторон (для интро). */
export default function Dots({
  text,
  height,
  grid = false,
  gather = false,
}: {
  text: string;
  height: number;
  grid?: boolean;
  gather?: boolean;
}) {
  const dots: { x: number; y: number; r: number; on: boolean }[] = [];
  let col = 0;
  for (const ch of text) {
    const rows = DOT_FONT[ch];
    if (!rows) {
      col += 3; // пробел
      continue;
    }
    const w = rows[0].length;
    rows.forEach((row, y) => {
      for (let x = 0; x < w; x++) {
        const level = Number(row[x]);
        if (level > 0)
          dots.push({ x: col + x, y, r: 0.12 + 0.3 * (level / 9), on: true });
        else if (grid) dots.push({ x: col + x, y, r: 0.2, on: false });
      }
    });
    col += w + 1;
  }
  const width = col - 1;
  return (
    <svg
      className={"dots" + (gather ? " gather" : "")}
      viewBox={`-0.5 -0.5 ${width} ${DOT_ROWS}`}
      height={height}
      width={(height / DOT_ROWS) * width}
      aria-hidden="true"
    >
      {dots.map((d, i) => (
        <circle
          key={i}
          cx={d.x}
          cy={d.y}
          r={d.r}
          className={d.on ? "on" : "off"}
          style={
            gather
              ? ({
                  // a fixed pseudo-random start for every dot, so the swarm looks the same on each render
                  "--sx": `${(Math.sin(i * 12.9898) * 43758.5453) % 26}px`,
                  "--sy": `${(Math.sin(i * 78.233) * 12543.123) % 40}px`,
                  animationDelay: `${120 + ((i * 37) % 23) * 22}ms`,
                } as React.CSSProperties)
              : { animationDelay: `${(d.x + d.y) * 14}ms` }
          }
        />
      ))}
    </svg>
  );
}
