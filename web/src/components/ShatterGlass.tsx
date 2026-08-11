import { useEffect, useRef } from "react";

/** The hero's shattered pane: a jittered triangle mosaic hovering slightly
    out of place — and where the pointer travels, the shards pull home,
    edges brighten, the glass becomes whole. The brand gesture inverted:
    rules turn scatter into a pane. Canvas 2D, cheap (~90 triangles),
    static-whole under prefers-reduced-motion. */

type Shard = {
  ax: number; ay: number; bx: number; by: number; cx: number; cy: number;
  ox: number; oy: number; // centroid
  dx: number; dy: number; rot: number; // scattered offset
  k: number; // 0 = scattered, 1 = home
  phase: number;
};

const COLS = 12;
const ROWS = 7;
const JITTER = 0.32; // of cell size
const SCATTER = 26;
const RADIUS = 300;

/** Deterministic pseudo-random from an index — no Math.random so the pane
    shatters the same way on every visit. */
const rnd = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

export function ShatterGlass() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const host = canvas.parentElement!;
    const ctx = canvas.getContext("2d")!;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let W = 0;
    let H = 0;
    let shards: Shard[] = [];
    let raf = 0;
    const mouse = { x: -9999, y: -9999 };

    const build = () => {
      const r = host.getBoundingClientRect();
      W = canvas.width = Math.max(1, Math.round(r.width));
      H = canvas.height = Math.max(1, Math.round(r.height));
      const cw = W / COLS;
      const ch = H / ROWS;
      // shared jittered grid corners so shards tile a real pane
      const px: number[][] = [];
      const py: number[][] = [];
      for (let y = 0; y <= ROWS; y++) {
        px[y] = [];
        py[y] = [];
        for (let x = 0; x <= COLS; x++) {
          const i = y * (COLS + 1) + x;
          const edge = x === 0 || y === 0 || x === COLS || y === ROWS;
          px[y][x] = x * cw + (edge ? 0 : (rnd(i) * 2 - 1) * cw * JITTER);
          py[y][x] = y * ch + (edge ? 0 : (rnd(i + 999) * 2 - 1) * ch * JITTER);
        }
      }
      shards = [];
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          const i = (y * COLS + x) * 3;
          const corners = [
            [px[y][x], py[y][x]],
            [px[y][x + 1], py[y][x + 1]],
            [px[y + 1][x + 1], py[y + 1][x + 1]],
            [px[y + 1][x], py[y + 1][x]],
          ];
          // split the quad along a per-cell diagonal
          const flip = rnd(i) > 0.5;
          const tris = flip
            ? [[corners[0], corners[1], corners[2]], [corners[0], corners[2], corners[3]]]
            : [[corners[0], corners[1], corners[3]], [corners[1], corners[2], corners[3]]];
          tris.forEach((t, j) => {
            const ox = (t[0][0] + t[1][0] + t[2][0]) / 3;
            const oy = (t[0][1] + t[1][1] + t[2][1]) / 3;
            shards.push({
              ax: t[0][0], ay: t[0][1], bx: t[1][0], by: t[1][1], cx: t[2][0], cy: t[2][1],
              ox, oy,
              dx: (rnd(i + j * 7 + 1) * 2 - 1) * SCATTER,
              dy: (rnd(i + j * 7 + 2) * 2 - 1) * SCATTER,
              rot: (rnd(i + j * 7 + 3) * 2 - 1) * 0.075,
              k: reduced ? 1 : 0,
              phase: rnd(i + j) * Math.PI * 2,
            });
          });
        }
      }
    };

    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left;
      mouse.y = e.clientY - r.top;
    };
    const onLeave = () => {
      mouse.x = -9999;
      mouse.y = -9999;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerout", onLeave, { passive: true });
    window.addEventListener("resize", build);
    build();

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      ctx.clearRect(0, 0, W, H);
      const t = now / 1000;
      for (const s of shards) {
        const d = Math.hypot(s.ox - mouse.x, s.oy - mouse.y);
        const target = reduced ? 1 : Math.max(0, 1 - d / RADIUS);
        s.k += (target - s.k) * 0.07; // gentle settle, no bounce
        const drift = reduced ? 0 : Math.sin(t * 0.7 + s.phase) * 1.6;
        const f = 1 - s.k;
        const mx = s.dx * f + drift * f;
        const my = s.dy * f + drift * f * 0.6;
        const rot = s.rot * f;
        ctx.save();
        ctx.translate(s.ox + mx, s.oy + my);
        ctx.rotate(rot);
        ctx.translate(-s.ox, -s.oy);
        ctx.beginPath();
        ctx.moveTo(s.ax, s.ay);
        ctx.lineTo(s.bx, s.by);
        ctx.lineTo(s.cx, s.cy);
        ctx.closePath();
        ctx.fillStyle = `rgba(207, 230, 245, ${0.012 + s.k * 0.028})`;
        ctx.fill();
        ctx.strokeStyle = `rgba(207, 230, 245, ${0.07 + s.k * 0.3})`;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
      }
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerout", onLeave);
      window.removeEventListener("resize", build);
    };
  }, []);

  return <canvas ref={ref} className="shatter-glass" aria-hidden="true" />;
}
