import {
  View,
  Text,
  ScrollView,
  Pressable,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import {
  ArrowLeft,
  Plus,
  AlertCircle,
  ChevronRight,
} from "lucide-react-native";
import { useRouter } from "expo-router";
import { useState, useEffect } from "react";
import { apiGetJson } from "@/utils/api";

export default function Tickets() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [tickets, setTickets] = useState([]);
  const [filter, setFilter] = useState("ALL"); // ALL, OPEN, CLOSED
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      setError(null);
      setLoading(true);
      const params = new URLSearchParams();
      params.set("limit", "50");
      params.set("offset", "0");
      if (filter === "OPEN") params.set("status", "OPEN");
      if (filter === "CLOSED") params.set("status", "CLOSED");

      const { data } = await apiGetJson(`/tickets?${params.toString()}`);
      setTickets(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
      setTickets([]);
      setError(error instanceof Error ? error.message : "Failed to load tickets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const filteredTickets = tickets.filter((ticket) => {
    if (filter === "ALL") return true;
    return ticket.status === filter;
  });

  const formatAgo = (value) => {
    if (!value) return "—";
    const t = new Date(value).getTime();
    if (Number.isNaN(t)) return "—";
    const sec = Math.max(0, Math.round((Date.now() - t) / 1000));
    if (sec < 60) return `${sec}s ago`;
    if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
    if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
    return `${Math.floor(sec / 86400)}d ago`;
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case "HIGH":
        return "#FF3B30";
      case "MEDIUM":
        return "#007AFF";
      case "LOW":
        return "#34C759";
      default:
        return "#666";
    }
  };

  const TicketCard = ({ ticket }) => (
    <Pressable
      onPress={() => router.push(`/tickets/${ticket.id}`)}
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
            alignItems: "flex-start",
            justifyContent: "space-between",
          }}
        >
          <View style={{ flex: 1 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <View
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 6,
                  backgroundColor: getPriorityColor(ticket.priority) + "20",
                  marginRight: 8,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "600",
                    color: getPriorityColor(ticket.priority),
                  }}
                >
                  {ticket.priority}
                </Text>
              </View>
              <View
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 6,
                  backgroundColor:
                    ticket.status === "OPEN"
                      ? "#007AFF20"
                      : ticket.status === "CLOSED"
                        ? "#34C75920"
                        : "#FF950020",
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "600",
                    color:
                      ticket.status === "OPEN"
                        ? "#007AFF"
                        : ticket.status === "CLOSED"
                          ? "#34C759"
                          : "#FF9500",
                  }}
                >
                  {ticket.status}
                </Text>
              </View>
            </View>
            <Text
              style={{
                fontSize: 17,
                fontWeight: "600",
                color: "#000",
                marginBottom: 8,
              }}
            >
              {ticket.title}
            </Text>
            {!!ticket.siteName && (
              <Text style={{ fontSize: 14, color: "#666", marginBottom: 4 }}>
                {ticket.siteName}
              </Text>
            )}
            <Text style={{ fontSize: 13, color: "#999" }}>
              {ticket.ticketId ? `${ticket.ticketId} • ` : ""}
              {formatAgo(ticket.createdAt)}
            </Text>
          </View>
          <ChevronRight size={20} color="#C7C7CC" />
        </View>
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
          justifyContent: "space-between",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ marginRight: 16 }}
          >
            <ArrowLeft size={24} color="#000" />
          </TouchableOpacity>
          <Text style={{ fontSize: 20, fontWeight: "700", color: "#000" }}>
            Tickets
          </Text>
        </View>
        <TouchableOpacity onPress={() => router.push("/tickets/create")}>
          <Plus size={28} color="#007AFF" />
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {["ALL", "OPEN", "CLOSED"].map((f) => (
            <TouchableOpacity
              key={f}
              onPress={() => setFilter(f)}
              style={{
                flex: 1,
              }}
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
                    ? filter === f
                      ? { backgroundColor: "rgba(0, 122, 255, 0.2)" }
                      : {}
                    : {
                        opacity: 0.95,
                        backgroundColor: filter === f ? "#007AFF" : "#ffffff",
                      },
                ]}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "600",
                    color:
                      filter === f
                        ? isLiquidGlassAvailable()
                          ? "#007AFF"
                          : "#FFF"
                        : "#000",
                  }}
                >
                  {f}
                </Text>
              </GlassView>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Ticket List */}
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
            onRefresh={async () => {
              setRefreshing(true);
              await fetchTickets();
              setRefreshing(false);
            }}
          />
        }
      >
        {loading ? (
          <View style={{ alignItems: "center", paddingTop: 60 }}>
            <Text style={{ fontSize: 16, color: "#666" }}>Loading…</Text>
          </View>
        ) : error ? (
          <View style={{ alignItems: "center", paddingTop: 60 }}>
            <AlertCircle size={48} color="#FF3B30" />
            <Text style={{ fontSize: 16, color: "#FF3B30", marginTop: 16 }}>
              {error}
            </Text>
          </View>
        ) : filteredTickets.length === 0 ? (
          <View style={{ alignItems: "center", paddingTop: 60 }}>
            <AlertCircle size={48} color="#C7C7CC" />
            <Text style={{ fontSize: 16, color: "#666", marginTop: 16 }}>
              No tickets found
            </Text>
          </View>
        ) : (
          filteredTickets.map((ticket) => (
            <TicketCard key={ticket.id} ticket={ticket} />
          ))
        )}
      </ScrollView>
    </View>
  );
}
