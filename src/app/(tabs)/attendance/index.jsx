import {
  View,
  Text,
  ScrollView,
  Pressable,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react-native";
import { useRouter } from "expo-router";
import { useState, useEffect, useCallback } from "react";
import { apiGetJson } from "@/utils/api";

function fmtTime(isoTime) {
  if (!isoTime || typeof isoTime !== "string") return null;
  const parts = isoTime.split(":");
  if (parts.length >= 2) return `${parts[0]}:${parts[1]}`;
  return isoTime;
}

/** Derive card status from attendance record row (org list API). */
function rowStatus(row) {
  const p = row?.punctuality;
  if (p === "LATE") return "LATE";
  if (!row?.checkInTime) return "ABSENT";
  if (p === "EARLY" || p === "ON_TIME") return "PRESENT";
  return "PRESENT";
}

function summarizeRows(rows) {
  let present = 0;
  let late = 0;
  let absent = 0;
  for (const r of rows) {
    const s = rowStatus(r);
    if (s === "LATE") late += 1;
    else if (s === "ABSENT") absent += 1;
    else present += 1;
  }
  return { present, late, absent };
}

export default function Attendance() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({ present: 0, absent: 0, late: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchAttendance = useCallback(async () => {
    setError(null);
    const dateStr = selectedDate.toISOString().split("T")[0];
    try {
      const params = new URLSearchParams({
        attendanceDate: dateStr,
        limit: "100",
        offset: "0",
      });
      const { data } = await apiGetJson(`/attendance-records?${params.toString()}`);
      const list = Array.isArray(data) ? data : [];
      setRows(list);
      setSummary(summarizeRows(list));
    } catch (e) {
      setRows([]);
      setSummary({ present: 0, absent: 0, late: 0 });
      setError(e instanceof Error ? e.message : "Could not load attendance");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    setLoading(true);
    void fetchAttendance();
  }, [fetchAttendance]);

  const formatDate = (date) =>
    date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  const changeDate = (days) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + days);
    setSelectedDate(newDate);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "PRESENT":
        return "#34C759";
      case "ABSENT":
        return "#FF3B30";
      case "LATE":
        return "#FF9500";
      default:
        return "#666";
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "PRESENT":
        return CheckCircle;
      case "ABSENT":
        return XCircle;
      case "LATE":
        return Clock;
      default:
        return CheckCircle;
    }
  };

  const GuardCard = ({ row }) => {
    const status = rowStatus(row);
    const StatusIcon = getStatusIcon(status);
    const name = row?.employee?.employeeName ?? row?.employee?.employeeCode ?? "Employee";
    const site = row?.client?.clientName ?? "—";
    const shift = row?.shift ?? row?.attendanceMaster?.name ?? "—";
    const checkIn = fmtTime(row?.checkInTime);
    const checkOut = fmtTime(row?.checkOutTime);
    const empId = row?.employeeId;

    return (
      <Pressable
        onPress={() => {
          if (empId) router.push(`/employee/${empId}`);
        }}
        style={({ pressed }) => ({
          opacity: pressed ? 0.8 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
          marginBottom: 12,
        })}
      >
        <GlassView
          isInteractive={true}
          style={[
            {
              padding: 16,
              borderRadius: 16,
              overflow: "hidden",
            },
            isLiquidGlassAvailable()
              ? {}
              : { opacity: 0.95, backgroundColor: "#ffffff" },
          ]}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 17,
                  fontWeight: "600",
                  color: "#000",
                  marginBottom: 4,
                }}
              >
                {name}
              </Text>
              <Text style={{ fontSize: 14, color: "#666", marginBottom: 8 }}>
                {site} • {shift}
              </Text>
              {checkIn ? (
                <Text style={{ fontSize: 13, color: "#999" }}>
                  In: {checkIn}
                  {checkOut ? ` · Out: ${checkOut}` : " · Still on site"}
                </Text>
              ) : (
                <Text style={{ fontSize: 13, color: "#999" }}>
                  No check-in on file
                </Text>
              )}
            </View>
            <View style={{ alignItems: "center" }}>
              <StatusIcon size={24} color={getStatusColor(status)} />
              <Text
                style={{
                  fontSize: 12,
                  color: getStatusColor(status),
                  marginTop: 4,
                  fontWeight: "600",
                }}
              >
                {status}
              </Text>
            </View>
          </View>
        </GlassView>
      </Pressable>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#F5F5F7" }}>
      <StatusBar style="dark" />

      <View
        style={{
          paddingHorizontal: 20,
          paddingTop: insets.top + 20,
          paddingBottom: 16,
        }}
      >
        <Text style={{ fontSize: 32, fontWeight: "700", color: "#000" }}>
          Attendance
        </Text>
        <Text style={{ fontSize: 13, color: "#8E8E93", marginTop: 6 }}>
          Field sessions for the selected day (from attendance records)
        </Text>
      </View>

      <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
        <GlassView
          style={[
            {
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingVertical: 12,
              paddingHorizontal: 16,
              borderRadius: 12,
              overflow: "hidden",
            },
            isLiquidGlassAvailable()
              ? {}
              : { opacity: 0.95, backgroundColor: "#ffffff" },
          ]}
        >
          <TouchableOpacity onPress={() => changeDate(-1)} style={{ padding: 4 }}>
            <ChevronLeft size={24} color="#007AFF" />
          </TouchableOpacity>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Calendar size={20} color="#000" />
            <Text
              style={{
                fontSize: 16,
                fontWeight: "600",
                color: "#000",
                marginLeft: 8,
              }}
            >
              {formatDate(selectedDate)}
            </Text>
          </View>
          <TouchableOpacity onPress={() => changeDate(1)} style={{ padding: 4 }}>
            <ChevronRight size={24} color="#007AFF" />
          </TouchableOpacity>
        </GlassView>
      </View>

      <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <GlassView
            style={[
              {
                flex: 1,
                padding: 12,
                borderRadius: 12,
                alignItems: "center",
                overflow: "hidden",
              },
              isLiquidGlassAvailable()
                ? {}
                : { opacity: 0.95, backgroundColor: "#ffffff" },
            ]}
          >
            <Text style={{ fontSize: 24, fontWeight: "700", color: "#34C759" }}>
              {summary.present}
            </Text>
            <Text style={{ fontSize: 12, color: "#666", marginTop: 2 }}>
              Present
            </Text>
          </GlassView>
          <GlassView
            style={[
              {
                flex: 1,
                padding: 12,
                borderRadius: 12,
                alignItems: "center",
                overflow: "hidden",
              },
              isLiquidGlassAvailable()
                ? {}
                : { opacity: 0.95, backgroundColor: "#ffffff" },
            ]}
          >
            <Text style={{ fontSize: 24, fontWeight: "700", color: "#FF3B30" }}>
              {summary.absent}
            </Text>
            <Text style={{ fontSize: 12, color: "#666", marginTop: 2 }}>
              No check-in
            </Text>
          </GlassView>
          <GlassView
            style={[
              {
                flex: 1,
                padding: 12,
                borderRadius: 12,
                alignItems: "center",
                overflow: "hidden",
              },
              isLiquidGlassAvailable()
                ? {}
                : { opacity: 0.95, backgroundColor: "#ffffff" },
            ]}
          >
            <Text style={{ fontSize: 24, fontWeight: "700", color: "#FF9500" }}>
              {summary.late}
            </Text>
            <Text style={{ fontSize: 12, color: "#666", marginTop: 2 }}>
              Late
            </Text>
          </GlassView>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 140,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void fetchAttendance();
            }}
          />
        }
      >
        {loading ? (
          <View style={{ paddingVertical: 32, alignItems: "center" }}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={{ marginTop: 12, color: "#666" }}>Loading attendance…</Text>
          </View>
        ) : error ? (
          <Text style={{ color: "#C62828", fontWeight: "600", marginBottom: 12 }}>{error}</Text>
        ) : null}

        {!loading && !error && rows.length === 0 ? (
          <GlassView
            style={[
              {
                padding: 24,
                borderRadius: 14,
                alignItems: "center",
                overflow: "hidden",
              },
              isLiquidGlassAvailable() ? {} : { backgroundColor: "#fff", opacity: 0.96 },
            ]}
          >
            <Text style={{ fontSize: 15, color: "#666", textAlign: "center" }}>
              No attendance records for this date.
            </Text>
          </GlassView>
        ) : null}

        {!loading && rows.length > 0 ? (
          <>
            <Text
              style={{
                fontSize: 20,
                fontWeight: "700",
                color: "#000",
                marginBottom: 12,
              }}
            >
              Records ({rows.length})
            </Text>
            {rows.map((row) => (
              <GuardCard key={row.id} row={row} />
            ))}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}
