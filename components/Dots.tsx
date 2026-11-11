// Знаки из точек, сетка 5×7, как на точечном дисплее.
const G: Record<string, string> = {
  "0": "01110 10001 10011 10101 11001 10001 01110",
  "1": "00100 01100 00100 00100 00100 00100 01110",
  "2": "01110 10001 00001 00010 00100 01000 11111",
  "3": "11110 00001 00001 01110 00001 00001 11110",
  "4": "00010 00110 01010 10010 11111 00010 00010",
  "5": "11111 10000 11110 00001 00001 10001 01110",
  "6": "00110 01000 10000 11110 10001 10001 01110",
  "7": "11111 00001 00010 00100 01000 01000 01000",
  "8": "01110 10001 10001 01110 10001 10001 01110",
  "9": "01110 10001 10001 01111 00001 00010 01100",
  S: "01111 10000 10000 01110 00001 00001 11110",
  M: "10001 11011 10101 10101 10001 10001 10001",
  L: "10000 10000 10000 10000 10000 10000 11111",
  X: "10001 10001 01010 00100 01010 10001 10001",
  O: "01110 10001 10001 10001 10001 10001 01110",
  N: "10001 11001 10101 10011 10001 10001 10001",
  E: "11111 10000 10000 11110 10000 10000 11111",
  F: "11111 10000 10000 11110 10000 10000 10000",
  " ": "00 00 00 00 00 00 00",
};

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
  const dots: { x: number; y: number; on: boolean }[] = [];
  let col = 0;
  for (const ch of text) {
    const rows = (G[ch] ?? G[" "]).split(" ");
    const w = rows[0].length;
    rows.forEach((row, y) => {
      for (let x = 0; x < w; x++) {
        const on = row[x] === "1";
        if (on || grid) dots.push({ x: col + x, y, on });
      }
    });
    col += w + 1;
  }
  const width = col - 1;
  return (
    <svg
      className={"dots" + (gather ? " gather" : "")}
      viewBox={`-0.5 -0.5 ${width} 7`}
      height={height}
      width={(height / 7) * width}
      aria-hidden="true"
    >
      {dots.map((d, i) => (
        <circle
          key={i}
          cx={d.x}
          cy={d.y}
          r={0.39}
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
