import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Pressable,
  TextInput,
  Modal,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Users,
  Plus,
  Search,
} from "lucide-react-native";
import { useRouter } from "expo-router";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Calendar as RNCalendar } from "react-native-calendars";
import { apiGetJson } from "@/utils/api";

function weekBoundsFromDate(d) {
  const start = new Date(d);
  start.setDate(start.getDate() - start.getDay());
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return [start.toISOString().split("T")[0], end.toISOString().split("T")[0]];
}

function formatDisplayDate(iso) {
  if (!iso) return "";
  const x = new Date(iso + "T00:00:00");
  if (Number.isNaN(x.getTime())) return iso;
  return x.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function DatePickerModal({ visible, label, value, minDate, onSelect, onClose }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.45)",
          justifyContent: "center",
          alignItems: "center",
        }}
        onPress={onClose}
      >
        <Pressable
          style={{
            width: "90%",
            maxWidth: 380,
            backgroundColor: "#fff",
            borderRadius: 20,
            overflow: "hidden",
            ...Platform.select({
              ios: {
                shadowColor: "#000",
                shadowOpacity: 0.18,
                shadowRadius: 14,
                shadowOffset: { width: 0, height: 6 },
              },
              android: { elevation: 12 },
            }),
          }}
          onPress={(e) => e.stopPropagation()}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              paddingHorizontal: 18,
              paddingTop: 16,
              paddingBottom: 8,
            }}
          >
            <Text style={{ fontSize: 17, fontWeight: "700", color: "#000" }}>{label}</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={{ fontSize: 22, color: "#8E8E93" }}>×</Text>
            </TouchableOpacity>
          </View>
          {visible ? (
            <RNCalendar
              current={value || undefined}
              minDate={minDate || undefined}
              markedDates={
                value ? { [value]: { selected: true, selectedColor: "#007AFF" } } : {}
              }
              onDayPress={(day) => {
                const ds = day?.dateString;
                if (!ds) return;
                onSelect(ds);
                onClose();
              }}
              theme={{
                todayTextColor: "#007AFF",
                arrowColor: "#007AFF",
                textDayFontSize: 15,
                textMonthFontSize: 16,
              }}
            />
          ) : null}
          <View style={{ height: 16 }} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function Roster() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState("WEEK");

  const [customFrom, setCustomFrom] = useState(() => weekBoundsFromDate(new Date())[0]);
  const [customTo, setCustomTo] = useState(() => weekBoundsFromDate(new Date())[1]);
  const [picker, setPicker] = useState(null);

  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [rosters, setRosters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listUpdating, setListUpdating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const hadRowsRef = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchText.trim()), 350);
    return () => clearTimeout(t);
  }, [searchText]);

  const getStartDate = useCallback(() => {
    const date = new Date(selectedDate);
    if (viewMode === "WEEK") {
      date.setDate(date.getDate() - date.getDay());
    } else if (viewMode === "MONTH") {
      date.setDate(1);
    }
    return date.toISOString().split("T")[0];
  }, [selectedDate, viewMode]);

  const getEndDate = useCallback(() => {
    const date = new Date(selectedDate);
    if (viewMode === "WEEK") {
      date.setDate(date.getDate() - date.getDay() + 6);
    } else if (viewMode === "MONTH") {
      date.setMonth(date.getMonth() + 1);
      date.setDate(0);
    }
    return date.toISOString().split("T")[0];
  }, [selectedDate, viewMode]);

  const apiRange = useMemo(() => {
    if (viewMode === "CUSTOM") {
      let from = customFrom;
      let to = customTo;
      if (from > to) {
        const x = from;
        from = to;
        to = x;
      }
      return { from, to };
    }
    return { from: getStartDate(), to: getEndDate() };
  }, [viewMode, customFrom, customTo, getStartDate, getEndDate]);

  const fetchRosters = useCallback(async () => {
    setError(null);
    const blocking = !hadRowsRef.current;
    if (blocking) setLoading(true);
    else setListUpdating(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", "100");
      params.set("offset", "0");
      params.set("fromDate", apiRange.from);
      params.set("toDate", apiRange.to);
      if (debouncedSearch) params.set("search", debouncedSearch);
      const { data } = await apiGetJson(
        `/apps/operations-manager/rosters?${params.toString()}`,
      );
      const arr = Array.isArray(data) ? data : [];
      setRosters(arr);
      if (arr.length > 0) hadRowsRef.current = true;
    } catch (e) {
      setRosters([]);
      setError(e instanceof Error ? e.message : "Could not load rosters");
    } finally {
      if (blocking) setLoading(false);
      else setListUpdating(false);
    }
  }, [apiRange.from, apiRange.to, debouncedSearch]);

  useEffect(() => {
    void fetchRosters();
  }, [fetchRosters]);

  const formatDate = (date) =>
    date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  const changeWeek = (direction) => {
    if (viewMode === "CUSTOM") return;
    const newDate = new Date(selectedDate);
    if (viewMode === "WEEK") {
      newDate.setDate(newDate.getDate() + direction * 7);
    } else {
      newDate.setMonth(newDate.getMonth() + direction);
    }
    setSelectedDate(newDate);
  };

  const rangeLabel = useMemo(() => {
    if (viewMode === "CUSTOM") {
      return `${formatDisplayDate(apiRange.from)} – ${formatDisplayDate(apiRange.to)}`;
    }
    if (viewMode === "WEEK") {
      return `${formatDate(new Date(getStartDate()))} – ${formatDate(new Date(getEndDate()))}`;
    }
    return formatDate(selectedDate);
  }, [viewMode, apiRange.from, apiRange.to, getStartDate, getEndDate, selectedDate]);

  const getShiftColor = (shift) => {
    const s = String(shift || "").toUpperCase();
    if (s.includes("DAY")) return "#007AFF";
    if (s.includes("NIGHT")) return "#5856D6";
    if (s.includes("SWING")) return "#FF9500";
    return "#666";
  };

  const glassCard = isLiquidGlassAvailable() ? {} : { opacity: 0.96, backgroundColor: "#ffffff" };

  return (
    <View style={{ flex: 1, backgroundColor: "#F5F5F7" }}>
      <StatusBar style="dark" />

      <View
        style={{
          paddingHorizontal: 20,
          paddingTop: insets.top + 16,
          paddingBottom: 8,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <Text style={{ fontSize: 28, fontWeight: "700", color: "#000", flex: 1 }}>Roster</Text>
        <TouchableOpacity
          onPress={() => router.push("/roster/create")}
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: "#007AFF",
            alignItems: "center",
            justifyContent: "center",
          }}
          accessibilityLabel="Create roster"
        >
          <Plus size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      <View style={{ paddingHorizontal: 20, marginBottom: 10 }}>
        <GlassView
          style={[
            {
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderRadius: 12,
              overflow: "hidden",
              gap: 10,
            },
            isLiquidGlassAvailable() ? {} : { backgroundColor: "#fff", opacity: 0.95 },
          ]}
        >
          <Search size={20} color="#8E8E93" />
          <TextInput
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Search employee, team, or client"
            placeholderTextColor="#8E8E93"
            style={{ flex: 1, fontSize: 16, color: "#000", paddingVertical: 4 }}
            autoCapitalize="none"
            autoCorrect={false}
            {...Platform.select({ ios: { clearButtonMode: "while-editing" } })}
          />
        </GlassView>
      </View>

      <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {[
            { id: "WEEK", label: "Week" },
            { id: "MONTH", label: "Month" },
            { id: "CUSTOM", label: "Range" },
          ].map(({ id, label }) => (
            <TouchableOpacity
              key={id}
              onPress={() => {
                setViewMode(id);
                if (id === "CUSTOM") {
                  const [a, b] = weekBoundsFromDate(selectedDate);
                  setCustomFrom(a);
                  setCustomTo(b);
                }
              }}
              style={{ flex: 1 }}
            >
              <GlassView
                isInteractive
                style={[
                  { padding: 10, borderRadius: 12, alignItems: "center", overflow: "hidden" },
                  isLiquidGlassAvailable()
                    ? viewMode === id
                      ? { backgroundColor: "rgba(0, 122, 255, 0.15)" }
                      : {}
                    : {
                        opacity: 0.95,
                        backgroundColor: viewMode === id ? "#007AFF" : "#ffffff",
                      },
                ]}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "600",
                    color:
                      viewMode === id
                        ? isLiquidGlassAvailable()
                          ? "#007AFF"
                          : "#FFF"
                        : "#000",
                  }}
                >
                  {label}
                </Text>
              </GlassView>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
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
            isLiquidGlassAvailable() ? {} : { opacity: 0.95, backgroundColor: "#ffffff" },
          ]}
        >
          <TouchableOpacity
            onPress={() => changeWeek(-1)}
            disabled={viewMode === "CUSTOM"}
            style={{ padding: 4, opacity: viewMode === "CUSTOM" ? 0.3 : 1 }}
          >
            <ChevronLeft size={24} color="#007AFF" />
          </TouchableOpacity>
          <View style={{ flexDirection: "row", alignItems: "center", flex: 1, justifyContent: "center" }}>
            <Calendar size={20} color="#000" />
            <Text
              style={{
                fontSize: 15,
                fontWeight: "600",
                color: "#000",
                marginLeft: 8,
                textAlign: "center",
              }}
              numberOfLines={2}
            >
              {rangeLabel}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => changeWeek(1)}
            disabled={viewMode === "CUSTOM"}
            style={{ padding: 4, opacity: viewMode === "CUSTOM" ? 0.3 : 1 }}
          >
            <ChevronRight size={24} color="#007AFF" />
          </TouchableOpacity>
        </GlassView>

        {viewMode === "CUSTOM" ? (
          <View style={{ marginTop: 12, gap: 8 }}>
            <TouchableOpacity onPress={() => setPicker("from")}>
              <GlassView
                style={[
                  {
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    borderRadius: 12,
                    overflow: "hidden",
                  },
                  glassCard,
                ]}
              >
                <Text style={{ fontSize: 12, color: "#8E8E93", marginBottom: 4 }}>From</Text>
                <Text style={{ fontSize: 16, fontWeight: "600", color: "#000" }}>
                  {formatDisplayDate(customFrom)}
                </Text>
              </GlassView>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setPicker("to")}>
              <GlassView
                style={[
                  {
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    borderRadius: 12,
                    overflow: "hidden",
                  },
                  glassCard,
                ]}
              >
                <Text style={{ fontSize: 12, color: "#8E8E93", marginBottom: 4 }}>To</Text>
                <Text style={{ fontSize: 16, fontWeight: "600", color: "#000" }}>
                  {formatDisplayDate(customTo)}
                </Text>
              </GlassView>
            </TouchableOpacity>
          </View>
        ) : null}

        <Text style={{ fontSize: 12, color: "#8E8E93", marginTop: 8, textAlign: "center" }}>
          Team rosters overlapping this period
          {debouncedSearch ? ` · filtered by “${debouncedSearch}”` : ""}
        </Text>
        {listUpdating ? (
          <Text style={{ fontSize: 12, color: "#007AFF", marginTop: 6, textAlign: "center" }}>
            Updating…
          </Text>
        ) : null}
      </View>

      <DatePickerModal
        visible={picker === "from"}
        label="From date"
        value={customFrom}
        onSelect={setCustomFrom}
        onClose={() => setPicker(null)}
      />
      <DatePickerModal
        visible={picker === "to"}
        label="To date"
        value={customTo}
        minDate={customFrom}
        onSelect={setCustomTo}
        onClose={() => setPicker(null)}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 40,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              try {
                await fetchRosters();
              } finally {
                setRefreshing(false);
              }
            }}
          />
        }
      >
        {loading ? (
          <View style={{ paddingTop: 24, alignItems: "center" }}>
            <Text style={{ color: "#666" }}>Loading rosters…</Text>
          </View>
        ) : error ? (
          <Text style={{ color: "#C62828", fontWeight: "600" }}>{error}</Text>
        ) : null}
        {!loading && rosters.length === 0 && !error ? (
          <GlassView
            style={[
              { padding: 24, borderRadius: 14, alignItems: "center", overflow: "hidden" },
              isLiquidGlassAvailable() ? {} : { backgroundColor: "#fff", opacity: 0.96 },
            ]}
          >
            <Users size={28} color="#C7C7CC" />
            <Text style={{ fontSize: 15, color: "#666", marginTop: 12, textAlign: "center" }}>
              No rosters match this period
              {debouncedSearch ? " or search" : ""}. Tap + to create one.
            </Text>
          </GlassView>
        ) : null}
        {!loading &&
          rosters.map((r) => {
            const mCount = r?.members?.totalMembers ?? (r?.members?.items?.length ?? 0);
            return (
              <Pressable key={r.id} onPress={() => router.push(`/roster/${r.id}`)}>
                <GlassView
                  style={[
                    {
                      padding: 16,
                      borderRadius: 14,
                      marginBottom: 10,
                      overflow: "hidden",
                    },
                    glassCard,
                  ]}
                >
                  <Text style={{ fontSize: 17, fontWeight: "700", color: "#000" }} numberOfLines={2}>
                    {r.clientName ?? "Site"}
                  </Text>
                  <Text style={{ fontSize: 14, color: "#8E8E93", marginTop: 6 }} numberOfLines={1}>
                    {r.teamName ?? "Team"} · {mCount} guard{mCount === 1 ? "" : "s"}
                  </Text>
                  <Text style={{ fontSize: 14, color: "#3C3C43", marginTop: 8 }}>
                    {r.shiftName ?? "Shift"}
                    {r.shiftStartTime && r.shiftEndTime
                      ? ` · ${r.shiftStartTime}–${r.shiftEndTime}`
                      : ""}
                  </Text>
                  <Text style={{ fontSize: 13, color: "#8E8E93", marginTop: 6 }}>
                    {r.assignment?.startDate} → {r.assignment?.endDate}
                  </Text>
                  <View
                    style={{
                      alignSelf: "flex-start",
                      marginTop: 10,
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: 6,
                      backgroundColor: r.status === "inactive" ? "#FFEBEE" : "#E3F2FD",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "700",
                        color: r.status === "inactive" ? "#C62828" : "#1565C0",
                        textTransform: "uppercase",
                      }}
                    >
                      {r.status ?? "active"}
                    </Text>
                  </View>
                </GlassView>
              </Pressable>
            );
          })}
      </ScrollView>
    </View>
  );
}
