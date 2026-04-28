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
  getSessionId,
  getPingIntervalSec,
} from "@/services/liveTracking/storage";
import { isLiveTrackingSessionActive } from "@/services/liveTracking";

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
    } catch {
      /* ignore */
    }
  }, []);

  const loadTeam = useCallback(async () => {
    setTeamError(null);
    setTeamLoading(true);
    try {
      const { data } = await apiGetJson("/apps/live-tracking/team/latest");
      setTeam(Array.isArray(data) ? data : []);
    } catch (e) {
      setTeam([]);
      setTeamError(e instanceof Error ? e.message : "Could not load team");
    } finally {
      setTeamLoading(false);
    }
  }, []);

  const loadClients = useCallback(async () => {
    setClientsError(null);
    try {
      const { data } = await apiGetJson("/apps/field-checkin/clients");
      setClients(Array.isArray(data) ? data : []);
    } catch (e) {
      setClients([]);
      setClientsError(e instanceof Error ? e.message : "Could not load clients");
    }
  }, []);

  const loadMyRouteToday = useCallback(async () => {
    if (!employeeId) {
      setRoute(null);
      return;
    }
    const day = new Date().toISOString().slice(0, 10);
    setRouteError(null);
    setRouteLoading(true);
    try {
      const { data } = await apiGetJson(
        `/apps/live-tracking/route?employeeId=${encodeURIComponent(employeeId)}&dateFrom=${day}&dateTo=${day}&limit=4000`,
      );
      setRoute(data ?? null);
      setPlaybackIndex(0);
      setPlaying(false);
      // Update last ping time from route points
      const pts = data?.points;
      if (Array.isArray(pts) && pts.length > 0) {
        const last = pts[pts.length - 1];
        setMySession((prev) => ({ ...prev, lastPingAt: last.trackedAt ?? last.timestamp ?? null }));
      }
    } catch (e) {
      setRoute(null);
      setRouteError(e instanceof Error ? e.message : "Could not load route");
    } finally {
      setRouteLoading(false);
    }
  }, [employeeId]);

  const loadClientHaltsToday = useCallback(async () => {
    if (!employeeId) {
      setClientHalts(null);
      return;
    }
    const day = new Date().toISOString().slice(0, 10);
    setClientHaltsError(null);
    setClientHaltsLoading(true);
    try {
      const { data } = await apiGetJson(
        `/apps/live-tracking/analytics/client-halts?employeeId=${encodeURIComponent(employeeId)}&dateFrom=${day}&dateTo=${day}&radiusMeters=500&limitPoints=4000`,
      );
      setClientHalts(data ?? null);
    } catch (e) {
      setClientHalts(null);
      setClientHaltsError(e instanceof Error ? e.message : "Could not load client halts");
    } finally {
      setClientHaltsLoading(false);
    }
  }, [employeeId]);

  const loadComplianceTimelineToday = useCallback(async () => {
    if (!employeeId) {
      setComplianceTl([]);
      return;
    }
    const day = new Date().toISOString().slice(0, 10);
    setComplianceError(null);
    setComplianceLoading(true);
    try {
      const { data } = await apiGetJson(
        `/apps/live-tracking/compliance/timeline?employeeId=${encodeURIComponent(employeeId)}&dateFrom=${day}&dateTo=${day}&limit=200`,
      );
      setComplianceTl(Array.isArray(data) ? data : []);
    } catch (e) {
      setComplianceTl([]);
      setComplianceError(e instanceof Error ? e.message : "Could not load compliance timeline");
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
    }, [loadMySessionHealth, loadTeam, loadMyRouteToday, loadClients, loadClientHaltsToday, loadComplianceTimelineToday]),
  );

  const mapInitial = useMemo(() => {
    const withLoc = team.filter((t) => t.latitude != null && t.longitude != null);
    if (withLoc.length === 0) {
      return { latitude: 20.5937, longitude: 78.9629, latitudeDelta: 8, longitudeDelta: 8 };
    }
    const lat = withLoc.reduce((s, t) => s + t.latitude, 0) / withLoc.length;
    const lng = withLoc.reduce((s, t) => s + t.longitude, 0) / withLoc.length;
    return { latitude: lat, longitude: lng, latitudeDelta: 0.12, longitudeDelta: 0.12 };
  }, [team]);

  const routeCoords = useMemo(() => {
    const pts = route?.points;
    if (!Array.isArray(pts) || pts.length < 2) return [];
    return pts
      .map((p) => ({ latitude: Number(p.latitude), longitude: Number(p.longitude) }))
      .filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude));
  }, [route]);

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
      employeeName: t.employeeName,
      latitude: t.latitude,
      longitude: t.longitude,
      subtitle: `${formatAgo(t.trackedAt)}${t.sessionOpen ? " · live session" : ""}`,
      pinColor: t.sessionOpen ? "#007AFF" : "#8E8E93",
    })),
    [team],
  );

  const focusCoord = selectedTarget
    ? { latitude: Number(selectedTarget.latitude), longitude: Number(selectedTarget.longitude) }
    : null;

  const selectedClientId = selectedTarget?.type === "client" ? String(selectedTarget.id) : null;
  const selectedGuardId = selectedTarget?.type === "team" ? String(selectedTarget.id) : null;

  const handleSelectClient = useCallback((clientId) => {
    const c = clients.find((x) => x.id === clientId);
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
  }, [clients]);

  const handleSelectGuard = useCallback((guardEmployeeId) => {
    const t = team.find((x) => x.employeeId === guardEmployeeId);
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
  }, [team]);

  const searchItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    const teamItems = team
      .filter((t) => t.latitude != null && t.longitude != null)
      .map((t) => ({
        type: "team", id: t.employeeId, name: t.employeeName,
        subtitle: `${formatAgo(t.trackedAt)}${t.sessionOpen ? " · session active" : ""}`,
        latitude: t.latitude, longitude: t.longitude,
      }));
    const clientItems = clients
      .filter((c) => c.latitude != null && c.longitude != null)
      .map((c) => ({
        type: "client", id: c.id, name: c.clientName,
        subtitle: "Site", latitude: c.latitude, longitude: c.longitude,
      }));
    const all = [...clientItems, ...teamItems];
    if (!q) return all.slice(0, 60);
    return all.filter((x) => String(x.name || "").toLowerCase().includes(q)).slice(0, 60);
  }, [query, team, clients]);

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
          />
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
      {clientHaltsLoading ? (
        <ActivityIndicator style={{ marginVertical: 10 }} />
      ) : clientHaltsError ? (
        <Text style={styles.err}>{clientHaltsError}</Text>
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
        <Text style={styles.muted}>No client halts detected yet (needs a few minutes of pings).</Text>
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
  // ── Session health card
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
