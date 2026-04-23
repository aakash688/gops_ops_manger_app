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
import { Plus, AlertCircle } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { apiGetJson } from "@/utils/api";

function formatDate(d) {
  if (!d) return "—";
  const t = new Date(d);
  if (Number.isNaN(t.getTime())) return "—";
  return t.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function RelieverRequests() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("ALL"); // ALL, PENDING, APPROVED, REJECTED, COMPLETED, CANCELLED
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("limit", "50");
      params.set("offset", "0");
      if (filter !== "ALL") params.set("status", filter);
      const { data } = await apiGetJson(`/reliever-requests?${params.toString()}`);
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setItems([]);
      setError(e instanceof Error ? e.message : "Failed to load reliever requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const filtered = useMemo(() => items, [items]);

  const Card = ({ req }) => {
    const status = req?.status || "—";
    const color =
      status === "PENDING"
        ? "#FF9500"
        : status === "APPROVED"
          ? "#007AFF"
          : status === "REJECTED"
            ? "#FF3B30"
            : status === "COMPLETED"
              ? "#34C759"
              : "#666";

    return (
      <Pressable
        onPress={() => router.push(`/reliever/${req.id}`)}
        style={({ pressed }) => ({
          opacity: pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.99 : 1 }],
          marginBottom: 12,
        })}
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
                {req?.client?.clientName || req?.clientName || "Client"}
              </Text>
              <Text style={{ color: "#666", marginTop: 4 }}>
                {formatDate(req?.startDate)} → {formatDate(req?.endDate)}
              </Text>
              <Text style={{ color: "#999", marginTop: 4, fontSize: 12 }}>
                Needed: {req?.relieversNeeded ?? "—"} • Ref: {req?.requestRef || "—"}
              </Text>
            </View>
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 10,
                backgroundColor: color + "20",
                alignSelf: "flex-start",
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: "800", color }}>{status}</Text>
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
          paddingTop: insets.top + 16,
          paddingHorizontal: 20,
          paddingBottom: 16,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text style={{ fontSize: 20, fontWeight: "800", color: "#000" }}>
          Reliever Requests
        </Text>
        <TouchableOpacity onPress={() => router.push("/reliever/create")}>
          <Plus size={26} color="#007AFF" />
        </TouchableOpacity>
      </View>

      <View style={{ paddingHorizontal: 20, marginBottom: 14 }}>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {["ALL", "PENDING", "APPROVED", "REJECTED"].map((f) => (
            <TouchableOpacity key={f} onPress={() => setFilter(f)} style={{ flex: 1 }}>
              <GlassView
                isInteractive={true}
                style={[
                  { padding: 10, borderRadius: 12, alignItems: "center", overflow: "hidden" },
                  isLiquidGlassAvailable()
                    ? filter === f
                      ? { backgroundColor: "rgba(0, 122, 255, 0.2)" }
                      : {}
                    : { opacity: 0.95, backgroundColor: filter === f ? "#007AFF" : "#ffffff" },
                ]}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "800",
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

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 80 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
      >
        {loading ? (
          <View style={{ alignItems: "center", paddingTop: 50 }}>
            <Text style={{ color: "#666" }}>Loading…</Text>
          </View>
        ) : error ? (
          <View style={{ alignItems: "center", paddingTop: 50 }}>
            <AlertCircle size={42} color="#FF3B30" />
            <Text style={{ color: "#FF3B30", fontWeight: "800", marginTop: 12 }}>
              {error}
            </Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={{ alignItems: "center", paddingTop: 50 }}>
            <AlertCircle size={42} color="#C7C7CC" />
            <Text style={{ color: "#666", marginTop: 12 }}>No requests found</Text>
          </View>
        ) : (
          filtered.map((r) => <Card key={r.id} req={r} />)
        )}
      </ScrollView>
    </View>
  );
}

