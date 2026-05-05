import { Platform } from "react-native";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import * as Battery from "expo-battery";
import NetInfo from "@react-native-community/netinfo";
import * as Application from "expo-application";
import * as Notifications from "expo-notifications";
import { LIVE_TRACKING_TASK } from "./constants";
import { useAuthStore } from "@/utils/auth/store";
import {
  getSessionId,
  setSessionMeta,
  clearSessionMeta,
  getPingIntervalSec,
  drainQueue,
  clearQueue,
  replaceQueue,
  drainComplianceQueue,
  clearComplianceQueue,
  replaceComplianceQueue,
  enqueueComplianceEvents,
  getOrCreateFallbackDeviceId,
  getPingComplianceQueueSnapshot,
} from "./storage";
import { apiPostJson, apiGetJson, getApiBaseUrl } from "@/utils/api";
import {
  startNativeTracking,
  stopNativeTracking,
  syncNativeTrackingState,
  getNativeTrackingHealth,
  isNativeTrackingAvailable,
  openBatteryOptimizationSettings,
} from "./native";

import "./task";

function networkLabel(state) {
  if (!state?.isConnected) return "OFFLINE";
  if (state.type === "wifi") return "WIFI";
  if (state.type === "cellular") return "CELLULAR";
  return "UNKNOWN";
}

function mergeTrackingHealth(native, js) {
  const nativeMod = isNativeTrackingAvailable();
  return {
    trackingActive: !!(native.trackingActive || js.trackingActive),
    nativeServiceRunning: !!(native.nativeServiceRunning || js.nativeServiceRunning),
    foregroundLocationGranted: !!(native.foregroundLocationGranted || js.foregroundLocationGranted),
    backgroundLocationGranted: !!(native.backgroundLocationGranted || js.backgroundLocationGranted),
    notificationGranted: !!(native.notificationGranted || js.notificationGranted),
    gpsEnabled: !!(native.gpsEnabled || js.gpsEnabled),
    networkConnected: !!(native.networkConnected || js.networkConnected),
    batteryOptimizationIgnored: nativeMod
      ? !!native.batteryOptimizationIgnored
      : !!js.batteryOptimizationIgnored,
    lastPingAt: native.lastPingAt || js.lastPingAt || null,
    lastComplianceReason: native.lastComplianceReason ?? js.lastComplianceReason ?? null,
    queuedPingCount: Math.max(
      Number(native.queuedPingCount) || 0,
      Number(js.queuedPingCount) || 0,
    ),
    queuedComplianceCount: Math.max(
      Number(native.queuedComplianceCount) || 0,
      Number(js.queuedComplianceCount) || 0,
    ),
  };
}

/** Expo / JS signals — matches what "Live session" uses when `GopsTracking` is not linked. */
async function buildJsTrackingHealthSnapshot() {
  const empty = {
    trackingActive: false,
    nativeServiceRunning: false,
    foregroundLocationGranted: false,
    backgroundLocationGranted: false,
    notificationGranted: false,
    gpsEnabled: false,
    networkConnected: false,
    batteryOptimizationIgnored: true,
    lastPingAt: null,
    lastComplianceReason: null,
    queuedPingCount: 0,
    queuedComplianceCount: 0,
  };
  if (Platform.OS === "web") return empty;

  const sid = await getSessionId().catch(() => null);
  const [
    netState,
    servicesEnabled,
    fgPerm,
    bgPerm,
    taskStarted,
    queueSnap,
    notifPerm,
  ] = await Promise.all([
    NetInfo.fetch().catch(() => null),
    Location.hasServicesEnabledAsync().catch(() => false),
    Location.getForegroundPermissionsAsync().catch(() => ({ status: "undetermined" })),
    Location.getBackgroundPermissionsAsync().catch(() => ({ status: "undetermined" })),
    Location.hasStartedLocationUpdatesAsync(LIVE_TRACKING_TASK).catch(() => false),
    getPingComplianceQueueSnapshot().catch(() => ({
      queuedPingCount: 0,
      queuedComplianceCount: 0,
      lastQueuedPingAt: null,
    })),
    Notifications.getPermissionsAsync().catch(() => ({ status: "undetermined" })),
  ]);

  const networkConnected = netState?.isConnected === true;
  const fgOk = fgPerm?.status === "granted";
  const bgOk = bgPerm?.status === "granted";
  const notificationGranted = notifPerm?.status === "granted";
  const taskRunning = !!taskStarted;
  const nativeServiceRunning = !!(sid && taskRunning);
  const gpsEnabled = !!(servicesEnabled && fgOk);

  return {
    ...empty,
    trackingActive: !!sid && taskRunning,
    nativeServiceRunning,
    foregroundLocationGranted: fgOk,
    backgroundLocationGranted: bgOk,
    notificationGranted,
    gpsEnabled,
    networkConnected,
    batteryOptimizationIgnored: true,
    lastPingAt: queueSnap.lastQueuedPingAt,
    queuedPingCount: queueSnap.queuedPingCount,
    queuedComplianceCount: queueSnap.queuedComplianceCount,
  };
}

