import { spawnSync } from "node:child_process";
import { applyShortGradleUserHome } from "./win-short-gradle-home.mjs";

applyShortGradleUserHome();

const args = ["expo", "run:android", ...process.argv.slice(2)];
const result = spawnSync("npx", args, {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: process.env,
});

process.exit(result.status === null ? 1 : result.status);
