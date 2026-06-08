import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const srcDir = path.join(root, "node_modules", "monaco-editor", "min", "vs");
const destDir = path.join(root, "public", "monaco", "vs");

if (!fs.existsSync(srcDir)) {
  console.error("monaco-editor is not installed; run npm install first.");
  process.exit(1);
}

fs.rmSync(path.join(root, "public", "monaco"), { recursive: true, force: true });
fs.mkdirSync(destDir, { recursive: true });
fs.cpSync(srcDir, destDir, { recursive: true });

console.log("Synced Monaco assets to public/monaco/vs/");
