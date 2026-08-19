import { access, cp } from "node:fs/promises";
import path from "node:path";

// Next's `output: "standalone"` bundle deliberately omits static assets: the
// `.next/static` chunks and the `public/` folder must be copied in next to the
// traced `server.js` (Next documents this as the one manual step). Run as
// `postbuild` so the standalone tree is deploy-ready.
const webRoot = process.cwd(); // apps/web
const standaloneApp = path.join(webRoot, ".next/standalone/apps/web");

async function copyDir(src: string, dest: string): Promise<void> {
  try {
    await access(src);
  } catch {
    console.warn(`[standalone] skip (missing): ${src}`);
    return;
  }
  await cp(src, dest, { recursive: true });
  console.log(
    `[standalone] copied ${path.relative(webRoot, src)} -> ${path.relative(webRoot, dest)}`,
  );
}

async function main(): Promise<void> {
  await copyDir(
    path.join(webRoot, ".next/static"),
    path.join(standaloneApp, ".next/static"),
  );
  await copyDir(path.join(webRoot, "public"), path.join(standaloneApp, "public"));
  console.log("[standalone] assets ready");
}

main().catch((err) => {
  console.error("[standalone] asset copy failed:", err);
  process.exit(1);
});
