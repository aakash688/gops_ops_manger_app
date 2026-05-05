const INDIA_BOUNDS = {
  minLat: 6,
  maxLat: 38,
  minLng: 68,
  maxLng: 98,
};

function toFiniteNumber(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function isValidLatLng(latitude, longitude) {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180
  );
}

function isInsideIndia(latitude, longitude) {
  return (
    latitude >= INDIA_BOUNDS.minLat &&
    latitude <= INDIA_BOUNDS.maxLat &&
    longitude >= INDIA_BOUNDS.minLng &&
    longitude <= INDIA_BOUNDS.maxLng
  );
}

function readRawLatLng(value) {
  if (!value || typeof value !== "object") return null;

  const lat =
    toFiniteNumber(value.latitude) ??
    toFiniteNumber(value.lat) ??
    toFiniteNumber(value.y);
  const lng =
    toFiniteNumber(value.longitude) ??
    toFiniteNumber(value.lng) ??
    toFiniteNumber(value.lon) ??
    toFiniteNumber(value.long) ??
    toFiniteNumber(value.x);

  if (lat != null && lng != null) return { latitude: lat, longitude: lng };

  const coords = value.coordinates ?? value.coordinate ?? value.location?.coordinates;
  if (Array.isArray(coords) && coords.length >= 2) {
    // GeoJSON and MapLibre use [longitude, latitude].
    const longitude = toFiniteNumber(coords[0]);
    const latitude = toFiniteNumber(coords[1]);
    if (latitude != null && longitude != null) return { latitude, longitude };
  }

  return null;
}

export function normalizeLatLng(value) {
  const raw = readRawLatLng(value);
  if (!raw) return null;

  const { latitude, longitude } = raw;
  if (!isValidLatLng(latitude, longitude)) {
    if (isValidLatLng(longitude, latitude)) {
      return { latitude: longitude, longitude: latitude };
    }
    return null;
  }

  // Most app data is Indian field sites. This catches swapped values like
  // latitude=77.12, longitude=28.63 without touching already-correct points.
  if (
    !isInsideIndia(latitude, longitude) &&
    isInsideIndia(longitude, latitude)
  ) {
    return { latitude: longitude, longitude: latitude };
  }

  return { latitude, longitude };
}

export function normalizeRecordCoordinates(record) {
  const point = normalizeLatLng(record);
  return point ? { ...record, ...point } : null;
}

export function normalizeRecordCoordinatesList(records) {
  return Array.isArray(records)
    ? records.map(normalizeRecordCoordinates).filter(Boolean)
    : [];
}

/** Haversine distance in meters between two { latitude, longitude } points. */
export function metersBetween(a, b) {
  if (!a || !b) return null;
  const R = 6371000;
  const toRad = (v) => (v * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
