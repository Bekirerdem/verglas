import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Verglas Docs",
  description: "ZK-verified agent trust that travels across every Avalanche L1.",
  base: "/docs/",
  head: [
    ["link", { rel: "icon", type: "image/png", href: "/favicon-32.png" }],
    ["link", { rel: "preconnect", href: "https://fonts.googleapis.com" }],
    ["link", { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "" }],
    [
      "link",
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=BioRhyme:wght@700;800&family=Inter:wght@400;500;550;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap",
      },
    ],
  ],
  themeConfig: {
    logo: "/docs/mark.png",
    nav: [
      { text: "verglas.xyz", link: "https://verglas.xyz" },
      { text: "Console", link: "https://verglas.xyz/app/" },
      { text: "GitHub", link: "https://github.com/Bekirerdem/verglas" },
    ],
    sidebar: [
      {
        text: "Concepts",
        items: [
          { text: "What is Verglas?", link: "/" },
          { text: "Architecture", link: "/architecture" },
          { text: "Proof System", link: "/proofs" },
          { text: "Naming & Glossary", link: "/glossary" },
        ],
      },
      {
        text: "Build",
        items: [
          { text: "Contracts & Addresses", link: "/contracts" },
          { text: "TypeScript SDK", link: "/sdk" },
          { text: "Verglas Treasurer", link: "/treasurer" },
          { text: "Run the Live Demo", link: "/demo" },
        ],
      },
    ],
    socialLinks: [{ icon: "github", link: "https://github.com/Bekirerdem/verglas" }],
  },
});
