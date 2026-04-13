import {
  View,
  Text,
  ScrollView,
  Pressable,
  TouchableOpacity,
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
import { useState, useEffect } from "react";
import FloatingActionButton from "@/components/FloatingActionButton";

export default function Attendance() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [guards, setGuards] = useState([]);
  const [summary, setSummary] = useState({ present: 0, absent: 0, late: 0 });

  useEffect(() => {
    fetchAttendance();
  }, [selectedDate]);

  const fetchAttendance = async () => {
    try {
      const dateStr = selectedDate.toISOString().split("T")[0];
      const response = await fetch(`/api/attendance?date=${dateStr}`);
      if (response.ok) {
        const data = await response.json();
        setGuards(data.guards);
        setSummary(data.summary);
        return;
      }
    } catch {
      // Offline or API unavailable
    }
    setGuards([
        {
          id: 1,
          name: "Rajesh Kumar",
          status: "PRESENT",
          site: "Warehouse 2",
          shift: "Night",
          checkIn: "18:00",
        },
        {
          id: 2,
          name: "Amit Singh",
          status: "PRESENT",
          site: "Office Complex",
          shift: "Day",
          checkIn: "08:00",
        },
        {
          id: 3,
          name: "Priya Sharma",
          status: "ABSENT",
          site: "Mall Entrance",
          shift: "Day",
          checkIn: null,
        },
        {
          id: 4,
          name: "Vijay Patel",
          status: "LATE",
          site: "Factory Gate",
          shift: "Day",
          checkIn: "08:45",
        },
      ]);
    setSummary({ present: 2, absent: 1, late: 1 });
  };

  const formatDate = (date) => {
    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

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

  const GuardCard = ({ guard }) => {
    const StatusIcon = getStatusIcon(guard.status);
    return (
      <Pressable
        onPress={() => router.push(`/attendance/${guard.id}`)}
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
                {guard.name}
              </Text>
              <Text style={{ fontSize: 14, color: "#666", marginBottom: 8 }}>
                {guard.site} • {guard.shift} Shift
              </Text>
              {guard.checkIn && (
                <Text style={{ fontSize: 13, color: "#999" }}>
                  Check-in: {guard.checkIn}
                </Text>
              )}
            </View>
            <View style={{ alignItems: "center" }}>
              <StatusIcon size={24} color={getStatusColor(guard.status)} />
              <Text
                style={{
                  fontSize: 12,
                  color: getStatusColor(guard.status),
                  marginTop: 4,
                  fontWeight: "600",
                }}
              >
                {guard.status}
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

      {/* Header */}
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
      </View>

      {/* Date Selector */}
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
          <TouchableOpacity
            onPress={() => changeDate(-1)}
            style={{ padding: 4 }}
          >
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
          <TouchableOpacity
            onPress={() => changeDate(1)}
            style={{ padding: 4 }}
          >
            <ChevronRight size={24} color="#007AFF" />
          </TouchableOpacity>
        </GlassView>
      </View>

      {/* Summary */}
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
              Absent
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

      {/* Bulk Actions - NEW */}
      <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
        <Text
          style={{
            fontSize: 16,
            fontWeight: "600",
            color: "#000",
            marginBottom: 12,
          }}
        >
          Bulk Actions
        </Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable
            onPress={async () => {
              try {
                const dateStr = selectedDate.toISOString().split("T")[0];
                const response = await fetch("/api/attendance/bulk", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ date: dateStr, status: "PRESENT" }),
                });
                if (response.ok) {
                  fetchAttendance();
                }
              } catch (error) {
                console.error(error);
              }
            }}
            style={({ pressed }) => ({
              flex: 1,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <GlassView
              isInteractive={true}
              style={[
                {
                  padding: 12,
                  borderRadius: 12,
                  alignItems: "center",
                  overflow: "hidden",
                },
                isLiquidGlassAvailable()
                  ? {}
                  : { opacity: 0.95, backgroundColor: "#34C759" },
              ]}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "600",
                  color: isLiquidGlassAvailable() ? "#000" : "#FFF",
                }}
              >
                Mark All Present
              </Text>
            </GlassView>
          </Pressable>
          <Pressable
            onPress={async () => {
              try {
                const dateStr = selectedDate.toISOString().split("T")[0];
                const response = await fetch("/api/attendance/bulk", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ date: dateStr, status: "ABSENT" }),
                });
                if (response.ok) {
                  fetchAttendance();
                }
              } catch (error) {
                console.error(error);
              }
            }}
            style={({ pressed }) => ({
              flex: 1,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <GlassView
              isInteractive={true}
              style={[
                {
                  padding: 12,
                  borderRadius: 12,
                  alignItems: "center",
                  overflow: "hidden",
                },
                isLiquidGlassAvailable()
                  ? {}
                  : { opacity: 0.95, backgroundColor: "#FF3B30" },
              ]}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "600",
                  color: isLiquidGlassAvailable() ? "#000" : "#FFF",
                }}
              >
                Mark All Absent
              </Text>
            </GlassView>
          </Pressable>
        </View>
      </View>

      {/* Guard List */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 140,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text
          style={{
            fontSize: 20,
            fontWeight: "700",
            color: "#000",
            marginBottom: 12,
          }}
        >
          Guard List
        </Text>
        {guards.map((guard) => (
          <GuardCard key={guard.id} guard={guard} />
        ))}
      </ScrollView>

      <FloatingActionButton />
    </View>
  );
}
