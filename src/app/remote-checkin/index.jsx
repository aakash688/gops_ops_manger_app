import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
  TextInput,
  ScrollView,
  Modal,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets, SafeAreaView } from "react-native-safe-area-context";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import {
  MapPinned,
  QrCode,
  LogIn,
  LogOut,
  RefreshCw,
  Navigation,
  Maximize2,
  X,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from "lucide-react-native";
import { useState, useEffect, useCallback } from "react";
import * as Location from "expo-location";
import StackScreen from "@/components/StackScreen";
import FieldCheckinMap from "@/components/FieldCheckinMap";
import { apiGetJson, apiPostJson } from "@/utils/api";
import { openMapsDirections, openMapsPin } from "@/utils/openInMaps";

function formatHm(isoOrTime) {
  if (!isoOrTime) return "—";
  const s = String(isoOrTime);
  if (s.length >= 8 && s.includes(":")) return s.slice(0, 5);
  return s.slice(11, 16) || s;
}

export default function RemoteCheckinScreen() {
  const insets = useSafeAreaInsets();
  const [permission, setPermission] = useState(null);
  const [userLoc, setUserLoc] = useState(null);
  const [clients, setClients] = useState([]);
  const [nearby, setNearby] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [qrToken, setQrToken] = useState("");
  const [mapFullscreen, setMapFullscreen] = useState(false);
  const [showQr, setShowQr] = useState(false);

  const loadStatic = useCallback(async () => {
    try {
      const [{ data: cl }, { data: sm }] = await Promise.all([
        apiGetJson("/apps/field-checkin/clients"),
        apiGetJson("/apps/field-checkin/summary"),
      ]);
      setClients(Array.isArray(cl) ? cl : []);
      setSummary(sm ?? null);
    } catch (e) {
      setSummary(null);
      setClients([]);
      const msg = e instanceof Error ? e.message : "Could not load field check-in";
      if (!String(msg).includes("Employee context")) {
        Alert.alert("Field check-in", msg);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshNearby = useCallback(async (lat, lng) => {
    try {
      const { data } = await apiGetJson(
        `/apps/field-checkin/nearby?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lng)}`,
      );
      setNearby(data);
      setSelectedClientId((prev) => {
        if (prev) return prev;
        return data?.inRange?.[0]?.id ?? null;
      });
    } catch {
      setNearby(null);
    }
  }, []);

  useEffect(() => {
    loadStatic();
  }, [loadStatic]);

  useEffect(() => {
    let sub;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setPermission(status);
      if (status !== "granted") return;

      sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 8000,
          distanceInterval: 25,
        },
        (loc) => {
          const { latitude, longitude, accuracy } = loc.coords;
          setUserLoc({ latitude, longitude, accuracy: accuracy ?? null });
          refreshNearby(latitude, longitude);
        },
      );

      const cur = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude, accuracy } = cur.coords;
      setUserLoc({ latitude, longitude, accuracy: accuracy ?? null });
      refreshNearby(latitude, longitude);
    })();

    return () => {
      if (sub) sub.remove();
    };
  }, [refreshNearby]);

  const active = summary?.activeSession;
  const fenceM = nearby?.geoFenceMeters ?? summary?.geoFenceMeters ?? 500;
  const withinFence = nearby?.withinFence === true;
  const inRange = nearby?.inRange ?? [];
  const selected =
    clients.find((c) => c.id === selectedClientId) ||
    inRange.find((c) => c.id === selectedClientId) ||
    null;

  const mapProps = {
    clients,
    selectedClientId,
    onSelectClient: setSelectedClientId,
    userLoc,
    geofenceCenter: selected ? { latitude: selected.latitude, longitude: selected.longitude } : null,
    geofenceRadiusM: selected ? fenceM : null,
  };

  const onDirections = () => {
    if (!selected || !userLoc) {
      Alert.alert("Directions", "Select a site and wait for your location.");
      return;
    }
    openMapsDirections(userLoc.latitude, userLoc.longitude, selected.latitude, selected.longitude);
  };

  const onOpenSiteInMaps = () => {
    if (!selected) {
      Alert.alert("Maps", "Select a site on the map first.");
      return;
    }
    openMapsPin(selected.latitude, selected.longitude, selected.clientName ?? "Site");
  };

  const punchGps = async (isCheckout) => {
    if (!userLoc) {
      Alert.alert("Location", "Waiting for GPS. Enable location and try again.");
      return;
    }
    const clientId = isCheckout ? active?.clientId : selected?.id;
    if (!clientId) {
      Alert.alert("Site", isCheckout ? "No open session." : "Select a site on the map.");
      return;
    }
    if (!isCheckout && !withinFence) {
      Alert.alert("Too far", `Get within about ${fenceM}m of the site for GPS check-in, or use QR.`);
      return;
    }
    setBusy(true);
    try {
      const body = {
        clientId,
        punchType: "FIELD_GPS",
        punchedAt: new Date().toISOString(),
        latitude: userLoc.latitude,
        longitude: userLoc.longitude,
        accuracyMeters: userLoc.accuracy ?? undefined,
      };
      await apiPostJson("/apps/field-checkin/punch", body);
      await loadStatic();
      if (userLoc) refreshNearby(userLoc.latitude, userLoc.longitude);
      Alert.alert("Done", isCheckout ? "Checked out." : "Checked in.");
    } catch (e) {
      Alert.alert("Check-in", e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  };

  const punchQr = async () => {
    const raw = qrToken.trim();
    if (!raw) {
      Alert.alert("QR", "Paste the site QR payload.");
      return;
    }
    let clientId = selected?.id;
    try {
      const normalized = raw.replace(/-/g, "+").replace(/_/g, "/");
      const pad = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
      const json = atob(normalized + pad);
      const payload = JSON.parse(json);
      if (payload.clientId) clientId = payload.clientId;
    } catch {
      Alert.alert("QR", "Invalid token. Paste the full site QR string.");
      return;
    }
    if (!clientId) {
      Alert.alert("QR", "Select the matching site on the map.");
      return;
    }
    setBusy(true);
    try {
      const body = {
        clientId,
        punchType: "FIELD_QR",
        punchedAt: new Date().toISOString(),
        qrNonce: raw,
      };
      if (userLoc) {
        body.latitude = userLoc.latitude;
        body.longitude = userLoc.longitude;
        body.accuracyMeters = userLoc.accuracy ?? undefined;
      }
      await apiPostJson("/apps/field-checkin/punch", body);
      setQrToken("");
      await loadStatic();
      if (userLoc) refreshNearby(userLoc.latitude, userLoc.longitude);
      Alert.alert("Done", "QR check-in recorded.");
    } catch (e) {
      Alert.alert("Check-in", e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  };

  const refreshAll = async () => {
    setLoading(true);
    await loadStatic();
    if (userLoc) await refreshNearby(userLoc.latitude, userLoc.longitude);
    setLoading(false);
  };

  return (
    <StackScreen title="Remote check-in" subtitle="Pick a site · GPS or QR" contentStyle={{ paddingHorizontal: 16 }}>
      {loading ? (
        <View style={{ paddingVertical: 32, alignItems: "center" }}>
          <ActivityIndicator color="#007AFF" />
        </View>
      ) : null}

      {permission && permission !== "granted" ? (
        <GlassView
          isInteractive
          style={[
            styles.card,
            isLiquidGlassAvailable() ? {} : { backgroundColor: "#fff" },
          ]}
        >
          <Text style={styles.warnTitle}>Location needed</Text>
          <Text style={styles.muted}>Allow location so we can tell if you’re near a site.</Text>
        </GlassView>
      ) : null}

      {active ? (
        <GlassView
          isInteractive
          style={[
            styles.card,
            {
              borderLeftWidth: 4,
              borderLeftColor: "#34C759",
            },
            isLiquidGlassAvailable() ? {} : { backgroundColor: "#fff" },
          ]}
        >
          <Text style={styles.kicker}>Checked in</Text>
          <Text style={styles.siteTitle}>{active.clientName ?? "Site"}</Text>
          <Text style={styles.muted}>
            Since {formatHm(active.checkIn)}
            {summary?.openElapsedHoursApprox != null
              ? ` · ~${summary.openElapsedHoursApprox.toFixed(1)} h`
              : ""}
          </Text>
          <Pressable
            onPress={() => punchGps(true)}
            disabled={busy}
            style={({ pressed }) => [styles.btnDanger, { opacity: pressed || busy ? 0.9 : 1 }]}
          >
            <LogOut size={18} color="#FFF" />
            <Text style={[styles.btnDangerText, { marginLeft: 8 }]}>Check out</Text>
          </Pressable>
        </GlassView>
      ) : null}

      <View style={styles.mapHeader}>
        <Text style={styles.sectionTitle}>Sites</Text>
        <View style={styles.mapActions}>
          <Pressable
            onPress={() => setMapFullscreen(true)}
            style={styles.iconBtn}
            hitSlop={8}
          >
            <Maximize2 size={20} color="#007AFF" />
          </Pressable>
          <Pressable onPress={onDirections} style={styles.iconBtn} hitSlop={8} disabled={!selected || !userLoc}>
            <Navigation size={20} color={selected && userLoc ? "#007AFF" : "#C7C7CC"} />
          </Pressable>
          <Pressable onPress={onOpenSiteInMaps} style={styles.iconBtn} hitSlop={8} disabled={!selected}>
            <ExternalLink size={20} color={selected ? "#007AFF" : "#C7C7CC"} />
          </Pressable>
          <Pressable onPress={refreshAll} style={styles.iconBtn} hitSlop={8}>
            <RefreshCw size={20} color="#007AFF" />
          </Pressable>
        </View>
      </View>
     

      <View style={styles.mapTileShadow}>
        <GlassView
          isInteractive
          style={[
            styles.mapTile,
            isLiquidGlassAvailable() ? {} : { backgroundColor: "#FFFFFF", opacity: 0.97 },
          ]}
        >
          <FieldCheckinMap {...mapProps} height={Platform.OS === "web" ? 100 : 220} />
        </GlassView>
      </View>

      <View style={styles.statusRow}>
        <View style={{ marginRight: 8 }}>
          <MapPinned size={18} color={withinFence ? "#34C759" : "#FF9500"} />
        </View>
        <Text style={styles.statusText}>
          {withinFence ? "In range — GPS check-in is available" : "Outside range — move closer or use QR"}
        </Text>
      </View>

      {userLoc ? (
        <Text style={[styles.muted, { marginBottom: 12 }]}>
          GPS {userLoc.latitude.toFixed(5)}, {userLoc.longitude.toFixed(5)}
          {userLoc.accuracy ? ` · ±${Math.round(userLoc.accuracy)}m` : ""}
        </Text>
      ) : (
        <Text style={[styles.muted, { marginBottom: 12 }]}>Getting location…</Text>
      )}

      <Text style={styles.sectionTitle}>Nearby</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
        {inRange.length === 0 ? (
          <Text style={styles.muted}>No sites in {fenceM}m — zoom the map or open directions.</Text>
        ) : (
          inRange.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => setSelectedClientId(c.id)}
              style={{
                paddingVertical: 10,
                paddingHorizontal: 14,
                borderRadius: 12,
                marginRight: 8,
                backgroundColor: c.id === selectedClientId ? "#007AFF" : "#E5E5EA",
              }}
            >
              <Text
                style={{
                  fontWeight: "700",
                  color: c.id === selectedClientId ? "#FFF" : "#000",
                  maxWidth: 140,
                }}
                numberOfLines={2}
              >
                {c.clientName}
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  color: c.id === selectedClientId ? "rgba(255,255,255,0.9)" : "#666",
                  marginTop: 4,
                }}
              >
                {c.distanceMeters}m
              </Text>
            </Pressable>
          ))
        )}
      </ScrollView>

      {!active ? (
        <Pressable
          onPress={() => punchGps(false)}
          disabled={busy || !withinFence || !selected}
          style={({ pressed }) => ({
            backgroundColor: withinFence && selected ? "#34C759" : "#C7C7CC",
            borderRadius: 14,
            paddingVertical: 16,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 14,
            opacity: pressed || busy ? 0.92 : 1,
          })}
        >
          <LogIn size={22} color="#FFF" />
          <Text style={{ color: "#FFF", fontWeight: "800", marginLeft: 10, fontSize: 17 }}>Check in</Text>
        </Pressable>
      ) : null}

      <Pressable
        onPress={() => setShowQr((v) => !v)}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingVertical: 12,
          marginBottom: showQr ? 8 : 4,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <QrCode size={20} color="#007AFF" />
          <Text style={{ fontWeight: "800", marginLeft: 8, color: "#000" }}>QR check-in</Text>
        </View>
        {showQr ? <ChevronUp size={20} color="#8E8E93" /> : <ChevronDown size={20} color="#8E8E93" />}
      </Pressable>

      {showQr ? (
        <>
          <TextInput
            value={qrToken}
            onChangeText={setQrToken}
            placeholder="Paste site QR"
            placeholderTextColor="#999"
            multiline
            style={styles.qrInput}
          />
          <Pressable
            onPress={punchQr}
            disabled={busy}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              paddingVertical: 14,
              borderRadius: 14,
              backgroundColor: "#007AFF",
              marginBottom: 16,
              opacity: pressed || busy ? 0.9 : 1,
            })}
          >
            <QrCode size={20} color="#FFF" />
            <Text style={{ color: "#FFF", fontWeight: "800", marginLeft: 8 }}>Submit QR</Text>
          </Pressable>
        </>
      ) : null}

      {summary?.todaySegments?.length ? (
        <GlassView
          style={[
            styles.card,
            isLiquidGlassAvailable() ? {} : { backgroundColor: "#fff" },
          ]}
        >
          <Text style={styles.sectionTitle}>Today · {summary.calendarDate}</Text>
          {summary.todaySegments.map((seg) => (
            <View key={seg.sessionId} style={styles.segmentRow}>
              <Text style={{ fontWeight: "700" }}>{seg.clientName ?? "—"}</Text>
              <Text style={styles.muted}>
                {formatHm(seg.checkIn)} – {seg.checkOut ? formatHm(seg.checkOut) : "open"}
                {seg.totalHours != null ? ` · ${Number(seg.totalHours).toFixed(1)}h` : ""}
              </Text>
            </View>
          ))}
          <Text style={{ marginTop: 6, fontWeight: "700" }}>
            Closed: {summary.totalHoursClosedToday?.toFixed(1) ?? "0"}h
          </Text>
        </GlassView>
      ) : null}

      {summary?.recentDays?.length ? (
        <GlassView
          style={[
            styles.card,
            { marginBottom: insets.bottom + 20 },
            isLiquidGlassAvailable() ? {} : { backgroundColor: "#fff" },
          ]}
        >
          <Text style={styles.sectionTitle}>Last 7 days</Text>
          {summary.recentDays.map((d) => (
            <View key={d.date} style={styles.dayRow}>
              <Text style={styles.muted}>{d.date}</Text>
              <Text style={{ fontWeight: "700" }}>
                {d.totalHours}h · {d.sessions} visit{d.sessions === 1 ? "" : "s"}
              </Text>
            </View>
          ))}
        </GlassView>
      ) : null}

      <Modal
        visible={mapFullscreen}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setMapFullscreen(false)}
      >
        <SafeAreaView style={styles.modalRoot} edges={["top", "bottom"]}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setMapFullscreen(false)} style={styles.modalClose} hitSlop={12}>
              <X size={26} color="#FFF" />
            </Pressable>
            <Text style={styles.modalTitle}>Sites map</Text>
            <View style={{ width: 40 }} />
          </View>
          <View style={{ flex: 1 }}>
            <FieldCheckinMap {...mapProps} fullScreen />
          </View>
          <View style={[styles.modalFooter, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <Pressable
              style={styles.modalFootBtn}
              onPress={onDirections}
              disabled={!selected || !userLoc}
            >
              <Navigation size={18} color="#007AFF" />
              <Text style={styles.modalFootBtnText}>Directions</Text>
            </Pressable>
            <Pressable style={styles.modalFootBtn} onPress={onOpenSiteInMaps} disabled={!selected}>
              <MapPinned size={18} color="#007AFF" />
              <Text style={styles.modalFootBtnText}>Open in Maps</Text>
            </Pressable>
            <Pressable style={[styles.modalFootBtn, styles.modalFootBtnPrimary]} onPress={() => setMapFullscreen(false)}>
              <Text style={styles.modalFootBtnPrimaryText}>Done</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </Modal>
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 14,
    borderRadius: 14,
    marginBottom: 12,
    overflow: "hidden",
  },
  cardTitle: { fontSize: 16, fontWeight: "800", color: "#000" },
  kicker: { fontSize: 11, fontWeight: "800", color: "#007AFF", letterSpacing: 0.6 },
  siteTitle: { fontSize: 18, fontWeight: "800", color: "#000", marginTop: 4 },
  warnTitle: { fontWeight: "800", color: "#C62828" },
  muted: { fontSize: 14, color: "#666", marginTop: 4, lineHeight: 20 },
  mono: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 11,
    color: "#000",
    lineHeight: 16,
  },
  mapHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: "#000" },
  mapActions: { flexDirection: "row", alignItems: "center" },
  iconBtn: { padding: 8 },
  mapHint: { fontSize: 12, color: "#8E8E93", marginBottom: 8 },
  mapTileShadow: {
    marginBottom: 12,
    borderRadius: 16,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
      },
      android: { elevation: 6 },
    }),
  },
  mapTile: {
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.1)",
  },
  statusRow: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  statusText: { flex: 1, fontSize: 15, fontWeight: "600", color: "#000" },
  segmentRow: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.08)",
  },
  dayRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  qrInput: {
    borderWidth: 1,
    borderColor: "#E5E5EA",
    borderRadius: 12,
    padding: 12,
    minHeight: 72,
    textAlignVertical: "top",
    color: "#000",
    marginBottom: 10,
  },
  btnDanger: {
    marginTop: 12,
    backgroundColor: "#FF3B30",
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  btnDangerText: { color: "#FFF", fontWeight: "800", fontSize: 16 },
  modalRoot: { flex: 1, backgroundColor: "#1C1C1E" },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 10,
    backgroundColor: "#1C1C1E",
  },
  modalClose: { padding: 8, width: 44 },
  modalTitle: { color: "#FFF", fontSize: 17, fontWeight: "700" },
  modalFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingTop: 10,
    backgroundColor: "#2C2C2E",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.12)",
  },
  modalFootBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
    marginHorizontal: 4,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  modalFootBtnText: { color: "#FFF", fontWeight: "700", fontSize: 13, marginLeft: 6 },
  modalFootBtnPrimary: { backgroundColor: "#007AFF" },
  modalFootBtnPrimaryText: { color: "#FFF", fontWeight: "800", fontSize: 15 },
});
