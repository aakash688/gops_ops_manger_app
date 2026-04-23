import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { ArrowLeft, User, Users, Package } from "lucide-react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { apiGetJson } from "@/utils/api";

function fmtHm(t) {
  if (!t || typeof t !== "string") return "—";
  const p = t.split(":");
  return p.length >= 2 ? `${p[0]}:${p[1]}` : t;
}

function logStatus(log) {
  if (log?.punctuality === "LATE") return "LATE";
  if (log?.checkIn) return "PRESENT";
  return "—";
}

export default function Employee360() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id: idParam } = useLocalSearchParams();
  const id = useMemo(
    () => (Array.isArray(idParam) ? idParam[0] : idParam) ?? "",
    [idParam],
  );

  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  /** Start true so first focus (before `useEffect`) does not duplicate-fetch; `useEffect` sets true again when `id` changes. */
  const skipNextFocusRefreshRef = useRef(true);

  const loadSummary = useCallback(
    async (opts = { silent: false }) => {
      if (!id) return;
      const silent = opts.silent === true;
      setError(null);
      if (silent) setRefreshing(true);
      else setLoading(true);
      try {
        const { data } = await apiGetJson(`/employees/${id}/operations-summary`);
        setSummary(data);
      } catch (e) {
        setSummary(null);
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (silent) setRefreshing(false);
        else setLoading(false);
      }
    },
    [id],
  );

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setSummary(null);
      setError(null);
      return;
    }
    skipNextFocusRefreshRef.current = true;
    loadSummary({ silent: false });
  }, [id, loadSummary]);

  /** Silent refetch when returning to this screen (e.g. after marking attendance). */
  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      if (skipNextFocusRefreshRef.current) {
        skipNextFocusRefreshRef.current = false;
        return;
      }
      loadSummary({ silent: true });
    }, [id, loadSummary]),
  );

  const emp = summary?.employee;
  const teams = Array.isArray(summary?.teams) ? summary.teams : [];
  const logs = Array.isArray(summary?.lastAttendanceLogs) ? summary.lastAttendanceLogs : [];
  const penalties = summary?.penaltiesThisMonth?.items ?? [];
  const penaltyTotal = summary?.penaltiesThisMonth?.totalAmount ?? 0;
  const invItems = Array.isArray(summary?.inventoryHeld?.items) ? summary.inventoryHeld.items : [];

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#F5F5F7",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={{ fontSize: 16, color: "#666", marginTop: 12 }}>Loading profile…</Text>
      </View>
    );
  }

  if (error || !summary) {
    return (
      <View style={{ flex: 1, backgroundColor: "#F5F5F7", padding: 24, justifyContent: "center" }}>
        <Text style={{ fontSize: 16, color: "#C62828", fontWeight: "600", marginBottom: 16 }}>{error || "Not found"}</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: "#007AFF", fontSize: 16 }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#F5F5F7" }}>
      <StatusBar style="dark" />

      <View
        style={{
          paddingTop: insets.top + 16,
          paddingHorizontal: 20,
          paddingBottom: 16,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 16 }}>
          <ArrowLeft size={24} color="#000" />
        </TouchableOpacity>
        <Text style={{ fontSize: 20, fontWeight: "700", color: "#000", flex: 1 }}>Employee</Text>
        <TouchableOpacity
          onPress={() => router.push(`/penalty/add?employeeId=${encodeURIComponent(id)}`)}
          hitSlop={8}
        >
          <Text style={{ fontSize: 15, fontWeight: "600", color: "#007AFF" }}>Add penalty</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 100,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadSummary({ silent: true })}
            tintColor="#007AFF"
          />
        }
      >
        <GlassView
          style={[
            {
              padding: 20,
              borderRadius: 20,
              marginBottom: 20,
              overflow: "hidden",
            },
            isLiquidGlassAvailable()
              ? {}
              : { opacity: 0.95, backgroundColor: "#ffffff" },
          ]}
        >
          <View style={{ alignItems: "center", marginBottom: 16 }}>
            <View
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: "#007AFF",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 12,
              }}
            >
              <User size={40} color="#FFF" />
            </View>
            <Text style={{ fontSize: 22, fontWeight: "700", color: "#000", marginBottom: 4 }}>
              {emp?.employeeName ?? "—"}
            </Text>
            <Text style={{ fontSize: 15, color: "#666" }}>Code: {emp?.employeeCode ?? "—"}</Text>
          </View>

          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
              <Users size={18} color="#666" style={{ marginTop: 2 }} />
              <Text style={{ fontSize: 15, color: "#666", marginLeft: 8, flex: 1 }}>
                <Text style={{ fontWeight: "600", color: "#000" }}>Teams: </Text>
                {teams.length
                  ? teams.map((t) => t.teamName || t.teamCode).filter(Boolean).join(", ")
                  : "—"}
              </Text>
            </View>
          </View>
        </GlassView>

        <Text style={{ fontSize: 20, fontWeight: "700", color: "#000", marginBottom: 12 }}>
          Last 10 attendance logs
        </Text>
        {logs.length === 0 ? (
          <Text style={{ color: "#8E8E93", marginBottom: 20 }}>No attendance records yet.</Text>
        ) : (
          logs.map((log) => {
            const st = logStatus(log);
            const col =
              st === "LATE" ? "#FF9500" : st === "PRESENT" ? "#34C759" : "#8E8E93";
            return (
              <GlassView
                key={log.id}
                style={[
                  {
                    padding: 16,
                    borderRadius: 12,
                    marginBottom: 12,
                    overflow: "hidden",
                  },
                  isLiquidGlassAvailable() ? {} : { opacity: 0.95, backgroundColor: "#ffffff" },
                ]}
              >
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: "600", color: "#000", marginBottom: 4 }}>
                      {log.attendanceDate}
                    </Text>
                    <Text style={{ fontSize: 14, color: "#666" }}>
                      {log.clientName ? `${log.clientName} · ` : ""}
                      {log.shiftName ?? ""}
                    </Text>
                    <Text style={{ fontSize: 14, color: "#666", marginTop: 4 }}>
                      {fmtHm(log.checkIn)}
                      {log.checkOut ? ` → ${fmtHm(log.checkOut)}` : " · Open"}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 14, fontWeight: "600", color: col }}>{st}</Text>
                </View>
              </GlassView>
            );
          })
        )}

        <Text style={{ fontSize: 20, fontWeight: "700", color: "#000", marginTop: 8, marginBottom: 8 }}>
          Penalties (this month)
        </Text>
        <Text style={{ fontSize: 13, color: "#8E8E93", marginBottom: 12 }}>
          Salary DEBIT adjustments ({summary?.penaltiesThisMonth?.effectiveMonth ?? "—"} ·{" "}
          {summary?.penaltiesThisMonth?.timezone ?? ""})
        </Text>
        {penalties.length === 0 ? (
          <Text style={{ color: "#8E8E93", marginBottom: 20 }}>No debits this month.</Text>
        ) : (
          <>
            <Text style={{ fontSize: 14, fontWeight: "600", color: "#000", marginBottom: 12 }}>
              Total ₹{Number(penaltyTotal).toFixed(2)}
            </Text>
            {penalties.map((p) => (
              <GlassView
                key={p.id}
                style={[
                  {
                    padding: 16,
                    borderRadius: 12,
                    marginBottom: 12,
                    overflow: "hidden",
                  },
                  isLiquidGlassAvailable() ? {} : { opacity: 0.95, backgroundColor: "#ffffff" },
                ]}
              >
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: "600", color: "#000", marginBottom: 4 }}>
                      {p.category}
                      {p.subCategory ? ` · ${p.subCategory}` : ""}
                    </Text>
                    <Text style={{ fontSize: 14, color: "#666" }}>{p.transactionDate}</Text>
                    {p.reason ? (
                      <Text style={{ fontSize: 13, color: "#8E8E93", marginTop: 4 }}>{p.reason}</Text>
                    ) : null}
                  </View>
                  <Text style={{ fontSize: 17, fontWeight: "700", color: "#FF3B30" }}>
                    ₹{Number(p.amount).toFixed(2)}
                  </Text>
                </View>
              </GlassView>
            ))}
          </>
        )}

        <Text style={{ fontSize: 20, fontWeight: "700", color: "#000", marginTop: 8, marginBottom: 12 }}>
          Inventory held
        </Text>
        {invItems.length === 0 ? (
          <Text style={{ color: "#8E8E93" }}>No items currently held.</Text>
        ) : (
          invItems.map((item, idx) => (
            <GlassView
              key={`${item.item_code ?? "i"}-${idx}`}
              style={[
                {
                  padding: 16,
                  borderRadius: 12,
                  marginBottom: 12,
                  overflow: "hidden",
                },
                isLiquidGlassAvailable() ? {} : { opacity: 0.95, backgroundColor: "#ffffff" },
              ]}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                  <Package size={20} color="#007AFF" />
                  <View style={{ marginLeft: 12 }}>
                    <Text style={{ fontSize: 15, fontWeight: "600", color: "#000" }}>
                      {item.item_name ?? item.item_code}
                    </Text>
                    <Text style={{ fontSize: 14, color: "#666" }}>
                      Held: {item.currently_held ?? 0}
                      {item.is_returnable ? " · Returnable" : ""}
                    </Text>
                  </View>
                </View>
              </View>
            </GlassView>
          ))
        )}
      </ScrollView>
    </View>
  );
}
