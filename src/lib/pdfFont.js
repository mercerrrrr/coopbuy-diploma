import path from "path";
import fs from "fs";

export function getDejaVuFontPath() {
  const p = path.join(process.cwd(), "node_modules", "dejavu-fonts-ttf", "ttf", "DejaVuSans.ttf");
  if (!fs.existsSync(p)) {
    throw new Error(`DejaVu font not found at ${p}. Run: npm i dejavu-fonts-ttf`);
  }
  return p;
}
