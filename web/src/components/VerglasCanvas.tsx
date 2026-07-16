import { useEffect, useRef } from "react";

/** THE INSTANT FREEZE — the page's single continuous generative ground.
    Supercooled rain streaks strike the surface and geometric ice cells
    snap-freeze in chain reaction (verglas: glaze ice forms the INSTANT
    rain touches). On scroll the horizontal bonds fade and the sheet
    becomes vertical RAILS (trust travels); the red band sends a light
    sweep down the rails; amber stamp artifacts in the DOM illuminate
    the ice beneath them. Canvas 2D, no WebGL, no stock video.
    Spec: Gemini brainstorm 2026-07-16 ("Instant Freeze", consensus 8/10). */

type Pt = { x: number; y: number };
type Edge = { a: number; b: number; alpha: number; target: number; born: number; horizontal: boolean };

const GRID = 96;
const JITTER = 34;
const NEIGHBORS = 3;
const DROP_SPEED = 22; // px/frame ≈ 1300px/s
const NEIGHBOR_DELAY = 42; // ms between cell chain reactions
const MAX_DROPS = 7;
const SPAWN_MS = 750; // steady freezing rain — the sheet never sleeps
const AUTO_SWEEP_MS = 7000; // ambient glass shine travelling the sheet
const REFREEZE_AFTER = 3000; // an impact re-ignites already-frozen cells

