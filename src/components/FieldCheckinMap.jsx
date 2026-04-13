import { useMemo, useRef, useEffect } from "react";
import { View, Text, StyleSheet, Platform, NativeModules } from "react-native";
import MapView, { Marker, Circle, UrlTile } from "react-native-maps";
import {
  MapView as MLMapView,
  Camera,
  UserLocation,
  ShapeSource,
  CircleLayer,
  SymbolLayer,
  FillLayer,
} from "@maplibre/maplibre-react-native";
import { getFieldMapStyle, CARTO_VOYAGER_URL_TEMPLATE } from "@/config/fieldMapStyle";

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

export function isMapLibreAvailable() {
  return Platform.OS !== "web" && !!MLRN;
}

/** Geodesic circle as GeoJSON polygon (ring closed). */
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

/**
 * MapLibre + OSM-style tiles when running a dev/production build with native MapLibre.
 * In Expo Go, falls back to react-native-maps + Carto Voyager UrlTile (OSM-style). Dev build uses MapLibre.
 */
export default function FieldCheckinMap({
  clients,
  selectedClientId,
  onSelectClient,
  userLoc,
  geofenceCenter,
  geofenceRadiusM,
  height = 220,
  fullScreen = false,
}) {
  const mapStyle = useMemo(() => getFieldMapStyle(), []);
  const cameraRef = useRef(null);

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
    if (!MLRN || !cameraRef.current || !userLoc) return;
    cameraRef.current.setCamera({
      centerCoordinate: [userLoc.longitude, userLoc.latitude],
      zoomLevel: fullScreen ? 15 : 14,
      animationDuration: 700,
      animationMode: "flyTo",
    });
  }, [userLoc?.latitude, userLoc?.longitude, fullScreen]);

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
          {clients.map((c) => (
            <Marker
              key={c.id}
              coordinate={{ latitude: c.latitude, longitude: c.longitude }}
              title={c.clientName}
              pinColor={c.id === selectedClientId ? "orange" : "red"}
              onPress={() => onSelectClient?.(c.id)}
            />
          ))}
        </MapView>
        <View style={styles.osmAttrib} pointerEvents="none">
          <Text style={styles.osmAttribText}>© OpenStreetMap © CARTO</Text>
        </View>
      </View>
    );
  }

  const useCluster = clients.length >= 12;

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
        <UserLocation visible showsUserHeadingIndicator androidRenderMode="compass" />

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

        <ShapeSource
          id="clients"
          shape={clientFeatures}
          cluster={useCluster}
          clusterRadius={56}
          clusterMaxZoomLevel={16}
          onPress={(e) => {
            const f = e?.features?.[0];
            if (!f?.properties) return;
            if (f.properties.cluster) return;
            const id = f.properties.id;
            if (id) onSelectClient?.(id);
          }}
        >
          <CircleLayer
            id="clusters"
            filter={["has", "point_count"]}
            style={{
              circleColor: "rgba(0, 122, 255, 0.88)",
              circleRadius: ["step", ["get", "point_count"], 20, 10, 24, 50, 30],
              circleOpacity: 0.95,
              circleStrokeWidth: 2,
              circleStrokeColor: "#FFFFFF",
            }}
          />
          <SymbolLayer
            id="cluster-count"
            filter={["has", "point_count"]}
            style={{
              textField: "{point_count_abbreviated}",
              textSize: 12,
              textColor: "#FFFFFF",
              textAllowOverlap: true,
            }}
          />
          <CircleLayer
            id="client-dots"
            filter={["!", ["has", "point_count"]]}
            style={{
              circleRadius: ["match", ["get", "sel"], 1, 11, 7],
              circleColor: ["match", ["get", "sel"], 1, "#FF9500", "#FF3B30"],
              circleOpacity: 0.95,
              circleStrokeWidth: 2,
              circleStrokeColor: "#FFFFFF",
            }}
          />
        </ShapeSource>
      </MLMapView>
    </View>
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
