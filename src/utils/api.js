import * as SecureStore from "expo-secure-store";
import { authKey } from "@/utils/auth/store";

/**
 * G-ops REST calls use the **native** fetch (no Create.xyz wrapper) to avoid
 * wrong Host headers and redirect loops (`too many follow-up requests` on Android).
 *
 * Set in `.env`:
 *   EXPO_PUBLIC_API_URL=http://YOUR_LAN_IP:3000/api/v1
 * Android emulator → host machine: http://10.0.2.2:3000/api/v1
 * Do not use your `*.created.app` URL here — that is not the Node API.
 */
function getApiBaseUrl() {
  const explicit =
    process.env.EXPO_PUBLIC_API_URL?.trim() ||
    process.env.EXPO_PUBLIC_GOPS_API_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  const fallback = (
    process.env.EXPO_PUBLIC_BASE_URL ||
    process.env.EXPO_PUBLIC_APP_URL ||
    ""
  )
    .trim()
    .replace(/\/$/, "");

  if (!fallback) return "";

  if (/created\.app|create\.xyz/i.test(fallback)) {
    return "";
  }

  return fallback;
}

function joinUrl(base, path) {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

async function getBearer() {
  try {
    const raw = await SecureStore.getItemAsync(authKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.jwt || null;
  } catch {
    return null;
  }
}

function missingApiUrlError() {
  return new Error(
    "Set EXPO_PUBLIC_API_URL in .env to your G-ops backend, e.g. http://192.168.1.5:3000/api/v1 (not the *.created.app URL).",
  );
}

export async function apiPostJson(path, body) {
  const base = getApiBaseUrl();
  if (!base) throw missingApiUrlError();

  const token = await getBearer();
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(joinUrl(base, path), {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    const msg =
      json?.error?.message || json?.message || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return { data: json.data, meta: json.meta };
}

export async function apiGetJson(path) {
  const base = getApiBaseUrl();
  if (!base) throw missingApiUrlError();

  const token = await getBearer();
  const headers = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(joinUrl(base, path), {
    headers,
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    const msg =
      json?.error?.message || json?.message || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return { data: json.data, meta: json.meta };
}

export async function apiPatchJson(path, body) {
  const base = getApiBaseUrl();
  if (!base) throw missingApiUrlError();

  const token = await getBearer();
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(joinUrl(base, path), {
    method: "PATCH",
    headers,
    body: JSON.stringify(body),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    const msg =
      json?.error?.message || json?.message || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return { data: json.data, meta: json.meta };
}

export async function apiDelete(path) {
  const base = getApiBaseUrl();
  if (!base) throw missingApiUrlError();

  const token = await getBearer();
  const headers = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(joinUrl(base, path), {
    method: "DELETE",
    headers,
  });

  if (res.status === 204) {
    return { data: null, meta: null };
  }

  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    const msg =
      json?.error?.message || json?.message || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return { data: json.data, meta: json.meta };
}