async function enrichPing(p) {
  let batteryLevel = p.batteryLevel;
  if (batteryLevel == null) {
    try {
      const lvl = await Battery.getBatteryLevelAsync();
      if (typeof lvl === "number" && !Number.isNaN(lvl)) {
        batteryLevel = Math.round(lvl * 100);
      }
    } catch {
      /* ignore */
    }
  }
  let networkType = p.networkType;
  if (networkType == null) {
    try {
      const n = await NetInfo.fetch();
      networkType = networkLabel(n);
    } catch {
      networkType = "UNKNOWN";
    }
  }
  return { ...p, batteryLevel, networkType };
}

export async function flushPingQueue() {
  const sessionId = await getSessionId();
  if (!sessionId) return { flushed: 0 };
  const batch = await drainQueue();
  if (!batch.length) return { flushed: 0 };
  try {
    const enriched = await Promise.all(batch.map((p) => enrichPing(p)));
    await apiPostJson("/apps/live-tracking/pings", {
      sessionId,
      pings: enriched.map((p) => ({
        latitude: p.latitude,
        longitude: p.longitude,
        timestamp: p.timestamp,
        accuracyMeters: p.accuracyMeters ?? undefined,
        speedMps: p.speedMps ?? undefined,
        batteryLevel: p.batteryLevel ?? undefined,
        networkType: p.networkType ?? undefined,
        status: p.status ?? undefined,
        deviceInfo: p.deviceInfo ?? undefined,
      })),
    });
    await clearQueue();
    return { flushed: enriched.length };
  } catch {
    await replaceQueue(batch);
    return { flushed: 0, error: true };
  }
}

export async function flushComplianceQueue() {
  const sessionId = await getSessionId();
  const batch = await drainComplianceQueue();
  if (!batch.length) return { flushed: 0 };
  try {
    await apiPostJson("/apps/live-tracking/compliance", {
      sessionId: sessionId ?? null,
      events: batch,
    });
    await clearComplianceQueue();
    return { flushed: batch.length };
  } catch {
    await replaceComplianceQueue(batch);
    return { flushed: 0, error: true };
  }
}

export async function reportComplianceEvent(evt) {
  // evt: { type, status, startedAt?, endedAt?, severity?, metadata? }
  await enqueueComplianceEvents([evt]);
  await flushComplianceQueue();
}

async function deviceId() {
  try {
    if (Platform.OS === "android") {
      const id = Application.getAndroidId?.();
      if (id) return `android:${id}`;
    }
    if (Platform.OS === "ios") {
      const id = await Application.getIosIdForVendorAsync();
      if (id) return `ios:${id}`;
    }
  } catch {
    /* ignore */
  }
  return getOrCreateFallbackDeviceId();
}

/**
 * Start server session + background location updates.
 * @param {{ loginMethod?: 'PASSWORD'|'QR'|'FACE'|'REMOTE' }} opts
 */
export async function startLiveTracking(opts = {}) {
  if (Platform.OS === "web") return;
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== "granted") {
    throw new Error("Location permission is required for live tracking.");
  }
  const bg = await Location.requestBackgroundPermissionsAsync();
  if (bg.status !== "granted") {
    /* still start foreground-only; compliance overlay will nag */
  }

  const loginMethod = opts.loginMethod ?? "PASSWORD";
  const devId = await deviceId();
  const { data } = await apiPostJson("/apps/live-tracking/session/start", {
    deviceId: devId,
    loginMethod,
  });
  const sessionId = data?.sessionId;
  const pingIntervalSec = data?.pingIntervalSec ?? 90;
  if (!sessionId) throw new Error("No tracking session returned from server.");

  await setSessionMeta(sessionId, pingIntervalSec);
  const auth = useAuthStore.getState?.().auth;

  await startNativeTracking({
    employeeId: auth?.user?.employeeId ?? null,
    sessionId,
    apiBaseUrl: getApiBaseUrl(),
    token: auth?.jwt ?? null,
    pingIntervalSec,
  }).catch(() => {});

  const isTaskDefined = TaskManager.isTaskDefined(LIVE_TRACKING_TASK);
  if (!isTaskDefined) {
    throw new Error("Live tracking task is not registered.");
  }

  const already = await Location.hasStartedLocationUpdatesAsync(LIVE_TRACKING_TASK);
  if (already) {
    await Location.stopLocationUpdatesAsync(LIVE_TRACKING_TASK);
  }

  // Field sessions (REMOTE = GPS punch-in, QR = QR punch-in) use a 2-minute minimum interval.
  const fieldLoginMethods = new Set(["REMOTE", "QR"]);
  const minIntervalMs = fieldLoginMethods.has(loginMethod) ? 120_000 : 30_000;
  const intervalMs = Math.max(minIntervalMs, Math.min(600_000, pingIntervalSec * 1000));

  await Location.startLocationUpdatesAsync(LIVE_TRACKING_TASK, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: intervalMs,
    distanceInterval: 0,
    pausesUpdatesAutomatically: false,
    foregroundService: {
      notificationTitle: "Live tracking on",
      notificationBody: "Your location is shared with your organization during this session.",
      notificationColor: "#007AFF",
    },
    showsBackgroundLocationIndicator: true,
  });

  await flushPingQueue();
  return { sessionId, pingIntervalSec };
}

