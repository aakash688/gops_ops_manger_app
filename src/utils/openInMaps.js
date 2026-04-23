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
 * Turn-by-turn from current GPS to destination (both must be valid numbers).
 */
export async function openMapsDirections(fromLat, fromLng, toLat, toLng) {
  const fa = Number(fromLat);
  const fl = Number(fromLng);
  const ta = Number(toLat);
  const tl = Number(toLng);
  if (![fa, fl, ta, tl].every(Number.isFinite)) {
    Alert.alert("Directions", "Turn on location and pick a site on the map.");
    return;
  }
  try {
    if (Platform.OS === "ios") {
      const url = `http://maps.apple.com/?saddr=${fa},${fl}&daddr=${ta},${tl}`;
      await Linking.openURL(url);
      return;
    }

    // Android: prefer an intent that opens the Google Maps app directly.
    const nav = `google.navigation:q=${ta},${tl}&mode=d`;
    const canNav = await Linking.canOpenURL(nav);
    if (canNav) {
      await Linking.openURL(nav);
      return;
    }

    // Fallback: web URL (opens browser or maps app chooser).
    const web = `https://www.google.com/maps/dir/?api=1&origin=${fa},${fl}&destination=${ta},${tl}`;
    await Linking.openURL(web);
  } catch {
    Alert.alert("Maps", "Could not open directions.");
  }
}
