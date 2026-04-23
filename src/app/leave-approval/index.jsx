import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { ArrowLeft, Plus, Calendar, Search } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { apiPostJson } from "@/utils/api";
import { fetchLeaveRequests } from "@/utils/leaveRequests";

function formatDate(d) {
  if (!d) return "—";
  const s = typeof d === "string" ? d.slice(0, 10) : d;
  const t = new Date(s);
  if (Number.isNaN(t.getTime())) return "—";
  return t.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

const FILTERS = [
  { key: "ALL", label: "All" },
  { key: "PENDING", label: "Pending" },
  { key: "APPROVED", label: "Approved" },
  { key: "REJECTED", label: "Rejected" },
];

export default function LeaveRequestsList() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("PENDING");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [actionId, setActionId] = useState(null);
  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchText.trim()), 300);
    return () => clearTimeout(t);
  }, [searchText]);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const { data } = await fetchLeaveRequests({
        limit: 50,
        offset: 0,
        status: filter,
        name: debouncedSearch || undefined,
      });
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setItems([]);
      setError(e instanceof Error ? e.message : "Failed to load leave requests");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter, debouncedSearch]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const quickApprove = async (id, ev) => {
    ev?.stopPropagation?.();
    try {
      setActionId(id);
      await apiPostJson(`/leave-requests/${id}/approve`, {});
      await load();
      Alert.alert("Approved", "Leave request approved.");
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Approve failed");
    } finally {
      setActionId(null);
    }
  };

  const quickReject = async (id, ev) => {
    ev?.stopPropagation?.();
    Alert.alert("Reject this leave?", "The request will be marked rejected.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reject",
        style: "destructive",
        onPress: async () => {
          try {
            setActionId(id);
            await apiPostJson(`/leave-requests/${id}/reject`, {});
            await load();
          } catch (e) {
            Alert.alert("Error", e instanceof Error ? e.message : "Reject failed");
          } finally {
            setActionId(null);
          }
        },
      },
    ]);
  };

  const statusColor = (status) => {
    if (status === "PENDING") return "#FF9500";
    if (status === "APPROVED") return "#34C759";
    if (status === "REJECTED") return "#FF3B30";
    return "#666";
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#F5F5F7" }}>
      <StatusBar style="dark" />

      <View
        style={{
          paddingTop: insets.top + 12,
          paddingHorizontal: 16,
          paddingBottom: 12,
          flexDirection: "row",
          alignItems: "center",
          borderBottomWidth: 1,
          borderBottomColor: "rgba(0,0,0,0.06)",
        }}
      >
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
          <ArrowLeft size={24} color="#000" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: "700", color: "#000" }}>Leave requests</Text>
          <Text style={{ fontSize: 13, color: "#666", marginTop: 2 }}>
            Org-wide · tap a row for details
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push("/leave-approval/create")}
          style={{
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 12,
            backgroundColor: "#007AFF",
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Plus size={18} color="#fff" />
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>Create</Text>
        </TouchableOpacity>
      </View>

      <View
        style={{
          paddingHorizontal: 16,
          paddingBottom: 10,
          borderBottomWidth: 1,
          borderBottomColor: "rgba(0,0,0,0.06)",
        }}
      >
        <GlassView
          style={[
            {
              borderRadius: 12,
              overflow: "hidden",
              paddingHorizontal: 12,
              paddingVertical: 10,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
            },
            isLiquidGlassAvailable() ? {} : { backgroundColor: "#fff" },
          ]}
        >
          <Search size={18} color="#666" />
          <TextInput
            placeholder="Search by employee name or code"
            value={searchText}
            onChangeText={setSearchText}
            style={{ flex: 1, fontSize: 15, color: "#000" }}
            placeholderTextColor="#999"
            autoCorrect={false}
          />
        </GlassView>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, maxHeight: 52, borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.06)" }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 8 }}
      >
        {FILTERS.map((f) => (
          <Pressable
            key={f.key}
            onPress={() => setFilter(f.key)}
            style={({ pressed }) => ({
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 20,
              backgroundColor: filter === f.key ? "#007AFF" : "#E5E5EA",
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: "700",
                color: filter === f.key ? "#fff" : "#000",
              }}
            >
              {f.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: 16,
          paddingBottom: insets.bottom + 24,
        }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading && !refreshing ? (
          <View style={{ paddingVertical: 40, alignItems: "center" }}>
            <ActivityIndicator color="#007AFF" />
          </View>
        ) : null}

        {error ? (
          <GlassView
            style={[
              { padding: 16, borderRadius: 14, marginBottom: 12 },
              isLiquidGlassAvailable() ? {} : { backgroundColor: "#fff" },
            ]}
          >
            <Text style={{ color: "#FF3B30", fontWeight: "600" }}>{error}</Text>
          </GlassView>
        ) : null}

        {!loading && !error && items.length === 0 ? (
          <GlassView
            style={[
              { padding: 24, borderRadius: 16, alignItems: "center" },
              isLiquidGlassAvailable() ? {} : { backgroundColor: "#fff" },
            ]}
          >
            <Calendar size={36} color="#C7C7CC" />
            <Text style={{ marginTop: 12, fontSize: 16, fontWeight: "700", color: "#000" }}>
              No requests
            </Text>
            <Text style={{ marginTop: 6, color: "#666", textAlign: "center" }}>
              Try another filter, adjust search, or create a new leave request.
            </Text>
          </GlassView>
        ) : null}

        {items.map((req) => {
          const st = req?.status || "—";
          const color = statusColor(st);
          const pending = st === "PENDING";
          return (
            <View key={req.id} style={{ marginBottom: 12 }}>
              <Pressable
                onPress={() => router.push(`/leave-approval/${req.id}`)}
                style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1 })}
              >
                <GlassView
                  isInteractive={true}
                  style={[
                    { padding: 16, borderRadius: 16, overflow: "hidden" },
                    isLiquidGlassAvailable() ? {} : { opacity: 0.95, backgroundColor: "#ffffff" },
                  ]}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <View style={{ flex: 1, paddingRight: 12 }}>
                      <Text style={{ fontSize: 16, fontWeight: "800", color: "#000" }}>
                        {req?.employeeName || "Employee"}
                      </Text>
                      <Text style={{ color: "#666", marginTop: 4 }}>
                        {formatDate(req?.startDate)} → {formatDate(req?.endDate)}
                      </Text>
                      <Text style={{ color: "#999", marginTop: 6, fontSize: 13 }} numberOfLines={2}>
                        {req?.reason || "—"}
                      </Text>
                    </View>
                    <View
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 10,
                        backgroundColor: color + "22",
                        alignSelf: "flex-start",
                      }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: "800", color }}>{st}</Text>
                    </View>
                  </View>
                </GlassView>
              </Pressable>

              {pending ? (
                <View
                  style={{
                    flexDirection: "row",
                    gap: 10,
                    marginTop: 10,
                    paddingHorizontal: 4,
                  }}
                >
                  <Pressable
                    onPress={(e) => quickApprove(req.id, e)}
                    disabled={actionId === req.id}
                    style={({ pressed }) => ({
                      flex: 1,
                      paddingVertical: 12,
                      borderRadius: 12,
                      backgroundColor: pressed ? "#28a745cc" : "#34C759",
                      alignItems: "center",
                    })}
                  >
                    {actionId === req.id ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={{ color: "#fff", fontWeight: "800" }}>Approve</Text>
                    )}
                  </Pressable>
                  <Pressable
                    onPress={(e) => quickReject(req.id, e)}
                    disabled={actionId === req.id}
                    style={({ pressed }) => ({
                      flex: 1,
                      paddingVertical: 12,
                      borderRadius: 12,
                      backgroundColor: pressed ? "#d63030cc" : "#FF3B30",
                      alignItems: "center",
                    })}
                  >
                    <Text style={{ color: "#fff", fontWeight: "800" }}>Reject</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
