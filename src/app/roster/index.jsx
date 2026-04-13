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
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
  Users,
} from "lucide-react-native";
import { useRouter } from "expo-router";
import { useState, useEffect } from "react";
import FloatingActionButton from "@/components/FloatingActionButton";

export default function Roster() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState("WEEK"); // WEEK or MONTH
  const [roster, setRoster] = useState([]);

  useEffect(() => {
    fetchRoster();
  }, [selectedDate, viewMode]);

  const fetchRoster = async () => {
    try {
      const startDate = getStartDate();
      const endDate = getEndDate();

      const response = await fetch(
        `/api/roster?startDate=${startDate}&endDate=${endDate}`,
      );
      if (response.ok) {
        const data = await response.json();
        setRoster(data);
      }
    } catch {
      // Demo / offline: keep empty roster
    }
  };

  const getStartDate = () => {
    const date = new Date(selectedDate);
    if (viewMode === "WEEK") {
      date.setDate(date.getDate() - date.getDay());
    } else {
      date.setDate(1);
    }
    return date.toISOString().split("T")[0];
  };

  const getEndDate = () => {
    const date = new Date(selectedDate);
    if (viewMode === "WEEK") {
      date.setDate(date.getDate() - date.getDay() + 6);
    } else {
      date.setMonth(date.getMonth() + 1);
      date.setDate(0);
    }
    return date.toISOString().split("T")[0];
  };

  const formatDate = (date) => {
    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const changeWeek = (direction) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + direction * 7);
    setSelectedDate(newDate);
  };

  const getRosterByDate = (date) => {
    return roster.filter((r) => r.date === date);
  };

  const generateWeekDates = () => {
    const dates = [];
    const start = new Date(selectedDate);
    start.setDate(start.getDate() - start.getDay());

    for (let i = 0; i < 7; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  const getShiftColor = (shift) => {
    switch (shift) {
      case "DAY":
        return "#007AFF";
      case "NIGHT":
        return "#5856D6";
      case "SWING":
        return "#FF9500";
      default:
        return "#666";
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#F5F5F7" }}>
      <StatusBar style="dark" />

      {/* Header */}
      <View
        style={{
          paddingHorizontal: 20,
          paddingTop: insets.top + 20,
          paddingBottom: 16,
        }}
      >
        <Text style={{ fontSize: 32, fontWeight: "700", color: "#000" }}>
          Roster
        </Text>
      </View>

      {/* View Toggle */}
      <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity
            onPress={() => setViewMode("WEEK")}
            style={{ flex: 1 }}
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
                  ? viewMode === "WEEK"
                    ? { backgroundColor: "rgba(0, 122, 255, 0.2)" }
                    : {}
                  : {
                      opacity: 0.95,
                      backgroundColor:
                        viewMode === "WEEK" ? "#007AFF" : "#ffffff",
                    },
              ]}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "600",
                  color:
                    viewMode === "WEEK"
                      ? isLiquidGlassAvailable()
                        ? "#007AFF"
                        : "#FFF"
                      : "#000",
                }}
              >
                Week View
              </Text>
            </GlassView>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setViewMode("MONTH")}
            style={{ flex: 1 }}
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
                  ? viewMode === "MONTH"
                    ? { backgroundColor: "rgba(0, 122, 255, 0.2)" }
                    : {}
                  : {
                      opacity: 0.95,
                      backgroundColor:
                        viewMode === "MONTH" ? "#007AFF" : "#ffffff",
                    },
              ]}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "600",
                  color:
                    viewMode === "MONTH"
                      ? isLiquidGlassAvailable()
                        ? "#007AFF"
                        : "#FFF"
                      : "#000",
                }}
              >
                Month View
              </Text>
            </GlassView>
          </TouchableOpacity>
        </View>
      </View>

      {/* Date Navigation */}
      <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
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
            isLiquidGlassAvailable()
              ? {}
              : { opacity: 0.95, backgroundColor: "#ffffff" },
          ]}
        >
          <TouchableOpacity
            onPress={() => changeWeek(-1)}
            style={{ padding: 4 }}
          >
            <ChevronLeft size={24} color="#007AFF" />
          </TouchableOpacity>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Calendar size={20} color="#000" />
            <Text
              style={{
                fontSize: 16,
                fontWeight: "600",
                color: "#000",
                marginLeft: 8,
              }}
            >
              {formatDate(selectedDate)}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => changeWeek(1)}
            style={{ padding: 4 }}
          >
            <ChevronRight size={24} color="#007AFF" />
          </TouchableOpacity>
        </GlassView>
      </View>

      {/* Roster List */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 140,
        }}
        showsVerticalScrollIndicator={false}
      >
        {viewMode === "WEEK" && (
          <>
            {generateWeekDates().map((date, index) => {
              const dateStr = date.toISOString().split("T")[0];
              const dayRoster = getRosterByDate(dateStr);
              const isToday =
                dateStr === new Date().toISOString().split("T")[0];

              return (
                <View key={index} style={{ marginBottom: 20 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      marginBottom: 12,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: "700",
                        color: isToday ? "#007AFF" : "#000",
                      }}
                    >
                      {date.toLocaleDateString("en-IN", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                      })}
                    </Text>
                    {isToday && (
                      <View
                        style={{
                          marginLeft: 8,
                          paddingHorizontal: 8,
                          paddingVertical: 2,
                          borderRadius: 6,
                          backgroundColor: "#007AFF20",
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: "600",
                            color: "#007AFF",
                          }}
                        >
                          TODAY
                        </Text>
                      </View>
                    )}
                    <View style={{ flex: 1, alignItems: "flex-end" }}>
                      <Text style={{ fontSize: 13, color: "#666" }}>
                        {dayRoster.length} assigned
                      </Text>
                    </View>
                  </View>

                  {dayRoster.length === 0 ? (
                    <GlassView
                      style={[
                        {
                          padding: 20,
                          borderRadius: 12,
                          alignItems: "center",
                          overflow: "hidden",
                        },
                        isLiquidGlassAvailable()
                          ? {}
                          : { opacity: 0.95, backgroundColor: "#ffffff" },
                      ]}
                    >
                      <Users size={24} color="#C7C7CC" />
                      <Text
                        style={{ fontSize: 14, color: "#999", marginTop: 8 }}
                      >
                        No guards assigned
                      </Text>
                    </GlassView>
                  ) : (
                    dayRoster.map((entry) => (
                      <GlassView
                        key={entry.id}
                        style={[
                          {
                            padding: 16,
                            borderRadius: 12,
                            marginBottom: 8,
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
                                fontSize: 16,
                                fontWeight: "600",
                                color: "#000",
                                marginBottom: 4,
                              }}
                            >
                              {entry.employee.name}
                            </Text>
                            <Text style={{ fontSize: 14, color: "#666" }}>
                              {entry.site.name}
                            </Text>
                          </View>
                          <View
                            style={{
                              paddingHorizontal: 12,
                              paddingVertical: 6,
                              borderRadius: 8,
                              backgroundColor:
                                getShiftColor(entry.shift) + "20",
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 13,
                                fontWeight: "600",
                                color: getShiftColor(entry.shift),
                              }}
                            >
                              {entry.shift}
                            </Text>
                          </View>
                        </View>
                      </GlassView>
                    ))
                  )}
                </View>
              );
            })}
          </>
        )}
      </ScrollView>

      <FloatingActionButton />
    </View>
  );
}