export async function stopLiveTracking() {
  await stopNativeTracking().catch(() => {});

  if (Platform.OS !== "web") {
    try {
      const started = await Location.hasStartedLocationUpdatesAsync(LIVE_TRACKING_TASK);
      if (started) {
        await Location.stopLocationUpdatesAsync(LIVE_TRACKING_TASK);
      }
    } catch {
      /* ignore */
    }
  }

  const sessionId = await getSessionId();
  if (sessionId) {
    // Flush pings first so offline queue reaches the server before the session closes.
    const flushResult = await flushPingQueue().catch(() => ({ flushed: 0, error: true }));
    try {
      await flushComplianceQueue();
    } catch {
      /* ignore */
    }
    try {
      await apiPostJson("/apps/live-tracking/session/end", { sessionId });
    } catch {
      /* ignore — session may already be closed server-side */
    }
    await clearSessionMeta();
    // Only wipe the queue if we confirmed a successful flush; otherwise keep for retry on next start.
    if (!flushResult?.error) {
      await clearQueue();
    }
  } else {
    await clearSessionMeta();
    await clearQueue();
  }
}

/** If we have a persisted session id (e.g. after app restart), restart native updates. */
export async function resumeLiveTrackingIfNeeded() {
  if (Platform.OS === "web") return;
  const sessionId = await getSessionId();
  if (!sessionId) return;

  const fg = await Location.getForegroundPermissionsAsync();
  if (fg.status !== "granted") return;

  const pingIntervalSec = await getPingIntervalSec();
  const intervalMs = Math.max(30_000, Math.min(600_000, pingIntervalSec * 1000));
  const auth = useAuthStore.getState?.().auth;

  await startNativeTracking({
    employeeId: auth?.user?.employeeId ?? null,
    sessionId,
    apiBaseUrl: getApiBaseUrl(),
    token: auth?.jwt ?? null,
    pingIntervalSec,
  }).catch(() => {});

  try {
    const already = await Location.hasStartedLocationUpdatesAsync(LIVE_TRACKING_TASK);
    if (already) return;

    await Location.startLocationUpdatesAsync(LIVE_TRACKING_TASK, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: intervalMs,
      distanceInterval: 0,
      pausesUpdatesAutomatically: false,
      foregroundService: {
        notificationTitle: "Live tracking on",
        notificationBody: "Your location is shared with your organization during this session.",
        notificationColor: "#007AFF",
      },
      showsBackgroundLocationIndicator: true,
    });
  } catch {
    /* permissions or task */
  }
}

export async function isLiveTrackingSessionActive() {
  if (Platform.OS === "web") return false;
  const sid = await getSessionId();
  if (!sid) return false;
  if (isNativeTrackingAvailable()) {
    const nativeHealth = await getNativeTrackingHealth().catch(() => null);
    if (nativeHealth?.nativeServiceRunning) return true;
  }
  try {
    return await Location.hasStartedLocationUpdatesAsync(LIVE_TRACKING_TASK);
  } catch {
    return false;
  }
}

export async function getLiveTrackingHealth() {
  const js = await buildJsTrackingHealthSnapshot();
  if (!isNativeTrackingAvailable()) {
    return js;
  }
  try {
    const native = await getNativeTrackingHealth();
    return mergeTrackingHealth(native, js);
  } catch {
    return js;
  }
}

/**
 * Align GPS tracking with field attendance: tracking runs only while a field check-in session is OPEN.
 * Call after login, app resume, and org switch. Safe on network errors (no-op).
 */
export async function syncLiveTrackingWithFieldSession() {
  if (Platform.OS === "web") return;
  try {
    const { data } = await apiGetJson("/apps/field-checkin/summary");
    const open = data?.activeSession != null;
    const sid = await getSessionId();
    if (open) {
      if (!sid) {
        await startLiveTracking({ loginMethod: "REMOTE" });
      } else {
        await resumeLiveTrackingIfNeeded();
      }
    } else if (sid) {
      await stopLiveTracking();
    }
  } catch {
    /* offline or user not field-check-in eligible — keep current local state */
  }
}

export { getSessionId } from "./storage";
export { syncNativeTrackingState, openBatteryOptimizationSettings };
