import { useEffect, useMemo, useRef } from "react";
import { View, Text, StyleSheet, Platform, NativeModules } from "react-native";
import MapView, { Marker, Polyline, UrlTile } from "react-native-maps";
import { CARTO_VOYAGER_URL_TEMPLATE } from "@/config/fieldMapStyle";

const MLRN = NativeModules.MLRNModule;

let MapLibreEntry = null;
function getMapLibreComponent() {
  if (!MapLibreEntry) {
    MapLibreEntry = require("./TrackingMap.libre").default;
  }
  return MapLibreEntry;
}

export function isMapLibreAvailable() {
  return Platform.OS !== "web" && !!MLRN;
}

export default function TrackingMap({
  height = 220,
  fullScreen = false,
  showsUserLocation = true,
  teamMarkers = [],
  routeCoords = [],
  playbackCoord = null,
  focusCoord = null, // { latitude, longitude }
  focusZoom = 14,
  initialCenter = { latitude: 20.5937, longitude: 78.9629 },
}) {
  const cameraRef = useRef(null);
  const mapRef = useRef(null);
  const outerStyle = fullScreen ? { flex: 1, minHeight: 200 } : { height, borderRadius: 16 };

  const computedInitial = useMemo(() => {
    if (teamMarkers?.length) {
      const withLoc = teamMarkers.filter((t) => t.latitude != null && t.longitude != null);
      if (withLoc.length) {
        const lat = withLoc.reduce((s, t) => s + t.latitude, 0) / withLoc.length;
        const lng = withLoc.reduce((s, t) => s + t.longitude, 0) / withLoc.length;
        return { latitude: lat, longitude: lng };
      }
    }
    return initialCenter;
  }, [teamMarkers, initialCenter]);

  if (Platform.OS === "web") {
    return (
      <View style={[styles.fallbackBox, fullScreen ? { flex: 1 } : { height }]}>
        <Text style={styles.fallbackText}>Open this screen on iOS or Android for the live map.</Text>
      </View>
    );
  }

  // Expo Go / no MapLibre native module → react-native-maps fallback (requires Google Maps on Android).
  // Dev builds with MapLibre linked will use TrackingMapLibre and avoid Google API key requirements.
  if (!MLRN) {
    useEffect(() => {
      if (!focusCoord || !mapRef.current) return;
      try {
        mapRef.current.animateToRegion(
          {
            latitude: focusCoord.latitude,
            longitude: focusCoord.longitude,
            latitudeDelta: 0.04,
            longitudeDelta: 0.04,
          },
          500,
        );
      } catch {
        // ignore
      }
    }, [focusCoord?.latitude, focusCoord?.longitude]);

    return (
      <View style={[{ overflow: "hidden" }, outerStyle]}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          initialRegion={{
            latitude: computedInitial.latitude,
            longitude: computedInitial.longitude,
            latitudeDelta: fullScreen ? 0.06 : 0.08,
            longitudeDelta: fullScreen ? 0.06 : 0.08,
          }}
          showsUserLocation={showsUserLocation}
          showsMyLocationButton
        >
          <UrlTile urlTemplate={CARTO_VOYAGER_URL_TEMPLATE} maximumZ={22} flipY={false} />
          {teamMarkers.map((t) =>
            t.latitude != null && t.longitude != null ? (
              <Marker
                key={t.employeeId ?? `${t.latitude},${t.longitude}`}
                coordinate={{ latitude: t.latitude, longitude: t.longitude }}
                title={t.employeeName}
                description={t.subtitle}
                anchor={{ x: 0.5, y: 1 }}
              >
                <View
                  style={{
                    minWidth: 44,
                    height: 44,
                    paddingHorizontal: 10,
                    borderRadius: 22,
                    backgroundColor: "rgba(255,255,255,0.95)",
                    borderWidth: 2,
                    borderColor: t.pinColor || "#007AFF",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ fontSize: 22 }}>🧍</Text>
                </View>
              </Marker>
            ) : null,
          )}
          {routeCoords.length > 1 ? (
            <Polyline coordinates={routeCoords} strokeColor="#007AFF" strokeWidth={4} />
          ) : null}
          {playbackCoord ? <Marker coordinate={playbackCoord} pinColor="orange" title="Playback" /> : null}
        </MapView>
        <View style={styles.attrib} pointerEvents="none">
          <Text style={styles.attribText}>© OpenStreetMap © CARTO</Text>
        </View>
      </View>
    );
  }

  const TrackingMapLibre = getMapLibreComponent();
  return (
    <TrackingMapLibre
      outerStyle={outerStyle}
      cameraRef={cameraRef}
      showsUserLocation={showsUserLocation}
      teamMarkers={teamMarkers}
      routeCoords={routeCoords}
      playbackCoord={playbackCoord}
      focusCoord={focusCoord}
      focusZoom={focusZoom}
      initialCenter={computedInitial}
      fullScreen={fullScreen}
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
});

