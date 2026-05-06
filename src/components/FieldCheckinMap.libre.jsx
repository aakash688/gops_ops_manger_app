import { useMemo, useEffect, useRef } from "react";
import { View, StyleSheet, InteractionManager } from "react-native";
import {
  MapView as MLMapView,
  Camera,
  UserLocation,
  PointAnnotation,
  ShapeSource,
  FillLayer,
} from "@maplibre/maplibre-react-native";
import { getFieldMapStyle } from "@/config/fieldMapStyle";
import MapMarkerPin from "@/components/MapMarkerPin";

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
  const centeredOnUserRef = useRef(false);

  const centerCoord = useMemo(() => {
    if (userLoc) return [userLoc.longitude, userLoc.latitude];
    if (clients[0]) return [clients[0].longitude, clients[0].latitude];
    return [78.9629, 20.5937];
  }, [userLoc, clients]);

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
    if (centeredOnUserRef.current) return;
    if (!centerOnUser) return;
    if (!cameraRef.current || !userLoc) return;
    centeredOnUserRef.current = true;
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
        attributionEnabled={false}
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
        {/* Single user layer — duplicate PointAnnotation + UserLocation on same coord caused white screen on tap. */}
        <UserLocation visible showsUserHeadingIndicator={false} androidRenderMode="normal" />

        {geofenceFill ? (
          <ShapeSource id="geofence" shape={geofenceFill}>
            <FillLayer
              id="geofence-fill"
              style={{
                fillColor: "rgba(26, 115, 232, 0.14)",
              }}
            />
          </ShapeSource>
        ) : null}

        {clients.map((c) => {
          const selected = String(c.id) === String(selectedClientId);
          return Number.isFinite(c.latitude) && Number.isFinite(c.longitude) ? (
            <PointAnnotation
              key={`field-client-${c.id}`}
              id={`field-client-${c.id}`}
              coordinate={[c.longitude, c.latitude]}
              onSelected={() => {
                InteractionManager.runAfterInteractions(() => onSelectClient?.(c.id));
              }}
            >
              <MapMarkerPin
                type="client"
                color={selected ? "#F9AB00" : "#EA4335"}
                selected={selected}
                name={c.clientName}
                forMapLibre
              />
            </PointAnnotation>
          ) : null;
        })}
      </MLMapView>
    </View>
  );
}

