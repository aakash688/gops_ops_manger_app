import { Platform } from "react-native";
import * as FileSystem from "expo-file-system";

const REMOTE_SIREN_URL = "https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg";
const LOCAL_NAME = "gops_siren_alarm.ogg";

/**
 * Ensures we have a local siren file stored in cache.
 * This lets audio keep working even when mobile data is turned off.
 */
export async function ensureLocalSirenUri() {
  if (Platform.OS === "web") return null;
  const base = FileSystem.cacheDirectory || FileSystem.documentDirectory;
  if (!base) return REMOTE_SIREN_URL;
  const localUri = `${base}${LOCAL_NAME}`;

  try {
    const info = await FileSystem.getInfoAsync(localUri);
    if (info.exists && info.size && info.size > 10_000) {
      return localUri;
    }
  } catch {
    // ignore and try download
  }

  try {
    const res = await FileSystem.downloadAsync(REMOTE_SIREN_URL, localUri);
    if (res?.uri) return res.uri;
  } catch {
    // If download fails (no network), return remote URL; vibration will still work.
  }

  return REMOTE_SIREN_URL;
}

