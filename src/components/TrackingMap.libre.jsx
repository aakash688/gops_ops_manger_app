import { useCallback, useEffect, useMemo, useRef } from "react";
import { View, StyleSheet } from "react-native";
import {
  MapView as MLMapView,
  Camera,
  UserLocation,
  ShapeSource,
  LineLayer,
  Images,
  SymbolLayer,
} from "@maplibre/maplibre-react-native";
import { getFieldMapStyle } from "@/config/fieldMapStyle";
import {
  MAP_LIBRE_LIVE_MARKER_ASSETS,
  getMapLibreMarkerImagesId,
  getMapLibreLiveMarkerSymbolLayerStyle,
} from "@/config/mapLibreMarkerSprites";

/**
 * Live tracking map: markers are SymbolLayer + PNGs (MapLibre recommends this over PointAnnotation).
 * PointAnnotation + RN views caused white-screen crashes on marker tap on Android.
 */
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
  initialCenter,
  fullScreen,
  userLoc = null,
  centerOnUser = true,
  centerMapEpoch = 0,
}) {
  const mapStyle = useMemo(() => getFieldMapStyle(), []);
  const centeredOnUserRef = useRef(false);
  const didInitialCenterRef = useRef(false);

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

  const markerFeatureCollection = useMemo(() => {
    const features = [];
    const selC = selectedClientId != null ? String(selectedClientId) : "";
    const selG = selectedGuardId != null ? String(selectedGuardId) : "";

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
          selected: fid === selC ? 1 : 0,
        },
        geometry: { type: "Point", coordinates: [c.longitude, c.latitude] },
      });
    }

    for (const t of teamMarkers) {
      if (!Number.isFinite(t.latitude) || !Number.isFinite(t.longitude)) continue;
      const fid =
        t.employeeId != null ? String(t.employeeId) : `noid-${t.latitude}-${t.longitude}`;
      features.push({
        type: "Feature",
        properties: {
          kind: "guard",
          fid,
          iconKey: "marker-guard",
          sortKey: 4,
          selected: fid === selG ? 1 : 0,
        },
        geometry: { type: "Point", coordinates: [t.longitude, t.latitude] },
      });
    }

    if (
      !showsUserLocation &&
      userLoc &&
      Number.isFinite(userLoc.latitude) &&
      Number.isFinite(userLoc.longitude)
    ) {
      features.push({
        type: "Feature",
        properties: {
          kind: "me",
          fid: "me",
          iconKey: "marker-me",
          sortKey: 5,
          selected: 0,
        },
        geometry: { type: "Point", coordinates: [userLoc.longitude, userLoc.latitude] },
      });
    }

    if (
      playbackCoord &&
      Number.isFinite(playbackCoord.latitude) &&
      Number.isFinite(playbackCoord.longitude)
    ) {
      features.push({
        type: "Feature",
        properties: {
          kind: "playback",
          fid: "playback",
          iconKey: "marker-playback",
          sortKey: 6,
          selected: 0,
        },
        geometry: {
          type: "Point",
          coordinates: [playbackCoord.longitude, playbackCoord.latitude],
        },
      });
    }

    return { type: "FeatureCollection", features };
  }, [
    clients,
    teamMarkers,
    selectedClientId,
    selectedGuardId,
    userLoc,
    showsUserLocation,
    playbackCoord,
  ]);

  const markerSymbolStyle = useMemo(() => getMapLibreLiveMarkerSymbolLayerStyle(), []);

  const routeLineStyle = useMemo(
    () => ({
      lineColor: "#1A73E8",
      lineOpacity: 0.92,
      lineCap: "round",
      lineJoin: "round",
      lineWidth: [
        "interpolate",
        ["linear"],
        ["zoom"],
        8,
        2,
        12,
        3.2,
        15,
        4.2,
        18,
        5.2,
      ],
    }),
    [],
  );

  const handleMarkerPress = useCallback(
    (e) => {
      const f = e.features?.[0];
      const p = f?.properties;
      if (!p) return;
      const kind = String(p.kind ?? "");
      const fid = p.fid != null ? String(p.fid) : "";
      if (kind === "client") onSelectClient?.(fid);
      else if (kind === "guard") onSelectGuard?.(fid);
    },
    [onSelectClient, onSelectGuard],
  );

  useEffect(() => {
    centeredOnUserRef.current = false;
    didInitialCenterRef.current = false;
  }, [centerMapEpoch]);

  useEffect(() => {
    if (!cameraRef.current) return;
    if (focusCoord) return;
    if (centerOnUser && userLoc && Number.isFinite(userLoc.latitude) && Number.isFinite(userLoc.longitude)) return;
    if (didInitialCenterRef.current) return;
    didInitialCenterRef.current = true;
    cameraRef.current.setCamera({
      centerCoordinate: [initialCenter.longitude, initialCenter.latitude],
      zoomLevel: fullScreen ? 14 : 13,
      animationDuration: 500,
      animationMode: "flyTo",
    });
  }, [
    initialCenter.latitude,
    initialCenter.longitude,
    fullScreen,
    cameraRef,
    focusCoord,
    centerOnUser,
    userLoc?.latitude,
    userLoc?.longitude,
  ]);

  useEffect(() => {
    if (!cameraRef.current || !focusCoord) return;
    const lat = Number(focusCoord.latitude);
    const lng = Number(focusCoord.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const id = setTimeout(() => {
      // Pan only — omit zoomLevel so pinch zoom is preserved (previously forced focusZoom ≈ 14 and felt like zoom-out).
      cameraRef.current?.setCamera({
        centerCoordinate: [lng, lat],
        animationDuration: 0,
        animationMode: "moveTo",
      });
    }, 150);
    return () => clearTimeout(id);
  }, [focusCoord?.latitude, focusCoord?.longitude, cameraRef]);

  useEffect(() => {
    if (!centerOnUser) return;
    if (!cameraRef.current) return;
    if (!userLoc || !Number.isFinite(userLoc.latitude) || !Number.isFinite(userLoc.longitude)) return;
    if (centeredOnUserRef.current) return;
    centeredOnUserRef.current = true;
    cameraRef.current.setCamera({
      centerCoordinate: [userLoc.longitude, userLoc.latitude],
      zoomLevel: fullScreen ? 15 : 14,
      animationDuration: 700,
      animationMode: "flyTo",
    });
  }, [centerOnUser, userLoc?.latitude, userLoc?.longitude, fullScreen, cameraRef, centerMapEpoch]);

  const hasMarkers = markerFeatureCollection.features.length > 0;

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
            centerCoordinate: [initialCenter.longitude, initialCenter.latitude],
            zoomLevel: fullScreen ? 14 : 13,
            animationMode: "moveTo",
          }}
        />

        {showsUserLocation ? (
          <UserLocation visible showsUserHeadingIndicator={false} androidRenderMode="normal" />
        ) : null}

        {routeFeature ? (
          <ShapeSource id="gops-route" shape={routeFeature}>
            <LineLayer id="gops-route-line" style={routeLineStyle} />
          </ShapeSource>
        ) : null}

        {hasMarkers ? (
          <>
            <Images id={getMapLibreMarkerImagesId()} images={MAP_LIBRE_LIVE_MARKER_ASSETS} />
            <ShapeSource
              id="gops-live-markers"
              shape={markerFeatureCollection}
              onPress={handleMarkerPress}
              hitbox={{ width: 56, height: 56 }}
            >
              <SymbolLayer id="gops-live-markers-symbol" style={markerSymbolStyle} />
            </ShapeSource>
          </>
        ) : null}
      </MLMapView>
    </View>
  );
}