export function VerglasCanvas({ theme }: { theme: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const themeRef = useRef(theme);
  themeRef.current = theme;

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let W = 0;
    let H = 0;
    let pts: Pt[] = [];
    let edges: Edge[] = [];
    let adj: number[][] = [];
    let raf = 0;
    const drops: { x: number; y: number; targetY: number; len: number }[] = [];
    const queue: { edge: number; at: number }[] = [];
    const mouse = { x: -9999, y: -9999 };
    let sweepStart = -1;
    let sweepRed = false;
    let lastSpawn = 0;
    let lastAutoSweep = 0;
    let bootDone = false;

    const build = () => {
      if (window.innerWidth === W && window.innerHeight === H && pts.length) return;
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
      pts = [];
      const cols = Math.ceil(W / GRID) + 2;
      const rows = Math.ceil(H / GRID) + 2;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          pts.push({
            x: c * GRID - GRID / 2 + (Math.random() * 2 - 1) * JITTER,
            y: r * GRID - GRID / 2 + (Math.random() * 2 - 1) * JITTER,
          });
        }
      }
      edges = [];
      adj = pts.map(() => []);
      const seen = new Set<string>();
      pts.forEach((p, i) => {
        const near = pts
          .map((q, j) => ({ j, d: (q.x - p.x) ** 2 + (q.y - p.y) ** 2 }))
          .filter((o) => o.j !== i)
          .sort((a, b) => a.d - b.d)
          .slice(0, NEIGHBORS);
        near.forEach(({ j }) => {
          const key = i < j ? `${i}-${j}` : `${j}-${i}`;
          if (seen.has(key)) return;
          seen.add(key);
          const dx = Math.abs(pts[i].x - pts[j].x);
          const dy = Math.abs(pts[i].y - pts[j].y);
          edges.push({ a: i, b: j, alpha: 0, target: 1, born: 0, horizontal: dx > dy });
          const e = edges.length - 1;
          adj[i].push(e);
          adj[j].push(e);
        });
      });
      queue.length = 0;
      if (reduced) {
        // static, fully frozen sheet
        const now = performance.now() - 5000;
        edges.forEach((e) => {
          e.alpha = 1;
          e.born = now;
        });
      } else {
        // (re)freeze the sheet: three strikes, glaze within ~1.2s
        setTimeout(() => freezeFrom(W * 0.28, H * 0.35), 200);
        setTimeout(() => freezeFrom(W * 0.72, H * 0.25), 480);
        setTimeout(() => {
          freezeFrom(W * 0.5, H * 0.72);
          bootDone = true;
        }, 780);
      }
    };

    const nearestPoint = (x: number, y: number) => {
      let best = 0;
      let bd = Infinity;
      pts.forEach((p, i) => {
        const d = (p.x - x) ** 2 + (p.y - y) ** 2;
        if (d < bd) {
          bd = d;
          best = i;
        }
      });
      return best;
    };

    const freezeFrom = (x: number, y: number) => {
      const start = nearestPoint(x, y);
      const now = performance.now();
      const visited = new Set<number>();
      let frontier = [start];
      let wave = 0;
      while (frontier.length && wave < 40) {
        const next: number[] = [];
        frontier.forEach((n) => {
          adj[n].forEach((ei) => {
            if (visited.has(ei)) return;
            visited.add(ei);
            queue.push({ edge: ei, at: now + wave * NEIGHBOR_DELAY });
            const other = edges[ei].a === n ? edges[ei].b : edges[ei].a;
            next.push(other);
          });
        });
        frontier = next;
        wave++;
      }
    };

    const spawnDrop = () => {
      const x = Math.random() * W;
      drops.push({ x, y: -80, targetY: 60 + Math.random() * (H * 0.8), len: 44 + Math.random() * 40 });
    };

    const onMove = (e: PointerEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };
    const onSweep = () => {
      sweepStart = performance.now();
      sweepRed = true;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("verglas-sweep", onSweep);
    window.addEventListener("resize", build);
    build();

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      const dark = themeRef.current !== "light";
      ctx.clearRect(0, 0, W, H);

      const doc = document.documentElement;
      const progress = Math.min(1, window.scrollY / Math.max(1, doc.scrollHeight - window.innerHeight));
      // rails phase: horizontal bonds fade between 12%..35% scroll
      const railK = Math.min(1, Math.max(0, (progress - 0.12) / 0.23));
      const calm = progress > 0.9 ? 0.55 : 1;

      // activate queued freeze edges (re-ignite old ice: every impact flashes)
      for (let i = queue.length - 1; i >= 0; i--) {
        if (queue[i].at <= now) {
          const e = edges[queue[i].edge];
          if (e.born === 0 || now - e.born > REFREEZE_AFTER) e.born = now;
          queue.splice(i, 1);
        }
      }

      // steady freezing rain — the storm never stops
      if (!reduced && bootDone && now - lastSpawn > SPAWN_MS && drops.length < MAX_DROPS) {
        lastSpawn = now;
        spawnDrop();
      }

      // ambient glass shine sweeping the sheet on its own rhythm
      if (!reduced && bootDone && sweepStart < 0 && now - lastAutoSweep > AUTO_SWEEP_MS) {
        lastAutoSweep = now;
        sweepStart = now;
        sweepRed = false;
      }
      const lineBase = dark ? "220, 236, 255" : "22, 32, 50";
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i];
        d.y += DROP_SPEED;
        const g = ctx.createLinearGradient(d.x, d.y - d.len, d.x, d.y);
        g.addColorStop(0, `rgba(${lineBase}, 0)`);
        g.addColorStop(1, `rgba(${lineBase}, ${dark ? 0.5 : 0.35})`);
        ctx.strokeStyle = g;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(d.x, d.y - d.len);
        ctx.lineTo(d.x, d.y);
        ctx.stroke();
        if (d.y >= d.targetY) {
          freezeFrom(d.x, d.targetY);
          drops.splice(i, 1);
        }
      }

      // sweep pulse travelling down the rails (fired by the red band)
      let sweepY = -1;
      if (sweepStart > 0) {
        const t = (now - sweepStart) / 1400;
        if (t <= 1) sweepY = t * H;
        else sweepStart = -1;
      }

      // amber stamps in the DOM illuminate the ice beneath them
      const glows: { x: number; y: number }[] = [];
      document.querySelectorAll<HTMLElement>("[data-ice-glow]").forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.bottom > 0 && r.top < H) glows.push({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
      });

      const settle = dark ? 0.3 : 0.22;
      edges.forEach((e, ei) => {
        if (e.born === 0) return;
        const age = now - e.born;
        // snap: bright at impact, settle into the sheet
        const flash = age < 800 ? 1 - (age / 800) * 0.65 : 0.35;
        let alpha = Math.min(1, age / 120) * flash * (settle / 0.35);
        // the sheet breathes: slow per-edge shimmer, phase-offset so the
        // whole glaze glimmers like ice under moving light
        alpha += Math.sin(now / 1600 + ei * 0.7) * 0.05 + 0.02;
        // random crack-sparkle: brief twinkles across the surface
        const tw = Math.sin(now / 230 + ei * 3.1);
        if (tw > 0.997) alpha += 0.35;
        if (e.horizontal) alpha *= 1 - railK * 0.92;
        else alpha *= 1 + railK * 0.7;
        const pa = pts[e.a];
        const pb = pts[e.b];
        // pointer glare: the sheet is glass — edges catch the light
        const mx = (pa.x + pb.x) / 2;
        const my = (pa.y + pb.y) / 2;
        const md = Math.hypot(mx - mouse.x, my - mouse.y);
        if (md < 320) alpha += (1 - md / 320) * (dark ? 0.22 : 0.16);
        const inSweep = sweepY >= 0 && Math.abs(my - sweepY) < 130;
        if (inSweep) alpha += sweepRed ? (e.horizontal ? 0.1 : 0.45) : 0.28;
        glows.forEach((g) => {
          const gd = Math.hypot(mx - g.x, my - g.y);
          if (gd < 200) alpha += (1 - gd / 200) * 0.3;
        });
        alpha *= calm;
        if (alpha <= 0.004) return;
        ctx.strokeStyle =
          inSweep && sweepRed && !e.horizontal
            ? `rgba(232, 65, 66, ${Math.min(0.6, alpha)})`
            : `rgba(${lineBase}, ${Math.min(0.55, alpha)})`;
        ctx.lineWidth = e.horizontal ? 1 : 1 + railK * 0.7;
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.stroke();
      });

      // cursor specular
      if (mouse.x > 0 && !reduced) {
        const rg = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 380);
        rg.addColorStop(0, `rgba(${lineBase}, ${dark ? 0.05 : 0.045})`);
        rg.addColorStop(1, `rgba(${lineBase}, 0)`);
        ctx.fillStyle = rg;
        ctx.fillRect(mouse.x - 380, mouse.y - 380, 760, 760);
      }
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("verglas-sweep", onSweep);
      window.removeEventListener("resize", build);
    };
  }, []);

  return <canvas ref={ref} className="verglas-canvas" aria-hidden="true" />;
}
