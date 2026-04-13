import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Image,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import {
  ArrowLeft,
  MapPin,
  Clock,
  Tag,
  User,
  FileText,
  Calendar,
  Timer,
  Hash,
} from "lucide-react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useState, useEffect, useMemo, useCallback } from "react";
import { apiGetJson } from "@/utils/api";
import { filterImageUrls, priorityAccent, statusAccent, formatActivityTime } from "@/utils/activityStyles";

const { width: SCREEN_W } = Dimensions.get("window");
const H_PAD = 16;
const GALLERY_W = SCREEN_W - H_PAD * 2;
const GALLERY_H = 208;

function normalizeParam(p) {
  if (p == null) return "";
  if (Array.isArray(p)) return p[0] ?? "";
  return String(p);
}

function SectionLabel({ children }) {
  return (
    <Text style={styles.sectionLabel}>{children}</Text>
  );
}

function InfoTile({ label, value, icon: Icon }) {
  return (
    <GlassView
      style={[
        styles.infoTile,
        isLiquidGlassAvailable() ? {} : { opacity: 0.98, backgroundColor: "#ffffff" },
      ]}
    >
      {Icon ? <Icon size={18} color="#007AFF" style={{ marginBottom: 8 }} /> : null}
      <Text style={styles.infoTileLabel}>{label}</Text>
      <Text style={styles.infoTileValue} numberOfLines={3}>
        {value ?? "—"}
      </Text>
    </GlassView>
  );
}

