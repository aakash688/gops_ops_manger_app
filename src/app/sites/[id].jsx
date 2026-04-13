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
  ArrowLeft,
  MapPin,
  Users,
  CheckCircle,
  XCircle,
  AlertCircle,
  Ticket,
  ClipboardCheck,
  QrCode,
  DollarSign,
} from "lucide-react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useState, useEffect } from "react";

export default function SiteCommandCenter() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSiteDashboard();
  }, [id]);

  const fetchSiteDashboard = async () => {
    try {
      const response = await fetch(`/api/sites/${id}/dashboard`);
      if (!response.ok) throw new Error("Failed to fetch");
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const markAttendance = async (employeeId, status) => {
    try {
      const response = await fetch("/api/attendance/mark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId, status }),
      });
      if (response.ok) {
        fetchSiteDashboard(); // Refresh
      }
    } catch (error) {
      console.error(error);
    }
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
        return "#999";
    }
  };

  if (loading || !data) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#F5F5F7",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Text style={{ fontSize: 16, color: "#666" }}>Loading...</Text>
      </View>
    );
  }

  const QuickAction = ({ icon: Icon, label, onPress, color }) => (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        opacity: pressed ? 0.8 : 1,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}
    >
      <GlassView
        isInteractive={true}
        style={[
          {
            padding: 16,
            borderRadius: 12,
            alignItems: "center",
            overflow: "hidden",
          },
          isLiquidGlassAvailable()
            ? {}
            : { opacity: 0.95, backgroundColor: "#ffffff" },
        ]}
      >
        <Icon size={24} color={color} />
        <Text
          style={{
            fontSize: 12,
            color: "#000",
            marginTop: 8,
            textAlign: "center",
          }}
        >
          {label}
        </Text>
      </GlassView>
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: "#F5F5F7" }}>
      <StatusBar style="dark" />

      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 16,
          paddingHorizontal: 20,
          paddingBottom: 16,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ marginRight: 16 }}
        >
          <ArrowLeft size={24} color="#000" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 20, fontWeight: "700", color: "#000" }}>
            {data.site.name}
          </Text>
          <View
            style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}
          >
            <MapPin size={14} color="#666" />
            <Text style={{ fontSize: 14, color: "#666", marginLeft: 4 }}>
              {data.site.location}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 100,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Attendance Summary */}
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 20 }}>
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
            <CheckCircle size={20} color="#34C759" />
            <Text
              style={{
                fontSize: 24,
                fontWeight: "700",
                color: "#34C759",
                marginTop: 4,
              }}
            >
              {data.summary.present}
            </Text>
            <Text style={{ fontSize: 11, color: "#666" }}>Present</Text>
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
            <XCircle size={20} color="#FF3B30" />
            <Text
              style={{
                fontSize: 24,
                fontWeight: "700",
                color: "#FF3B30",
                marginTop: 4,
              }}
            >
              {data.summary.absent}
            </Text>
            <Text style={{ fontSize: 11, color: "#666" }}>Absent</Text>
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
            <Users size={20} color="#007AFF" />
            <Text
              style={{
                fontSize: 24,
                fontWeight: "700",
                color: "#007AFF",
                marginTop: 4,
              }}
            >
              {data.summary.total}
            </Text>
            <Text style={{ fontSize: 11, color: "#666" }}>Total</Text>
          </GlassView>
        </View>

        {/* Quick Actions */}
        <Text
          style={{
            fontSize: 18,
            fontWeight: "700",
            color: "#000",
            marginBottom: 12,
          }}
        >
          Quick Actions
        </Text>
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 20 }}>
          <QuickAction
            icon={QrCode}
            label="Scan QR"
            color="#007AFF"
            onPress={() => router.push("/scanner")}
          />
          <QuickAction
            icon={DollarSign}
            label="Penalty"
            color="#FF3B30"
            onPress={() => router.push("/penalty/add")}
          />
          <QuickAction
            icon={Ticket}
            label="Ticket"
            color="#AF52DE"
            onPress={() => router.push("/tickets/create")}
          />
        </View>

        {/* Guards on Duty */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: "700", color: "#000" }}>
            Guards on Duty
          </Text>
          <Text style={{ fontSize: 14, color: "#666" }}>
            {data.guards.length} assigned
          </Text>
        </View>

        {data.guards.map((guard) => (
          <GlassView
            key={guard.id}
            style={[
              {
                padding: 16,
                borderRadius: 12,
                marginBottom: 12,
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
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "600",
                    color: "#000",
                    marginBottom: 4,
                  }}
                >
                  {guard.name}
                </Text>
                <Text style={{ fontSize: 13, color: "#666" }}>
                  ID: {guard.employeeId}
                </Text>
              </View>
              <View
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 4,
                  borderRadius: 8,
                  backgroundColor:
                    getStatusColor(guard.attendanceStatus) + "20",
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "600",
                    color: getStatusColor(guard.attendanceStatus),
                  }}
                >
                  {guard.attendanceStatus}
                </Text>
              </View>
            </View>

            {guard.attendanceStatus === "UNMARKED" && (
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Pressable
                  onPress={() => markAttendance(guard.id, "PRESENT")}
                  style={({ pressed }) => ({
                    flex: 1,
                    opacity: pressed ? 0.8 : 1,
                  })}
                >
                  <View
                    style={{
                      padding: 10,
                      borderRadius: 8,
                      backgroundColor: "#34C759",
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{ fontSize: 13, fontWeight: "600", color: "#FFF" }}
                    >
                      Present
                    </Text>
                  </View>
                </Pressable>
                <Pressable
                  onPress={() => markAttendance(guard.id, "ABSENT")}
                  style={({ pressed }) => ({
                    flex: 1,
                    opacity: pressed ? 0.8 : 1,
                  })}
                >
                  <View
                    style={{
                      padding: 10,
                      borderRadius: 8,
                      backgroundColor: "#FF3B30",
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{ fontSize: 13, fontWeight: "600", color: "#FFF" }}
                    >
                      Absent
                    </Text>
                  </View>
                </Pressable>
              </View>
            )}
          </GlassView>
        ))}

        {/* Active Tickets */}
        {data.tickets.length > 0 && (
          <>
            <Text
              style={{
                fontSize: 18,
                fontWeight: "700",
                color: "#000",
                marginTop: 20,
                marginBottom: 12,
              }}
            >
              Active Tickets ({data.tickets.length})
            </Text>
            {data.tickets.map((ticket) => (
              <GlassView
                key={ticket.id}
                style={[
                  {
                    padding: 16,
                    borderRadius: 12,
                    marginBottom: 12,
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
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{ fontSize: 15, fontWeight: "600", color: "#000" }}
                    >
                      {ticket.title}
                    </Text>
                  </View>
                  <View
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 6,
                      backgroundColor:
                        ticket.priority === "HIGH" ? "#FF3B3020" : "#FF950020",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "600",
                        color:
                          ticket.priority === "HIGH" ? "#FF3B30" : "#FF9500",
                      }}
                    >
                      {ticket.priority}
                    </Text>
                  </View>
                </View>
              </GlassView>
            ))}
          </>
        )}

        {/* Checklist Status */}
        <GlassView
          style={[
            {
              padding: 16,
              borderRadius: 12,
              marginTop: 20,
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
              marginBottom: 12,
            }}
          >
            <ClipboardCheck size={20} color="#007AFF" />
            <Text
              style={{
                fontSize: 16,
                fontWeight: "600",
                color: "#000",
                marginLeft: 8,
              }}
            >
              Today's Checklist
            </Text>
          </View>
          <View
            style={{ flexDirection: "row", justifyContent: "space-between" }}
          >
            <Text style={{ fontSize: 14, color: "#666" }}>
              Completed: {data.checklist.completed} / {data.checklist.total}
            </Text>
            <Text style={{ fontSize: 14, fontWeight: "600", color: "#007AFF" }}>
              {data.checklist.total > 0
                ? `${Math.round((data.checklist.completed / data.checklist.total) * 100)}%`
                : "0%"}
            </Text>
          </View>
        </GlassView>
      </ScrollView>
    </View>
  );
}
