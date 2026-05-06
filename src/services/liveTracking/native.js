import { NativeModules, Platform } from "react-native";

const NativeTracking = NativeModules.GopsTracking;

function unavailableHealth() {
  return {
    trackingActive: false,
    nativeServiceRunning: false,
    foregroundLocationGranted: false,
    backgroundLocationGranted: false,
    notificationGranted: false,
    gpsEnabled: false,
    networkConnected: false,
    batteryOptimizationIgnored: false,
    lastPingAt: null,
    lastComplianceReason: null,
    queuedPingCount: 0,
    queuedComplianceCount: 0,
  };
}

export function isNativeTrackingAvailable() {
  return Platform.OS === "android" && !!NativeTracking;
}

export async function startNativeTracking(config) {
  if (!isNativeTrackingAvailable()) return unavailableHealth();
  return NativeTracking.startNativeTracking(config);
}

export async function stopNativeTracking() {
  if (!isNativeTrackingAvailable()) return unavailableHealth();
  return NativeTracking.stopNativeTracking();
}

/** Push session + JWT + API URL into native prefs and restart the foreground service. */
export async function syncNativeTrackingStateWithConfig(config) {
  if (!isNativeTrackingAvailable()) return unavailableHealth();
  return NativeTracking.syncNativeTrackingState(config);
}

export async function startComplianceAlarm(reason) {
  if (!isNativeTrackingAvailable()) return false;
  return NativeTracking.startComplianceAlarm(reason);
}

export async function stopComplianceAlarm() {
  if (!isNativeTrackingAvailable()) return false;
  return NativeTracking.stopComplianceAlarm();
}

export async function openBatteryOptimizationSettings() {
  if (!isNativeTrackingAvailable()) return false;
  return NativeTracking.openBatteryOptimizationSettings();
}

export async function getNativeTrackingHealth() {
  if (!isNativeTrackingAvailable()) return unavailableHealth();
  return NativeTracking.getTrackingHealth();
}
