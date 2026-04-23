import { useRef } from "react";
import { View, Text, StyleSheet, Platform, NativeModules } from "react-native";
import MapView, { Marker, Circle, UrlTile } from "react-native-maps";
import { CARTO_VOYAGER_URL_TEMPLATE } from "@/config/fieldMapStyle";

/** Dims native Google basemap so OSM-style raster tiles read clearly (Android). iOS ignores this for Apple Maps. */
const GOOGLE_BASE_MINIMAL_STYLE = [
  { featureType: "all", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "administrative", stylers: [{ visibility: "off" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "road", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", stylers: [{ color: "#aad3df" }] },
  { featureType: "landscape", stylers: [{ color: "#f2efe9" }] },
];

const MLRN = NativeModules.MLRNModule;

let MapLibreEntry = null;
function getMapLibreComponent() {
  if (!MapLibreEntry) {
    MapLibreEntry = require("./FieldCheckinMap.libre").default;
  }
  return MapLibreEntry;
}

export function isMapLibreAvailable() {
  return Platform.OS !== "web" && !!MLRN;
}

/**
 * MapLibre + OSM-style tiles when running a dev/production build with native MapLibre.
 * In Expo Go, MapLibre is never imported — uses react-native-maps + Carto Voyager UrlTile.
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

  if (Platform.OS === "web") {
    return (
      <View style={[styles.fallbackBox, fullScreen ? { flex: 1 } : { height }]}>
        <Text style={styles.fallbackText}>Open this screen on iOS or Android for the live map.</Text>
      </View>
    );
  }

  if (!MLRN) {
    return (
      <View style={[{ overflow: "hidden" }, outerStyle]}>
        <MapView
          style={StyleSheet.absoluteFill}
          initialRegion={{
            latitude: userLoc?.latitude ?? clients[0]?.latitude ?? 20.5937,
            longitude: userLoc?.longitude ?? clients[0]?.longitude ?? 78.9629,
            latitudeDelta: fullScreen ? 0.06 : 0.08,
            longitudeDelta: fullScreen ? 0.06 : 0.08,
          }}
          showsUserLocation
          showsMyLocationButton
          {...(Platform.OS === "android" ? { customMapStyle: GOOGLE_BASE_MINIMAL_STYLE } : {})}
        >
          <UrlTile urlTemplate={CARTO_VOYAGER_URL_TEMPLATE} maximumZ={22} flipY={false} />
          {geofenceCenter && geofenceRadiusM ? (
            <Circle
              center={{ latitude: geofenceCenter.latitude, longitude: geofenceCenter.longitude }}
              radius={geofenceRadiusM}
              strokeColor="rgba(0,122,255,0.5)"
              fillColor="rgba(0,122,255,0.08)"
            />
          ) : null}
          {clients.map((c) => {
            const selected = c.id === selectedClientId;
            return (
              <Marker
                key={c.id}
                coordinate={{ latitude: c.latitude, longitude: c.longitude }}
                title={c.clientName}
                onPress={() => onSelectClient?.(c.id)}
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
                    borderColor: selected ? "#FF9500" : "#FF3B30",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ fontSize: 22 }}>{selected ? "📍" : "🏢"}</Text>
                </View>
              </Marker>
            );
          })}
        </MapView>
        <View style={styles.osmAttrib} pointerEvents="none">
          <Text style={styles.osmAttribText}>© OpenStreetMap © CARTO</Text>
        </View>
      </View>
    );
  }

  const FieldCheckinMapLibre = getMapLibreComponent();
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
