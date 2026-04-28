import { Linking, Platform, Alert } from "react-native";

/**
 * Open native maps at a pin (Apple Maps on iOS, Google Maps URL on Android).
 */
export async function openMapsPin(lat, lng, label = "Location") {
  const la = Number(lat);
  const lo = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) {
    Alert.alert("Maps", "This place has no coordinates yet.");
    return;
  }
  const q = encodeURIComponent(label || "Location");
  const url =
    Platform.OS === "ios"
      ? `http://maps.apple.com/?ll=${la},${lo}&q=${q}`
      : `https://www.google.com/maps/search/?api=1&query=${la},${lo}`;
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert("Maps", "Could not open the maps app.");
  }
}

/**
 * Turn-by-turn navigation to a destination.
 * Origin is optional — when null/invalid the map app routes from the device's current GPS position.
 * This opens instantly without waiting for a live GPS fix.
 */
export async function openMapsDirections(fromLat, fromLng, toLat, toLng) {
  const ta = Number(toLat);
  const tl = Number(toLng);
  if (!Number.isFinite(ta) || !Number.isFinite(tl)) {
    Alert.alert("Directions", "This destination has no coordinates.");
    return;
  }

  const fa = Number(fromLat);
  const fl = Number(fromLng);
  const hasOrigin = Number.isFinite(fa) && Number.isFinite(fl);

  try {
    if (Platform.OS === "ios") {
      // Apple Maps: omit saddr to let the app use device location when origin is unknown.
      const url = hasOrigin
        ? `http://maps.apple.com/?saddr=${fa},${fl}&daddr=${ta},${tl}&dirflg=d`
        : `http://maps.apple.com/?daddr=${ta},${tl}&dirflg=d`;
      await Linking.openURL(url);
      return;
    }

    // Android: google.navigation intent routes to destination from current device location (no origin needed).
    const nav = `google.navigation:q=${ta},${tl}&mode=d`;
    const canNav = await Linking.canOpenURL(nav);
    if (canNav) {
      await Linking.openURL(nav);
      return;
    }

    // Fallback: Google Maps web URL — include origin when available, otherwise destination-only.
    const web = hasOrigin
      ? `https://www.google.com/maps/dir/?api=1&origin=${fa},${fl}&destination=${ta},${tl}`
      : `https://www.google.com/maps/dir/?api=1&destination=${ta},${tl}`;
    await Linking.openURL(web);
  } catch {
    Alert.alert("Maps", "Could not open directions.");
  }
}
