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
  Calendar,
  AlertCircle,
  Ticket,
  Clock,
} from "lucide-react-native";
import { useRouter } from "expo-router";
import { useState, useEffect } from "react";

export default function Notifications() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const response = await fetch("/api/notifications");
      if (!response.ok) throw new Error("Failed to fetch");
      const data = await response.json();
      setNotifications(data);
    } catch (error) {
      console.error(error);
      // Demo data
      setNotifications([
        {
          id: 1,
          type: "LEAVE",
          title: "3 leave requests pending approval",
          description: "Review and approve pending leave requests",
          timestamp: "2 hours ago",
          priority: "HIGH",
        },
        {
          id: 2,
          type: "TICKET",
          title: "2 critical tickets need attention",
          description:
            "Camera malfunction at Warehouse 2, Gate lock broken at Office Complex",
          timestamp: "4 hours ago",
          priority: "CRITICAL",
        },
        {
          id: 3,
          type: "RELIEVER",
          title: "Reliever request approved",
          description: "Request for Site Alpha has been approved",
          timestamp: "1 day ago",
          priority: "MEDIUM",
        },
        {
          id: 4,
          type: "ATTENDANCE",
          title: "Unusual absence pattern detected",
          description:
            "Guard Rajesh Kumar has been absent for 3 consecutive days",
          timestamp: "2 days ago",
          priority: "MEDIUM",
        },
      ]);
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case "LEAVE":
        return Calendar;
      case "TICKET":
        return Ticket;
      case "RELIEVER":
        return AlertCircle;
      case "ATTENDANCE":
        return Clock;
      default:
        return AlertCircle;
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case "CRITICAL":
        return "#FF3B30";
      case "HIGH":
        return "#FF9500";
      case "MEDIUM":
        return "#007AFF";
      case "LOW":
        return "#34C759";
      default:
        return "#666";
    }
  };

  const NotificationCard = ({ notification }) => {
    const Icon = getIcon(notification.type);
    return (
      <Pressable
        onPress={() => {}}
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
          <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: getPriorityColor(notification.priority) + "20",
                alignItems: "center",
                justifyContent: "center",
                marginRight: 12,
              }}
            >
              <Icon size={20} color={getPriorityColor(notification.priority)} />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "600",
                  color: "#000",
                  marginBottom: 4,
                }}
              >
                {notification.title}
              </Text>
              <Text style={{ fontSize: 14, color: "#666", marginBottom: 8 }}>
                {notification.description}
              </Text>
              <Text style={{ fontSize: 13, color: "#999" }}>
                {notification.timestamp}
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
          Notifications
        </Text>
      </View>

      {/* Notification List */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 100,
        }}
        showsVerticalScrollIndicator={false}
      >
        {notifications.map((notification) => (
          <NotificationCard key={notification.id} notification={notification} />
        ))}
      </ScrollView>
    </View>
  );
}
