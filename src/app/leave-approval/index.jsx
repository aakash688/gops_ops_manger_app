import { View, Text, Pressable } from "react-native";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { Calendar, Check, X } from "lucide-react-native";
import { useState } from "react";
import StackScreen from "@/components/StackScreen";

const DEMO = [
  { id: "1", name: "Amit Singh", dates: "Apr 12–14", type: "Annual leave", site: "HQ" },
  { id: "2", name: "Priya Sharma", dates: "Apr 18", type: "Sick leave", site: "Mall" },
];

export default function LeaveApprovalScreen() {
  const [rows, setRows] = useState(DEMO);

  const approve = (id) => {
    setRows((r) => r.filter((x) => x.id !== id));
  };

  return (
    <StackScreen title="Leave approval" subtitle="Pending requests from guards & supervisors">
      {rows.length === 0 ? (
        <Text style={{ color: "#666", textAlign: "center", marginTop: 24 }}>
          No pending leave requests.
        </Text>
      ) : (
        rows.map((row) => (
          <GlassView
            key={row.id}
            isInteractive
            style={[
              {
                padding: 16,
                borderRadius: 16,
                overflow: "hidden",
                marginBottom: 12,
              },
              isLiquidGlassAvailable()
                ? {}
                : { opacity: 0.95, backgroundColor: "#ffffff" },
            ]}
          >
            <Text style={{ fontSize: 17, fontWeight: "700", color: "#000" }}>{row.name}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8 }}>
              <Calendar size={16} color="#666" />
              <Text style={{ marginLeft: 6, color: "#666", fontSize: 14 }}>{row.dates}</Text>
            </View>
            <Text style={{ color: "#333", marginTop: 6 }}>{row.type} · {row.site}</Text>
            <View style={{ flexDirection: "row", marginTop: 14, gap: 10 }}>
              <Pressable
                onPress={() => approve(row.id)}
                style={({ pressed }) => ({
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#34C759",
                  paddingVertical: 10,
                  borderRadius: 10,
                  opacity: pressed ? 0.85 : 1,
                  gap: 6,
                })}
              >
                <Check size={18} color="#FFF" />
                <Text style={{ color: "#FFF", fontWeight: "700" }}>Approve</Text>
              </Pressable>
              <Pressable
                onPress={() => approve(row.id)}
                style={({ pressed }) => ({
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#FF3B30",
                  paddingVertical: 10,
                  borderRadius: 10,
                  opacity: pressed ? 0.85 : 1,
                  gap: 6,
                })}
              >
                <X size={18} color="#FFF" />
                <Text style={{ color: "#FFF", fontWeight: "700" }}>Reject</Text>
              </Pressable>
            </View>
          </GlassView>
        ))
      )}
    </StackScreen>
  );
}
