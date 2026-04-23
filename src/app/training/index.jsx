import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { ArrowLeft, GraduationCap, Search } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { fetchTrainings } from "@/utils/trainings";

function formatDate(d) {
  if (!d) return "—";
  const s = typeof d === "string" ? d.slice(0, 10) : d;
  const t = new Date(s);
  if (Number.isNaN(t.getTime())) return "—";
  return t.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

const FILTERS = [
  { key: "ALL", label: "All" },
  { key: "COMPLETED", label: "Completed" },
  { key: "SCHEDULED", label: "Scheduled" },
  { key: "IN_PROGRESS", label: "In progress" },
  { key: "CANCELLED", label: "Cancelled" },
  { key: "PENDING", label: "Pending" },
];

function statusStyle(st) {
  if (st === "COMPLETED") return { bg: "#34C75922", fg: "#34C759" };
  if (st === "SCHEDULED") return { bg: "#007AFF22", fg: "#007AFF" };
  if (st === "IN_PROGRESS") return { bg: "#FF950022", fg: "#FF9500" };
  if (st === "CANCELLED") return { bg: "#8E8E9322", fg: "#636366" };
  if (st === "PENDING") return { bg: "#AF52DE22", fg: "#AF52DE" };
  return { bg: "#66666622", fg: "#666" };
}

function formatStatusLabel(st) {
  if (!st) return "—";
  return st.replace(/_/g, " ");
}

export default function TrainingListScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
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
      const { data } = await fetchTrainings({
        limit: 50,
        offset: 0,
        status: filter,
        title: debouncedSearch || undefined,
      });
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setItems([]);
      setError(e instanceof Error ? e.message : "Failed to load trainings");
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
          <Text style={{ fontSize: 18, fontWeight: "700", color: "#000" }}>Trainings</Text>
          <Text style={{ fontSize: 13, color: "#666", marginTop: 2 }}>View-only · org schedule</Text>
        </View>
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
            placeholder="Search by training title"
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
            <GraduationCap size={36} color="#C7C7CC" />
            <Text style={{ marginTop: 12, fontSize: 16, fontWeight: "700", color: "#000" }}>No trainings</Text>
            <Text style={{ marginTop: 6, color: "#666", textAlign: "center" }}>
              Try another filter or clear the search.
            </Text>
          </GlassView>
        ) : null}

        {items.map((row) => {
          const st = row?.status || "";
          const { bg, fg } = statusStyle(st);
          return (
            <Pressable
              key={row.id}
              onPress={() => router.push(`/training/${row.id}`)}
              style={({ pressed }) => ({ marginBottom: 12, opacity: pressed ? 0.92 : 1 })}
            >
              <GlassView
                isInteractive
                style={[
                  {
                    padding: 16,
                    borderRadius: 16,
                    overflow: "hidden",
                    flexDirection: "row",
                    alignItems: "center",
                  },
                  isLiquidGlassAvailable() ? {} : { opacity: 0.95, backgroundColor: "#ffffff" },
                ]}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    backgroundColor: "rgba(175,82,222,0.12)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <GraduationCap size={22} color="#AF52DE" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={{ fontSize: 16, fontWeight: "800", color: "#000" }} numberOfLines={2}>
                    {row?.title || "Training"}
                  </Text>
                  <Text style={{ fontSize: 13, color: "#666", marginTop: 4 }} numberOfLines={1}>
                    {formatDate(row?.scheduleDate || row?.startDate)} · {row?.trainingType || "—"}
                  </Text>
                </View>
                <View style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: bg }}>
                  <Text style={{ fontSize: 11, fontWeight: "800", color: fg }}>{formatStatusLabel(st)}</Text>
                </View>
              </GlassView>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