export default function ActivityDetail() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id: idParam } = useLocalSearchParams();
  const activityId = useMemo(() => normalizeParam(idParam), [idParam]);
  const [row, setRow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [galleryIndex, setGalleryIndex] = useState(0);

  useEffect(() => {
    if (!activityId) {
      setLoading(false);
      setError("Missing activity id");
      setRow(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data } = await apiGetJson(`/apps/activities/${activityId}`);
        if (!cancelled) setRow(data);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load");
          setRow(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activityId]);

  const imgs = useMemo(() => (row ? filterImageUrls(row.images) : []), [row]);

  useEffect(() => {
    setGalleryIndex(0);
  }, [activityId, imgs.length]);

  const onGalleryScroll = useCallback((e) => {
    const x = e.nativeEvent.contentOffset.x;
    const next = Math.max(0, Math.round(x / GALLERY_W));
    setGalleryIndex((prev) => (prev !== next ? next : prev));
  }, []);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingHint}>Loading activity…</Text>
      </View>
    );
  }

  if (error || !row) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 20, paddingHorizontal: 20 }]}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: 16 }}>
          <ArrowLeft size={24} color="#000" />
        </TouchableOpacity>
        <Text style={{ fontSize: 16, color: "#FF3B30" }}>{error || "Not found"}</Text>
      </View>
    );
  }

  const priA = priorityAccent(row.priority);
  const stA = statusAccent(row.status);
  const loc = row.locationAddress || row.locationClientName || row.location || "—";
  const dateStr = row.scheduledDate ? String(row.scheduledDate).slice(0, 10) : "—";
  const timeStr = row.scheduledTime ? formatActivityTime(row.scheduledTime) : "—";
  const durationStr =
    row.durationMinutes != null && row.durationMinutes !== ""
      ? `${row.durationMinutes} min`
      : "—";

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 36 }}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        <LinearGradient
          colors={["#E8F2FF", "#EEF6FC", "#F5F5F7"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroGradient}
        >
          <View style={[styles.heroTop, { paddingTop: insets.top + 12 }]}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backPill} activeOpacity={0.85}>
              <ArrowLeft size={22} color="#000" />
            </TouchableOpacity>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.heroEyebrow}>ACTIVITY</Text>
              <Text style={styles.heroTitle} numberOfLines={3}>
                {row.title}
              </Text>
            </View>
          </View>

          <View style={styles.pillRow}>
            {row.activityType ? (
              <View style={[styles.pill, { backgroundColor: "rgba(0,122,255,0.14)" }]}>
                <Text style={[styles.pillText, { color: "#007AFF" }]} numberOfLines={1}>
                  {row.activityType}
                </Text>
              </View>
            ) : null}
            {row.status ? (
              <View
                style={[
                  styles.pill,
                  {
                    backgroundColor: stA.bg,
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: stA.border,
                  },
                ]}
              >
                <Text style={[styles.pillText, { color: stA.text }]} numberOfLines={1}>
                  {row.status}
                </Text>
              </View>
            ) : null}
            {row.priority ? (
              <View style={[styles.pill, { backgroundColor: priA.soft, flexDirection: "row", alignItems: "center" }]}>
                <Tag size={13} color={priA.text} />
                <Text style={[styles.pillText, { color: priA.text, marginLeft: 6 }]} numberOfLines={1}>
                  {row.priority}
                </Text>
              </View>
            ) : null}
            {row.activityCode ? (
              <View
                style={[
                  styles.pill,
                  {
                    backgroundColor: "rgba(142,142,147,0.16)",
                    flexDirection: "row",
                    alignItems: "center",
                  },
                ]}
              >
                <Hash size={13} color="#636366" />
                <Text style={[styles.pillText, { color: "#3C3C43", marginLeft: 6 }]} numberOfLines={1}>
                  {row.activityCode}
                </Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.heroSub} numberOfLines={2}>
            {loc !== "—" ? loc : "Location not on file"}
          </Text>
        </LinearGradient>

        <View style={{ paddingHorizontal: H_PAD, marginTop: 4 }}>
          {imgs.length > 0 ? (
            <GlassView
              style={[
                styles.galleryCard,
                isLiquidGlassAvailable() ? {} : { opacity: 0.97, backgroundColor: "#ffffff" },
              ]}
            >
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                nestedScrollEnabled
                onScroll={onGalleryScroll}
                scrollEventThrottle={16}
                decelerationRate="fast"
              >
                {imgs.map((uri, i) => (
                  <Image
                    key={`${uri}-${i}`}
                    source={{ uri }}
                    style={{ width: GALLERY_W, height: GALLERY_H, backgroundColor: "#E5E5EA" }}
                    resizeMode="cover"
                  />
                ))}
              </ScrollView>
              {imgs.length > 1 ? (
                <View style={styles.dotsRow}>
                  {imgs.map((_, i) => (
                    <View
                      key={i}
                      style={[styles.dot, i === galleryIndex ? styles.dotActive : styles.dotIdle]}
                    />
                  ))}
                </View>
              ) : null}
            </GlassView>
          ) : null}

          <SectionLabel>SCHEDULE</SectionLabel>
          <Text style={styles.blockTitle}>When & duration</Text>
          <View style={styles.tileRow}>
            <InfoTile label="Date" value={dateStr} icon={Calendar} />
            <InfoTile label="Time" value={timeStr} icon={Clock} />
            <InfoTile label="Duration" value={durationStr} icon={Timer} />
          </View>

          <SectionLabel>LOCATION</SectionLabel>
          <GlassView
            style={[
              styles.locationCard,
              isLiquidGlassAvailable() ? {} : { opacity: 0.97, backgroundColor: "#ffffff" },
            ]}
          >
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
              <MapPin size={20} color="#007AFF" />
              <Text style={styles.cardHeading}>Site & address</Text>
            </View>
            <Text style={styles.locationBody}>{loc}</Text>
            <View
              style={[
                styles.leftAccent,
                { backgroundColor: priA.border, marginTop: 14 },
              ]}
            />
          </GlassView>

          <SectionLabel>ASSIGNMENT</SectionLabel>
          <GlassView
            style={[
              styles.assignCard,
              isLiquidGlassAvailable() ? {} : { opacity: 0.97, backgroundColor: "#ffffff" },
            ]}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View style={styles.assignIconWrap}>
                <User size={22} color="#007AFF" />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.assignLabel}>Assigned to</Text>
                <Text style={styles.assignName} numberOfLines={2}>
                  {row.assignedToEmployeeName || "Unassigned"}
                </Text>
              </View>
            </View>
          </GlassView>

          {row.description ? (
            <>
              <SectionLabel>BRIEF</SectionLabel>
              <GlassView
                style={[
                  styles.proseCard,
                  isLiquidGlassAvailable() ? {} : { opacity: 0.97, backgroundColor: "#ffffff" },
                ]}
              >
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
                  <FileText size={20} color="#007AFF" />
                  <Text style={styles.cardHeading}>Description</Text>
                </View>
                <Text style={styles.prose}>{row.description}</Text>
              </GlassView>
            </>
          ) : null}

          {row.notes ? (
            <>
              <SectionLabel>FIELD NOTES</SectionLabel>
              <GlassView
                style={[
                  styles.notesCard,
                  isLiquidGlassAvailable() ? {} : { opacity: 0.97, backgroundColor: "#ffffff" },
                ]}
              >
                <Text style={styles.notesLabel}>Internal notes</Text>
                <Text style={styles.prose}>{row.notes}</Text>
              </GlassView>
            </>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F5F5F7" },
  centered: {
    flex: 1,
    backgroundColor: "#F5F5F7",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingHint: { marginTop: 12, fontSize: 15, color: "#666" },
  heroGradient: {
    paddingHorizontal: 20,
    paddingBottom: 22,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,122,255,0.1)",
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  backPill: {
    marginRight: 12,
    padding: 8,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.75)",
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: "800",
    color: "#007AFF",
    letterSpacing: 1,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#000",
    marginTop: 6,
    lineHeight: 28,
  },
  heroSub: {
    marginTop: 14,
    fontSize: 14,
    color: "#3C3C43",
    lineHeight: 20,
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -4,
 },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
    marginLeft: 4,
    maxWidth: SCREEN_W * 0.92,
  },
  pillText: { fontSize: 12, fontWeight: "800" },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#007AFF",
    letterSpacing: 0.8,
    marginTop: 22,
    marginBottom: 8,
  },
  blockTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#000",
    marginBottom: 12,
  },
  tileRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -4,
  },
  infoTile: {
    flex: 1,
    minWidth: "30%",
    maxWidth: "50%",
    padding: 14,
    borderRadius: 16,
    marginBottom: 10,
    marginHorizontal: 4,
    overflow: "hidden",
  },
  infoTileLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#8E8E93",
    marginBottom: 4,
  },
  infoTileValue: {
    fontSize: 15,
    fontWeight: "700",
    color: "#000",
  },
  galleryCard: {
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 18,
    overflow: "hidden",
    padding: 0,
  },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 10,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginHorizontal: 3,
  },
  dotActive: { backgroundColor: "#007AFF", transform: [{ scale: 1.15 }] },
  dotIdle: { backgroundColor: "rgba(0,122,255,0.25)" },
  locationCard: {
    padding: 18,
    borderRadius: 18,
    marginBottom: 4,
    overflow: "hidden",
    borderLeftWidth: 5,
    borderLeftColor: "#007AFF",
  },
  leftAccent: {
    height: 3,
    borderRadius: 2,
    opacity: 0.35,
  },
  cardHeading: {
    fontSize: 16,
    fontWeight: "800",
    color: "#000",
    marginLeft: 8,
  },
  locationBody: {
    fontSize: 15,
    color: "#636366",
    lineHeight: 22,
  },
  assignCard: {
    padding: 18,
    borderRadius: 18,
    marginBottom: 4,
    overflow: "hidden",
    borderLeftWidth: 5,
    borderLeftColor: "#34C759",
  },
  assignIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "rgba(0,122,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  assignLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#8E8E93",
  },
  assignName: {
    fontSize: 17,
    fontWeight: "800",
    color: "#000",
    marginTop: 4,
  },
  proseCard: {
    padding: 18,
    borderRadius: 18,
    marginBottom: 4,
    overflow: "hidden",
    borderLeftWidth: 5,
    borderLeftColor: "#FF9500",
  },
  notesCard: {
    padding: 18,
    borderRadius: 18,
    overflow: "hidden",
    borderLeftWidth: 5,
    borderLeftColor: "#5856D6",
    marginBottom: 8,
  },
  notesLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#8E8E93",
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  prose: {
    fontSize: 15,
    color: "#3C3C43",
    lineHeight: 24,
  },
});
