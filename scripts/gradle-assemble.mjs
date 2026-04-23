import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyShortGradleUserHome } from "./win-short-gradle-home.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.join(__dirname, "..");
const androidDir = path.join(appRoot, "android");

applyShortGradleUserHome();

const gradlew = process.platform === "win32" ? "gradlew.bat" : "gradlew";
const args = process.argv.slice(2);
const result = spawnSync(path.join(androidDir, gradlew), args, {
  cwd: androidDir,
  stdio: "inherit",
  shell: process.platform === "win32",
  env: process.env,
});

process.exit(result.status === null ? 1 : result.status);
