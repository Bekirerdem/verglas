/* Cinematic grounds (Pexels, free license). The site is verglas: ice forming
   over the content. Poster keeps the first paint instant. */
export const HERO_VIDEO = "https://videos.pexels.com/video-files/36139877/15326251_1920_1080_60fps.mp4";
export const TEXTURE_VIDEO = "https://videos.pexels.com/video-files/6805362/6805362-hd_1920_1080_30fps.mp4";
export const HERO_POSTER =
  "https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=1600&auto=format&fit=crop";

export const REDUCED = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
