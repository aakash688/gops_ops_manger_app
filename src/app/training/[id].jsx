import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
  StyleSheet,
  Platform,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  Building2,
  Sparkles,
} from "lucide-react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { fetchTrainingById } from "@/utils/trainings";

const PALETTE = {
  bg: "#F1F5F9",
  card: "#FFFFFF",
  border: "#E2E8F0",
  text: "#0F172A",
  muted: "#64748B",
  faint: "#94A3B8",
};

function formatDate(d) {
  if (!d) return null;
  const s = typeof d === "string" ? d.slice(0, 10) : d;
  const t = new Date(s);
  if (Number.isNaN(t.getTime())) return null;
  return t.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function statusPresentation(st) {
  const label = (st || "—").replace(/_/g, " ").toLowerCase();
  switch (st) {
    case "COMPLETED":
      return { label, tone: "#059669", soft: "#ECFDF5" };
    case "SCHEDULED":
      return { label, tone: "#2563EB", soft: "#EFF6FF" };
    case "IN_PROGRESS":
      return { label, tone: "#D97706", soft: "#FFFBEB" };
    case "CANCELLED":
      return { label, tone: "#64748B", soft: "#F8FAFC" };
    case "PENDING":
      return { label, tone: "#7C3AED", soft: "#F5F3FF" };
    default:
      return { label, tone: "#475569", soft: "#F1F5F9" };
  }
}

function StatTile({ icon: Icon, label, value }) {
  if (!value) return null;
  return (
    <View style={tileStyles.tile}>
      <Icon size={18} color="#6366F1" strokeWidth={2} />
      <Text style={tileStyles.tileLabel}>{label}</Text>
      <Text style={tileStyles.tileValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function PersonBlock({ role, primary, secondary }) {
  if (!primary && !secondary) return null;
  return (
    <View style={detailStyles.personBlock}>
      <Text style={detailStyles.personRole}>{role}</Text>
      <Text style={detailStyles.personPrimary}>{primary || "—"}</Text>
      {secondary ? <Text style={detailStyles.personSecondary}>{secondary}</Text> : null}
    </View>
  );
}

export default function TrainingDetailScreen() {
  const { id } = useLocalSearchParams();
  const tid = typeof id === "string" ? id : id?.[0];
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [row, setRow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const load = useCallback(async () => {
    if (!tid) return;
    setErr(null);
    setLoading(true);
    try {
      const { data } = await fetchTrainingById(tid);
      setRow(data && typeof data === "object" ? data : null);
    } catch (e) {
      setRow(null);
      setErr(e instanceof Error ? e.message : "Not found");
    } finally {
      setLoading(false);
    }
  }, [tid]);

  useEffect(() => {
    load();
  }, [load]);

  const client = row?.client;
  const trainerEmp = row?.trainerEmployee;
  const attendee = row?.employee;
  const st = row?.status || "";
  const badge = statusPresentation(st);

  const scheduleDateRaw = row?.scheduleDate || row?.startDate;
  const dateFormatted = scheduleDateRaw ? formatDate(scheduleDateRaw) : null;
  const timeRange =
    row?.startTime || row?.endTime
      ? [row?.startTime, row?.endTime].filter(Boolean).join(" → ")
      : null;

  const photoUrls = Array.isArray(row?.completionPhotos)
    ? row.completionPhotos.map((p) => (typeof p === "string" ? p : p?.url)).filter(Boolean)
    : [];

  const thumbW = Math.min(width - 80, 280);

  const hasStatTiles = Boolean(
    dateFormatted || timeRange || row?.duration || row?.location || row?.site,
  );

  return (
    <View style={detailStyles.screen}>
      <StatusBar style="light" />

      {/* Hero */}
      <LinearGradient
        colors={["#1E1B4B", "#4338CA", "#6366F1"]}
        locations={[0, 0.45, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[detailStyles.heroGradient, { paddingTop: insets.top + 8 }]}
      >
        <Pressable onPress={() => router.back()} style={detailStyles.backFab} hitSlop={16}>
          <ArrowLeft size={22} color="#FFFFFF" strokeWidth={2.2} />
        </Pressable>

        {loading ? (
          <View style={detailStyles.heroLoading}>
            <ActivityIndicator color="#FFFFFF" size="large" />
            <Text style={detailStyles.heroLoadingText}>Fetching session…</Text>
          </View>
        ) : err ? (
          <View style={detailStyles.heroError}>
            <Text style={detailStyles.heroErrorTitle}>Something went wrong</Text>
            <Text style={detailStyles.heroErrorBody}>{err}</Text>
          </View>
        ) : (
          <>
            {row?.company?.name ? (
              <Text style={detailStyles.heroKicker}>{row.company.name}</Text>
            ) : (
              <Text style={detailStyles.heroKicker}>Training session</Text>
            )}
            <Text style={detailStyles.heroTitle}>{row?.title || "Training"}</Text>

            <View style={detailStyles.heroChips}>
              <View style={[detailStyles.statusChip, { backgroundColor: badge.soft }]}>
                <Sparkles size={13} color={badge.tone} strokeWidth={2} />
                <Text style={[detailStyles.statusChipText, { color: badge.tone }]}>{badge.label}</Text>
              </View>
              {row?.trainingType ? (
                <View style={detailStyles.dimChip}>
                  <Text style={detailStyles.dimChipText}>{row.trainingType}</Text>
                </View>
              ) : null}
              {row?.category ? (
                <View style={detailStyles.dimChip}>
                  <Text style={detailStyles.dimChipText}>{row.category}</Text>
                </View>
              ) : null}
            </View>
          </>
        )}
      </LinearGradient>

      {/* Sheet */}
      {!loading && !err && row ? (
        <ScrollView
          style={detailStyles.sheet}
          contentContainerStyle={[detailStyles.sheetContent, { paddingBottom: insets.bottom + 28 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* At a glance */}
          {hasStatTiles ? (
            <>
              <Text style={detailStyles.sectionEyebrow}>At a glance</Text>
              <View style={detailStyles.statGrid}>
                <StatTile icon={Calendar} label="Date" value={dateFormatted} />
                <StatTile icon={Clock} label="Time" value={timeRange || null} />
                <StatTile icon={Clock} label="Duration" value={row.duration || null} />
                <StatTile icon={MapPin} label="Venue" value={row.location || row.site || null} />
              </View>
            </>
          ) : null}

          {/* About */}
          {row.description ? (
            <View style={detailStyles.block}>
              <Text style={detailStyles.blockTitle}>About</Text>
              <Text style={detailStyles.aboutText}>{String(row.description).trim()}</Text>
            </View>
          ) : null}

          {/* Location */}
          {(row.location || row.site) ? (
            <View style={detailStyles.block}>
              <Text style={detailStyles.blockTitle}>Location</Text>
              <View style={detailStyles.locationCard}>
                <MapPin size={20} color="#6366F1" strokeWidth={2} />
                <View style={{ flex: 1 }}>
                  {row.location ? <Text style={detailStyles.locationPrimary}>{row.location}</Text> : null}
                  {row.site ? <Text style={detailStyles.locationSecondary}>{row.site}</Text> : null}
                </View>
              </View>
            </View>
          ) : null}

          {/* People */}
          {(row.trainerName || trainerEmp || attendee) && (
            <View style={detailStyles.block}>
              <Text style={detailStyles.blockTitle}>People</Text>
              <View style={detailStyles.peopleCard}>
                {(row.trainerName || trainerEmp) ? (
                  <PersonBlock
                    role="Trainer"
                    primary={row.trainerName || trainerEmp?.employeeName || null}
                    secondary={
                      trainerEmp
                        ? [trainerEmp.employeeCode, trainerEmp.employeeName].filter(Boolean).join(" · ")
                        : null
                    }
                  />
                ) : null}
                {(row.trainerName || trainerEmp) && attendee ? <View style={detailStyles.peopleDivider} /> : null}
                {attendee ? (
                  <PersonBlock
                    role="Attendee"
                    primary={attendee.employeeName || null}
                    secondary={attendee.employeeCode ? String(attendee.employeeCode) : null}
                  />
                ) : null}
              </View>
            </View>
          )}

          {/* Client */}
          {(client?.clientName || client?.clientCode || client?.address) && (
            <View style={detailStyles.block}>
              <Text style={detailStyles.blockTitle}>Client site</Text>
              <View style={detailStyles.clientCard}>
                <Building2 size={22} color="#475569" strokeWidth={2} />
                <View style={{ flex: 1 }}>
                  <Text style={detailStyles.clientName}>{client.clientName || client.clientCode}</Text>
                  {client.address ? (
                    <Text style={detailStyles.clientAddress}>{client.address}</Text>
                  ) : null}
                </View>
              </View>
            </View>
          )}

          {/* Photos */}
          {photoUrls.length > 0 ? (
            <View style={[detailStyles.block, { marginBottom: 8 }]}>
              <Text style={detailStyles.blockTitle}>Documentation</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={detailStyles.photoStrip}>
                {photoUrls.map((uri) => (
                  <Image
                    key={uri}
                    source={{ uri }}
                    style={[detailStyles.photoThumb, { width: thumbW }]}
                    contentFit="cover"
                    transition={200}
                  />
                ))}
              </ScrollView>
            </View>
          ) : null}

          <Text style={detailStyles.footer}>Read-only · contact ops to request changes</Text>
        </ScrollView>
      ) : null}
    </View>
  );
}

const detailStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: PALETTE.bg,
  },
  heroGradient: {
    paddingHorizontal: 20,
    paddingBottom: 56,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  backFab: {
    alignSelf: "flex-start",
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  heroLoading: {
    paddingVertical: 36,
    alignItems: "center",
    gap: 12,
  },
  heroLoadingText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 15,
    fontWeight: "600",
  },
  heroError: {
    paddingVertical: 24,
  },
  heroErrorTitle: {
    color: "#FECACA",
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 8,
  },
  heroErrorBody: {
    color: "rgba(255,255,255,0.88)",
    fontSize: 15,
    lineHeight: 22,
  },
  heroKicker: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginTop: 8,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.6,
    lineHeight: 32,
    marginTop: 10,
    maxWidth: "100%",
  },
  heroChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 16,
    alignItems: "center",
  },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  statusChipText: {
    fontSize: 13,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  dimChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.22)",
  },
  dimChipText: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 13,
    fontWeight: "600",
  },
  sheet: {
    flex: 1,
    marginTop: -28,
    backgroundColor: PALETTE.bg,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#0F172A",
        shadowOpacity: 0.12,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: -4 },
      },
      android: { elevation: 8 },
    }),
  },
  sheetContent: {
    paddingHorizontal: 20,
    paddingTop: 22,
  },
  sectionEyebrow: {
    fontSize: 12,
    fontWeight: "700",
    color: PALETTE.faint,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  statGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  block: {
    marginBottom: 22,
  },
  blockTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: PALETTE.text,
    marginBottom: 12,
    letterSpacing: -0.2,
  },
  aboutText: {
    fontSize: 16,
    lineHeight: 26,
    color: PALETTE.text,
    backgroundColor: PALETTE.card,
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: PALETTE.border,
    overflow: "hidden",
  },
  locationCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    backgroundColor: PALETTE.card,
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: PALETTE.border,
  },
  locationPrimary: {
    fontSize: 16,
    fontWeight: "700",
    color: PALETTE.text,
    marginBottom: 4,
  },
  locationSecondary: {
    fontSize: 14,
    color: PALETTE.muted,
    lineHeight: 20,
  },
  peopleCard: {
    backgroundColor: PALETTE.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: PALETTE.border,
    paddingVertical: 6,
    overflow: "hidden",
  },
  personBlock: {
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  personRole: {
    fontSize: 11,
    fontWeight: "700",
    color: PALETTE.faint,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  personPrimary: {
    fontSize: 17,
    fontWeight: "700",
    color: PALETTE.text,
  },
  personSecondary: {
    fontSize: 14,
    color: PALETTE.muted,
    marginTop: 4,
  },
  peopleDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: PALETTE.border,
    marginHorizontal: 18,
  },
  clientCard: {
    flexDirection: "row",
    gap: 14,
    alignItems: "flex-start",
    backgroundColor: PALETTE.card,
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: PALETTE.border,
  },
  clientName: {
    fontSize: 17,
    fontWeight: "700",
    color: PALETTE.text,
    marginBottom: 6,
  },
  clientAddress: {
    fontSize: 14,
    lineHeight: 21,
    color: PALETTE.muted,
  },
  photoStrip: {
    gap: 12,
    paddingVertical: 4,
  },
  photoThumb: {
    height: 156,
    borderRadius: 14,
    backgroundColor: PALETTE.border,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.08,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 3 },
    }),
  },
  footer: {
    textAlign: "center",
    fontSize: 12,
    color: PALETTE.faint,
    marginTop: 8,
    marginBottom: 8,
    fontWeight: "500",
  },
});

const tileStyles = StyleSheet.create({
  tile: {
    width: "47.8%",
    backgroundColor: PALETTE.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: PALETTE.border,
    gap: 8,
    ...Platform.select({
      ios: {
        shadowColor: "#64748B",
        shadowOpacity: 0.06,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 2 },
    }),
  },
  tileLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: PALETTE.faint,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  tileValue: {
    fontSize: 15,
    fontWeight: "700",
    color: PALETTE.text,
    lineHeight: 20,
  },
});
