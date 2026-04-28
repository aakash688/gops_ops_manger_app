import { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Platform, NativeModules } from "react-native";
import MapView, { Marker, Circle, UrlTile } from "react-native-maps";
import { CARTO_VOYAGER_URL_TEMPLATE } from "@/config/fieldMapStyle";
import MapMarkerPin from "@/components/MapMarkerPin";

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
  const mapRef = useRef(null);
  const outerStyle = fullScreen ? { flex: 1, minHeight: 200 } : { height, borderRadius: 16 };
  const centeredOnUserRef = useRef(false);

  useEffect(() => {
    if (Platform.OS === "web" || MLRN) return;
    if (!centerOnUser || centeredOnUserRef.current || !userLoc || !mapRef.current) return;
    centeredOnUserRef.current = true;
    mapRef.current.animateToRegion(
      {
        latitude: userLoc.latitude,
        longitude: userLoc.longitude,
        latitudeDelta: fullScreen ? 0.025 : 0.035,
        longitudeDelta: fullScreen ? 0.025 : 0.035,
      },
      350,
    );
  }, [centerOnUser, fullScreen, userLoc?.latitude, userLoc?.longitude]);

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
          ref={mapRef}
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
          {userLoc ? (
            <Marker
              key={`user-${Math.round(userLoc.latitude * 100000)}-${Math.round(userLoc.longitude * 100000)}`}
              coordinate={{ latitude: userLoc.latitude, longitude: userLoc.longitude }}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges
            >
              <View style={styles.userDotOuter}>
                <View style={styles.userDotInner} />
              </View>
            </Marker>
          ) : null}
          {geofenceCenter && geofenceRadiusM ? (
            <Circle
              center={{ latitude: geofenceCenter.latitude, longitude: geofenceCenter.longitude }}
              radius={geofenceRadiusM}
              strokeColor="rgba(26,115,232,0.55)"
              fillColor="rgba(26,115,232,0.11)"
            />
          ) : null}
          {clients.map((c) => {
            const selected = c.id === selectedClientId;
            return (
              <Marker
                key={`${c.id}-${selected ? "selected" : "default"}`}
                coordinate={{ latitude: c.latitude, longitude: c.longitude }}
                title={c.clientName}
                onPress={() => onSelectClient?.(c.id)}
                anchor={{ x: 0.5, y: 1 }}
                tracksViewChanges
              >
                <MapMarkerPin
                  type="client"
                  color={selected ? "#F9AB00" : "#EA4335"}
                  selected={selected}
                  label={selected ? c.clientName : undefined}
                />
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
