/**
 * The pixel-art scene at the top of the Menu screen: a tabby cat, golf ball
 * and mushroom standing on a grass/dirt strip, with a flag on the right.
 *
 * Everything below is computed ONCE at module load into a flat list of rect
 * descriptors, not on every render — the shapes (cat, ball, mushroom, flag)
 * are built on a shared pixel grid so they share one silhouette outline, and
 * the ground (grass/dirt) is drawn as a handful of large bands rather than
 * per-cell, keeping the DOM to a few hundred static rects instead of several
 * thousand. The component itself just maps that precomputed list to JSX.
 */

const W = 128;
const H = 46;
const GRASS_TOP = 26;
const DIRT_TOP = 34;

type Cell = { x: number; y: number; fill: string };

function buildScene(): { ground: Cell[]; objects: Cell[] } {
  const grid: string[][] = Array.from({ length: H }, () => Array(W).fill('.'));
  const set = (x: number, y: number, ch: string) => {
    if (x >= 0 && y >= 0 && x < W && y < H) grid[y][x] = ch;
  };

  /* --- cat, built on its own small grid then stamped onto the scene ------ */
  function buildCat() {
    const w = 34;
    const h = 20;
    const g: string[][] = Array.from({ length: h }, () => Array(w).fill('.'));
    const s = (x: number, y: number, ch: string) => {
      if (x >= 0 && y >= 0 && x < w && y < h) g[y][x] = ch;
    };

    // Head.
    const headCx = 5, headCy = 10, headRx = 5, headRy = 4.6;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = (x - headCx) / headRx;
        const dy = (y - headCy) / headRy;
        if (dx * dx + dy * dy <= 1) s(x, y, 'b');
      }
    }
    // Ears.
    const ear = (x0: number, y0: number) => {
      s(x0, y0, 'b');
      s(x0 - 1, y0 + 1, 'b'); s(x0, y0 + 1, 'b'); s(x0 + 1, y0 + 1, 'b');
      s(x0 - 1, y0 + 2, 'b'); s(x0, y0 + 2, 'b'); s(x0 + 1, y0 + 2, 'b');
    };
    ear(3, 3);
    ear(7, 3);

    // Body.
    const bodyCx = 19, bodyCy = 11, bodyRx = 10, bodyRy = 5;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = (x - bodyCx) / bodyRx;
        const dy = (y - bodyCy) / bodyRy;
        if (dx * dx + dy * dy <= 1) s(x, y, 'b');
      }
    }

    // Belly: hugs the true bottom edge of the silhouette so far, rather than
    // a fixed rectangle, so it follows the body's curve.
    for (let x = 8; x <= 27; x++) {
      let bottom = -1;
      for (let y = h - 1; y >= 0; y--) {
        if (g[y][x] === 'b') { bottom = y; break; }
      }
      if (bottom >= 0) {
        s(x, bottom, 'w');
        if (bottom - 1 >= 0) s(x, bottom - 1, 'w');
      }
    }

    // Tail: a filled elliptical annulus (every cell tested against a radius
    // range + angle range) rather than traced arcs — traced arcs at shrinking
    // radii leave gaps wherever the curve is steep, reading as a hollow loop
    // instead of a solid curled tail. The angle range stops short of the head
    // so the tip hovers clear of it instead of sweeping down into the neck.
    const tailCx = 21, tailCy = 6, tailRx = 9, tailRy = 5.5;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const nx = (x - tailCx) / tailRx;
        const ny = -(y - tailCy) / tailRy;
        const r = Math.hypot(nx, ny);
        if (r < 0.72 || r > 1.0) continue;
        const a = Math.atan2(ny, nx);
        if (a < -0.3 || a > 2.05) continue;
        s(x, y, 'b');
      }
    }

    // Legs: staggered lengths for a mid-stride look.
    const leg = (x0: number, y0: number, y1: number) => {
      for (let y = y0; y <= y1; y++) {
        s(x0, y, 'b');
        s(x0 + 1, y, 'b');
      }
      s(x0, y1, 'k');
      s(x0 + 1, y1, 'k');
    };
    leg(9, 14, 16);
    leg(12, 14, 17);
    leg(23, 14, 17);
    leg(26, 14, 15);

    // Face + tabby stripes.
    s(1, 10, 'k'); // nose
    s(4, 8, 'k'); // eye
    for (const [x, y] of [[13, 6], [17, 6], [21, 6], [25, 7]]) s(x, y, 'd');

    return { g, w, h };
  }

  const cat = buildCat();
  const catOffX = 6;
  const catOffY = GRASS_TOP - 17; // paw bottoms land on the grass line
  for (let y = 0; y < cat.h; y++) {
    for (let x = 0; x < cat.w; x++) {
      const ch = cat.g[y][x];
      if (ch !== '.') set(x + catOffX, y + catOffY, ch);
    }
  }

  /* --- golf ball ----------------------------------------------------------- */
  function placeBall(cx: number, cy: number, r: number) {
    for (let y = -r; y <= r; y++) {
      for (let x = -r; x <= r; x++) {
        if (x * x + y * y <= r * r) set(cx + x, cy + y, 'ball');
      }
    }
    set(cx - 1, cy - 1, 'dimple');
    set(cx + 2, cy, 'dimple');
    set(cx, cy + 2, 'dimple');
    set(cx - 2, cy + 1, 'dimple');
  }
  placeBall(70, GRASS_TOP + 1, 6);

  /* --- mushroom -------------------------------------------------------------- */
  function placeMushroom(cx: number, capBottomY: number) {
    const capRx = 6, capRy = 5;
    for (let y = -capRy; y <= 0; y++) {
      for (let x = -capRx; x <= capRx; x++) {
        const nx = x / capRx, ny = y / capRy;
        if (nx * nx + ny * ny <= 1) set(cx + x, capBottomY + y, 'cap');
      }
    }
    for (const [dx, dy] of [[-3, -3], [1, -4], [3, -1], [-1, -1]]) {
      set(cx + dx, capBottomY + dy, 'spot');
    }
    for (let y = 1; y <= 6; y++) {
      for (let x = -2; x <= 2; x++) set(cx + x, capBottomY + y, 'stem');
    }
  }
  placeMushroom(94, GRASS_TOP - 2);

  /* --- flag -------------------------------------------------------------------- */
  function placeFlag(poleX: number, topY: number, bottomY: number) {
    for (let y = topY; y <= bottomY; y++) set(poleX, y, 'pole');
    for (let i = 0; i < 5; i++) {
      for (let x = poleX - 1; x >= poleX - 1 - i; x--) set(x, topY + i, 'flag');
    }
  }
  placeFlag(112, 4, GRASS_TOP);

  /* --- silhouette outline: dilate the object grid by one cell -------------- */
  const OBJECT_COLORS: Record<string, string> = {
    b: '#c9915a', d: '#7a4a26', w: '#f2dcb4', k: '#20120a',
    ball: '#f4f4f2', dimple: '#c9c9c4',
    cap: '#e0392b', spot: '#ffffff', stem: '#e8d9b0',
    pole: '#aab4b8', flag: '#e0392b',
  };
  const OUTLINE = '#160b05';

  function dilate(g: string[][]): string[][] {
    const solid = (x: number, y: number) =>
      x >= 0 && y >= 0 && y < H && x < W && g[y][x] !== '.';
    return g.map((row, y) =>
      row.map((ch, x) => {
        if (ch !== '.') return '.';
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (solid(x + dx, y + dy)) return 'O';
          }
        }
        return '.';
      }),
    );
  }

  const outline = dilate(grid);
  const objects: Cell[] = [];
  outline.forEach((row, y) =>
    row.forEach((ch, x) => {
      if (ch !== '.') objects.push({ x, y, fill: OUTLINE });
    }),
  );
  grid.forEach((row, y) =>
    row.forEach((ch, x) => {
      if (ch !== '.') objects.push({ x, y, fill: OBJECT_COLORS[ch] ?? ch });
    }),
  );

  return { ground: [], objects };
}

