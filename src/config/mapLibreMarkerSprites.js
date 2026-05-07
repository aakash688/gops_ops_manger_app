import Constants from "expo-constants";

/** Sprites for live tracking + remote check-in MapLibre maps (512×512 PNGs, scaled in style). */
export const MAP_LIBRE_LIVE_MARKER_ASSETS = {
  "marker-client": require("../../assets/map/marker-client.png"),
  "marker-guard": require("../../assets/map/marker-guard.png"),
  "marker-me": require("../../assets/map/marker-me.png"),
  "marker-playback": require("../../assets/map/marker-playback.png"),
};

/**
 * Bump `expo.extra.mapMarkerAssetRevision` in app.json when replacing PNGs under assets/map/.
 */
export function getMapLibreMarkerImagesId() {
  return `gops-live-marker-images-r${Number(Constants.expoConfig?.extra?.mapMarkerAssetRevision ?? 1)}`;
}

/** Target ~48–56 logical px at mid-zoom for 512×512 sources. */
export const MAP_LIBRE_MARKER_BASE_ICON_SCALE = 52 / 512;

export const MAP_LIBRE_MARKER_ZOOM_SCALE = [
  "interpolate",
  ["linear"],
  ["zoom"],
  4,
  0.22,
  7,
  0.36,
  10,
  0.52,
  12,
  0.66,
  14,
  0.82,
  16,
  0.94,
  18,
  1.05,
  20,
  1.14,
];

/** SymbolLayer style shared by live tracking and field check-in marker layers. */
export function getMapLibreLiveMarkerSymbolLayerStyle() {
  return {
    iconImage: ["get", "iconKey"],
    iconAllowOverlap: true,
    iconIgnorePlacement: true,
    iconAnchor: "center",
    symbolSortKey: ["get", "sortKey"],
    iconSize: [
      "*",
      MAP_LIBRE_MARKER_BASE_ICON_SCALE,
      [
        "*",
        [
          "case",
          ["==", ["to-number", ["coalesce", ["get", "selected"], 0]], 1],
          1.38,
          ["==", ["get", "kind"], "playback"],
          1.12,
          ["==", ["get", "kind"], "me"],
          1.08,
          ["==", ["get", "kind"], "client"],
          1.18,
          1.0,
        ],
        MAP_LIBRE_MARKER_ZOOM_SCALE,
      ],
    ],
  };
}
