// Copies MapLibre's web-worker files into public/ (runs before dev/build). MapLibre 6 starts its
// worker from a URL next to its own module, which a bundled chunk doesn't have — SiteMap.js
// points setWorkerUrl() here instead. Always copied from node_modules, so versions never drift.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const dist = dirname(require.resolve("maplibre-gl/package.json")) + "/dist";
const out = new URL("../public/vendor/maplibre/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
mkdirSync(out, { recursive: true });
for (const f of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) copyFileSync(join(dist, f), join(out, f));
console.log("maplibre worker → public/vendor/maplibre/");
