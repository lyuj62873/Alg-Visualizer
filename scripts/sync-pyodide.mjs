import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const srcDir = path.join(root, "node_modules", "pyodide");
const destDir = path.join(root, "public", "pyodide");

const FILES = [
  "pyodide.js",
  "pyodide.asm.js",
  "pyodide.asm.wasm",
  "python_stdlib.zip",
  "pyodide-lock.json",
];

if (!fs.existsSync(srcDir)) {
  console.error("pyodide is not installed; run npm install first.");
  process.exit(1);
}

fs.mkdirSync(destDir, { recursive: true });

for (const file of FILES) {
  const src = path.join(srcDir, file);
  if (!fs.existsSync(src)) {
    console.error(`Missing Pyodide file: ${file}`);
    process.exit(1);
  }
  fs.copyFileSync(src, path.join(destDir, file));
}

console.log(`Synced ${FILES.length} Pyodide files to public/pyodide/`);
