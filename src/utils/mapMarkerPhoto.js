/** HTTP(S) image URL safe for React Native `Image`. */
export function isHttpImageUrl(value) {
  if (value == null || typeof value !== "string") return false;
  const s = value.trim();
  return s.length > 8 && /^https?:\/\//i.test(s);
}

const GUARD_KEYS = [
  "avatar_url",
  "avatarUrl",
  "photoUrl",
  "profilePhotoUrl",
  "profileImageUrl",
  "imageUrl",
  "photo",
  "picture",
];

const CLIENT_KEYS = [
  "logo_url",
  "logoUrl",
  "clientLogoUrl",
  "sitePhotoUrl",
  "imageUrl",
  "photoUrl",
  "photo",
  "avatar_url",
  "avatarUrl",
];

function firstUrlInObject(obj, keys) {
  if (!obj || typeof obj !== "object") return null;
  for (const k of keys) {
    const v = obj[k];
    if (isHttpImageUrl(v)) return v.trim();
  }
  return null;
}

/**
 * Pick a profile / logo image from API-shaped records (team member or client site).
 * @param {"guard"|"client"} kind
 */
export function resolveMarkerPhotoUrl(record, kind) {
  if (!record || typeof record !== "object") return null;

  if (kind === "client") {
    return (
      firstUrlInObject(record, CLIENT_KEYS) ||
      firstUrlInObject(record.client, CLIENT_KEYS) ||
      firstUrlInObject(record.client, GUARD_KEYS)
    );
  }

  return (
    firstUrlInObject(record, GUARD_KEYS) ||
    firstUrlInObject(record.employee, GUARD_KEYS) ||
    firstUrlInObject(record.user, GUARD_KEYS)
  );
}

/** Two-letter initials for avatar fallback. */
export function initialsFromName(name) {
  if (name == null || typeof name !== "string") return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) {
    const w = parts[0];
    return w.length >= 2 ? w.slice(0, 2).toUpperCase() : (w[0] || "?").toUpperCase();
  }
  const a = parts[0][0] || "";
  const b = parts[parts.length - 1][0] || "";
  return `${a}${b}`.toUpperCase() || "?";
}
