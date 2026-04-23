import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import {
  Users,
  UserX,
  Calendar,
  Building2,
  Ticket,
  QrCode,
  DollarSign,
  AlertCircle,
  FileText,
  Bell,
  ChevronRight,
  AlertTriangle,
  ClipboardList,
  Banknote,
  UserPlus,
  MapPinned,
  GraduationCap,
  LogIn,
  List,
  Radio,
  ShieldCheck,
} from "lucide-react-native";
import { useRouter } from "expo-router";
import FloatingActionButton from "@/components/FloatingActionButton";
import { useState, useEffect } from "react";
import { apiGetJson } from "@/utils/api";
import { useAuthStore } from "@/utils/auth/store";

export default function Dashboard() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [stats, setStats] = useState({
    present: 0,
    absent: 0,
    pendingLeaves: 0,
    activeSites: 0,
    openTickets: 0,
  });
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const employeeId = useAuthStore((s) => s.auth?.user?.employeeId);
  const [tracking, setTracking] = useState({ trackedAt: null, sessionOpen: false });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [{ data: statsData }, { data: teamLatest }] = await Promise.all([
        apiGetJson("/dashboard"),
        apiGetJson("/apps/live-tracking/team/latest"),
      ]);

      setStats({
        present: statsData?.employeesCount ?? 0,
        absent: 0,
        pendingLeaves: 0,
        activeSites: statsData?.clientsCount ?? 0,
        openTickets: statsData?.openTicketsCount ?? 0,
      });

      const me = Array.isArray(teamLatest) && employeeId
        ? teamLatest.find((t) => t.employeeId === employeeId)
        : null;
      setTracking({ trackedAt: me?.trackedAt ?? null, sessionOpen: me?.sessionOpen === true });
    } catch {
      setStats({
        present: 42,
        absent: 8,
        pendingLeaves: 5,
        activeSites: 6,
        openTickets: 3,
      });
    } finally {
      setLoading(false);
    }
  };

  const formatAgo = (iso) => {
    if (!iso) return "—";
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return "—";
    const sec = Math.max(0, Math.round((Date.now() - t) / 1000));
    if (sec < 60) return `${sec}s ago`;
    if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
    if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
    return `${Math.floor(sec / 86400)}d ago`;
  };

  const handleAlertAction = (action) => {
    switch (action) {
      case "VIEW_ATTENDANCE":
        router.push("/attendance");
        break;
      case "VIEW_LEAVES":
        router.push("/leave-approval");
        break;
      case "VIEW_TICKETS":
        router.push("/tickets");
        break;
      case "VIEW_SITES":
        router.push("/clients");
        break;
      case "VIEW_RELIEVERS":
        router.push("/dashboard/notifications");
        break;
    }
  };

  const AlertCard = ({ alert }) => (
    <Pressable
      onPress={() => handleAlertAction(alert.action)}
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
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: alert.color,
              marginRight: 12,
            }}
          />
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 17,
                fontWeight: "700",
                color: "#000",
                marginBottom: 4,
              }}
            >
              {alert.title}
            </Text>
            <Text style={{ fontSize: 14, color: "#666", marginBottom: 8 }}>
              {alert.description}
            </Text>
            <View
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 8,
                backgroundColor: alert.color + "20",
                alignSelf: "flex-start",
              }}
            >
              <Text
                style={{ fontSize: 13, fontWeight: "600", color: alert.color }}
              >
                {alert.actionLabel}
              </Text>
            </View>
          </View>
          <ChevronRight size={20} color="#C7C7CC" />
        </View>
      </GlassView>
    </Pressable>
  );

  const StatCard = ({ icon: Icon, label, value, color, onPress }) => (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        margin: 6,
        opacity: pressed ? 0.8 : 1,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}
    >
      <GlassView
        isInteractive={true}
        style={[
          {
            padding: 16,
            borderRadius: 16,
            alignItems: "center",
            justifyContent: "center",
            minHeight: 120,
            overflow: "hidden",
          },
          isLiquidGlassAvailable()
            ? {}
            : { opacity: 0.95, backgroundColor: "#ffffff" },
        ]}
      >
        <Icon size={32} color={color} />
        <Text
          style={{
            fontSize: 28,
            fontWeight: "700",
            color: "#000",
            marginTop: 12,
          }}
        >
          {value}
        </Text>
        <Text style={{ fontSize: 13, color: "#666", marginTop: 4 }}>
          {label}
        </Text>
      </GlassView>
    </Pressable>
  );

  const QuickAction = ({ icon: Icon, label, onPress }) => (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        margin: 6,
        opacity: pressed ? 0.8 : 1,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}
    >
      <GlassView
        isInteractive={true}
        style={[
          {
            padding: 20,
            borderRadius: 16,
            alignItems: "center",
            justifyContent: "center",
            minHeight: 100,
            overflow: "hidden",
          },
          isLiquidGlassAvailable()
            ? {}
            : { opacity: 0.95, backgroundColor: "#ffffff" },
        ]}
      >
        <Icon size={28} color="#007AFF" />
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

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 140 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View
          style={{
            paddingHorizontal: 20,
            paddingTop: insets.top + 20,
            paddingBottom: 20,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <View>
              <Text style={{ fontSize: 14, color: "#666" }}>Welcome back,</Text>
              <Text
                style={{
                  fontSize: 28,
                  fontWeight: "700",
                  color: "#000",
                  marginTop: 4,
                }}
              >
                Operations Manager
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push("/dashboard/notifications")}
              style={{ padding: 8 }}
            >
              <View style={{ position: "relative" }}>
                <Bell size={24} color="#000" />
                <View
                  style={{
                    position: "absolute",
                    top: 0,
                    right: 0,
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: "#FF3B30",
                  }}
                />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Field hub — placed at top so updates are obvious without scrolling */}
        <View
          style={{
            paddingHorizontal: 20,
            paddingTop: 8,
            paddingBottom: 20,
            backgroundColor: "#E8F2FF",
            borderBottomWidth: 1,
            borderBottomColor: "rgba(0,122,255,0.12)",
          }}
        >
          <Text
            style={{
              fontSize: 12,
              fontWeight: "800",
              color: "#007AFF",
              letterSpacing: 0.8,
              marginBottom: 6,
            }}
          >
            FIELD COMMAND CENTER
          </Text>
          <Text style={{ fontSize: 20, fontWeight: "800", color: "#000", marginBottom: 4 }}>
            All modules
          </Text>
          <Text style={{ fontSize: 14, color: "#3C3C43", marginBottom: 14 }}>
            One tap to roster, remote check-in, approvals, training, and more.
          </Text>

          <Text style={{ fontSize: 13, fontWeight: "700", color: "#8E8E93", marginBottom: 8 }}>
            CLIENTS & SITES
          </Text>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              marginHorizontal: -6,
              marginBottom: 16,
            }}
          >
            <QuickAction
              icon={Building2}
              label="Assigned clients"
              onPress={() => router.push("/clients")}
            />
            <QuickAction
              icon={Users}
              label="Roster"
              onPress={() => router.push("/roster")}
            />
          </View>

          <Text style={{ fontSize: 13, fontWeight: "700", color: "#8E8E93", marginBottom: 8 }}>
            FIELD & ATTENDANCE
          </Text>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              marginHorizontal: -6,
              marginBottom: 16,
            }}
          >
            <QuickAction
              icon={MapPinned}
              label="Remote check-in"
              onPress={() => router.push("/remote-checkin")}
            />
            <QuickAction
              icon={Radio}
              label={tracking.trackedAt ? `Live tracking · ${formatAgo(tracking.trackedAt)}` : "Live tracking"}
              onPress={() => router.push("/live-tracking")}
            />
          </View>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              marginHorizontal: -6,
              marginBottom: 16,
            }}
          >
            <QuickAction
              icon={QrCode}
              label="Scan QR"
              onPress={() => router.push("/scanner")}
            />
            <QuickAction
              icon={Users}
              label="Guard attendance"
              onPress={() => router.push("/attendance")}
            />
          </View>

          <Text style={{ fontSize: 13, fontWeight: "700", color: "#8E8E93", marginBottom: 8 }}>
            APPROVALS & PAYMENTS
          </Text>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              marginHorizontal: -6,
              marginBottom: 16,
            }}
          >
            <QuickAction
              icon={Calendar}
              label="Leave approval"
              onPress={() => router.push("/leave-approval")}
            />
            <QuickAction
              icon={AlertCircle}
              label="Request reliever"
              onPress={() => router.push("/reliever/create")}
            />
          </View>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              marginHorizontal: -6,
              marginBottom: 16,
            }}
          >
            {/**
             * Temporarily hidden per product decision.
             * Keep code for later re-enable (do not delete).
             */}
            {/*
              <QuickAction
                icon={Banknote}
                label="Advance payment"
                onPress={() => router.push("/advance-payment")}
              />
            */}
            <QuickAction
              icon={DollarSign}
              label="Add penalty"
              onPress={() => router.push("/penalty/add")}
            />
          </View>

          <Text style={{ fontSize: 13, fontWeight: "700", color: "#8E8E93", marginBottom: 8 }}>
            PEOPLE & COMPLIANCE
          </Text>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              marginHorizontal: -6,
              marginBottom: 16,
            }}
          >
            <QuickAction
              icon={UserPlus}
              label="Onboarding"
              onPress={() => router.push("/onboarding")}
            />
            <QuickAction
              icon={ClipboardList}
              label="Checklists"
              onPress={() => router.push("/checklist")}
            />
          </View>

          <Text style={{ fontSize: 13, fontWeight: "700", color: "#8E8E93", marginBottom: 8 }}>
            OPS & LEARNING
          </Text>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              marginHorizontal: -6,
              marginBottom: 16,
            }}
          >
            <QuickAction
              icon={Ticket}
              label="Tickets"
              onPress={() => router.push("/tickets")}
            />
            <QuickAction
              icon={List}
              label="Activities"
              onPress={() => router.push("/activities")}
            />
          </View>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              marginHorizontal: -6,
              marginBottom: 8,
            }}
          >
            <QuickAction
              icon={GraduationCap}
              label="Training"
              onPress={() => router.push("/training")}
            />
            <QuickAction
              icon={FileText}
              label="New ticket"
              onPress={() => router.push("/tickets/create")}
            />
          </View>

          <Text style={{ fontSize: 13, fontWeight: "700", color: "#8E8E93", marginBottom: 8 }}>
            ACCOUNT
          </Text>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              marginHorizontal: -6,
            }}
          >
            <QuickAction
              icon={LogIn}
              label="Login / SSO"
              onPress={() => router.push("/login")}
            />
            <QuickAction
              icon={ShieldCheck}
              label="Notifications"
              onPress={() => router.push("/dashboard/notifications")}
            />
          </View>
        </View>

        {/* Action-Based Alerts - NEW PRIORITY */}
        {alerts.length > 0 && (
          <View style={{ paddingHorizontal: 20, marginBottom: 32 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <AlertTriangle size={20} color="#FF3B30" />
              <Text
                style={{
                  fontSize: 20,
                  fontWeight: "700",
                  color: "#000",
                  marginLeft: 8,
                }}
              >
                Requires Action ({alerts.length})
              </Text>
            </View>
            {alerts.map((alert) => (
              <AlertCard key={alert.id} alert={alert} />
            ))}
          </View>
        )}

        {/* Stats Grid - Now Secondary */}
        <View style={{ paddingHorizontal: 20 }}>
          <Text
            style={{
              fontSize: 18,
              fontWeight: "700",
              color: "#000",
              marginBottom: 12,
            }}
          >
            Today's Overview
          </Text>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              marginHorizontal: -6,
            }}
          >
            <StatCard
              icon={Users}
              label="Present"
              value={stats.present}
              color="#34C759"
              onPress={() => router.push("/attendance")}
            />
            <StatCard
              icon={UserX}
              label="Absent"
              value={stats.absent}
              color="#FF3B30"
              onPress={() => router.push("/attendance")}
            />
          </View>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              marginHorizontal: -6,
            }}
          >
            <StatCard
              icon={Calendar}
              label="Pending Leaves"
              value={stats.pendingLeaves}
              color="#FF9500"
              onPress={() => router.push("/leave-approval")}
            />
            <StatCard
              icon={Building2}
              label="Active Sites"
              value={stats.activeSites}
              color="#007AFF"
              onPress={() => router.push("/clients")}
            />
          </View>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              marginHorizontal: -6,
            }}
          >
            <StatCard
              icon={Ticket}
              label="Open Tickets"
              value={stats.openTickets}
              color="#AF52DE"
              onPress={() => router.push("/tickets")}
            />
            <View style={{ flex: 1, margin: 6 }} />
          </View>
        </View>
      </ScrollView>

      <FloatingActionButton />
    </View>
  );
}
