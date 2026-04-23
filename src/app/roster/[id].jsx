import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { ArrowLeft, Building2, Calendar, Clock, Users } from "lucide-react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { apiGetJson } from "@/utils/api";

export default function RosterDetailScreen() {
  const { id } = useLocalSearchParams();
  const rosterId = Array.isArray(id) ? id[0] : id;
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState(null);

  const load = useCallback(async () => {
    if (!rosterId) return;
    setErr(null);
    setLoading(true);
    try {
      const { data: d } = await apiGetJson(`/apps/operations-manager/rosters/${rosterId}`);
      setData(d ?? null);
    } catch (e) {
      setData(null);
      setErr(e instanceof Error ? e.message : "Failed to load roster");
    } finally {
      setLoading(false);
    }
  }, [rosterId]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const members = data?.members?.items ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: "#F5F5F7" }}>
      <StatusBar style="dark" />
      <View
        style={{
          paddingTop: insets.top + 12,
          paddingHorizontal: 20,
          paddingBottom: 12,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
          <ArrowLeft size={24} color="#000" />
        </TouchableOpacity>
        <Text style={{ fontSize: 20, fontWeight: "700", color: "#000", flex: 1 }} numberOfLines={1}>
          Roster detail
        </Text>
      </View>

      {loading && !data ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#007AFF" />
      ) : err ? (
        <Text style={{ paddingHorizontal: 20, color: "#C62828" }}>{err}</Text>
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: insets.bottom + 32,
          }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <GlassView
            style={[
              { padding: 16, borderRadius: 14, marginBottom: 16, overflow: "hidden" },
              isLiquidGlassAvailable() ? {} : { backgroundColor: "#fff", opacity: 0.98 },
            ]}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <Building2 size={20} color="#007AFF" />
              <Text style={{ fontSize: 18, fontWeight: "700", color: "#000" }} numberOfLines={2}>
                {data?.clientName ?? "Client"}
              </Text>
            </View>
            <Text style={{ fontSize: 14, color: "#8E8E93", marginBottom: 8 }}>
              {data?.teamName ?? "—"} {data?.teamCode ? `· ${data.teamCode}` : ""}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Clock size={16} color="#666" />
              <Text style={{ fontSize: 15, color: "#000" }}>
                {data?.shiftName ?? "Shift"}{" "}
                {data?.shiftStartTime && data?.shiftEndTime
                  ? `(${data.shiftStartTime}–${data.shiftEndTime})`
                  : ""}
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Calendar size={16} color="#666" />
              <Text style={{ fontSize: 15, color: "#000" }}>
                {data?.assignment?.startDate} → {data?.assignment?.endDate}
              </Text>
            </View>
            <View
              style={{
                alignSelf: "flex-start",
                marginTop: 12,
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 8,
                backgroundColor: data?.status === "inactive" ? "#FFEBEE" : "#E8F5E9",
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "700",
                  color: data?.status === "inactive" ? "#C62828" : "#2E7D32",
                  textTransform: "uppercase",
                }}
              >
                {data?.status ?? "—"}
              </Text>
            </View>
          </GlassView>

          <Text style={{ fontSize: 15, fontWeight: "700", color: "#000", marginBottom: 10 }}>
            Assigned guards ({members.length})
          </Text>
          {members.map((m) => (
            <GlassView
              key={m.employeeId}
              style={[
                {
                  padding: 14,
                  borderRadius: 12,
                  marginBottom: 8,
                  overflow: "hidden",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                },
                isLiquidGlassAvailable() ? {} : { backgroundColor: "#fff", opacity: 0.98 },
              ]}
            >
              <Users size={18} color="#007AFF" />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 16, fontWeight: "600", color: "#000" }} numberOfLines={1}>
                  {m.employeeName ?? "—"}
                </Text>
                <Text style={{ fontSize: 13, color: "#8E8E93", marginTop: 2 }} numberOfLines={1}>
                  {[m.designationName, m.employeeCode].filter(Boolean).join(" · ")}
                </Text>
              </View>
            </GlassView>
          ))}

          {data?.supervisor?.employeeName ? (
            <Text style={{ fontSize: 13, color: "#8E8E93", marginTop: 16 }}>
              Supervisor: {data.supervisor.employeeName}
            </Text>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}
