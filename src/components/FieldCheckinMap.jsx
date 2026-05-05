import { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Platform } from "react-native";

const USE_MAPLIBRE = process.env.EXPO_PUBLIC_MAP_ENGINE === "maplibre";

let MapLibreEntry = null;
function getMapLibreComponent() {
  if (!USE_MAPLIBRE) return null;
  if (!MapLibreEntry) {
    try {
      MapLibreEntry = require("./FieldCheckinMap.libre").default;
    } catch {
      MapLibreEntry = false;
    }
  }
  return MapLibreEntry || null;
}

export function isMapLibreAvailable() {
  return Platform.OS !== "web" && !!getMapLibreComponent();
}

/**
 * MapLibre + OSM-style tiles when running a dev/production build with native MapLibre.
 * MapLibre is opt-in through EXPO_PUBLIC_MAP_ENGINE=maplibre so Android never falls back to Google Maps.
 */
export default function FieldCheckinMap({
  clients,
  selectedClientId,
  onSelectClient,
  userLoc,
  geofenceCenter,
  geofenceRadiusM,
  centerOnUser = true,
  height = 220,
  fullScreen = false,
}) {
  const cameraRef = useRef(null);
  const outerStyle = fullScreen ? { flex: 1, minHeight: 200 } : { height, borderRadius: 16 };

  useEffect(() => {
    // Map movement is handled inside the MapLibre implementation.
  }, [centerOnUser, fullScreen, userLoc?.latitude, userLoc?.longitude]);

  if (Platform.OS === "web") {
    return (
      <View style={[styles.fallbackBox, fullScreen ? { flex: 1 } : { height }]}>
        <Text style={styles.fallbackText}>Open this screen on iOS or Android for the live map.</Text>
      </View>
    );
  }

  const FieldCheckinMapLibre = getMapLibreComponent();
  if (!FieldCheckinMapLibre) {
    return (
      <View style={[styles.fallbackBox, fullScreen ? { flex: 1 } : { height }]}>
        <Text style={styles.fallbackText}>Map engine unavailable in this build.</Text>
      </View>
    );
  }

  return (
    <FieldCheckinMapLibre
      clients={clients}
      selectedClientId={selectedClientId}
      onSelectClient={onSelectClient}
      userLoc={userLoc}
      geofenceCenter={geofenceCenter}
      geofenceRadiusM={geofenceRadiusM}
      fullScreen={fullScreen}
      outerStyle={outerStyle}
      cameraRef={cameraRef}
      centerOnUser={centerOnUser}
    />
  );
}

const styles = StyleSheet.create({
  fallbackBox: {
    borderRadius: 16,
    backgroundColor: "#EEF0F4",
    justifyContent: "center",
    padding: 16,
  },
  fallbackText: { color: "#666", textAlign: "center", fontSize: 14 },
  userDotOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(26,115,232,0.20)",
    alignItems: "center",
    justifyContent: "center",
  },
  userDotInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#1A73E8",
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },
  osmAttrib: {
    position: "absolute",
    left: 6,
    right: 6,
    bottom: 4,
    alignItems: "center",
  },
  osmAttribText: {
    fontSize: 9,
    color: "rgba(0,0,0,0.55)",
    backgroundColor: "rgba(255,255,255,0.82)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: "hidden",
  },
});
