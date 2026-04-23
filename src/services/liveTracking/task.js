import * as TaskManager from "expo-task-manager";
import * as Location from "expo-location";
import { LIVE_TRACKING_TASK } from "./constants";
import { enqueuePings } from "./storage";

function mapLocation(loc) {
  return {
    latitude: loc.coords.latitude,
    longitude: loc.coords.longitude,
    timestamp: loc.timestamp ? new Date(loc.timestamp).toISOString() : new Date().toISOString(),
    accuracyMeters: loc.coords.accuracy ?? null,
    speedMps: loc.coords.speed != null && !Number.isNaN(loc.coords.speed) ? loc.coords.speed : null,
    batteryLevel: null,
    networkType: null,
    status: "LIVE",
    deviceInfo: null,
  };
}

TaskManager.defineTask(LIVE_TRACKING_TASK, async ({ data, error }) => {
  if (error) {
    return;
  }
  const locations = data?.locations;
  if (!locations || !locations.length) return;
  const pings = locations.map(mapLocation);
  await enqueuePings(pings);
});
