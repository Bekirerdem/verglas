// Builds the full public site: landing (web/) + docs (docs/) merged into
// web/dist, ready for `wrangler pages deploy web/dist --project-name=verglas`.
// Run from the repo root: node scripts/build-site.mjs
import { execSync } from "node:child_process";
import { cpSync, rmSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

const run = (cmd, cwd) => {
  console.log(`\n$ ${cmd}  (${cwd})`);
  execSync(cmd, { cwd: join(root, cwd), stdio: "inherit" });
};

run("npm run build", "web");
run("npm run build", "docs");

const src = join(root, "docs/.vitepress/dist");
const dst = join(root, "web/dist/docs");
rmSync(dst, { recursive: true, force: true });
cpSync(src, dst, { recursive: true });
console.log(`\ndocs merged -> web/dist/docs`);
console.log("deploy: npx wrangler pages deploy web/dist --project-name=verglas --commit-dirty=true");
