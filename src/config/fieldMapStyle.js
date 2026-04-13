/**
 * MapLibre styles — OSM ecosystem, no Google Maps API.
 *
 * Modes (set `EXPO_PUBLIC_MAP_STYLE_MODE`):
 * - `openfreemap` (default) — vector tiles from OpenFreeMap (MapLibre-friendly, free).
 * - `carto-raster` — CARTO Voyager raster (OSM data, 4 subdomains for throughput).
 * - `maplibre-demo` — MapLibre demo vector style (try only; not for production traffic).
 * - `custom-url` — full style JSON URL in `EXPO_PUBLIC_MAP_STYLE_URL`.
 *
 * Do not use `tile.openstreetmap.org` for high-volume apps (OSMF usage policy).
 */

const OPENFREEMAP_LIBERTY = "https://tiles.openfreemap.org/styles/liberty";

/**
 * Raster template for `react-native-maps` UrlTile (Expo Go fallback).
 * Same OSM-derived layer as `buildCartoVoyagerRasterStyle` — one subdomain is enough for UrlTile.
 */
export const CARTO_VOYAGER_URL_TEMPLATE =
  "https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png";

/** MapLibre-hosted demo tiles (do not use for production). */
const MAPLIBRE_DEMO_STYLE = "https://demotiles.maplibre.org/style.json";

export function buildCartoVoyagerRasterStyle() {
  return {
    version: 8,
    name: "carto-voyager-osm",
    sources: {
      carto: {
        type: "raster",
        tiles: [
          "https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
          "https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
          "https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
          "https://d.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
        ],
        tileSize: 256,
        attribution: "© OpenStreetMap contributors © CARTO",
        maxzoom: 22,
      },
    },
    layers: [{ id: "carto", type: "raster", source: "carto", minzoom: 0, maxzoom: 22 }],
  };
}

/**
 * @returns {string | object} MapLibre `mapStyle` prop (URL string or style JSON object).
 */
export function getFieldMapStyle() {
  const mode = (process.env.EXPO_PUBLIC_MAP_STYLE_MODE || "openfreemap").toLowerCase().trim();
  const customUrl = process.env.EXPO_PUBLIC_MAP_STYLE_URL?.trim();

  if (mode === "custom-url" && customUrl) {
    return customUrl;
  }
  if (mode === "carto-raster") {
    return buildCartoVoyagerRasterStyle();
  }
  if (mode === "maplibre-demo") {
    return MAPLIBRE_DEMO_STYLE;
  }
  // default: vector, sharp at all zooms, good for pan/zoom
  return OPENFREEMAP_LIBERTY;
}