const { objects: OBJECT_CELLS } = buildScene();

/** A handful of large bands rather than one rect per grid cell — the ground
 * is a solid fill, so there is nothing per-pixel to gain from doing it that
 * way, and it keeps the DOM light. */
const GRASS_BLADES = Array.from({ length: Math.ceil(W / 5) }, (_, i) => i * 5 + 2);

export default function MenuScene() {
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMax slice"
      shape-rendering="crispEdges"
      className="menu-scene__svg"
    >
      <rect x={0} y={GRASS_TOP} width={W} height={2} fill="#49b84a" />
      <rect x={0} y={GRASS_TOP + 2} width={W} height={DIRT_TOP - GRASS_TOP - 2} fill="#2d8a34" />
      <rect x={0} y={DIRT_TOP} width={W} height={2} fill="#7a4a2a" />
      <rect x={0} y={DIRT_TOP + 2} width={W} height={H - DIRT_TOP - 2} fill="#5a3620" />
      {GRASS_BLADES.map((x) => (
        <rect key={x} x={x} y={GRASS_TOP - 1} width={1} height={1} fill="#49b84a" />
      ))}
      {OBJECT_CELLS.map((c, i) => (
        <rect key={i} x={c.x} y={c.y} width={1} height={1} fill={c.fill} />
      ))}
    </svg>
  );
}
