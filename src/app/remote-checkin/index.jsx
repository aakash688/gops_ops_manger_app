import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  Modal,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets, SafeAreaView } from "react-native-safe-area-context";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock3,
  ExternalLink,
  LocateFixed,
  LogIn,
  LogOut,
  MapPinned,
  Maximize2,
  Navigation,
  RefreshCw,
  X,
} from "lucide-react-native";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import StackScreen from "@/components/StackScreen";
import FieldCheckinMap from "@/components/FieldCheckinMap";
import { apiGetJson, apiPostJson } from "@/utils/api";
import { openMapsDirections, openMapsPin } from "@/utils/openInMaps";
import { startLiveTracking, stopLiveTracking } from "@/services/liveTracking";
import { useAuthStore } from "@/utils/auth/store";

const LAST_FIELD_LOCATION_KEY = "field-checkin:last-location:v1";

function formatHm(isoOrTime) {
  if (!isoOrTime) return "-";
  const s = String(isoOrTime);
  if (s.length >= 8 && s.includes(":")) return s.slice(0, 5);
  return s.slice(11, 16) || s;
}

function formatDistance(meters) {
  if (meters == null || Number.isNaN(Number(meters))) return "-";
  const n = Number(meters);
  if (n < 1000) return `${Math.round(n)} m`;
  return `${(n / 1000).toFixed(n < 10000 ? 1 : 0)} km`;
}

function formatAccuracy(meters) {
  if (meters == null || Number.isNaN(Number(meters))) return "Accuracy pending";
  return `+/-${Math.round(Number(meters))} m`;
}

