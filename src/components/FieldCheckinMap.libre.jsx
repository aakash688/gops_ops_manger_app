import { useMemo, useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import {
  MapView as MLMapView,
  Camera,
  UserLocation,
  PointAnnotation,
  ShapeSource,
  FillLayer,
} from "@maplibre/maplibre-react-native";
import { getFieldMapStyle } from "@/config/fieldMapStyle";

function geofencePolygonRing(lat, lng, radiusM, steps = 72) {
  const R = 6371000;
  const lat1 = (lat * Math.PI) / 180;
  const lng1 = (lng * Math.PI) / 180;
  const ring = [];
  for (let i = 0; i <= steps; i++) {
    const brng = (i / steps) * 2 * Math.PI;
    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(radiusM / R) + Math.cos(lat1) * Math.sin(radiusM / R) * Math.cos(brng),
    );
    const lng2 =
      lng1 +
      Math.atan2(
        Math.sin(brng) * Math.sin(radiusM / R) * Math.cos(lat1),
        Math.cos(radiusM / R) - Math.sin(lat1) * Math.sin(lat2),
      );
    ring.push([(lng2 * 180) / Math.PI, (lat2 * 180) / Math.PI]);
  }
  return ring;
}

/** MapLibre path — only required when native MLRNModule is linked (custom dev build). */
export default function FieldCheckinMapLibre({
  clients,
  selectedClientId,
  onSelectClient,
  userLoc,
  geofenceCenter,
  geofenceRadiusM,
  fullScreen,
  outerStyle,
  cameraRef,
  centerOnUser = true,
}) {
  const mapStyle = useMemo(() => getFieldMapStyle(), []);

  const centerCoord = useMemo(() => {
    if (userLoc) return [userLoc.longitude, userLoc.latitude];
    if (clients[0]) return [clients[0].longitude, clients[0].latitude];
    return [78.9629, 20.5937];
  }, [userLoc, clients]);

  const clientFeatures = useMemo(
    () => ({
      type: "FeatureCollection",
      features: clients.map((c) => ({
        type: "Feature",
        id: c.id,
        properties: {
          id: c.id,
          name: c.clientName,
          sel: c.id === selectedClientId ? 1 : 0,
        },
        geometry: {
          type: "Point",
          coordinates: [c.longitude, c.latitude],
        },
      })),
    }),
    [clients, selectedClientId],
  );

  const geofenceFill = useMemo(() => {
    if (!geofenceCenter || !geofenceRadiusM) return null;
    const ring = geofencePolygonRing(geofenceCenter.latitude, geofenceCenter.longitude, geofenceRadiusM);
    return {
      type: "Feature",
      properties: {},
      geometry: {
        type: "Polygon",
        coordinates: [ring],
      },
    };
  }, [geofenceCenter, geofenceRadiusM]);

  useEffect(() => {
    if (!centerOnUser) return;
    if (!cameraRef.current || !userLoc) return;
    cameraRef.current.setCamera({
      centerCoordinate: [userLoc.longitude, userLoc.latitude],
      zoomLevel: fullScreen ? 15 : 14,
      animationDuration: 700,
      animationMode: "flyTo",
    });
  }, [centerOnUser, userLoc?.latitude, userLoc?.longitude, fullScreen, cameraRef]);

  // We render individual site pins to match the old "marker pin" UX.
  // Clustering can be reintroduced later if needed.

  return (
    <View style={[{ overflow: "hidden" }, outerStyle]}>
      <MLMapView
        style={StyleSheet.absoluteFill}
        mapStyle={mapStyle}
        attributionEnabled
        logoEnabled={false}
        compassEnabled
        scaleBarEnabled
      >
        <Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: centerCoord,
            zoomLevel: userLoc ? (fullScreen ? 15 : 14) : 10,
            animationMode: "moveTo",
          }}
        />
        {/* Avoid the moving arrow/compass look — keep it as a simple blue dot. */}
        <UserLocation visible showsUserHeadingIndicator={false} androidRenderMode="normal" />

        {geofenceFill ? (
          <ShapeSource id="geofence" shape={geofenceFill}>
            <FillLayer
              id="geofence-fill"
              style={{
                fillColor: "rgba(0, 122, 255, 0.14)",
              }}
            />
          </ShapeSource>
        ) : null}

        {clients.map((c) => {
          const selected = c.id === selectedClientId;
          return (
            <PointAnnotation
              key={c.id}
              id={String(c.id)}
              coordinate={[c.longitude, c.latitude]}
              onSelected={() => onSelectClient?.(c.id)}
            >
              <View style={[styles.pinWrap, selected && styles.pinWrapSelected]}>
                <View style={[styles.emojiBubble, selected && styles.emojiBubbleSelected]}>
                  <Text style={styles.emoji}>{selected ? "📍" : "🏢"}</Text>
                </View>
              </View>
            </PointAnnotation>
          );
        })}
      </MLMapView>
    </View>
  );
}

const styles = StyleSheet.create({
  pinWrap: {
    alignItems: "center",
  },
  pinWrapSelected: {
    transform: [{ scale: 1.12 }],
  },
  emojiBubble: {
    minWidth: 44,
    height: 44,
    paddingHorizontal: 10,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderWidth: 2,
    borderColor: "#FF3B30",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  emojiBubbleSelected: {
    borderColor: "#FF9500",
  },
  emoji: {
    fontSize: 22,
  },
});
