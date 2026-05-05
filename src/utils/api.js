import * as SecureStore from "expo-secure-store";
import { authKey } from "@/utils/auth/store";

/**
 * G-ops REST calls use the **native** fetch (no Create.xyz wrapper) to avoid
 * wrong Host headers and redirect loops (`too many follow-up requests` on Android).
 *
 * Set in `.env`:
 *   EXPO_PUBLIC_API_URL=https://gops-api.yantralogic.com/api/v1
 * Do not use your `*.created.app` URL here — that is not the Node API.
 */
const PRODUCTION_API_URL = "https://gops-api.yantralogic.com/api/v1";

function normalizeBaseUrl(value) {
  return value?.trim().replace(/\/$/, "") || "";
}

function isDevRuntime() {
  return typeof __DEV__ !== "undefined" && __DEV__;
}

function isCleartextUrl(value) {
  try {
    return new URL(value).protocol !== "https:";
  } catch {
    return true;
  }
}

export function getApiBaseUrl() {
  const explicit = normalizeBaseUrl(
    process.env.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_GOPS_API_URL,
  );
  if (explicit) {
    return !isDevRuntime() && isCleartextUrl(explicit)
      ? PRODUCTION_API_URL
      : explicit;
  }

  const fallback = normalizeBaseUrl(
    process.env.EXPO_PUBLIC_BASE_URL ||
    process.env.EXPO_PUBLIC_APP_URL ||
      "",
  );

  if (!fallback) return "";

  if (/created\.app|create\.xyz/i.test(fallback)) {
    return "";
  }

  return !isDevRuntime() && isCleartextUrl(fallback)
    ? PRODUCTION_API_URL
    : fallback;
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
    `Set EXPO_PUBLIC_API_URL in .env to your G-ops backend, e.g. ${PRODUCTION_API_URL} (not the *.created.app URL).`,
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

export async function apiPostFormData(path, formData) {
  const base = getApiBaseUrl();
  if (!base) throw missingApiUrlError();

  const token = await getBearer();
  const headers = { Accept: "application/json" };
  // IMPORTANT: Do not set Content-Type for multipart; fetch will add boundary.
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(joinUrl(base, path), {
    method: "POST",
    headers,
    body: formData,
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
