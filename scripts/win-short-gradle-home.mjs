/**
 * Windows: Gradle + CMake + Prefab paths exceed MAX_PATH (260) when GRADLE_USER_HOME
 * sits under a deep repo path. Use a drive-root cache dir instead.
 */
import fs from "node:fs";
import path from "node:path";

export function applyShortGradleUserHome() {
  if (process.platform !== "win32") {
    return;
  }
  if (process.env.G_OPS_GRADLE_HOME) {
    const g = process.env.G_OPS_GRADLE_HOME;
    fs.mkdirSync(g, { recursive: true });
    process.env.GRADLE_USER_HOME = g;
    console.log("GRADLE_USER_HOME ->", g, "(from G_OPS_GRADLE_HOME)");
    return;
  }
  const root = path.parse(process.cwd()).root || "C:\\";
  const short = path.join(root, "ggradle");
  fs.mkdirSync(short, { recursive: true });
  process.env.GRADLE_USER_HOME = short;
  console.log("GRADLE_USER_HOME ->", short, "(short path; avoids Windows MAX_PATH in native builds)");
}
