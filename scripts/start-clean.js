const { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

const projectRoot = path.resolve(__dirname, "..");
const nextServerDir = path.join(projectRoot, ".next", "server");
const nextChunksDir = path.join(nextServerDir, "chunks");
const nextCssDir = path.join(projectRoot, ".next", "static", "css");
const publicDir = path.join(projectRoot, "public");
const publicCssTarget = path.join(publicDir, "app-static.css");

function syncServerChunks() {
  if (!existsSync(nextServerDir) || !existsSync(nextChunksDir)) {
    return;
  }

  for (const entry of readdirSync(nextChunksDir)) {
    if (!entry.endsWith(".js")) {
      continue;
    }

    const source = path.join(nextChunksDir, entry);
    const target = path.join(nextServerDir, entry);

    if (existsSync(target)) {
      const sourceStat = statSync(source);
      const targetStat = statSync(target);
      if (sourceStat.size === targetStat.size) {
        continue;
      }
    }

    copyFileSync(source, target);
  }
}

function syncPublicCss() {
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

syncServerChunks();
syncPublicCss();

const nextBin = path.join(projectRoot, "node_modules", ".bin", process.platform === "win32" ? "next.cmd" : "next");
const child = spawn(nextBin, ["start", ...process.argv.slice(2)], {
  cwd: projectRoot,
  stdio: "inherit",
  shell: process.platform === "win32"
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
