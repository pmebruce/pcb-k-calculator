import { readFile, readdir, writeFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

const root = path.resolve("dist/client");
const template = await readFile("scripts/sw-template.js", "utf8");
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/$/, "");
const routeRoot = basePath || "/";
const assetRoot = basePath ? `${basePath}/` : "/";
const routePcb = `${basePath}/pcb-k`;
const assetPcb = `${basePath}/pcb-k/`;
const routeInstall = `${basePath}/install-v3`;
const assetInstall = `${basePath}/install-v3/`;
const withBase = (pathname) => `${basePath}${pathname}`;

await stat(path.join(root, "index.html"));
async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => entry.isDirectory() ? walk(path.join(directory, entry.name)) : [path.join(directory, entry.name)]));
  return nested.flat();
}

const files = await walk(root);
const installPage = ["pcb-k/index.html", "pcb-k.html"].find((name) => files.includes(path.join(root, name)));
if (!installPage) throw new Error("Missing /pcb-k/ installation page");
const installV3Page = ["install-v3/index.html", "install-v3.html"].find((name) => files.includes(path.join(root, name)));
if (!installV3Page) throw new Error("Missing /install-v3/ installation page");

for (const manifestName of ["manifest.webmanifest", "pcb-k.webmanifest"]) {
  const manifestPath = path.join(root, manifestName);
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  manifest.id = assetRoot;
  manifest.scope = assetRoot;
  manifest.start_url = `${assetInstall}?source=homescreen`;
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

const routeFiles = new Map([[assetRoot, "index.html"], [assetPcb, installPage], [assetInstall, installV3Page]]);
const routeCacheKeys = [[routeRoot, assetRoot], [routePcb, assetPcb], [routeInstall, assetInstall]];
const publicFiles = files.filter((file) => /\.(js|css|woff2?|ttf)$/.test(file) && !file.endsWith("/sw.js") && !file.includes("/."));
const copperTables = [3, 4, 5].flatMap((number) => ["svg", "png"].map((extension) => withBase(`/examples/pcb-table-${number}-v1.${extension}`)));
const paths = [
  assetRoot,
  assetPcb,
  assetInstall,
  withBase("/manifest.webmanifest"),
  withBase("/pcb-k.webmanifest"),
  withBase("/examples/pcb-stackup-v1.svg"),
  withBase("/examples/pcb-stackup-v1.png"),
  ...copperTables,
  withBase("/apple-touch-icon.png"),
  withBase("/apple-touch-icon-precomposed.png"),
  withBase("/icons/pcb-apple-v3.png"),
  withBase("/icons/pcb-192-v3.png"),
  withBase("/icons/pcb-512-v3.png"),
  withBase("/icons/pcb-maskable-v3.png"),
  ...publicFiles.map((file) => withBase("/" + path.relative(root, file).split(path.sep).join("/"))),
].sort();

function outputFile(asset) {
  const relative = basePath && asset.startsWith(basePath) ? asset.slice(basePath.length) : asset;
  return path.join(root, routeFiles.get(asset) ?? relative.replace(/^\//, ""));
}

const digest = createHash("sha256").update(template);
for (const asset of paths) {
  digest.update(asset);
  digest.update(await readFile(outputFile(asset)));
}
const cacheName = `pcb-shell-${digest.digest("hex").slice(0, 14)}`;
const output = template
  .replace("__CACHE_NAME__", cacheName)
  .replace("__PRECACHE_ASSETS__", JSON.stringify(paths, null, 2))
  .replace("__APP_ROUTE_CACHE_KEYS__", JSON.stringify(routeCacheKeys, null, 2));
await writeFile(path.join(root, "sw.js"), output);
await writeFile(path.join(root, ".nojekyll"), "");
console.log(`PWA: ${paths.length} resources under ${assetRoot}, complete offline shell generated.`);
