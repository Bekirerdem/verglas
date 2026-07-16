import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Verglas Docs",
  description: "ZK-verified agent trust that travels across every Avalanche L1.",
  base: "/docs/",
  head: [["link", { rel: "icon", type: "image/png", href: "/favicon-32.png" }]],
  themeConfig: {
    logo: "/docs/mark.png",
    nav: [
      { text: "verglas.xyz", link: "https://verglas.xyz" },
      { text: "GitHub", link: "https://github.com/Bekirerdem/verglas" },
    ],
    sidebar: [
      {
        text: "Concepts",
        items: [
          { text: "What is Verglas?", link: "/" },
          { text: "Architecture", link: "/architecture" },
          { text: "Proof System", link: "/proofs" },
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
