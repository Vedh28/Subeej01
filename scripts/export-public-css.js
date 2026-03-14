const { copyFileSync, existsSync, mkdirSync, readdirSync } = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const nextCssDir = path.join(projectRoot, ".next", "static", "css");
const publicDir = path.join(projectRoot, "public");
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
