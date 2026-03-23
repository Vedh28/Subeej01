const { copyFileSync, existsSync, mkdirSync, readdirSync } = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const appDir = path.join(projectRoot, "frontend");
const nextCssDir = path.join(appDir, ".next", "static", "css");
const publicDir = path.join(appDir, "public");
const publicCssTarget = path.join(publicDir, "app-static.css");

function exportCss() {
  if (!existsSync(nextCssDir)) {
    return;
  }

  const cssFiles = readdirSync(nextCssDir).filter((entry) => entry.endsWith(".css"));
  if (!cssFiles.length) {
    return;
  }

  mkdirSync(publicDir, { recursive: true });
  copyFileSync(path.join(nextCssDir, cssFiles[0]), publicCssTarget);
}

exportCss();
