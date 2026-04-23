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
import { MapPin, Navigation, Radio, Play, Pause, Footprints, Timer, Search, X } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import Slider from "@react-native-community/slider";
import * as Location from "expo-location";
import StackScreen from "@/components/StackScreen";
import TrackingMap from "@/components/TrackingMap";
import { apiGetJson } from "@/utils/api";
import { useAuthStore } from "@/utils/auth/store";
import { openMapsDirections, openMapsPin } from "@/utils/openInMaps";

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
  const [selectedTarget, setSelectedTarget] = useState(null); // { type, id, name, subtitle, latitude, longitude }

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
      loadTeam();
      loadMyRouteToday();
      loadClients();
      loadClientHaltsToday();
      loadComplianceTimelineToday();
    }, [loadTeam, loadMyRouteToday, loadClients, loadClientHaltsToday, loadComplianceTimelineToday]),
  );

  const mapInitial = useMemo(() => {
    const withLoc = team.filter((t) => t.latitude != null && t.longitude != null);
    if (withLoc.length === 0) {
      return {
        latitude: 20.5937,
        longitude: 78.9629,
        latitudeDelta: 8,
        longitudeDelta: 8,
      };
    }
    const lat = withLoc.reduce((s, t) => s + t.latitude, 0) / withLoc.length;
    const lng = withLoc.reduce((s, t) => s + t.longitude, 0) / withLoc.length;
    return {
      latitude: lat,
      longitude: lng,
      latitudeDelta: 0.12,
      longitudeDelta: 0.12,
    };
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
    const end = Math.min(playbackIndex + 1, routeCoords.length);
    return routeCoords.slice(0, end);
  }, [routeCoords, playbackIndex]);

  useEffect(() => {
    if (!playing || routeCoords.length < 2) return undefined;
    const stepMs = Math.max(60, Math.round(320 / playbackSpeed));
    const id = setInterval(() => {
      setPlaybackIndex((i) => {
        if (i >= routeCoords.length - 1) {
          setPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, stepMs);
    return () => clearInterval(id);
  }, [playing, routeCoords.length, playbackSpeed]);

  const playbackPosition = routeCoords[Math.min(playbackIndex, routeCoords.length - 1)];
  const teamMarkers = useMemo(
    () =>
      team.map((t) => ({
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

  const searchItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    const teamItems = team
      .filter((t) => t.latitude != null && t.longitude != null)
      .map((t) => ({
        type: "team",
        id: t.employeeId,
        name: t.employeeName,
        subtitle: `${formatAgo(t.trackedAt)}${t.sessionOpen ? " · session active" : ""}`,
        latitude: t.latitude,
        longitude: t.longitude,
      }));
    const clientItems = clients
      .filter((c) => c.latitude != null && c.longitude != null)
      .map((c) => ({
        type: "client",
        id: c.id,
        name: c.clientName,
        subtitle: "Site",
        latitude: c.latitude,
        longitude: c.longitude,
      }));
    const all = [...clientItems, ...teamItems];
    if (!q) return all.slice(0, 60);
    return all.filter((x) => String(x.name || "").toLowerCase().includes(q)).slice(0, 60);
  }, [query, team, clients]);

  const openDirectionsToTarget = useCallback(async () => {
    if (!selectedTarget) return;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const cur = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = cur.coords;
      await openMapsDirections(latitude, longitude, selectedTarget.latitude, selectedTarget.longitude);
    } catch {
      await openMapsDirections(null, null, selectedTarget.latitude, selectedTarget.longitude);
    }
  }, [selectedTarget]);

  return (
    <StackScreen title="Live tracking" subtitle="Team positions & your route (today)">
      {Platform.OS !== "web" ? (
        <View style={styles.mapWrap}>
          <TrackingMap
            height={220}
            teamMarkers={teamMarkers}
            routeCoords={routeCoordsPlayback}
            playbackCoord={playbackPosition ?? null}
            focusCoord={focusCoord}
            initialCenter={{ latitude: mapInitial.latitude, longitude: mapInitial.longitude }}
          />
          <View style={styles.mapAttrib} pointerEvents="none">
            <Text style={styles.mapAttribText}>© OpenStreetMap © CARTO</Text>
          </View>
        </View>
      ) : (
        <GlassView
          style={[
            styles.webMapPlaceholder,
            isLiquidGlassAvailable() ? {} : { opacity: 0.95, backgroundColor: "#E8F4FF" },
          ]}
        >
          <MapPin size={36} color="#007AFF" />
          <Text style={{ marginTop: 10, fontWeight: "700", color: "#000" }}>Map on device</Text>
          <Text style={{ fontSize: 13, color: "#666", marginTop: 4, textAlign: "center" }}>
            Open this screen in the iOS or Android app for the live map.
          </Text>
        </GlassView>
      )}

      <View style={styles.toolbar}>
        <Pressable
          onPress={() => {
            loadTeam();
            loadMyRouteToday();
            loadClients();
            loadClientHaltsToday();
            loadComplianceTimelineToday();
          }}
          style={({ pressed }) => [styles.toolBtn, pressed && { opacity: 0.88 }]}
        >
          <Radio size={18} color="#000" />
          <Text style={styles.toolBtnTextDark}>Refresh</Text>
        </Pressable>

        <Pressable
          onPress={() => setSearchOpen(true)}
          style={({ pressed }) => [styles.toolBtn, pressed && { opacity: 0.88 }]}
        >
          <Search size={18} color="#000" />
          <Text style={styles.toolBtnTextDark}>Search</Text>
        </Pressable>

        {selectedTarget ? (
          <Pressable
            onPress={openDirectionsToTarget}
            style={({ pressed }) => [styles.toolBtnPrimary, pressed && { opacity: 0.88 }]}
          >
            <Navigation size={18} color="#FFF" />
            <Text style={styles.toolBtnTextLight}>Directions</Text>
          </Pressable>
        ) : null}
      </View>

      {teamLoading ? (
        <ActivityIndicator style={{ marginVertical: 12 }} />
      ) : teamError ? (
        <Text style={styles.err}>{teamError}</Text>
      ) : null}

      {clientsError ? <Text style={styles.err}>{clientsError}</Text> : null}

      <Text style={styles.sectionTitle}>Team</Text>
      <ScrollView style={{ maxHeight: 220 }} keyboardShouldPersistTaps="handled">
        {team.map((t) => (
          <GlassView
            key={t.employeeId}
            style={[
              styles.card,
              isLiquidGlassAvailable() ? {} : { opacity: 0.95, backgroundColor: "#ffffff" },
            ]}
          >
            <Text style={styles.cardTitle}>{t.employeeName}</Text>
            <Text style={styles.cardMeta}>
              {t.latitude != null && t.longitude != null
                ? `${t.latitude.toFixed(5)}, ${t.longitude.toFixed(5)}`
                : "No position yet"}
            </Text>
            <Text style={styles.cardHighlight}>
              {formatAgo(t.trackedAt)}
              {t.batteryLevel != null ? ` · ${t.batteryLevel}% battery` : ""}
              {t.sessionOpen ? " · session active" : ""}
            </Text>
          </GlassView>
        ))}
        {!team.length && !teamLoading ? (
          <Text style={styles.muted}>No recent GPS points for your organization.</Text>
        ) : null}
      </ScrollView>

      <Text style={[styles.sectionTitle, { marginTop: 18 }]}>My route today</Text>
      {!employeeId ? (
        <Text style={styles.muted}>Employee id not loaded yet — open Profile once, then return.</Text>
      ) : routeLoading ? (
        <ActivityIndicator style={{ marginVertical: 8 }} />
      ) : routeError ? (
        <Text style={styles.err}>{routeError}</Text>
      ) : route?.points?.length ? (
        <>
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
          </View>
          <View style={styles.playbackBar}>
            <Pressable
              onPress={() => setPlaying((p) => !p)}
              style={({ pressed }) => [styles.playBtn, pressed && { opacity: 0.85 }]}
            >
              {playing ? (
                <Pause size={22} color="#FFF" />
              ) : (
                <Play size={22} color="#FFF" style={{ marginLeft: 3 }} />
              )}
            </Pressable>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.sliderLabel}>
                Playback {playbackIndex + 1} / {routeCoords.length} · {playbackSpeed}x
              </Text>
              <Slider
                style={{ width: WIN_W - 120, height: 36 }}
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
              <Pressable
                key={s}
                onPress={() => setPlaybackSpeed(s)}
                style={[
                  styles.speedChip,
                  playbackSpeed === s && styles.speedChipOn,
                ]}
              >
                <Text style={[styles.speedChipText, playbackSpeed === s && styles.speedChipTextOn]}>
                  {s}x
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : (
        <Text style={styles.muted}>No route points recorded for you today.</Text>
      )}

      <Text style={[styles.sectionTitle, { marginTop: 18 }]}>Visited sites today (auto)</Text>
      {clientHaltsLoading ? (
        <ActivityIndicator style={{ marginVertical: 10 }} />
      ) : clientHaltsError ? (
        <Text style={styles.err}>{clientHaltsError}</Text>
      ) : clientHalts?.perClient?.length ? (
        <GlassView
          style={[
            styles.card,
            isLiquidGlassAvailable() ? {} : { opacity: 0.95, backgroundColor: "#ffffff" },
          ]}
        >
          {clientHalts.perClient.slice(0, 8).map((c) => (
            <View
              key={c.clientId}
              style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 8 }}
            >
              <Text style={{ fontWeight: "800", color: "#000", flex: 1, paddingRight: 10 }} numberOfLines={1}>
                {c.clientName}
              </Text>
              <Text style={{ fontWeight: "800", color: "#007AFF" }}>
                {Math.round((c.totalDurationSec ?? 0) / 60)}m · {c.haltCount}
              </Text>
            </View>
          ))}
          {clientHalts.perClient.length > 8 ? (
            <Text style={[styles.muted, { marginTop: 6 }]}>
              +{clientHalts.perClient.length - 8} more
            </Text>
          ) : null}
        </GlassView>
      ) : (
        <Text style={styles.muted}>No client halts detected yet (needs a few minutes of pings).</Text>
      )}

      <Text style={[styles.sectionTitle, { marginTop: 18 }]}>Compliance timeline (today)</Text>
      {complianceLoading ? (
        <ActivityIndicator style={{ marginVertical: 10 }} />
      ) : complianceError ? (
        <Text style={styles.err}>{complianceError}</Text>
      ) : complianceTl?.length ? (
        <GlassView
          style={[
            styles.card,
            isLiquidGlassAvailable() ? {} : { opacity: 0.95, backgroundColor: "#ffffff" },
          ]}
        >
          {complianceTl.slice(-8).map((e) => (
            <View key={e.id} style={{ paddingVertical: 8 }}>
              <Text style={{ fontWeight: "900", color: "#000" }}>
                {String(e.type).replace(/_/g, " ")}
                {e.endedAt ? "" : " · ACTIVE"}
              </Text>
              <Text style={styles.muted}>
                {formatAgo(e.startedAt)} {e.endedAt ? `→ ended ${formatAgo(e.endedAt)}` : ""}
              </Text>
            </View>
          ))}
        </GlassView>
      ) : (
        <Text style={styles.muted}>No compliance issues recorded today.</Text>
      )}

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
            <Pressable
              onPress={() => setSearchOpen(false)}
              style={({ pressed }) => [{ padding: 8 }, pressed && { opacity: 0.8 }]}
            >
              <Text style={{ fontWeight: "800", color: "#007AFF" }}>Done</Text>
            </Pressable>
          </View>

          <ScrollView style={{ marginTop: 14 }} keyboardShouldPersistTaps="handled">
            {searchItems.map((x) => {
              const isSel = selectedTarget?.type === x.type && String(selectedTarget?.id) === String(x.id);
              return (
                <Pressable
                  key={`${x.type}:${x.id}`}
                  onPress={() => {
                    setSelectedTarget(x);
                    setSearchOpen(false);
                  }}
                  style={({ pressed }) => [
                    styles.pickRow,
                    isSel && styles.pickRowSelected,
                    pressed && { opacity: 0.9 },
                  ]}
                >
                  <Text style={styles.pickTitle}>
                    {x.type === "client" ? "🏢 " : "🧍 "}
                    {x.name}
                  </Text>
                  <Text style={styles.pickSub}>{x.subtitle}</Text>
                </Pressable>
              );
            })}
            {!searchItems.length ? <Text style={styles.muted}>No matches.</Text> : null}
          </ScrollView>

          {selectedTarget ? (
            <View style={{ marginTop: 12, flexDirection: "row", gap: 10 }}>
              <Pressable
                onPress={() => openMapsPin(selectedTarget.latitude, selectedTarget.longitude, selectedTarget.name)}
                style={({ pressed }) => [styles.quickBtn, pressed && { opacity: 0.9 }]}
              >
                <MapPin size={18} color="#000" />
                <Text style={styles.quickBtnText}>Open in maps</Text>
              </Pressable>
              <Pressable
                onPress={openDirectionsToTarget}
                style={({ pressed }) => [styles.quickBtnPrimary, pressed && { opacity: 0.9 }]}
              >
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
  mapWrap: {
    height: 220,
    borderRadius: 16,
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
  toolbar: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 8,
  },
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
  sectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: 10, color: "#000" },
  card: {
    padding: 14,
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 10,
  },
  cardTitle: { fontWeight: "700", color: "#000" },
  cardMeta: { color: "#666", marginTop: 4, fontSize: 13 },
  cardHighlight: { color: "#007AFF", marginTop: 6, fontSize: 13 },
  err: { color: "#C00", marginBottom: 8, fontSize: 14 },
  muted: { color: "#8E8E93", fontSize: 14, marginBottom: 8 },
  searchModal: {
    flex: 1,
    paddingTop: 16,
    paddingHorizontal: 16,
    backgroundColor: "#F4F6FA",
  },
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
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#000",
    fontWeight: "700",
    paddingVertical: 0,
  },
  pickRow: {
    borderRadius: 14,
    backgroundColor: "#FFF",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    marginBottom: 10,
  },
  pickRowSelected: {
    borderColor: "#007AFF",
    backgroundColor: "rgba(0,122,255,0.08)",
  },
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
  statsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  stat: {
    flex: 1,
    backgroundColor: "#F2F2F7",
    borderRadius: 12,
    padding: 10,
    alignItems: "center",
  },
  statLabel: { fontSize: 11, color: "#666", marginTop: 4 },
  statVal: { fontSize: 15, fontWeight: "800", color: "#000", marginTop: 2 },
  playbackBar: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  playBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#007AFF",
    alignItems: "center",
    justifyContent: "center",
  },
  sliderLabel: { fontSize: 12, color: "#636366", marginBottom: -4 },
  speedRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  speedChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#E5E5EA",
  },
  speedChipOn: { backgroundColor: "#007AFF" },
  speedChipText: { fontWeight: "700", color: "#000" },
  speedChipTextOn: { color: "#FFF" },
});
