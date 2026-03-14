const { existsSync, rmSync } = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

const projectRoot = path.resolve(__dirname, "..");
const nextDir = path.join(projectRoot, ".next");

if (existsSync(nextDir)) {
  rmSync(nextDir, { recursive: true, force: true });
  process.stdout.write("Cleared stale .next cache before starting dev server.\n");
}

const nextBin = path.join(projectRoot, "node_modules", ".bin", process.platform === "win32" ? "next.cmd" : "next");
const child = spawn(nextBin, ["dev", ...process.argv.slice(2)], {
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
