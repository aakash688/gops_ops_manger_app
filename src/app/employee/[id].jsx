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
  User,
  Clock,
  DollarSign,
  Package,
} from "lucide-react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useState, useEffect } from "react";

export default function Employee360() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEmployee();
  }, [id]);

  const fetchEmployee = async () => {
    try {
      const response = await fetch(`/api/employees/${id}`);
      if (!response.ok) throw new Error("Failed to fetch");
      const data = await response.json();
      setEmployee(data);
    } catch (error) {
      console.error(error);
      // Demo data
      setEmployee({
        id,
        name: "Rajesh Kumar",
        employeeId: "EMP101",
        site: "Warehouse 2",
        supervisor: "Amit Sharma",
        phone: "+91 98765 43210",
        attendanceLogs: [
          {
            date: "2026-04-07",
            status: "PRESENT",
            checkIn: "08:00",
            checkOut: "18:00",
          },
          {
            date: "2026-04-06",
            status: "PRESENT",
            checkIn: "08:05",
            checkOut: "18:10",
          },
          {
            date: "2026-04-05",
            status: "LATE",
            checkIn: "08:45",
            checkOut: "18:00",
          },
        ],
        penalties: [
          { date: "2026-04-05", reason: "Late arrival", amount: 200 },
        ],
        inventory: [
          { item: "Uniform", quantity: 2, status: "Issued" },
          { item: "Radio", quantity: 1, status: "Issued" },
        ],
      });
    } finally {
      setLoading(false);
    }
  };

  const markAttendance = async (status) => {
    try {
      const response = await fetch("/api/attendance/mark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: id, status }),
      });
      if (!response.ok) throw new Error("Failed to mark");
      router.back();
    } catch (error) {
      console.error(error);
    }
  };

  if (loading || !employee) {
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
        <Text style={{ fontSize: 20, fontWeight: "700", color: "#000" }}>
          Employee 360
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 100,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card */}
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
            <Text
              style={{
                fontSize: 22,
                fontWeight: "700",
                color: "#000",
                marginBottom: 4,
              }}
            >
              {employee.name}
            </Text>
            <Text style={{ fontSize: 15, color: "#666" }}>
              ID: {employee.employeeId}
            </Text>
          </View>

          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <MapPin size={18} color="#666" />
              <Text style={{ fontSize: 15, color: "#666", marginLeft: 8 }}>
                <Text style={{ fontWeight: "600", color: "#000" }}>Site:</Text>{" "}
                {employee.site}
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <User size={18} color="#666" />
              <Text style={{ fontSize: 15, color: "#666", marginLeft: 8 }}>
                <Text style={{ fontWeight: "600", color: "#000" }}>
                  Supervisor:
                </Text>{" "}
                {employee.supervisor}
              </Text>
            </View>
          </View>
        </GlassView>

        {/* Mark Attendance Actions */}
        <View style={{ flexDirection: "row", gap: 12, marginBottom: 20 }}>
          <Pressable
            onPress={() => markAttendance("PRESENT")}
            style={({ pressed }) => ({
              flex: 1,
              opacity: pressed ? 0.8 : 1,
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
                  : { opacity: 0.95, backgroundColor: "#34C759" },
              ]}
            >
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "600",
                  color: isLiquidGlassAvailable() ? "#000" : "#FFF",
                }}
              >
                Mark Present
              </Text>
            </GlassView>
          </Pressable>
          <Pressable
            onPress={() => markAttendance("ABSENT")}
            style={({ pressed }) => ({
              flex: 1,
              opacity: pressed ? 0.8 : 1,
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
                  : { opacity: 0.95, backgroundColor: "#FF3B30" },
              ]}
            >
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "600",
                  color: isLiquidGlassAvailable() ? "#000" : "#FFF",
                }}
              >
                Mark Absent
              </Text>
            </GlassView>
          </Pressable>
        </View>

        {/* Attendance Logs */}
        <Text
          style={{
            fontSize: 20,
            fontWeight: "700",
            color: "#000",
            marginBottom: 12,
          }}
        >
          Last 10 Attendance Logs
        </Text>
        {employee.attendanceLogs.map((log, index) => (
          <GlassView
            key={index}
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
              <View>
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: "600",
                    color: "#000",
                    marginBottom: 4,
                  }}
                >
                  {log.date}
                </Text>
                <Text style={{ fontSize: 14, color: "#666" }}>
                  {log.checkIn} - {log.checkOut}
                </Text>
              </View>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "600",
                  color:
                    log.status === "PRESENT"
                      ? "#34C759"
                      : log.status === "LATE"
                        ? "#FF9500"
                        : "#FF3B30",
                }}
              >
                {log.status}
              </Text>
            </View>
          </GlassView>
        ))}

        {/* Penalties */}
        <Text
          style={{
            fontSize: 20,
            fontWeight: "700",
            color: "#000",
            marginTop: 20,
            marginBottom: 12,
          }}
        >
          Penalties
        </Text>
        {employee.penalties.map((penalty, index) => (
          <GlassView
            key={index}
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
                  style={{
                    fontSize: 15,
                    fontWeight: "600",
                    color: "#000",
                    marginBottom: 4,
                  }}
                >
                  {penalty.reason}
                </Text>
                <Text style={{ fontSize: 14, color: "#666" }}>
                  {penalty.date}
                </Text>
              </View>
              <Text
                style={{ fontSize: 17, fontWeight: "700", color: "#FF3B30" }}
              >
                ₹{penalty.amount}
              </Text>
            </View>
          </GlassView>
        ))}

        {/* Inventory */}
        <Text
          style={{
            fontSize: 20,
            fontWeight: "700",
            color: "#000",
            marginTop: 20,
            marginBottom: 12,
          }}
        >
          Inventory
        </Text>
        {employee.inventory.map((item, index) => (
          <GlassView
            key={index}
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
              <View
                style={{ flexDirection: "row", alignItems: "center", flex: 1 }}
              >
                <Package size={20} color="#007AFF" />
                <View style={{ marginLeft: 12 }}>
                  <Text
                    style={{ fontSize: 15, fontWeight: "600", color: "#000" }}
                  >
                    {item.item}
                  </Text>
                  <Text style={{ fontSize: 14, color: "#666" }}>
                    Qty: {item.quantity}
                  </Text>
                </View>
              </View>
              <Text
                style={{ fontSize: 14, fontWeight: "600", color: "#34C759" }}
              >
                {item.status}
              </Text>
            </View>
          </GlassView>
        ))}
      </ScrollView>
    </View>
  );
}
