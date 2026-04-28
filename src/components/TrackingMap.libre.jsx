import { useEffect, useMemo } from "react";
import { View, StyleSheet } from "react-native";
import {
  MapView as MLMapView,
  Camera,
  UserLocation,
  ShapeSource,
  LineLayer,
  PointAnnotation,
} from "@maplibre/maplibre-react-native";
import { getFieldMapStyle } from "@/config/fieldMapStyle";
import MapMarkerPin from "@/components/MapMarkerPin";

export default function TrackingMapLibre({
  outerStyle,
  cameraRef,
  showsUserLocation,
  teamMarkers,
  clients = [],
  selectedClientId = null,
  selectedGuardId = null,
  onSelectClient = null,
  onSelectGuard = null,
  routeCoords,
  playbackCoord,
  focusCoord,
  focusZoom = 14,
  initialCenter,
  fullScreen,
}) {
  const mapStyle = useMemo(() => getFieldMapStyle(), []);

  const routeFeature = useMemo(() => {
    if (!Array.isArray(routeCoords) || routeCoords.length < 2) return null;
    return {
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: routeCoords.map((p) => [p.longitude, p.latitude]),
      },
    };
  }, [routeCoords]);

  useEffect(() => {
    if (!cameraRef.current) return;
    cameraRef.current.setCamera({
      centerCoordinate: [initialCenter.longitude, initialCenter.latitude],
      zoomLevel: fullScreen ? 14 : 13,
      animationDuration: 500,
      animationMode: "flyTo",
    });
  }, [initialCenter.latitude, initialCenter.longitude, fullScreen, cameraRef]);

  useEffect(() => {
    if (!cameraRef.current) return;
    if (!focusCoord) return;
    cameraRef.current.setCamera({
      centerCoordinate: [focusCoord.longitude, focusCoord.latitude],
      zoomLevel: focusZoom,
      animationDuration: 500,
      animationMode: "flyTo",
    });
  }, [focusCoord?.latitude, focusCoord?.longitude, focusZoom, cameraRef]);

  return (
    <View style={[{ overflow: "hidden" }, outerStyle]}>
      <MLMapView style={StyleSheet.absoluteFill} mapStyle={mapStyle} attributionEnabled logoEnabled={false}>
        <Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: [initialCenter.longitude, initialCenter.latitude],
            zoomLevel: fullScreen ? 14 : 13,
            animationMode: "moveTo",
          }}
        />

        {showsUserLocation ? (
          <UserLocation visible showsUserHeadingIndicator={false} androidRenderMode="normal" />
        ) : null}

        {routeFeature ? (
          <ShapeSource id="route" shape={routeFeature}>
            <LineLayer
              id="route-line"
              style={{
                lineColor: "#1A73E8",
                lineWidth: 4,
                lineOpacity: 0.92,
                lineCap: "round",
                lineJoin: "round",
              }}
            />
          </ShapeSource>
        ) : null}

        {/* Client site markers — identical to FieldCheckinMap */}
        {clients.map((c) => {
          const sel = c.id === selectedClientId;
          return c.latitude != null && c.longitude != null ? (
            <PointAnnotation
              key={`client-${c.id}-${sel ? "sel" : "def"}`}
              id={`client-${c.id}-${sel ? "sel" : "def"}`}
              coordinate={[c.longitude, c.latitude]}
              onSelected={() => onSelectClient?.(c.id)}
            >
              <MapMarkerPin
                type="client"
                color={sel ? "#F9AB00" : "#EA4335"}
                selected={sel}
                label={sel ? c.clientName : undefined}
              />
            </PointAnnotation>
          ) : null;
        })}

        {/* Team / guard markers */}
        {teamMarkers.map((t) => {
          const sel = t.employeeId === selectedGuardId;
          return t.latitude != null && t.longitude != null ? (
            <PointAnnotation
              key={`guard-${t.employeeId ?? `${t.latitude},${t.longitude}`}-${sel ? "sel" : "def"}`}
              id={String(`guard-${t.employeeId ?? `${t.latitude},${t.longitude}`}-${sel ? "sel" : "def"}`)}
              coordinate={[t.longitude, t.latitude]}
              onSelected={() => onSelectGuard?.(t.employeeId)}
            >
              <MapMarkerPin
                type="guard"
                color={sel ? "#F9AB00" : (t.pinColor || "#1A73E8")}
                selected={sel}
                label={t.employeeName}
              />
            </PointAnnotation>
          ) : null;
        })}

        {playbackCoord ? (
          <PointAnnotation id="playback" coordinate={[playbackCoord.longitude, playbackCoord.latitude]}>
            <View style={styles.playbackDotOuter}>
              <View style={styles.playbackDotInner} />
            </View>
          </PointAnnotation>
        ) : null}
      </MLMapView>
    </View>
  );
}

const styles = StyleSheet.create({
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
