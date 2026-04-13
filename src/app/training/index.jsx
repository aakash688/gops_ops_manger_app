import { View, Text, Pressable } from "react-native";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { GraduationCap, Play, ChevronRight } from "lucide-react-native";
import StackScreen from "@/components/StackScreen";

const MODULES = [
  { id: "1", title: "Field safety refresher", duration: "18 min", due: "Due Apr 15" },
  { id: "2", title: "Customer escalation protocol", duration: "12 min", due: "Optional" },
  { id: "3", title: "New SOP: night shift handover", duration: "8 min", due: "New" },
];

export default function TrainingScreen() {
  return (
    <StackScreen title="Training updates" subtitle="Micro-learning assigned to your role">
      {MODULES.map((m) => (
        <Pressable key={m.id} style={{ marginBottom: 12 }}>
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
              isLiquidGlassAvailable()
                ? {}
                : { opacity: 0.95, backgroundColor: "#ffffff" },
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
              <Text style={{ fontSize: 16, fontWeight: "700", color: "#000" }}>{m.title}</Text>
              <Text style={{ fontSize: 13, color: "#666", marginTop: 4 }}>
                {m.duration} · {m.due}
              </Text>
            </View>
            <Play size={20} color="#007AFF" />
            <ChevronRight size={18} color="#C7C7CC" style={{ marginLeft: 4 }} />
          </GlassView>
        </Pressable>
      ))}

      <Text style={{ fontSize: 13, color: "#666", marginTop: 8, lineHeight: 18 }}>
        Completion syncs to HR. Videos can be streamed on Wi‑Fi or downloaded for offline.
      </Text>
    </StackScreen>
  );
}
