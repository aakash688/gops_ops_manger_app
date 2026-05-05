import AsyncStorage from "@react-native-async-storage/async-storage";
import { COMPLIANCE_QUEUE_KEY, QUEUE_STORAGE_KEY, PING_INTERVAL_KEY, SESSION_ID_KEY } from "./constants";

const MAX_QUEUED = 500;
const MAX_COMPLIANCE = 200;
const DEVICE_ID_KEY = "gops-live-tracking-device-id";

export async function getOrCreateFallbackDeviceId() {
  const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;
  const id = `fcb:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
  await AsyncStorage.setItem(DEVICE_ID_KEY, id);
  return id;
}

export async function getSessionId() {
  const v = await AsyncStorage.getItem(SESSION_ID_KEY);
  return v || null;
}

export async function setSessionMeta(sessionId, pingIntervalSec) {
  await AsyncStorage.multiSet([
    [SESSION_ID_KEY, sessionId],
    [PING_INTERVAL_KEY, String(pingIntervalSec ?? 90)],
  ]);
}

export async function clearSessionMeta() {
  await AsyncStorage.multiRemove([SESSION_ID_KEY, PING_INTERVAL_KEY]);
}

export async function getPingIntervalSec() {
  const v = await AsyncStorage.getItem(PING_INTERVAL_KEY);
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 90;
}

export async function enqueuePings(pings) {
  const raw = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
  let q = [];
  try {
    q = raw ? JSON.parse(raw) : [];
  } catch {
    q = [];
  }
  if (!Array.isArray(q)) q = [];
  q.push(...pings);
  const trimmed = q.slice(-MAX_QUEUED);
  await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(trimmed));
  return trimmed.length;
}

export async function drainQueue() {
  const raw = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
  if (!raw) return [];
  try {
    const q = JSON.parse(raw);
    return Array.isArray(q) ? q : [];
  } catch {
    return [];
  }
}

export async function clearQueue() {
  await AsyncStorage.removeItem(QUEUE_STORAGE_KEY);
}

export async function replaceQueue(items) {
  await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(items));
}

/** Ping / compliance queue sizes and last queued ping ISO time (for health UI when native module is absent). */
export async function getPingComplianceQueueSnapshot() {
  const [rawPing, rawComp] = await Promise.all([
    AsyncStorage.getItem(QUEUE_STORAGE_KEY),
    AsyncStorage.getItem(COMPLIANCE_QUEUE_KEY),
  ]);
  let pings = [];
  let compliance = [];
  try {
    pings = rawPing ? JSON.parse(rawPing) : [];
  } catch {
    pings = [];
  }
  try {
    compliance = rawComp ? JSON.parse(rawComp) : [];
  } catch {
    compliance = [];
  }
  if (!Array.isArray(pings)) pings = [];
  if (!Array.isArray(compliance)) compliance = [];
  const last = pings.length ? pings[pings.length - 1] : null;
  const lastQueuedPingAt = last?.timestamp ? String(last.timestamp) : null;
  return {
    queuedPingCount: pings.length,
    queuedComplianceCount: compliance.length,
    lastQueuedPingAt,
  };
}

export async function enqueueComplianceEvents(items) {
  const raw = await AsyncStorage.getItem(COMPLIANCE_QUEUE_KEY);
  let q = [];
  try {
    q = raw ? JSON.parse(raw) : [];
  } catch {
    q = [];
  }
  if (!Array.isArray(q)) q = [];
  q.push(...items);
  const trimmed = q.slice(-MAX_COMPLIANCE);
  await AsyncStorage.setItem(COMPLIANCE_QUEUE_KEY, JSON.stringify(trimmed));
  return trimmed.length;
}

export async function drainComplianceQueue() {
  const raw = await AsyncStorage.getItem(COMPLIANCE_QUEUE_KEY);
  if (!raw) return [];
  try {
    const q = JSON.parse(raw);
    return Array.isArray(q) ? q : [];
  } catch {
    return [];
  }
}

export async function clearComplianceQueue() {
  await AsyncStorage.removeItem(COMPLIANCE_QUEUE_KEY);
}

export async function replaceComplianceQueue(items) {
  await AsyncStorage.setItem(COMPLIANCE_QUEUE_KEY, JSON.stringify(items));
}
