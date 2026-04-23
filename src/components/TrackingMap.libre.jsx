import { useEffect, useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import {
  MapView as MLMapView,
  Camera,
  UserLocation,
  ShapeSource,
  LineLayer,
  PointAnnotation,
} from "@maplibre/maplibre-react-native";
import { getFieldMapStyle } from "@/config/fieldMapStyle";

export default function TrackingMapLibre({
  outerStyle,
  cameraRef,
  showsUserLocation,
  teamMarkers,
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
                lineColor: "#007AFF",
                lineWidth: 4,
                lineOpacity: 0.9,
              }}
            />
          </ShapeSource>
        ) : null}

        {teamMarkers.map((t) =>
          t.latitude != null && t.longitude != null ? (
            <PointAnnotation
              key={t.employeeId ?? `${t.latitude},${t.longitude}`}
              id={String(t.employeeId ?? `${t.latitude},${t.longitude}`)}
              coordinate={[t.longitude, t.latitude]}
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
            </PointAnnotation>
          ) : null,
        )}

        {playbackCoord ? (
          <PointAnnotation id="playback" coordinate={[playbackCoord.longitude, playbackCoord.latitude]}>
            <View
              style={{
                width: 14,
                height: 14,
                borderRadius: 7,
                backgroundColor: "#FF9500",
                borderWidth: 2,
                borderColor: "#FFFFFF",
              }}
            />
          </PointAnnotation>
        ) : null}
      </MLMapView>
    </View>
  );
}

