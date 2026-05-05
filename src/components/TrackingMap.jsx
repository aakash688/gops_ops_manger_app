import { useMemo, useRef } from "react";
import { View, Text, StyleSheet, Platform } from "react-native";

const USE_MAPLIBRE = process.env.EXPO_PUBLIC_MAP_ENGINE === "maplibre";

let MapLibreEntry = null;
function getMapLibreComponent() {
  if (!USE_MAPLIBRE) return null;
  if (!MapLibreEntry) {
    try {
      MapLibreEntry = require("./TrackingMap.libre").default;
    } catch {
      MapLibreEntry = false;
    }
  }
  return MapLibreEntry || null;
}

export function isMapLibreAvailable() {
  return Platform.OS !== "web" && !!getMapLibreComponent();
}

export default function TrackingMap({
  height = 220,
  fullScreen = false,
  showsUserLocation = true,
  teamMarkers = [],
  clients = [],
  selectedClientId = null,
  selectedGuardId = null,
  onSelectClient = null,   // (clientId: string) => void
  onSelectGuard = null,    // (employeeId: string) => void
  routeCoords = [],
  playbackCoord = null,
  focusCoord = null,
  focusZoom = 14,
  initialCenter = { latitude: 20.5937, longitude: 78.9629 },
  userLoc = null,
  centerOnUser = true,
  centerMapEpoch = 0,
}) {
  const cameraRef = useRef(null);
  const outerStyle = fullScreen ? { flex: 1, minHeight: 200 } : { height, borderRadius: 16 };

  const computedInitial = useMemo(() => {
    if (
      userLoc &&
      Number.isFinite(userLoc.latitude) &&
      Number.isFinite(userLoc.longitude)
    ) {
      return { latitude: userLoc.latitude, longitude: userLoc.longitude };
    }
    if (teamMarkers?.length) {
      const withLoc = teamMarkers.filter((t) => Number.isFinite(t.latitude) && Number.isFinite(t.longitude));
      if (withLoc.length) {
        const lat = withLoc.reduce((s, t) => s + t.latitude, 0) / withLoc.length;
        const lng = withLoc.reduce((s, t) => s + t.longitude, 0) / withLoc.length;
        return { latitude: lat, longitude: lng };
      }
    }
    return initialCenter;
  }, [teamMarkers, initialCenter, userLoc]);

  if (Platform.OS === "web") {
    return (
      <View style={[styles.fallbackBox, fullScreen ? { flex: 1 } : { height }]}>
        <Text style={styles.fallbackText}>Open this screen on iOS or Android for the live map.</Text>
      </View>
    );
  }

  const TrackingMapLibre = getMapLibreComponent();
  if (!TrackingMapLibre) {
    return (
      <View style={[styles.fallbackBox, fullScreen ? { flex: 1 } : { height }]}>
        <Text style={styles.fallbackText}>Map engine unavailable in this build.</Text>
      </View>
    );
  }

  return (
    <TrackingMapLibre
      outerStyle={outerStyle}
      cameraRef={cameraRef}
      showsUserLocation={showsUserLocation}
      teamMarkers={teamMarkers}
      clients={clients}
      selectedClientId={selectedClientId}
      selectedGuardId={selectedGuardId}
      onSelectClient={onSelectClient}
      onSelectGuard={onSelectGuard}
      routeCoords={routeCoords}
      playbackCoord={playbackCoord}
      focusCoord={focusCoord}
      focusZoom={focusZoom}
      initialCenter={computedInitial}
      fullScreen={fullScreen}
      userLoc={userLoc}
      centerOnUser={centerOnUser}
      centerMapEpoch={centerMapEpoch}
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
  attrib: {
    position: "absolute",
    left: 6,
    right: 6,
    bottom: 4,
    alignItems: "center",
  },
  attribText: {
    fontSize: 9,
    color: "rgba(0,0,0,0.55)",
    backgroundColor: "rgba(255,255,255,0.82)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: "hidden",
  },
  // Google-style playback dot: orange with white ring
  playbackDotOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(251,140,0,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  playbackDotInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#FB8C00",
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },
});

