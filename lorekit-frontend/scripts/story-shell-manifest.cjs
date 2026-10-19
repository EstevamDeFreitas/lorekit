const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const root = path.resolve(__dirname, "../dist/lorekit-frontend/browser");
function files(directory) {
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory()
        ? files(path.join(directory, entry.name))
        : [path.join(directory, entry.name)],
    );
}
const assets = files(root)
  .map((file) => path.relative(root, file).replaceAll(path.sep, "/"))
  .filter(
    (file) =>
      /\.(js|css|woff2?|ttf|wasm|png|svg|ico)$/.test(file) &&
      file !== "story-worker.js",
  )
  .sort();
const hash = createHash("sha256");
for (const asset of assets) {
  hash.update(asset);
  hash.update(fs.readFileSync(path.join(root, asset)));
}
hash.update(fs.readFileSync(path.join(root, "index.html")));
const version = hash.digest("hex").slice(0, 20);
fs.writeFileSync(
  path.join(root, "story-shell-manifest.json"),
  JSON.stringify({
    version,
    assets: ["/index.html", ...assets.map((asset) => "/" + asset)],
  }),
);
const worker = path.join(root, "story-worker.js");
fs.writeFileSync(
  worker,
  fs.readFileSync(worker, "utf8").replace("__LOREKIT_SHELL_VERSION__", version),
);
console.log(
  `Story offline shell: ${assets.length + 1} assets, version ${version}`,
);
