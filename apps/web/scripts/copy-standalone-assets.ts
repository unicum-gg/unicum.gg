import { access, cp } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

// Next's `output: "standalone"` bundle deliberately omits static assets: the
// `.next/static` chunks and the `public/` folder must be copied in next to the
// traced `server.js` (Next documents this as the one manual step). Run as
// `postbuild` so the standalone tree is deploy-ready.
const webRoot = process.cwd(); // apps/web
// Mirrors `next.config.ts`, which allows a side-by-side output directory. Read
// here too, or a build into one leaves its assets beside the OTHER build's
// `server.js` and reports success doing it.
const distDir = process.env.NEXT_DIST_DIR || ".next";
const standaloneApp = path.join(webRoot, distDir, "standalone/apps/web");

// Must mirror `serverExternalPackages` in `next.config.ts`.
//
// An external package is kept out of the bundle and the tracer does copy its
// files into the standalone tree, but under pnpm they land only at their real
// `node_modules/.pnpm/<name>@<version>/node_modules/<name>` path, with no link
// from `apps/web/node_modules`. That is the only place Node's lookup from
// `server.js` would find them: `ioredis` and `next` have one because Next
// links what IT requires, and a package only our own code requires gets none,
// so `require()` throws MODULE_NOT_FOUND in the container.
//
// Every local check passes meanwhile, which is what makes this worth a step of
// its own rather than a note: the standalone tree sits inside the repository,
// so a lookup run here escapes into the workspace's own `node_modules` and
// resolves against the source rather than the output.
//
// Copied rather than linked. A link into `.pnpm` holds only for as long as
// whatever assembles the image carries that tree as well, and the copy also
// puts a package's own data files (`tiktoken_bg.wasm`, 5.6 MB, which its
// loader looks for by walking up from `__dirname`) on that search path.
const RUNTIME_EXTERNAL_PACKAGES = ["tiktoken"];

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

async function copyExternalPackages(): Promise<void> {
  const resolve = createRequire(path.join(webRoot, "package.json")).resolve;
  for (const name of RUNTIME_EXTERNAL_PACKAGES) {
    let packageRoot: string;
    try {
      // The entry point rather than `<name>/package.json`, which a package is
      // free not to export (tiktoken does not).
      packageRoot = path.dirname(resolve(name));
    } catch {
      console.warn(`[standalone] skip (unresolved): ${name}`);
      continue;
    }
    await copyDir(packageRoot, path.join(standaloneApp, "node_modules", name));
  }
}

async function main(): Promise<void> {
  await copyDir(
    path.join(webRoot, distDir, "static"),
    path.join(standaloneApp, ".next/static"),
  );
  await copyDir(path.join(webRoot, "public"), path.join(standaloneApp, "public"));
  await copyExternalPackages();
  console.log("[standalone] assets ready");
}

main().catch((err) => {
  console.error("[standalone] asset copy failed:", err);
  process.exit(1);
});
