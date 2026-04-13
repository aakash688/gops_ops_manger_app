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
  Plus,
  AlertCircle,
  ChevronRight,
} from "lucide-react-native";
import { useRouter } from "expo-router";
import { useState, useEffect } from "react";

export default function Tickets() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [tickets, setTickets] = useState([]);
  const [filter, setFilter] = useState("ALL"); // ALL, OPEN, CLOSED

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      const response = await fetch("/api/tickets");
      if (!response.ok) throw new Error("Failed to fetch");
      const data = await response.json();
      setTickets(data);
    } catch (error) {
      console.error(error);
      // Demo data
      setTickets([
        {
          id: 1,
          title: "Camera not working",
          status: "OPEN",
          priority: "HIGH",
          site: "Warehouse 2",
          createdAt: "2 hours ago",
        },
        {
          id: 2,
          title: "Gate lock broken",
          status: "OPEN",
          priority: "CRITICAL",
          site: "Office Complex",
          createdAt: "5 hours ago",
        },
        {
          id: 3,
          title: "Uniform request",
          status: "CLOSED",
          priority: "LOW",
          site: "Mall Entrance",
          createdAt: "1 day ago",
        },
      ]);
    }
  };

  const filteredTickets = tickets.filter((ticket) => {
    if (filter === "ALL") return true;
    return ticket.status === filter;
  });

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
                    ticket.status === "OPEN" ? "#007AFF20" : "#34C75920",
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "600",
                    color: ticket.status === "OPEN" ? "#007AFF" : "#34C759",
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
            <Text style={{ fontSize: 14, color: "#666", marginBottom: 4 }}>
              {ticket.site}
            </Text>
            <Text style={{ fontSize: 13, color: "#999" }}>
              {ticket.createdAt}
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
      >
        {filteredTickets.length === 0 ? (
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
