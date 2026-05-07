import { useCallback, useEffect, useMemo, useRef } from "react";
import { View, StyleSheet } from "react-native";
import {
  MapView as MLMapView,
  Camera,
  UserLocation,
  ShapeSource,
  FillLayer,
  Images,
  SymbolLayer,
} from "@maplibre/maplibre-react-native";
import { getFieldMapStyle } from "@/config/fieldMapStyle";
import {
  MAP_LIBRE_LIVE_MARKER_ASSETS,
  getMapLibreMarkerImagesId,
  getMapLibreLiveMarkerSymbolLayerStyle,
} from "@/config/mapLibreMarkerSprites";

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

/** MapLibre path — same marker sprites as live tracking (SymbolLayer + PNGs, not PointAnnotation). */
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

  const clientMarkerCollection = useMemo(() => {
    const sel = selectedClientId != null ? String(selectedClientId) : "";
    const features = [];
    for (const c of clients) {
      if (!Number.isFinite(c.latitude) || !Number.isFinite(c.longitude)) continue;
      const fid = String(c.id);
      features.push({
        type: "Feature",
        properties: {
          kind: "client",
          fid,
          iconKey: "marker-client",
          sortKey: 3,
          selected: fid === sel ? 1 : 0,
        },
        geometry: { type: "Point", coordinates: [c.longitude, c.latitude] },
      });
    }
    return { type: "FeatureCollection", features };
  }, [clients, selectedClientId]);

  const markerSymbolStyle = useMemo(() => getMapLibreLiveMarkerSymbolLayerStyle(), []);

  const handleClientMarkerPress = useCallback(
    (e) => {
      const f = e.features?.[0];
      const p = f?.properties;
      if (!p || String(p.kind ?? "") !== "client") return;
      const fid = p.fid != null ? String(p.fid) : "";
      if (!fid) return;
      const match = clients.find((c) => String(c.id) === fid);
      if (match) onSelectClient?.(match.id);
    },
    [onSelectClient, clients],
  );

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

  const hasClientMarkers = clientMarkerCollection.features.length > 0;

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

        {hasClientMarkers ? (
          <>
            <Images id={getMapLibreMarkerImagesId()} images={MAP_LIBRE_LIVE_MARKER_ASSETS} />
            <ShapeSource
              id="field-checkin-markers"
              shape={clientMarkerCollection}
              onPress={handleClientMarkerPress}
              hitbox={{ width: 56, height: 56 }}
            >
              <SymbolLayer id="field-checkin-markers-symbol" style={markerSymbolStyle} />
            </ShapeSource>
          </>
        ) : null}
      </MLMapView>
    </View>
  );
}