function formatAge(timestamp) {
  if (!timestamp) return "Waiting";
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 5) return "Just now";
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.round(seconds / 60)}m ago`;
}

function toLocationState(loc, source, cached = false) {
  const { latitude, longitude, accuracy } = loc.coords;
  return {
    latitude,
    longitude,
    accuracy: accuracy ?? null,
    timestamp: loc.timestamp ?? Date.now(),
    source,
    cached,
  };
}

function storedLocationToState(raw) {
  try {
    const parsed = JSON.parse(raw);
    if (
      typeof parsed?.latitude !== "number" ||
      typeof parsed?.longitude !== "number" ||
      Math.abs(parsed.latitude) > 90 ||
      Math.abs(parsed.longitude) > 180
    ) {
      return null;
    }
    return {
      latitude: parsed.latitude,
      longitude: parsed.longitude,
      accuracy: typeof parsed.accuracy === "number" ? parsed.accuracy : null,
      timestamp: typeof parsed.timestamp === "number" ? parsed.timestamp : Date.now(),
      source: "stored",
      cached: true,
    };
  } catch {
    return null;
  }
}

function metersBetween(a, b) {
  if (!a || !b) return null;
  const R = 6371000;
  const toRad = (v) => (v * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

async function getPositionWithTimeout(options, timeoutMs = 6500) {
  return Promise.race([
    Location.getCurrentPositionAsync(options),
    new Promise((_, reject) => setTimeout(() => reject(new Error("Location request timed out")), timeoutMs)),
  ]);
}

async function applyFieldPunchLiveTracking(punchBody, punchResult) {
  if (Platform.OS === "web") return;
  const action = punchResult?.action;
  try {
    if (action === "PUNCHED_IN") {
      const loginMethod = punchBody.punchType === "FIELD_QR" ? "QR" : "REMOTE";
      await startLiveTracking({ loginMethod });
    } else if (action === "PUNCHED_OUT") {
      await stopLiveTracking();
    }
  } catch (e) {
    Alert.alert(
      "Live tracking",
      e instanceof Error ? e.message : "Could not update background location for this session.",
    );
  }
}

export default function RemoteCheckinScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();
  const employeeId = useAuthStore((s) => s.auth?.user?.employeeId);
  const [permission, setPermission] = useState(null);
  const [userLoc, setUserLoc] = useState(null);
  const [clients, setClients] = useState([]);
  const [nearby, setNearby] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [mapFullscreen, setMapFullscreen] = useState(false);
  const [clientHalts, setClientHalts] = useState(null);
  const [clientHaltsLoading, setClientHaltsLoading] = useState(false);
  const [clientHaltsError, setClientHaltsError] = useState(null);
  const [locating, setLocating] = useState(true);
  const lastNearbyFetchRef = useRef(null);

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
      if (!String(msg).includes("Employee context")) Alert.alert("Field check-in", msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshNearby = useCallback(async (lat, lng, options = {}) => {
    const currentPoint = { latitude: lat, longitude: lng };
    const last = lastNearbyFetchRef.current;
    if (!options.force && last) {
      const movedM = metersBetween(last, currentPoint) ?? 0;
      const ageMs = Date.now() - last.timestamp;
      if (movedM < 20 && ageMs < 20000) return;
    }
    lastNearbyFetchRef.current = { ...currentPoint, timestamp: Date.now() };
    try {
      const { data } = await apiGetJson(
        `/apps/field-checkin/nearby?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lng)}`,
      );
      setNearby(data);
      setSelectedClientId((prev) => prev || data?.nearest?.id || data?.inRange?.[0]?.id || null);
    } catch {
      setNearby(null);
    }
  }, []);

  useEffect(() => {
    loadStatic();
  }, [loadStatic]);

  useEffect(() => {
    const token = typeof params?.qrToken === "string" ? params.qrToken : null;
    if (!token) return;
    router.setParams({ qrToken: undefined });
    (async () => {
      await punchQr(token);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params?.qrToken]);

  useEffect(() => {
    let sub;
    let cancelled = false;
    const applyCachedState = (next, forceNearby = false) => {
      if (cancelled || !next) return;
      setUserLoc(next);
      setLocating(false);
      refreshNearby(next.latitude, next.longitude, { force: forceNearby });
    };
    const applyLocation = (loc, source, cached = false, forceNearby = false) => {
      if (cancelled || !loc?.coords) return;
      const next = toLocationState(loc, source, cached);
      applyCachedState(next, forceNearby);
      AsyncStorage.setItem(
        LAST_FIELD_LOCATION_KEY,
        JSON.stringify({
          latitude: next.latitude,
          longitude: next.longitude,
          accuracy: next.accuracy,
          timestamp: next.timestamp,
        }),
      ).catch(() => {});
    };

    (async () => {
      setLocating(true);
      const stored = await AsyncStorage.getItem(LAST_FIELD_LOCATION_KEY)
        .then(storedLocationToState)
        .catch(() => null);
      if (stored && Date.now() - stored.timestamp < 60 * 60 * 1000) {
        applyCachedState(stored, true);
      }

      const existing = await Location.getForegroundPermissionsAsync();
      const permissionResult =
        existing.status === "granted" ? existing : await Location.requestForegroundPermissionsAsync();
      setPermission(permissionResult.status);
      if (permissionResult.status !== "granted") {
        setLocating(false);
        return;
      }

      const cached = await Location.getLastKnownPositionAsync({ maxAge: 60 * 60 * 1000 }).catch(() => null);
      if (cached) applyLocation(cached, "cached", true, true);

      Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 10000,
          distanceInterval: 30,
        },
        (loc) => applyLocation(loc, "watch", false, false),
      )
        .then((subscription) => {
          if (cancelled) subscription.remove();
          else sub = subscription;
        })
        .catch(() => {});

      try {
        const fast = await getPositionWithTimeout({ accuracy: Location.Accuracy.Low }, 2500);
        applyLocation(fast, "fast-current", false, true);
      } catch {
        // Keep the cached/stored location visible while the balanced fix continues below.
      }

      try {
        const cur = await getPositionWithTimeout({ accuracy: Location.Accuracy.Balanced }, 6500);
        applyLocation(cur, "current", false, true);
      } catch {
        if (!cached && !stored) setLocating(false);
      }
    })();

    return () => {
      cancelled = true;
      if (sub) sub.remove();
    };
  }, [refreshNearby]);

  const active = summary?.activeSession;
  const inRange = nearby?.inRange ?? [];
  const effectiveSelectedClientId = selectedClientId ?? active?.clientId;
  const selected =
    clients.find((c) => c.id === effectiveSelectedClientId) ||
    inRange.find((c) => c.id === effectiveSelectedClientId) ||
    null;
  const selectedNearby = selected ? inRange.find((c) => c.id === selected.id) : null;
  const selectedDistanceM =
    selectedNearby?.distanceMeters ??
    (selected && userLoc ? metersBetween(userLoc, { latitude: selected.latitude, longitude: selected.longitude }) : null);
  const gpsStatus =
    permission && permission !== "granted"
      ? "Permission needed"
      : locating && !userLoc
        ? "Finding GPS"
        : userLoc
          ? "GPS available"
          : "Waiting";
  const totalClosedHours = summary?.totalHoursClosedToday ?? 0;
  const visibleSegments = useMemo(() => summary?.todaySegments?.slice(0, 4) ?? [], [summary?.todaySegments]);

  const mapProps = {
    clients,
    selectedClientId: effectiveSelectedClientId,
    onSelectClient: setSelectedClientId,
    userLoc,
    geofenceCenter: null,
    geofenceRadiusM: null,
    centerOnUser: true,
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
    const loc = userLoc;
    if (!loc) {
      Alert.alert("Location required", "We are still getting your GPS location. Please keep location services enabled and try again.");
      return;
    }
    const clientId = selected?.id;
    if (!clientId) {
      Alert.alert("Select a site", `Select the site on the map before you ${isCheckout ? "check out" : "check in"}.`);
      return;
    }
    const selectedWithinRange = fenceM != null && selectedDistanceM != null && selectedDistanceM <= fenceM;
    if (!selectedWithinRange) {
      Alert.alert(
        "Move closer to selected site",
        selectedDistanceM != null && fenceM != null
          ? `You are ${formatDistance(selectedDistanceM)} away from ${selected.clientName}. You must be within ${formatDistance(fenceM)} to ${isCheckout ? "check out" : "check in"}.`
          : "Your distance from the selected site is still being calculated. Please wait a moment and try again.",
      );
      return;
    }
    setBusy(true);
    try {
      const body = {
        clientId,
        punchType: "FIELD_GPS",
        punchedAt: new Date().toISOString(),
        latitude: loc.latitude,
        longitude: loc.longitude,
        accuracyMeters: loc.accuracy ?? undefined,
      };
      const { data: punchData } = await apiPostJson("/apps/field-checkin/punch", body);
      await applyFieldPunchLiveTracking(body, punchData);
      await loadStatic();
      refreshNearby(loc.latitude, loc.longitude, { force: true });
      Alert.alert(isCheckout ? "Check-out recorded" : "Check-in recorded", punchData?.guidance?.summary ?? (isCheckout ? "You checked out successfully." : "You checked in successfully."));
    } catch (e) {
      Alert.alert(isCheckout ? "Check-out failed" : "Check-in failed", e instanceof Error ? e.message : "We could not record this punch. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const punchQr = async (raw) => {
    const token = String(raw || "").trim();
    if (!token) {
      Alert.alert("QR", "Scan the site QR first.");
      return;
    }
    const isCheckout = !!active;
    if (!userLoc) {
      Alert.alert("Location required", "We are still getting your GPS location. QR punches also require live location verification.");
      return;
    }
    const selectedWithinRange = selected && fenceM != null && selectedDistanceM != null && selectedDistanceM <= fenceM;
    if (!selectedWithinRange) {
      Alert.alert(
        "Move closer to selected site",
        selected && selectedDistanceM != null && fenceM != null
          ? `You are ${formatDistance(selectedDistanceM)} away from ${selected.clientName}. You must be within ${formatDistance(fenceM)} before using QR.`
          : "Select the site on the map and wait for distance verification before using QR.",
      );
      return;
    }
    let clientId = selected?.id;
    try {
      const normalized = token.replace(/-/g, "+").replace(/_/g, "/");
      const pad = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
      const payload = JSON.parse(atob(normalized + pad));
      if (payload.clientId) clientId = payload.clientId;
    } catch {
      Alert.alert("QR", "Invalid QR. Scan the full site QR.");
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
        qrNonce: token,
      };
      body.latitude = userLoc.latitude;
      body.longitude = userLoc.longitude;
      body.accuracyMeters = userLoc.accuracy ?? undefined;
      const { data: punchData } = await apiPostJson("/apps/field-checkin/punch", body);
      await applyFieldPunchLiveTracking(body, punchData);
      await loadStatic();
      if (userLoc) refreshNearby(userLoc.latitude, userLoc.longitude, { force: true });
      Alert.alert(
        punchData?.action === "PUNCHED_OUT" ? "Check-out recorded" : "Check-in recorded",
        punchData?.guidance?.summary ?? (isCheckout ? "You checked out successfully." : "You checked in successfully."),
      );
    } catch (e) {
      Alert.alert(isCheckout ? "Check-out failed" : "Check-in failed", e instanceof Error ? e.message : "We could not record this punch. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const refreshAll = async () => {
    setLoading(true);
    await loadStatic();
    if (userLoc) await refreshNearby(userLoc.latitude, userLoc.longitude, { force: true });
    setLoading(false);
  };

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
      setClientHaltsError(e instanceof Error ? e.message : "Could not load visited sites");
    } finally {
      setClientHaltsLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    loadClientHaltsToday().catch(() => {});
  }, [loadClientHaltsToday]);

  const glassFallback = isLiquidGlassAvailable() ? {} : { backgroundColor: "#fff" };
  const withinFence = nearby?.withinFence ?? false;
  const fenceM = nearby?.geoFenceMeters ?? null;
  const nearestSite = nearby?.nearest ?? null;
  const nearestDistM = nearestSite?.distanceMeters ?? null;
  const selectedWithinRange = selected && fenceM != null && selectedDistanceM != null && selectedDistanceM <= fenceM;
  const canGpsPunch = !!userLoc && !!selected && !!selectedWithinRange;
  const outOfRangeReason =
    userLoc && !withinFence && nearestSite
      ? `${formatDistance(nearestDistM)} from nearest site · need within ${fenceM ? formatDistance(fenceM) : "range"}`
      : null;
  const primaryActionText = active
    ? "Check out"
    : "Check in";

  return (
    <StackScreen title="Remote check-in" subtitle="Field attendance · GPS or QR" contentStyle={{ paddingHorizontal: 16 }}>
      {loading ? (
        <View style={styles.loadingStrip}>
          <ActivityIndicator color="#1A73E8" />
          <Text style={styles.loadingText}>Loading sites and attendance...</Text>
        </View>
      ) : null}

      <GlassView isInteractive style={[styles.heroCard, glassFallback]}>
        <View style={styles.heroTopRow}>
          <View style={[styles.heroIcon, active ? styles.heroIconActive : styles.heroIconIdle]}>
            {active ? <CheckCircle2 size={22} color="#188038" /> : <MapPinned size={22} color="#1A73E8" />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>{active ? "ACTIVE FIELD SESSION" : "READY FOR FIELD CHECK-IN"}</Text>
            <Text style={styles.heroTitle} numberOfLines={2}>
              {active?.clientName ?? selected?.clientName ?? "Select your assigned site"}
            </Text>
          </View>
        </View>
        <View style={styles.heroMetrics}>
          <View style={styles.metricBox}>
            <Clock3 size={16} color="#5F6368" />
            <Text style={styles.metricLabel}>Today</Text>
            <Text style={styles.metricValue}>{Number(totalClosedHours).toFixed(1)}h</Text>
          </View>
          <View style={styles.metricBox}>
            <LocateFixed size={16} color="#5F6368" />
            <Text style={styles.metricLabel}>GPS</Text>
            <Text style={[styles.metricValue, userLoc ? styles.goodText : styles.warnText]}>{gpsStatus}</Text>
          </View>
          <View style={styles.metricBox}>
            <Building2 size={16} color="#5F6368" />
            <Text style={styles.metricLabel}>Sites</Text>
            <Text style={styles.metricValue}>{clients.length}</Text>
          </View>
        </View>
        <Text style={styles.heroNote}>
          {active
            ? `Complete this open session before starting a new one. Checked in since ${formatHm(active.checkIn)}${
                summary?.openElapsedHoursApprox != null ? ` · ${summary.openElapsedHoursApprox.toFixed(1)}h open` : ""
              }`
            : ""}
        </Text>
      </GlassView>

      {permission && permission !== "granted" ? (
        <GlassView isInteractive style={[styles.permissionCard, glassFallback]}>
          <AlertTriangle size={20} color="#B3261E" />
          <View style={{ flex: 1 }}>
            <Text style={styles.warnTitle}>Location permission required</Text>
            <Text style={styles.muted}>Allow location access to record field attendance.</Text>
          </View>
        </GlassView>
      ) : null}

      <View style={styles.mapTileShadow}>
        <GlassView isInteractive style={[styles.mapTile, glassFallback]}>
          <View style={styles.mapTopBar}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>Nearby work sites</Text>
              <Text style={styles.mapHint}>
                {selected
                  ? selectedWithinRange
                    ? `${formatDistance(selectedDistanceM)} away · selected site is in range`
                    : selectedDistanceM != null && fenceM != null
                      ? `${formatDistance(selectedDistanceM)} away · move within ${formatDistance(fenceM)}`
                      : "Calculating distance to selected site…"
                  : "Tap a pin to select a site"}
              </Text>
            </View>
            <View style={styles.mapActions}>
              <Pressable onPress={() => setMapFullscreen(true)} style={styles.iconBtn} hitSlop={8}>
                <Maximize2 size={20} color="#1A73E8" />
              </Pressable>
              <Pressable onPress={refreshAll} style={styles.iconBtn} hitSlop={8}>
                <RefreshCw size={20} color="#1A73E8" />
              </Pressable>
            </View>
          </View>
          <View style={styles.mapCanvas}>
            <FieldCheckinMap {...mapProps} height={Platform.OS === "web" ? 180 : 320} />
          </View>
          <View style={styles.selectedSiteCard}>
            <View style={styles.selectedTopRow}>
              <View style={[styles.siteBadge, selected ? styles.siteBadgeGood : styles.siteBadgeWarn]}>
                {selected ? <CheckCircle2 size={18} color="#188038" /> : <AlertTriangle size={18} color="#B06000" />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.selectedTitle} numberOfLines={1}>
                  {selected?.clientName ?? "No site selected"}
                </Text>
                <Text style={[styles.selectedMeta, selected && !selectedWithinRange && userLoc ? styles.warnText : null]}>
                  {selected
                    ? selectedWithinRange
                      ? `${formatDistance(selectedDistanceM)} from you · within geofence ✓`
                      : selectedDistanceM != null && fenceM != null
                        ? `Out of range · ${formatDistance(selectedDistanceM)} away · need within ${formatDistance(fenceM)}`
                        : `${formatDistance(selectedDistanceM)} from you · loading range…`
                    : "Select a marker or nearby site to continue"}
                </Text>
              </View>
            </View>
              <View style={styles.siteInfoGrid}>
              <View style={styles.siteInfoItem}>
                <Text style={styles.siteInfoLabel}>Range</Text>
                <Text style={[styles.siteInfoValue, selectedWithinRange ? styles.goodText : userLoc ? styles.warnText : null]}>
                  {selectedWithinRange ? `Within ${fenceM ? formatDistance(fenceM) : "range"}` : fenceM ? `Need ${formatDistance(fenceM)}` : "Loading…"}
                </Text>
              </View>
              <View style={styles.siteInfoItem}>
                <Text style={styles.siteInfoLabel}>Accuracy</Text>
                <Text style={styles.siteInfoValue}>{formatAccuracy(userLoc?.accuracy)}</Text>
              </View>
              <View style={styles.siteInfoItem}>
                <Text style={styles.siteInfoLabel}>Updated</Text>
                <Text style={styles.siteInfoValue}>{formatAge(userLoc?.timestamp)}</Text>
              </View>
            </View>
            <View style={styles.siteActionRow}>
              <Pressable onPress={onDirections} disabled={!selected || !userLoc} style={styles.secondaryAction}>
                <Navigation size={17} color={selected && userLoc ? "#1A73E8" : "#9AA0A6"} />
                <Text style={[styles.secondaryActionText, (!selected || !userLoc) && styles.disabledText]}>Directions</Text>
              </Pressable>
              <Pressable onPress={onOpenSiteInMaps} disabled={!selected} style={styles.secondaryAction}>
                <ExternalLink size={17} color={selected ? "#1A73E8" : "#9AA0A6"} />
                <Text style={[styles.secondaryActionText, !selected && styles.disabledText]}>Open map</Text>
              </Pressable>
            </View>
          </View>
        </GlassView>
      </View>

      <View style={styles.actionRow}>
        <Pressable
          onPress={() => punchGps(!!active)}
          disabled={busy || !canGpsPunch}
          style={({ pressed }) => [
            styles.primaryAction,
            active ? styles.checkoutAction : canGpsPunch ? styles.checkinAction : styles.disabledAction,
            (pressed || busy) && styles.pressed,
          ]}
        >
          {busy ? (
            <ActivityIndicator color="#FFF" />
          ) : active ? (
            <LogOut size={21} color="#FFF" />
          ) : (
            <LogIn size={21} color="#FFF" />
          )}
          <Text style={styles.primaryActionText}>{primaryActionText}</Text>
        </Pressable>
      </View>

      {!active ? (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Nearby sites</Text>
            <Text style={styles.sectionCount}>{inRange.length}</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.nearbyList}>
            {inRange.length === 0 ? (
              <View style={styles.emptyNearby}>
                <Text style={styles.emptyTitle}>No nearby sites detected</Text>
                <Text style={styles.muted}>Move within the allowed range of any active site to check in or check out.</Text>
              </View>
            ) : (
              inRange.map((c) => {
                const isSelected = c.id === effectiveSelectedClientId;
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => setSelectedClientId(c.id)}
                    style={[styles.nearbyChip, isSelected && styles.nearbyChipSelected]}
                  >
                    <Text style={[styles.nearbyName, isSelected && styles.nearbyNameSelected]} numberOfLines={1}>
                      {c.clientName}
                    </Text>
                    <Text style={[styles.nearbyDistance, isSelected && styles.nearbyDistanceSelected]}>
                      {formatDistance(c.distanceMeters)}
                    </Text>
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        </>
      ) : null}

      {visibleSegments.length ? (
        <GlassView style={[styles.card, glassFallback]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Today’s punches</Text>
            <Text style={styles.sectionCount}>{summary.calendarDate}</Text>
          </View>
          {visibleSegments.map((seg) => (
            <View key={seg.sessionId} style={styles.segmentRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.segmentSite} numberOfLines={1}>
                  {seg.clientName ?? "Site"}
                </Text>
                <Text style={styles.muted}>
                  {formatHm(seg.checkIn)} - {seg.checkOut ? formatHm(seg.checkOut) : "open"}
                </Text>
              </View>
              <Text style={styles.segmentHours}>{seg.totalHours != null ? `${Number(seg.totalHours).toFixed(1)}h` : "Open"}</Text>
            </View>
          ))}
        </GlassView>
      ) : null}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Visited sites today</Text>
        {clientHaltsLoading ? <ActivityIndicator size="small" color="#1A73E8" /> : null}
      </View>
      {clientHaltsError ? (
        <Text style={styles.err}>{clientHaltsError}</Text>
      ) : clientHalts?.perClient?.length ? (
        <GlassView style={[styles.card, glassFallback]}>
          {clientHalts.perClient.slice(0, 5).map((c) => (
            <View key={c.clientId} style={styles.dayRow}>
              <Text style={styles.daySite} numberOfLines={1}>
                {c.clientName}
              </Text>
              <Text style={styles.dayValue}>
                {Math.round((c.totalDurationSec ?? 0) / 60)}m · {c.haltCount} halt{c.haltCount === 1 ? "" : "s"}
              </Text>
            </View>
          ))}
        </GlassView>
      ) : clientHaltsLoading ? null : (
        <Text style={styles.muted}>No automatic site visits detected yet.</Text>
      )}

      <View style={{ height: insets.bottom + 20 }} />

      <Modal visible={mapFullscreen} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setMapFullscreen(false)}>
        <SafeAreaView style={styles.modalRoot} edges={["top", "bottom"]}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setMapFullscreen(false)} style={styles.modalClose} hitSlop={12}>
              <X size={26} color="#FFF" />
            </Pressable>
            <Text style={styles.modalTitle}>Sites map</Text>
            <View style={{ width: 40 }} />
          </View>
          <View style={styles.modalMapWrap}>
            <FieldCheckinMap {...mapProps} fullScreen />
            <View style={styles.modalSelectedCard}>
              <Text style={styles.modalSelectedTitle} numberOfLines={1}>
                {selected?.clientName ?? "Select a site"}
              </Text>
              <Text style={[styles.modalSelectedMeta, selected && !selectedWithinRange && userLoc ? styles.warnText : null]}>
                {selected
                  ? selectedWithinRange
                    ? `${formatDistance(selectedDistanceM)} away · within geofence ✓`
                    : selectedDistanceM != null && fenceM != null
                      ? `Out of range · ${formatDistance(selectedDistanceM)} away · need within ${formatDistance(fenceM)}`
                      : `${formatDistance(selectedDistanceM)} away`
                  : "Tap a marker to view site details"}
              </Text>
            </View>
          </View>
          <View style={[styles.modalFooter, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <Pressable style={styles.modalFootBtn} onPress={onDirections} disabled={!selected || !userLoc}>
              <Navigation size={18} color="#1A73E8" />
              <Text style={styles.modalFootBtnText}>Directions</Text>
            </Pressable>
            <Pressable style={styles.modalFootBtn} onPress={onOpenSiteInMaps} disabled={!selected}>
              <MapPinned size={18} color="#1A73E8" />
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
  loadingStrip: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12 },
  loadingText: { color: "#5F6368", fontWeight: "700" },
  card: { padding: 14, borderRadius: 18, marginBottom: 14, overflow: "hidden" },
  heroCard: {
    padding: 16,
    borderRadius: 22,
    marginBottom: 14,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(26,115,232,0.16)",
  },
  heroTopRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  heroIcon: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  heroIconActive: { backgroundColor: "#E6F4EA" },
  heroIconIdle: { backgroundColor: "#E8F0FE" },
  kicker: { fontSize: 11, fontWeight: "900", color: "#1A73E8", letterSpacing: 0.8 },
  heroTitle: { color: "#202124", fontSize: 21, fontWeight: "900", marginTop: 3, lineHeight: 26 },
  heroMetrics: { flexDirection: "row", gap: 8, marginTop: 14 },
  metricBox: {
    flex: 1,
    minHeight: 74,
    padding: 10,
    borderRadius: 16,
    backgroundColor: "rgba(248,250,252,0.92)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.07)",
  },
  metricLabel: { color: "#5F6368", fontSize: 11, fontWeight: "800", marginTop: 6 },
  metricValue: { color: "#202124", fontSize: 13, fontWeight: "900", marginTop: 2 },
  goodText: { color: "#188038" },
  warnText: { color: "#B06000" },
  heroNote: { marginTop: 12, color: "#5F6368", fontSize: 13, fontWeight: "600", lineHeight: 19 },
  permissionCard: {
    flexDirection: "row",
    gap: 10,
    padding: 14,
    borderRadius: 18,
    marginBottom: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(179,38,30,0.18)",
  },
  warnTitle: { fontWeight: "900", color: "#B3261E" },
  muted: { fontSize: 13, color: "#5F6368", marginTop: 3, lineHeight: 19 },
  sectionTitle: { fontSize: 17, fontWeight: "900", color: "#202124" },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  sectionCount: { color: "#5F6368", fontSize: 12, fontWeight: "800" },
  mapTileShadow: {
    marginBottom: 14,
    borderRadius: 24,
    ...Platform.select({
      ios: { shadowColor: "#1F2937", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.14, shadowRadius: 24 },
      android: { elevation: 8 },
    }),
  },
  mapTile: { borderRadius: 24, overflow: "hidden", borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(0,0,0,0.1)" },
  mapTopBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 14, paddingTop: 14, paddingBottom: 10 },
  mapHint: { fontSize: 12, color: "#5F6368", marginTop: 3, fontWeight: "700" },
  mapActions: { flexDirection: "row", alignItems: "center", gap: 4 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: "#E8F0FE" },
  mapCanvas: { marginHorizontal: 10, borderRadius: 20, overflow: "hidden", backgroundColor: "#EEF3F8" },
  selectedSiteCard: {
    margin: 10,
    padding: 14,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.08)",
  },
  selectedTopRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  siteBadge: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  siteBadgeGood: { backgroundColor: "#E6F4EA" },
  siteBadgeWarn: { backgroundColor: "#FEF7E0" },
  selectedTitle: { color: "#202124", fontSize: 18, fontWeight: "900" },
  selectedMeta: { color: "#5F6368", fontSize: 13, marginTop: 2, fontWeight: "700" },
  siteInfoGrid: { flexDirection: "row", gap: 8, marginTop: 12 },
  siteInfoItem: { flex: 1, padding: 10, borderRadius: 14, backgroundColor: "#F8FAFC" },
  siteInfoLabel: { color: "#6B7280", fontSize: 10, fontWeight: "900", textTransform: "uppercase" },
  siteInfoValue: { color: "#202124", fontSize: 12, fontWeight: "900", marginTop: 4 },
  siteActionRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  secondaryAction: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 11, borderRadius: 14, backgroundColor: "#E8F0FE" },
  secondaryActionText: { color: "#1A73E8", fontWeight: "900", fontSize: 13 },
  disabledText: { color: "#9AA0A6" },
  actionRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  primaryAction: { flex: 1, minHeight: 56, borderRadius: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  checkinAction: { backgroundColor: "#188038" },
  checkoutAction: { backgroundColor: "#D93025" },
  disabledAction: { backgroundColor: "#BDC1C6" },
  pressed: { opacity: 0.88 },
  primaryActionText: { color: "#FFFFFF", fontWeight: "900", fontSize: 16 },
  qrAction: { width: 76, minHeight: 56, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#DADCE0" },
  qrActionText: { color: "#1A73E8", fontWeight: "900", marginTop: 2 },
  nearbyList: { paddingBottom: 16 },
  nearbyChip: { width: 150, padding: 12, borderRadius: 16, marginRight: 10, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E5E7EB" },
  nearbyChipSelected: { backgroundColor: "#1A73E8", borderColor: "#1A73E8" },
  nearbyName: { color: "#202124", fontWeight: "900" },
  nearbyNameSelected: { color: "#FFFFFF" },
  nearbyDistance: { color: "#5F6368", fontSize: 12, fontWeight: "800", marginTop: 6 },
  nearbyDistanceSelected: { color: "rgba(255,255,255,0.86)" },
  emptyNearby: { width: 270, padding: 14, borderRadius: 16, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E5E7EB" },
  emptyTitle: { color: "#202124", fontWeight: "900" },
  segmentRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(0,0,0,0.08)" },
  segmentSite: { color: "#202124", fontWeight: "900", paddingRight: 10 },
  segmentHours: { color: "#1A73E8", fontWeight: "900" },
  dayRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(0,0,0,0.06)" },
  daySite: { flex: 1, color: "#202124", fontWeight: "900", paddingRight: 10 },
  dayValue: { color: "#1A73E8", fontWeight: "900" },
  err: { color: "#B3261E", fontWeight: "700", marginBottom: 12 },
  modalRoot: { flex: 1, backgroundColor: "#1C1C1E" },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 8, paddingVertical: 10, backgroundColor: "#1C1C1E" },
  modalClose: { padding: 8, width: 44 },
  modalTitle: { color: "#FFF", fontSize: 17, fontWeight: "800" },
  modalMapWrap: { flex: 1 },
  modalSelectedCard: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 16,
    padding: 14,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 8,
  },
  modalSelectedTitle: { color: "#202124", fontSize: 17, fontWeight: "900" },
  modalSelectedMeta: { color: "#5F6368", fontSize: 13, fontWeight: "700", marginTop: 3 },
  modalFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingTop: 10, backgroundColor: "#2C2C2E", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(255,255,255,0.12)" },
  modalFootBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 12, borderRadius: 12, marginHorizontal: 4, backgroundColor: "rgba(255,255,255,0.12)" },
  modalFootBtnText: { color: "#FFF", fontWeight: "800", fontSize: 13, marginLeft: 6 },
  modalFootBtnPrimary: { backgroundColor: "#1A73E8" },
  modalFootBtnPrimaryText: { color: "#FFF", fontWeight: "900", fontSize: 15 },
});
