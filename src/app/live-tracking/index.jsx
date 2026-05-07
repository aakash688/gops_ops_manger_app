import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Modal,
  TextInput,
  StyleSheet,
  Platform,
  Dimensions,
  InteractionManager,
} from "react-native";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import {
  MapPin,
  Navigation,
  Radio,
  Play,
  Pause,
  Footprints,
  Timer,
  Search,
  X,
  Wifi,
  WifiOff,
  BatteryLow,
  BatteryMedium,
  BatteryFull,
  ShieldCheck,
  ShieldAlert,
  Satellite,
  Building2,
  UserRound,
  Crosshair,
  ExternalLink,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import Slider from "@react-native-community/slider";
import * as Location from "expo-location";
import * as Battery from "expo-battery";
import NetInfo from "@react-native-community/netinfo";
import StackScreen from "@/components/StackScreen";
import TrackingMap from "@/components/TrackingMap";
import { apiGetJson } from "@/utils/api";
import { useAuthStore } from "@/utils/auth/store";
import { openMapsDirections, openMapsPin } from "@/utils/openInMaps";
import {
  normalizeRecordCoordinates,
  normalizeRecordCoordinatesList,
  metersBetween,
} from "@/utils/coordinates";
import {
  getSessionId,
  getPingIntervalSec,
} from "@/services/liveTracking/storage";
import { getLiveTrackingHealth, isLiveTrackingSessionActive, reportComplianceEvent } from "@/services/liveTracking";

function formatAgo(iso) {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const sec = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

function formatDistance(m) {
  if (m == null || Number.isNaN(m)) return "—";
  if (m < 1000) return `${m} m`;
  return `${(m / 1000).toFixed(2)} km`;
}

function formatDuration(sec) {
  if (sec == null || Number.isNaN(sec)) return "—";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatClock(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/** YYYY-MM-DD in the device's local calendar (not UTC). */
function localCalendarDateISO(d) {
  const tzOffsetMs = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - tzOffsetMs).toISOString().slice(0, 10);
}

function todayLocalISODate() {
  return localCalendarDateISO(new Date());
}

function localDateISOPlusDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return localCalendarDateISO(d);
}

function pointLocalDateISO(p) {
  const raw = p.trackedAt ?? p.timestamp ?? p.createdAt;
  if (!raw) return null;
  const t = new Date(raw).getTime();
  if (!Number.isFinite(t)) return null;
  return localCalendarDateISO(new Date(t));
}

function filterRouteDataToLocalToday(data, todayIso) {
  if (!data || !Array.isArray(data.points)) return data;
  const filtered = data.points.filter((p) => pointLocalDateISO(p) === todayIso);
  return { ...data, points: filtered };
}

const OFFLINE_FRIENDLY = "Offline — will load when internet returns";

function isNetworkErrorMsg(msg) {
  if (msg == null) return false;
  const s = String(msg).toLowerCase();
  return (
    s.includes("unknownhostexception")
    || s.includes("unable to resolve host")
    || s.includes("network request failed")
    || s.includes("failed to fetch")
    || s.includes("econnrefused")
    || s.includes("etimedout")
    || s.includes("enotfound")
    || s.includes("network error")
    || s.includes("sockettimeout")
  );
}

function friendlyLoadError(e) {
  const msg = e instanceof Error ? e.message : String(e ?? "");
  return isNetworkErrorMsg(msg) ? OFFLINE_FRIENDLY : msg || "Something went wrong";
}

const STALE_COMPLIANCE_MS = 10 * 60 * 1000;

/** Close orphaned START rows from older app versions once radios/GPS/permission are healthy again. */
async function resolveStaleOpenComplianceEvents(events) {
  if (!Array.isArray(events) || events.length === 0) return false;
  const net = await NetInfo.fetch();
  if (net.isConnected !== true) return false;
  const fg = await Location.getForegroundPermissionsAsync();
  const servicesOk = await Location.hasServicesEnabledAsync();
  const now = Date.now();
  const endedAt = new Date().toISOString();

  const stale = (e) => {
    if (e.endedAt) return false;
    const started = e.startedAt ? new Date(e.startedAt).getTime() : NaN;
    return Number.isFinite(started) && now - started >= STALE_COMPLIANCE_MS;
  };

  let posted = false;
  if (events.some((e) => stale(e) && String(e.type) === "NETWORK_OFFLINE")) {
    await reportComplianceEvent({
      type: "NETWORK_OFFLINE",
      status: "END",
      endedAt,
    }).catch(() => {});
    posted = true;
  }
  if (servicesOk && events.some((e) => stale(e) && String(e.type) === "GPS_OFF")) {
    await reportComplianceEvent({
      type: "GPS_OFF",
      status: "END",
      endedAt,
    }).catch(() => {});
    posted = true;
  }
  if (fg.status === "granted" && events.some((e) => stale(e) && String(e.type) === "PERMISSION_REVOKED")) {
    await reportComplianceEvent({
      type: "PERMISSION_REVOKED",
      status: "END",
      endedAt,
    }).catch(() => {});
    posted = true;
  }
  return posted;
}

const SITE_VISIT_RADIUS_M = 500;

/** Contiguous stretches at one client from route pings (nearest site within radius). */
function buildSiteVisitSegmentsFromRoute(routePoints, clientsList, radiusM) {
  if (!Array.isArray(routePoints) || routePoints.length === 0) return [];
  if (!Array.isArray(clientsList) || clientsList.length === 0) return [];

  const normalized = routePoints
    .map((p) => {
      const c = normalizeRecordCoordinates(p);
      if (!c) return null;
      const raw = p.trackedAt ?? p.timestamp ?? p.createdAt;
      const ts = raw ? new Date(raw).getTime() : NaN;
      if (!Number.isFinite(ts)) return null;
      return {
        latitude: c.latitude,
        longitude: c.longitude,
        ts,
        iso: new Date(ts).toISOString(),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.ts - b.ts);

  if (!normalized.length) return [];

  const nearestClient = (lat, lng) => {
    let best = null;
    let bestD = Infinity;
    for (const cl of clientsList) {
      if (!Number.isFinite(cl.latitude) || !Number.isFinite(cl.longitude)) continue;
      const d = metersBetween(
        { latitude: lat, longitude: lng },
        { latitude: cl.latitude, longitude: cl.longitude },
      );
      if (d != null && d <= radiusM && d < bestD) {
        bestD = d;
        best = { id: String(cl.id), clientName: cl.clientName || "Site" };
      }
    }
    return best;
  };

  const segments = [];
  let i = 0;
  while (i < normalized.length) {
    const at = nearestClient(normalized[i].latitude, normalized[i].longitude);
    if (!at) {
      i += 1;
      continue;
    }
    const { id, clientName } = at;
    const start = normalized[i];
    let j = i + 1;
    while (j < normalized.length) {
      const atJ = nearestClient(normalized[j].latitude, normalized[j].longitude);
      if (!atJ || atJ.id !== id) break;
      j += 1;
    }
    const end = normalized[j - 1];
    const lastPt = normalized[normalized.length - 1];
    const lastNearest = nearestClient(lastPt.latitude, lastPt.longitude);
    const ongoing = lastNearest?.id === id && j === normalized.length;

    segments.push({
      clientId: id,
      clientName,
      arrivedAt: start.iso,
      leftAt: ongoing ? null : end.iso,
      durationSec: Math.max(0, Math.round((end.ts - start.ts) / 1000)),
      ongoing,
    });
    i = j;
  }
  return segments;
}

function BatteryIcon({ level }) {
  if (level == null) return <BatteryMedium size={15} color="#8E8E93" />;
  if (level < 20) return <BatteryLow size={15} color="#FF3B30" />;
  if (level < 60) return <BatteryMedium size={15} color="#FF9500" />;
  return <BatteryFull size={15} color="#30D158" />;
}

const { width: WIN_W } = Dimensions.get("window");

export default function LiveTrackingScreen() {
  const employeeId = useAuthStore((s) => s.auth?.user?.employeeId);
  const [team, setTeam] = useState([]);
  const [teamLoading, setTeamLoading] = useState(true);
  const [teamError, setTeamError] = useState(null);
  const [clients, setClients] = useState([]);
  const [clientsError, setClientsError] = useState(null);
  const [route, setRoute] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState(null);
  const [clientHalts, setClientHalts] = useState(null);
  const [clientHaltsLoading, setClientHaltsLoading] = useState(false);
  const [clientHaltsError, setClientHaltsError] = useState(null);
  const [complianceTl, setComplianceTl] = useState([]);
  const [complianceLoading, setComplianceLoading] = useState(false);
  const [complianceError, setComplianceError] = useState(null);
  const [playbackIndex, setPlaybackIndex] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(2);
  const [playing, setPlaying] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedTarget, setSelectedTarget] = useState(null);

  // My session health state
  const [mySession, setMySession] = useState({
    active: false,
    intervalSec: 0,
    battery: null,
    network: "UNKNOWN",
    lastPingAt: null,
  });
  const [nativeHealth, setNativeHealth] = useState(null);
  /** Current device location for map centering (same behavior as remote check-in). */
  const [mapUserLoc, setMapUserLoc] = useState(null);
  /** Bumped on each screen focus so the map can re-run one-shot "center on me". */
  const [mapCenterEpoch, setMapCenterEpoch] = useState(0);
  const [locatingMe, setLocatingMe] = useState(false);

  const glassFallback = isLiquidGlassAvailable() ? {} : { backgroundColor: "#fff" };

  const loadMySessionHealth = useCallback(async () => {
    try {
      const [active, intervalSec, batteryRaw, netState] = await Promise.all([
        isLiveTrackingSessionActive().catch(() => false),
        getPingIntervalSec().catch(() => 0),
        Battery.getBatteryLevelAsync().catch(() => null),
        NetInfo.fetch().catch(() => null),
      ]);
      const battery = typeof batteryRaw === "number" && !Number.isNaN(batteryRaw)
        ? Math.round(batteryRaw * 100)
        : null;
      let network = "UNKNOWN";
      if (netState) {
        if (!netState.isConnected) network = "OFFLINE";
        else if (netState.type === "wifi") network = "WiFi";
        else if (netState.type === "cellular") network = `${netState.details?.cellularGeneration ?? "Cell"}`;
        else network = "Online";
      }
      setMySession((prev) => ({ ...prev, active, intervalSec, battery, network }));
      getLiveTrackingHealth()
        .then(setNativeHealth)
        .catch(() => setNativeHealth(null));
    } catch {
      /* ignore */
    }
  }, []);

  const loadTeam = useCallback(async () => {
    setTeamError(null);
    setTeamLoading(true);
    try {
      const { data } = await apiGetJson("/apps/live-tracking/team/latest");
      setTeam(normalizeRecordCoordinatesList(data));
    } catch (e) {
      setTeam([]);
      setTeamError(friendlyLoadError(e));
    } finally {
      setTeamLoading(false);
    }
  }, []);

  const loadClients = useCallback(async () => {
    setClientsError(null);
    try {
      const { data } = await apiGetJson("/apps/field-checkin/clients");
      setClients(normalizeRecordCoordinatesList(data));
    } catch (e) {
      setClients([]);
      setClientsError(friendlyLoadError(e));
    }
  }, []);

  const loadMyRouteToday = useCallback(async () => {
    if (!employeeId) {
      setRoute(null);
      return;
    }
    const todayIso = todayLocalISODate();
    const dateFrom = localDateISOPlusDays(-1);
    const dateTo = localDateISOPlusDays(1);
    setRouteError(null);
    setRouteLoading(true);
    try {
      const { data } = await apiGetJson(
        `/apps/live-tracking/route?employeeId=${encodeURIComponent(employeeId)}&dateFrom=${dateFrom}&dateTo=${dateTo}&limit=4000`,
      );
      const filtered = filterRouteDataToLocalToday(data ?? null, todayIso);
      setRoute(filtered ?? null);
      setPlaybackIndex(0);
      setPlaying(false);
      const pts = filtered?.points;
      if (Array.isArray(pts) && pts.length > 0) {
        const last = pts[pts.length - 1];
        setMySession((prev) => ({ ...prev, lastPingAt: last.trackedAt ?? last.timestamp ?? null }));
      }
    } catch (e) {
      setRoute(null);
      setRouteError(friendlyLoadError(e));
    } finally {
      setRouteLoading(false);
    }
  }, [employeeId]);

  const loadClientHaltsToday = useCallback(async () => {
    if (!employeeId) {
      setClientHalts(null);
      return;
    }
    const dateFrom = localDateISOPlusDays(-1);
    const dateTo = localDateISOPlusDays(1);
    setClientHaltsError(null);
    setClientHaltsLoading(true);
    try {
      const { data } = await apiGetJson(
        `/apps/live-tracking/analytics/client-halts?employeeId=${encodeURIComponent(employeeId)}&dateFrom=${dateFrom}&dateTo=${dateTo}&radiusMeters=500&limitPoints=4000`,
      );
      setClientHalts(data ?? null);
    } catch (e) {
      setClientHalts(null);
      setClientHaltsError(friendlyLoadError(e));
    } finally {
      setClientHaltsLoading(false);
    }
  }, [employeeId]);

  const loadComplianceTimelineToday = useCallback(async () => {
    if (!employeeId) {
      setComplianceTl([]);
      return;
    }
    const dateFrom = localDateISOPlusDays(-1);
    const dateTo = localDateISOPlusDays(1);
    setComplianceError(null);
    setComplianceLoading(true);
    try {
      const { data } = await apiGetJson(
        `/apps/live-tracking/compliance/timeline?employeeId=${encodeURIComponent(employeeId)}&dateFrom=${dateFrom}&dateTo=${dateTo}&limit=200`,
      );
      const list = Array.isArray(data) ? data : [];
      setComplianceTl(list);
      const refreshed = await resolveStaleOpenComplianceEvents(list);
      if (refreshed) {
        const { data: data2 } = await apiGetJson(
          `/apps/live-tracking/compliance/timeline?employeeId=${encodeURIComponent(employeeId)}&dateFrom=${dateFrom}&dateTo=${dateTo}&limit=200`,
        );
        setComplianceTl(Array.isArray(data2) ? data2 : []);
      }
    } catch (e) {
      setComplianceTl([]);
      setComplianceError(friendlyLoadError(e));
    } finally {
      setComplianceLoading(false);
    }
  }, [employeeId]);

  useFocusEffect(
    useCallback(() => {
      loadMySessionHealth();
      loadTeam();
      loadMyRouteToday();
      loadClients();
      loadClientHaltsToday();
      loadComplianceTimelineToday();

      let cancelled = false;
      (async () => {
        try {
          const { status } = await Location.getForegroundPermissionsAsync();
          if (cancelled) return;
          if (status === "granted") {
            const pos = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            });
            if (cancelled) return;
            setMapUserLoc({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy ?? undefined,
              timestamp: pos.timestamp,
            });
          } else {
            setMapUserLoc(null);
          }
        } catch {
          if (!cancelled) setMapUserLoc(null);
        } finally {
          if (!cancelled) setMapCenterEpoch((e) => e + 1);
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [loadMySessionHealth, loadTeam, loadMyRouteToday, loadClients, loadClientHaltsToday, loadComplianceTimelineToday]),
  );

  const mapInitial = useMemo(() => {
    if (
      mapUserLoc &&
      Number.isFinite(mapUserLoc.latitude) &&
      Number.isFinite(mapUserLoc.longitude)
    ) {
      return {
        latitude: mapUserLoc.latitude,
        longitude: mapUserLoc.longitude,
        latitudeDelta: 0.08,
        longitudeDelta: 0.08,
      };
    }
    const withLoc = team.filter((t) => Number.isFinite(t.latitude) && Number.isFinite(t.longitude));
    if (withLoc.length === 0) {
      return { latitude: 20.5937, longitude: 78.9629, latitudeDelta: 8, longitudeDelta: 8 };
    }
    const lat = withLoc.reduce((s, t) => s + t.latitude, 0) / withLoc.length;
    const lng = withLoc.reduce((s, t) => s + t.longitude, 0) / withLoc.length;
    return { latitude: lat, longitude: lng, latitudeDelta: 0.12, longitudeDelta: 0.12 };
  }, [team, mapUserLoc]);

  const routeCoords = useMemo(() => {
    const pts = route?.points;
    if (!Array.isArray(pts) || pts.length < 2) return [];
    return pts.map(normalizeRecordCoordinates).filter(Boolean);
  }, [route]);

  const siteVisitSegments = useMemo(
    () => buildSiteVisitSegmentsFromRoute(route?.points ?? [], clients, SITE_VISIT_RADIUS_M),
    [route?.points, clients],
  );

  const routeCoordsPlayback = useMemo(() => {
    if (!routeCoords.length) return [];
    return routeCoords.slice(0, Math.min(playbackIndex + 1, routeCoords.length));
  }, [routeCoords, playbackIndex]);

  useEffect(() => {
    if (!playing || routeCoords.length < 2) return undefined;
    const stepMs = Math.max(60, Math.round(320 / playbackSpeed));
    const id = setInterval(() => {
      setPlaybackIndex((i) => {
        if (i >= routeCoords.length - 1) { setPlaying(false); return i; }
        return i + 1;
      });
    }, stepMs);
    return () => clearInterval(id);
  }, [playing, routeCoords.length, playbackSpeed]);

  const playbackPosition = routeCoords[Math.min(playbackIndex, routeCoords.length - 1)];
  const teamMarkers = useMemo(
    () => team.map((t) => ({
      employeeId: t.employeeId,
      employeeName: t.employeeName ?? t.name ?? t.employee?.name ?? "",
      latitude: t.latitude,
      longitude: t.longitude,
      subtitle: `${formatAgo(t.trackedAt)}${t.sessionOpen ? " · live session" : ""}`,
      pinColor: t.sessionOpen ? "#007AFF" : "#8E8E93",
    })),
    [team],
  );

  const focusCoord = useMemo(() => {
    if (!selectedTarget) return null;
    const lat = Number(selectedTarget.latitude);
    const lng = Number(selectedTarget.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { latitude: lat, longitude: lng };
  }, [selectedTarget]);

  const selectedClientId = selectedTarget?.type === "client" ? String(selectedTarget.id) : null;
  const selectedGuardId = selectedTarget?.type === "team" ? String(selectedTarget.id) : null;

  const handleSelectClient = useCallback((clientId) => {
    InteractionManager.runAfterInteractions(() => {
      const c = clients.find((x) => String(x.id) === String(clientId));
      if (!c) return;
      setSelectedTarget({
        type: "client",
        id: c.id,
        name: c.clientName,
        subtitle: [c.deploymentAddress, c.city].filter(Boolean).join(", ") || "Site",
        latitude: c.latitude,
        longitude: c.longitude,
        extra: { address: c.deploymentAddress ?? null, city: c.city ?? null },
      });
    });
  }, [clients]);

  const handleSelectGuard = useCallback((guardEmployeeId) => {
    InteractionManager.runAfterInteractions(() => {
      const t = team.find((x) => String(x.employeeId) === String(guardEmployeeId));
      if (!t) return;
      setSelectedTarget({
        type: "team",
        id: t.employeeId,
        name: t.employeeName,
        subtitle: formatAgo(t.trackedAt),
        latitude: t.latitude,
        longitude: t.longitude,
        extra: {
          trackedAt: t.trackedAt ?? null,
          batteryLevel: t.batteryLevel ?? null,
          sessionOpen: t.sessionOpen ?? false,
          networkType: t.networkType ?? null,
        },
      });
    });
  }, [team]);

  const searchItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    const teamItems = team
      .filter((t) => Number.isFinite(t.latitude) && Number.isFinite(t.longitude))
      .map((t) => ({
        type: "team", id: t.employeeId, name: t.employeeName,
        subtitle: `${formatAgo(t.trackedAt)}${t.sessionOpen ? " · session active" : ""}`,
        latitude: t.latitude, longitude: t.longitude,
      }));
    const clientItems = clients
      .filter((c) => Number.isFinite(c.latitude) && Number.isFinite(c.longitude))
      .map((c) => ({
        type: "client", id: c.id, name: c.clientName,
        subtitle: "Site", latitude: c.latitude, longitude: c.longitude,
      }));
    const all = [...clientItems, ...teamItems];
    if (!q) return all.slice(0, 60);
    return all.filter((x) => String(x.name || "").toLowerCase().includes(q)).slice(0, 60);
  }, [query, team, clients]);

  const recenterOnMe = useCallback(async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== "granted") return;
      setLocatingMe(true);
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setMapUserLoc({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy ?? undefined,
        timestamp: pos.timestamp,
      });
      setMapCenterEpoch((e) => e + 1);
    } catch {
      /* ignore */
    } finally {
      setLocatingMe(false);
    }
  }, []);

  const openDirectionsToTarget = useCallback(async () => {
    if (!selectedTarget) return;
    // Use last-known OS location (instant) so the map app opens immediately.
    // getCurrentPositionAsync waits for a live GPS fix and adds 3-8s of delay.
    try {
      const last = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60 * 1000 });
      const origin = last?.coords ?? null;
      await openMapsDirections(
        origin?.latitude ?? null,
        origin?.longitude ?? null,
        selectedTarget.latitude,
        selectedTarget.longitude,
      );
    } catch {
      // If even getLastKnownPosition fails, open with destination only — map app handles routing from device location.
      await openMapsDirections(null, null, selectedTarget.latitude, selectedTarget.longitude);
    }
  }, [selectedTarget]);

  const refreshAll = () => {
    loadMySessionHealth();
    loadTeam();
    loadMyRouteToday();
    loadClients();
    loadClientHaltsToday();
    loadComplianceTimelineToday();
  };

  const recentCompliance = complianceTl.slice(-6).reverse();
  const liveTeam = team.filter((t) => t.sessionOpen);
  const offlineTeam = team.filter((t) => !t.sessionOpen);

  return (
    <StackScreen title="Live tracking" subtitle="Team positions & your route (today)" contentStyle={{ paddingHorizontal: 16 }}>

      {mySession.network === "OFFLINE" ? (
        <View style={styles.offlineBanner}>
          <WifiOff size={18} color="#C00" />
          <Text style={styles.offlineBannerText}>
            No network connection. Some data may not load until you are back online.
          </Text>
        </View>
      ) : null}

      {/* ─── My Session Health Card ─── */}
      <GlassView style={[styles.sessionCard, glassFallback]}>
        <View style={styles.sessionCardTop}>
          <View style={[styles.sessionDot, mySession.active ? styles.dotLive : styles.dotOff]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.sessionCardTitle}>
              {mySession.active ? "Live session active" : "No active session"}
            </Text>
            <Text style={styles.sessionCardSub}>
              {mySession.active
                ? `Pinging every ${mySession.intervalSec}s · last: ${formatAgo(mySession.lastPingAt)}`
                : "Check in on Remote Check-in to start tracking"}
            </Text>
          </View>
          {mySession.active ? (
            <ShieldCheck size={22} color="#30D158" />
          ) : (
            <ShieldAlert size={22} color="#8E8E93" />
          )}
        </View>
        <View style={styles.healthRow}>
          <View style={styles.healthChip}>
            <BatteryIcon level={mySession.battery} />
            <Text style={styles.healthLabel}>Battery</Text>
            <Text style={[styles.healthVal, mySession.battery != null && mySession.battery < 20 ? styles.textRed : styles.textPrimary]}>
              {mySession.battery != null ? `${mySession.battery}%` : "—"}
            </Text>
          </View>
          <View style={styles.healthChip}>
            {mySession.network === "OFFLINE" ? <WifiOff size={15} color="#FF3B30" /> : <Wifi size={15} color="#30D158" />}
            <Text style={styles.healthLabel}>Network</Text>
            <Text style={[styles.healthVal, mySession.network === "OFFLINE" ? styles.textRed : styles.textPrimary]}>
              {mySession.network}
            </Text>
          </View>
          <View style={styles.healthChip}>
            <Satellite size={15} color={mySession.active ? "#30D158" : "#8E8E93"} />
            <Text style={styles.healthLabel}>GPS</Text>
            <Text style={[styles.healthVal, mySession.active ? styles.textGreen : styles.textMuted]}>
              {mySession.active ? "Active" : "Off"}
            </Text>
          </View>
          <View style={styles.healthChip}>
            <Radio size={15} color={complianceTl.some((e) => !e.endedAt) ? "#FF3B30" : "#30D158"} />
            <Text style={styles.healthLabel}>Compliance</Text>
            <Text style={[styles.healthVal, complianceTl.some((e) => !e.endedAt) ? styles.textRed : styles.textGreen]}>
              {complianceTl.some((e) => !e.endedAt) ? "Issue" : "OK"}
            </Text>
          </View>
        </View>
      </GlassView>

      {/* ─── Map ─── */}
      {Platform.OS !== "web" ? (
        <View style={styles.mapWrap}>
          <TrackingMap
            height={330}
            teamMarkers={teamMarkers}
            clients={clients}
            selectedClientId={selectedClientId}
            selectedGuardId={selectedGuardId}
            onSelectClient={handleSelectClient}
            onSelectGuard={handleSelectGuard}
            routeCoords={routeCoordsPlayback}
            playbackCoord={playbackPosition ?? null}
            focusCoord={focusCoord}
            initialCenter={{ latitude: mapInitial.latitude, longitude: mapInitial.longitude }}
            userLoc={mapUserLoc}
            centerOnUser
            centerMapEpoch={mapCenterEpoch}
          />
          <Pressable
            onPress={recenterOnMe}
            style={({ pressed }) => [styles.mapLocateBtn, pressed && { opacity: 0.88 }]}
            hitSlop={12}
            accessibilityLabel="Center map on my GPS location"
          >
            {locatingMe ? (
              <ActivityIndicator size="small" color="#1A73E8" />
            ) : (
              <Crosshair size={22} color="#1A73E8" />
            )}
          </Pressable>
          <View style={styles.mapAttrib} pointerEvents="none">
            <Text style={styles.mapAttribText}>© OpenStreetMap © CARTO</Text>
          </View>

          {/* Google Maps-style selection card overlaid at the bottom of the map */}
          {selectedTarget ? (
            <View style={styles.mapSelectionCard}>
              <View style={styles.mapSelectionCardInner}>
                <View style={[
                  styles.mapSelectionIcon,
                  selectedTarget.type === "client" ? styles.mapSelIconClient : styles.mapSelIconGuard,
                ]}>
                  {selectedTarget.type === "client"
                    ? <Building2 size={20} color="#EA4335" />
                    : <UserRound size={20} color={selectedTarget.extra?.sessionOpen ? "#1A73E8" : "#8E8E93"} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.mapSelectionName} numberOfLines={1}>{selectedTarget.name}</Text>
                  {selectedTarget.type === "team" ? (
                    <View style={styles.mapSelMetaRow}>
                      <Text style={styles.mapSelMeta}>
                        {selectedTarget.extra?.sessionOpen ? "● Live" : "○ Offline"}
                        {" · "}
                        {formatAgo(selectedTarget.extra?.trackedAt)}
                      </Text>
                      {selectedTarget.extra?.batteryLevel != null ? (
                        <View style={styles.mapSelBattery}>
                          <BatteryIcon level={selectedTarget.extra.batteryLevel} />
                          <Text style={styles.mapSelMeta}>{selectedTarget.extra.batteryLevel}%</Text>
                        </View>
                      ) : null}
                    </View>
                  ) : (
                    <Text style={styles.mapSelMeta} numberOfLines={1}>{selectedTarget.subtitle}</Text>
                  )}
                </View>
                <View style={styles.mapSelActions}>
                  <Pressable onPress={openDirectionsToTarget} style={styles.mapSelActionBtn} hitSlop={8}>
                    <Navigation size={18} color="#1A73E8" />
                  </Pressable>
                  <Pressable onPress={() => openMapsPin(selectedTarget.latitude, selectedTarget.longitude, selectedTarget.name)} style={styles.mapSelActionBtn} hitSlop={8}>
                    <ExternalLink size={18} color="#1A73E8" />
                  </Pressable>
                  <Pressable onPress={() => setSelectedTarget(null)} style={styles.mapSelCloseBtn} hitSlop={8}>
                    <X size={16} color="#636366" />
                  </Pressable>
                </View>
              </View>
            </View>
          ) : null}
        </View>
      ) : (
        <GlassView style={[styles.webMapPlaceholder, glassFallback]}>
          <MapPin size={36} color="#007AFF" />
          <Text style={{ marginTop: 10, fontWeight: "700", color: "#000" }}>Map on device</Text>
          <Text style={{ fontSize: 13, color: "#666", marginTop: 4, textAlign: "center" }}>
            Open this screen in the iOS or Android app for the live map.
          </Text>
        </GlassView>
      )}

      {Platform.OS === "android" ? (
        <GlassView style={[styles.card, glassFallback, styles.nativeTrackingHealthCard]}>
          <View style={styles.sectionHeaderRow}>
            <ShieldCheck size={18} color={nativeHealth?.nativeServiceRunning ? "#30D158" : "#FF9500"} />
            <Text style={styles.sectionTitle}>Tracking health</Text>
          </View>
          <View style={styles.nativeHealthGrid}>
            <View style={styles.nativeHealthRow}>
              <View style={styles.nativeHealthCell}>
                <Radio size={18} color={nativeHealth?.nativeServiceRunning ? "#30D158" : "#FF9500"} />
                <Text style={styles.nativeHealthLabel}>Service</Text>
                <Text style={[styles.nativeHealthVal, nativeHealth?.nativeServiceRunning ? styles.textGreen : styles.textRed]} numberOfLines={1}>
                  {nativeHealth?.nativeServiceRunning ? "Running" : "Stopped"}
                </Text>
              </View>
              <View style={styles.nativeHealthCell}>
                <Satellite size={18} color={nativeHealth?.gpsEnabled ? "#30D158" : "#FF3B30"} />
                <Text style={styles.nativeHealthLabel}>GPS</Text>
                <Text style={[styles.nativeHealthVal, nativeHealth?.gpsEnabled ? styles.textGreen : styles.textRed]} numberOfLines={1}>
                  {nativeHealth?.gpsEnabled ? "On" : "Off"}
                </Text>
              </View>
              <View style={styles.nativeHealthCell}>
                {nativeHealth?.networkConnected ? <Wifi size={18} color="#30D158" /> : <WifiOff size={18} color="#FF3B30" />}
                <Text style={styles.nativeHealthLabel}>Data</Text>
                <Text style={[styles.nativeHealthVal, nativeHealth?.networkConnected ? styles.textGreen : styles.textRed]} numberOfLines={1}>
                  {nativeHealth?.networkConnected ? "On" : "Off"}
                </Text>
              </View>
            </View>
            <View style={styles.nativeHealthRow}>
              <View style={styles.nativeHealthCell}>
                <ShieldCheck size={18} color={nativeHealth?.backgroundLocationGranted ? "#30D158" : "#FF9500"} />
                <Text style={styles.nativeHealthLabel}>Background</Text>
                <Text style={[styles.nativeHealthVal, nativeHealth?.backgroundLocationGranted ? styles.textGreen : styles.textRed]} numberOfLines={1}>
                  {nativeHealth?.backgroundLocationGranted ? "OK" : "Missing"}
                </Text>
              </View>
              <View style={styles.nativeHealthCell}>
                <BatteryMedium size={18} color={nativeHealth?.batteryOptimizationIgnored ? "#30D158" : "#FF9500"} />
                <Text style={styles.nativeHealthLabel}>Battery</Text>
                <Text style={[styles.nativeHealthVal, nativeHealth?.batteryOptimizationIgnored ? styles.textGreen : styles.textRed]} numberOfLines={1}>
                  {nativeHealth?.batteryOptimizationIgnored ? "OK" : "Limited"}
                </Text>
              </View>
              <View style={styles.nativeHealthCell}>
                <Timer size={18} color="#007AFF" />
                <Text style={styles.nativeHealthLabel}>Queued</Text>
                <Text style={[styles.nativeHealthVal, styles.textPrimary]} numberOfLines={1}>
                  {nativeHealth?.queuedPingCount ?? 0}
                </Text>
              </View>
            </View>
          </View>
          <Text style={styles.healthFootnote}>
            Last ping:{" "}
            {nativeHealth?.lastPingAt || mySession.lastPingAt
              ? formatAgo(nativeHealth?.lastPingAt || mySession.lastPingAt)
              : "not yet"}
          </Text>
        </GlassView>
      ) : null}

      {/* ─── Toolbar ─── */}
      <View style={styles.toolbar}>
        <Pressable onPress={refreshAll} style={({ pressed }) => [styles.toolBtn, pressed && { opacity: 0.88 }]}>
          <Radio size={18} color="#000" />
          <Text style={styles.toolBtnTextDark}>Refresh</Text>
        </Pressable>
        <Pressable onPress={() => setSearchOpen(true)} style={({ pressed }) => [styles.toolBtn, pressed && { opacity: 0.88 }]}>
          <Search size={18} color="#000" />
          <Text style={styles.toolBtnTextDark}>Search</Text>
        </Pressable>
        <Pressable onPress={recenterOnMe} style={({ pressed }) => [styles.toolBtn, pressed && { opacity: 0.88 }]}>
          {locatingMe ? <ActivityIndicator size="small" color="#000" /> : <Crosshair size={18} color="#000" />}
          <Text style={styles.toolBtnTextDark}>Locate me</Text>
        </Pressable>
        {selectedTarget ? (
          <Pressable onPress={openDirectionsToTarget} style={({ pressed }) => [styles.toolBtnPrimary, pressed && { opacity: 0.88 }]}>
            <Navigation size={18} color="#FFF" />
            <Text style={styles.toolBtnTextLight}>Directions</Text>
          </Pressable>
        ) : null}
      </View>

      {/* ─── My Route Today ─── */}
      <Text style={styles.sectionTitle}>My route today</Text>
      {!employeeId ? (
        <Text style={styles.muted}>Employee id not loaded — open Profile once, then return.</Text>
      ) : routeLoading ? (
        <ActivityIndicator style={{ marginVertical: 8 }} />
      ) : routeError ? (
        <Text style={styles.err}>{routeError}</Text>
      ) : route?.points?.length ? (
        <GlassView style={[styles.card, glassFallback]}>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Footprints size={18} color="#007AFF" />
              <Text style={styles.statLabel}>Distance</Text>
              <Text style={styles.statVal}>{formatDistance(route.totals?.distanceMeters)}</Text>
            </View>
            <View style={styles.stat}>
              <Timer size={18} color="#007AFF" />
              <Text style={styles.statLabel}>Span</Text>
              <Text style={styles.statVal}>{formatDuration(route.totals?.durationSec)}</Text>
            </View>
            <View style={styles.stat}>
              <MapPin size={18} color="#007AFF" />
              <Text style={styles.statLabel}>Halts</Text>
              <Text style={styles.statVal}>{route.halts?.length ?? 0}</Text>
            </View>
            <View style={styles.stat}>
              <Radio size={18} color="#007AFF" />
              <Text style={styles.statLabel}>Pings</Text>
              <Text style={styles.statVal}>{route.points?.length ?? 0}</Text>
            </View>
          </View>
          <View style={styles.playbackBar}>
            <Pressable onPress={() => setPlaying((p) => !p)} style={({ pressed }) => [styles.playBtn, pressed && { opacity: 0.85 }]}>
              {playing ? <Pause size={22} color="#FFF" /> : <Play size={22} color="#FFF" style={{ marginLeft: 3 }} />}
            </Pressable>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.sliderLabel}>
                Playback {playbackIndex + 1} / {routeCoords.length} · {playbackSpeed}x
              </Text>
              <Slider
                style={{ width: WIN_W - 134, height: 36 }}
                minimumValue={0}
                maximumValue={Math.max(0, routeCoords.length - 1)}
                step={1}
                value={playbackIndex}
                onSlidingComplete={setPlaybackIndex}
                minimumTrackTintColor="#007AFF"
                maximumTrackTintColor="#E5E5EA"
                thumbTintColor="#007AFF"
              />
            </View>
          </View>
          <View style={styles.speedRow}>
            {[1, 2, 5].map((s) => (
              <Pressable key={s} onPress={() => setPlaybackSpeed(s)} style={[styles.speedChip, playbackSpeed === s && styles.speedChipOn]}>
                <Text style={[styles.speedChipText, playbackSpeed === s && styles.speedChipTextOn]}>{s}x</Text>
              </Pressable>
            ))}
          </View>
        </GlassView>
      ) : (
        <Text style={styles.muted}>No route points recorded for you today.</Text>
      )}

      {/* ─── Team Members ─── */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Team</Text>
        {teamLoading ? <ActivityIndicator size="small" color="#007AFF" /> : null}
        <Text style={styles.sectionBadge}>{liveTeam.length} live · {offlineTeam.length} offline</Text>
      </View>
      {teamError ? <Text style={styles.err}>{teamError}</Text> : null}
      {clientsError ? <Text style={styles.err}>{clientsError}</Text> : null}

      {liveTeam.length > 0 && (
        <ScrollView style={{ maxHeight: 200 }} keyboardShouldPersistTaps="handled">
          {liveTeam.map((t) => (
            <Pressable
              key={t.employeeId}
              onPress={() => handleSelectGuard(t.employeeId)}
            >
              <GlassView style={[styles.teamCard, glassFallback]}>
                <View style={styles.teamCardLeft}>
                  <View style={styles.liveIndicator} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.teamCardName}>{t.employeeName}</Text>
                    <Text style={styles.teamCardMeta}>Last seen {formatAgo(t.trackedAt)}</Text>
                  </View>
                </View>
                <View style={styles.teamCardRight}>
                  {t.batteryLevel != null ? (
                    <View style={styles.teamChip}>
                      <BatteryIcon level={t.batteryLevel} />
                      <Text style={styles.teamChipText}>{t.batteryLevel}%</Text>
                    </View>
                  ) : null}
                  <Text style={styles.livePill}>LIVE</Text>
                </View>
              </GlassView>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {offlineTeam.length > 0 && (
        <ScrollView style={{ maxHeight: 160 }} keyboardShouldPersistTaps="handled">
          {offlineTeam.map((t) => (
            <Pressable
              key={t.employeeId}
              onPress={() => handleSelectGuard(t.employeeId)}
            >
              <GlassView style={[styles.teamCard, styles.teamCardOff, glassFallback]}>
                <View style={styles.teamCardLeft}>
                  <View style={styles.offIndicator} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.teamCardName, { color: "#636366" }]}>{t.employeeName}</Text>
                    <Text style={styles.teamCardMeta}>Last seen {formatAgo(t.trackedAt)}</Text>
                  </View>
                </View>
              </GlassView>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {!team.length && !teamLoading ? (
        <Text style={styles.muted}>No recent GPS points for your organization.</Text>
      ) : null}

      {/* ─── Visited Sites Today ─── */}
      <Text style={[styles.sectionTitle, { marginTop: 18 }]}>Visited sites today (auto-detected)</Text>
      <Text style={[styles.muted, { marginBottom: 6, marginTop: -4 }]}>
        From your GPS pings within {SITE_VISIT_RADIUS_M} m of a saved site.
      </Text>
      {clientHaltsLoading && !siteVisitSegments.length ? (
        <ActivityIndicator style={{ marginVertical: 10 }} />
      ) : clientHaltsError && !siteVisitSegments.length ? (
        <Text style={styles.err}>{clientHaltsError}</Text>
      ) : siteVisitSegments.length ? (
        <GlassView style={[styles.card, glassFallback]}>
          {siteVisitSegments.map((seg, idx) => (
            <View
              key={`${seg.clientId}-${seg.arrivedAt}-${idx}`}
              style={[styles.visitRow, idx === siteVisitSegments.length - 1 ? styles.visitRowLast : null]}
            >
              <View style={[styles.visitDot, seg.ongoing ? styles.visitDotOngoing : null]} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.visitSiteName} numberOfLines={2}>
                  {seg.clientName}
                </Text>
                <Text style={styles.visitMeta}>
                  {seg.ongoing ? (
                    <>
                      At site since {formatClock(seg.arrivedAt)}
                      {" · "}
                      {formatDuration(seg.durationSec)}
                      {" · "}
                      <Text style={styles.visitOngoingLabel}>ongoing</Text>
                    </>
                  ) : (
                    <>
                      {formatClock(seg.arrivedAt)} → {formatClock(seg.leftAt)}
                      {" · "}
                      total {formatDuration(seg.durationSec)}
                    </>
                  )}
                </Text>
              </View>
            </View>
          ))}
        </GlassView>
      ) : clientHalts?.perClient?.length ? (
        <GlassView style={[styles.card, glassFallback]}>
          {clientHalts.perClient.slice(0, 8).map((c) => (
            <View key={c.clientId} style={styles.siteRow}>
              <View style={styles.siteDot} />
              <Text style={styles.siteRowName} numberOfLines={1}>{c.clientName}</Text>
              <Text style={styles.siteRowVal}>
                {Math.round((c.totalDurationSec ?? 0) / 60)}m · {c.haltCount} halt{c.haltCount === 1 ? "" : "s"}
              </Text>
            </View>
          ))}
          {clientHalts.perClient.length > 8 ? (
            <Text style={[styles.muted, { marginTop: 6 }]}>+{clientHalts.perClient.length - 8} more</Text>
          ) : null}
        </GlassView>
      ) : (
        <Text style={styles.muted}>
          {route?.points?.length
            ? "No pings within range of a known site yet. Check that this site has coordinates on the map, or wait for more GPS points."
            : "No route pings for today yet — start a live session so visits can be detected."}
        </Text>
      )}

      {/* ─── Compliance Timeline ─── */}
      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionTitle, { marginTop: 18 }]}>Compliance (today)</Text>
        {complianceLoading ? <ActivityIndicator size="small" color="#007AFF" style={{ marginTop: 18 }} /> : null}
      </View>
      {complianceError ? (
        <Text style={styles.err}>{complianceError}</Text>
      ) : recentCompliance.length ? (
        <GlassView style={[styles.card, glassFallback]}>
          {recentCompliance.map((e) => (
            <View key={e.id} style={styles.complianceRow}>
              <View style={[styles.complianceDot, !e.endedAt ? styles.complianceDotActive : styles.complianceDotOk]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.complianceType}>{String(e.type ?? "").replace(/_/g, " ")}</Text>
                <Text style={styles.complianceMeta}>
                  {formatAgo(e.startedAt)}
                  {e.endedAt ? ` → resolved ${formatAgo(e.endedAt)}` : " · still active"}
                </Text>
              </View>
              {!e.endedAt ? <Text style={styles.complianceActivePill}>ACTIVE</Text> : null}
            </View>
          ))}
        </GlassView>
      ) : (
        <Text style={styles.muted}>No compliance issues recorded today.</Text>
      )}

      <View style={{ height: 32 }} />

      {/* ─── Search Modal ─── */}
      <Modal visible={searchOpen} animationType="slide" onRequestClose={() => setSearchOpen(false)}>
        <View style={styles.searchModal}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={styles.searchBox}>
              <Search size={18} color="#666" />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search client or team…"
                placeholderTextColor="#999"
                style={styles.searchInput}
                autoFocus
              />
              {query ? (
                <Pressable onPress={() => setQuery("")} hitSlop={10} style={{ padding: 6 }}>
                  <X size={18} color="#666" />
                </Pressable>
              ) : null}
            </View>
            <Pressable onPress={() => setSearchOpen(false)} style={({ pressed }) => [{ padding: 8 }, pressed && { opacity: 0.8 }]}>
              <Text style={{ fontWeight: "800", color: "#007AFF" }}>Done</Text>
            </Pressable>
          </View>

          <ScrollView style={{ marginTop: 14 }} keyboardShouldPersistTaps="handled">
            {searchItems.map((x) => {
              const isSel = selectedTarget?.type === x.type && String(selectedTarget?.id) === String(x.id);
              return (
                <Pressable
                  key={`${x.type}:${x.id}`}
                  onPress={() => { setSelectedTarget(x); setSearchOpen(false); }}
                  style={({ pressed }) => [styles.pickRow, isSel && styles.pickRowSelected, pressed && { opacity: 0.9 }]}
                >
                  <Text style={styles.pickTitle}>{x.type === "client" ? "🏢 " : "🧍 "}{x.name}</Text>
                  <Text style={styles.pickSub}>{x.subtitle}</Text>
                </Pressable>
              );
            })}
            {!searchItems.length ? <Text style={styles.muted}>No matches.</Text> : null}
          </ScrollView>

          {selectedTarget ? (
            <View style={{ marginTop: 12, flexDirection: "row", gap: 10 }}>
              <Pressable onPress={() => openMapsPin(selectedTarget.latitude, selectedTarget.longitude, selectedTarget.name)} style={({ pressed }) => [styles.quickBtn, pressed && { opacity: 0.9 }]}>
                <MapPin size={18} color="#000" />
                <Text style={styles.quickBtnText}>Open in maps</Text>
              </Pressable>
              <Pressable onPress={openDirectionsToTarget} style={({ pressed }) => [styles.quickBtnPrimary, pressed && { opacity: 0.9 }]}>
                <Navigation size={18} color="#FFF" />
                <Text style={styles.quickBtnTextLight}>Directions</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </Modal>
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  offlineBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(255,59,48,0.12)",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,59,48,0.35)",
  },
  offlineBannerText: { flex: 1, color: "#8B0000", fontSize: 13, fontWeight: "700", lineHeight: 18 },
  sessionCard: {
    padding: 16,
    borderRadius: 20,
    marginBottom: 14,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,122,255,0.15)",
  },
  sessionCardTop: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  sessionDot: { width: 10, height: 10, borderRadius: 5 },
  dotLive: { backgroundColor: "#30D158" },
  dotOff: { backgroundColor: "#8E8E93" },
  sessionCardTitle: { fontSize: 16, fontWeight: "900", color: "#000" },
  sessionCardSub: { fontSize: 12, color: "#636366", fontWeight: "600", marginTop: 2 },
  healthRow: { flexDirection: "row", gap: 8 },
  healthChip: {
    flex: 1,
    backgroundColor: "rgba(242,242,247,0.9)",
    borderRadius: 12,
    padding: 10,
    alignItems: "center",
    gap: 4,
  },
  healthLabel: { fontSize: 10, color: "#636366", fontWeight: "700" },
  healthVal: { fontSize: 12, fontWeight: "900" },
  healthFootnote: { marginTop: 12, fontSize: 11, color: "#636366", fontWeight: "600" },
  nativeTrackingHealthCard: {
    marginTop: 4,
    marginBottom: 14,
  },
  nativeHealthGrid: { gap: 8, marginTop: 4 },
  nativeHealthRow: { flexDirection: "row", gap: 8 },
  nativeHealthCell: {
    flex: 1,
    minWidth: 0,
    backgroundColor: "rgba(242,242,247,0.95)",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: "center",
    gap: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.06)",
  },
  nativeHealthLabel: {
    fontSize: 9,
    color: "#636366",
    fontWeight: "700",
    letterSpacing: 0.2,
    textTransform: "uppercase",
  },
  nativeHealthVal: { fontSize: 12, fontWeight: "800", textAlign: "center" },
  textPrimary: { color: "#000" },
  textGreen: { color: "#30D158" },
  textRed: { color: "#FF3B30" },
  textMuted: { color: "#8E8E93" },

  // ── Map
  mapWrap: {
    height: 330,
    borderRadius: 18,
    overflow: "hidden",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(0,122,255,0.2)",
    position: "relative",
  },
  mapLocateBtn: {
    position: "absolute",
    right: 10,
    bottom: 36,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.95)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(0,122,255,0.35)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  mapAttrib: {
    position: "absolute",
    right: 6,
    bottom: 4,
    backgroundColor: "rgba(255,255,255,0.85)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  mapAttribText: { fontSize: 9, color: "#555" },
  webMapPlaceholder: {
    height: 160,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(0,122,255,0.2)",
    borderStyle: "dashed",
  },

  // ── Toolbar
  toolbar: { flexDirection: "row", gap: 10, marginBottom: 14 },
  toolBtn: {
    flex: 1,
    backgroundColor: "#F2F2F7",
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  toolBtnTextDark: { color: "#000", fontWeight: "700" },
  toolBtnPrimary: {
    flex: 1,
    backgroundColor: "#007AFF",
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  toolBtnTextLight: { color: "#FFF", fontWeight: "900" },

  // ── Sections
  sectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: 10, color: "#000" },
  sectionHeaderRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  sectionBadge: { fontSize: 12, color: "#636366", fontWeight: "700" },

  // ── Generic card
  card: { padding: 14, borderRadius: 16, overflow: "hidden", marginBottom: 12 },

  // ── Route stats
  statsRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  stat: { flex: 1, backgroundColor: "rgba(242,242,247,0.9)", borderRadius: 12, padding: 10, alignItems: "center" },
  statLabel: { fontSize: 10, color: "#636366", marginTop: 4, fontWeight: "700" },
  statVal: { fontSize: 14, fontWeight: "900", color: "#000", marginTop: 2 },
  playbackBar: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  playBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#007AFF", alignItems: "center", justifyContent: "center" },
  sliderLabel: { fontSize: 12, color: "#636366", marginBottom: -4 },
  speedRow: { flexDirection: "row", gap: 8 },
  speedChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: "#E5E5EA" },
  speedChipOn: { backgroundColor: "#007AFF" },
  speedChipText: { fontWeight: "700", color: "#000" },
  speedChipTextOn: { color: "#FFF" },

  // ── Team cards
  teamCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 14,
    marginBottom: 8,
    overflow: "hidden",
  },
  teamCardOff: { opacity: 0.75 },
  teamCardLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  liveIndicator: { width: 9, height: 9, borderRadius: 5, backgroundColor: "#30D158" },
  offIndicator: { width: 9, height: 9, borderRadius: 5, backgroundColor: "#C7C7CC" },
  teamCardName: { fontSize: 14, fontWeight: "800", color: "#000" },
  teamCardMeta: { fontSize: 12, color: "#636366", fontWeight: "600", marginTop: 2 },
  teamCardRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  teamChip: { flexDirection: "row", alignItems: "center", gap: 4 },
  teamChipText: { fontSize: 12, fontWeight: "700", color: "#636366" },
  livePill: {
    fontSize: 10,
    fontWeight: "900",
    color: "#FFF",
    backgroundColor: "#30D158",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    letterSpacing: 0.5,
  },

  // ── Visited sites
  siteRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, gap: 8 },
  siteDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#007AFF" },
  siteRowName: { flex: 1, fontWeight: "800", color: "#000", fontSize: 14 },
  siteRowVal: { fontWeight: "700", color: "#007AFF", fontSize: 13 },
  visitRow: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 10, gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(0,0,0,0.06)" },
  visitDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5, backgroundColor: "#007AFF" },
  visitDotOngoing: { backgroundColor: "#30D158" },
  visitSiteName: { fontWeight: "800", color: "#000", fontSize: 15 },
  visitMeta: { color: "#636366", fontSize: 12, fontWeight: "600", marginTop: 4, lineHeight: 17 },
  visitOngoingLabel: { color: "#30D158", fontWeight: "800" },
  visitRowLast: { borderBottomWidth: 0 },

  // ── Compliance
  complianceRow: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 8, gap: 10 },
  complianceDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  complianceDotActive: { backgroundColor: "#FF3B30" },
  complianceDotOk: { backgroundColor: "#30D158" },
  complianceType: { fontWeight: "800", color: "#000", fontSize: 13, textTransform: "capitalize" },
  complianceMeta: { color: "#636366", fontSize: 12, fontWeight: "600", marginTop: 2 },
  complianceActivePill: {
    fontSize: 10,
    fontWeight: "900",
    color: "#FFF",
    backgroundColor: "#FF3B30",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    letterSpacing: 0.5,
  },

  // ── Utils
  err: { color: "#C00", marginBottom: 8, fontSize: 14 },
  muted: { color: "#8E8E93", fontSize: 14, marginBottom: 8 },

  // ── Search modal
  searchModal: { flex: 1, paddingTop: 16, paddingHorizontal: 16, backgroundColor: "#F4F6FA" },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FFF",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
  },
  searchInput: { flex: 1, fontSize: 16, color: "#000", fontWeight: "700", paddingVertical: 0 },
  pickRow: {
    borderRadius: 14,
    backgroundColor: "#FFF",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    marginBottom: 10,
  },
  pickRowSelected: { borderColor: "#007AFF", backgroundColor: "rgba(0,122,255,0.08)" },
  pickTitle: { fontWeight: "900", color: "#000", fontSize: 15 },
  pickSub: { marginTop: 4, color: "#666", fontSize: 12, fontWeight: "700" },
  quickBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    backgroundColor: "#FFF",
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.12)",
  },
  quickBtnText: { fontWeight: "900", color: "#000" },
  quickBtnPrimary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    backgroundColor: "#007AFF",
    paddingVertical: 12,
  },
  quickBtnTextLight: { fontWeight: "900", color: "#FFF" },

  // ── Map selection card (Google Maps-style bottom overlay)
  mapSelectionCard: {
    position: "absolute",
    bottom: 10,
    left: 10,
    right: 10,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.97)",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
    overflow: "hidden",
  },
  mapSelectionCardInner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  mapSelectionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  mapSelIconClient: { backgroundColor: "rgba(234,67,53,0.12)" },
  mapSelIconGuard: { backgroundColor: "rgba(26,115,232,0.12)" },
  mapSelectionName: { fontSize: 15, fontWeight: "900", color: "#202124" },
  mapSelMetaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
  mapSelBattery: { flexDirection: "row", alignItems: "center", gap: 3 },
  mapSelMeta: { fontSize: 12, color: "#5F6368", fontWeight: "600", marginTop: 2 },
  mapSelActions: { flexDirection: "row", alignItems: "center", gap: 4 },
  mapSelActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(26,115,232,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  mapSelCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.07)",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
  },
});
