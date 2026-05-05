/**
 * Expo config plugin: on Windows, merge Gradle properties that reduce
 * daemon/worker locking and path issues during local Android builds.
 * Safe no-op on macOS/Linux.
 */
const { withGradleProperties } = require("@expo/config-plugins");

const WIN32_PROPS = [
  { key: "org.gradle.workers.max", value: "2" },
  { key: "org.gradle.vfs.watch", value: "false" },
  // Keep Kotlin daemon enabled (default). Forcing false caused parallel-build flakes with Skia + Expo Kotlin.
  { key: "org.gradle.configuration-cache", value: "false" },
];

function upsertProperty(modResults, key, value) {
  const idx = modResults.findIndex(
    (item) => item.type === "property" && item.key === key,
  );
  if (idx >= 0) {
    modResults[idx].value = value;
  } else {
    modResults.push({ type: "property", key, value });
  }
}

function withAndroidWindowsGradleProps(config) {
  if (process.platform !== "win32") {
    return config;
  }
  return withGradleProperties(config, (cfg) => {
    for (const { key, value } of WIN32_PROPS) {
      upsertProperty(cfg.modResults, key, value);
    }
    return cfg;
  });
}

module.exports = withAndroidWindowsGradleProps;
