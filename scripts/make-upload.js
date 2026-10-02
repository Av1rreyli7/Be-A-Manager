// Makes site/upload: a clean copy of everything that belongs on GitHub.
// Run: npm run upload
// Left out on purpose: node_modules, .next, the upload folder itself, the Floodlights save file,
// build leftovers and computer junk.
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const out = path.join(root, "upload");

const TOP = [
  "package.json", "package-lock.json", "server.js", "next.config.ts", "tsconfig.json", "tsconfig.build.json", "postcss.config.mjs",
  "eslint.config.mjs", "vitest.config.ts", ".gitignore", ".node-version", "render.yaml",
  "README.md", "DEPLOY.md", "PROGRESS.md", "AGENTS.md", "CLAUDE.md",
  "src", "public", "data", "scripts", "tests", "tests-site", "floodlights"
];
const SKIP_NAMES = new Set(["node_modules", ".next", ".DS_Store", "games.json", "upload", ".cache", "Thumbs.db"]);
const skip = name => SKIP_NAMES.has(name) || name.endsWith(".tsbuildinfo") || name.endsWith(".log");

let files = 0, bytes = 0;
function copy(from, to) {
  const st = fs.statSync(from);
  if (st.isDirectory()) {
    fs.mkdirSync(to, { recursive: true });
    for (const name of fs.readdirSync(from)) if (!skip(name)) copy(path.join(from, name), path.join(to, name));
  } else {
    fs.copyFileSync(from, to);
    files++;
    bytes += st.size;
  }
}

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const name of TOP) {
  const from = path.join(root, name);
  if (!fs.existsSync(from)) { console.log("missing, skipped: " + name); continue; }
  copy(from, path.join(out, name));
}
console.log("upload folder ready: " + files + " files, " + (bytes / 1024 / 1024).toFixed(1) + " MB");
