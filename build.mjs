// Builds the single-file plugin Buzz loads: plugin.js (no imports, no CSS, no assets).
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
const version = JSON.parse(readFileSync(new URL("./package.json", import.meta.url))).version;
const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const art = Object.fromEntries(
  readdirSync(new URL("./art/", import.meta.url)).filter((f) => f.endsWith(".svg"))
    .map((f) => [f.replace(".svg", ""), "data:image/svg+xml;base64," + Buffer.from(read("./art/" + f)).toString("base64")]),
);
const out = [
  "// Agent Access " + version + " — a Buzz API v1 plugin. Built from src/ by build.mjs; edit those files, not this one.",
  "// Illustrations: Open Peeps and Open Doodles by Pablo Stanley, CC0 1.0. Icons: Lucide, ISC.",
  "",
  read("./src/core.js"),
  `const VERSION = ${JSON.stringify(version)};`,
  `const ART = ${JSON.stringify(art)};`,
  read("./src/icons.js"),
  read("./src/runtime.js"),
  read("./src/ui.js"),
].join("\n");
writeFileSync(new URL("./plugin.js", import.meta.url), out);
console.log(`plugin.js ${(out.length / 1024).toFixed(0)} KB`);
