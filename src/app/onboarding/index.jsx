import { View, Text, Pressable } from "react-native";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { UserPlus, ChevronRight } from "lucide-react-native";
import { useRouter } from "expo-router";
import StackScreen from "@/components/StackScreen";

const STEPS = [
  { id: "1", title: "Personal & ID", desc: "Aadhaar, photo, emergency contact" },
  { id: "2", title: "Site assignment", desc: "Client, shift, reporting manager" },
  { id: "3", title: "Uniform & kit", desc: "Sizes, badge, device handover" },
  { id: "4", title: "Compliance", desc: "NDA, safety briefing acknowledgment" },
];

export default function OnboardingScreen() {
  const router = useRouter();

  return (
    <StackScreen title="New employee onboarding" subtitle="Guided checklist for field hires">
      <Pressable
        onPress={() => router.push("/checklist")}
        style={({ pressed }) => ({
          marginBottom: 16,
          opacity: pressed ? 0.92 : 1,
        })}
      >
        <GlassView
          isInteractive
          style={[
            {
              padding: 18,
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
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: "rgba(0,122,255,0.12)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <UserPlus size={24} color="#007AFF" />
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={{ fontSize: 17, fontWeight: "700", color: "#000" }}>
              Start onboarding form
            </Text>
            <Text style={{ fontSize: 14, color: "#666", marginTop: 4 }}>
              Opens full checklist wizard
            </Text>
          </View>
          <ChevronRight size={22} color="#C7C7CC" />
        </GlassView>
      </Pressable>

      <Text style={{ fontSize: 16, fontWeight: "700", color: "#000", marginBottom: 10 }}>
        Steps
      </Text>
      {STEPS.map((s, i) => (
        <GlassView
          key={s.id}
          style={[
            {
              padding: 14,
              borderRadius: 14,
              overflow: "hidden",
              marginBottom: 10,
            },
            isLiquidGlassAvailable()
              ? {}
              : { opacity: 0.95, backgroundColor: "#ffffff" },
          ]}
        >
          <Text style={{ fontSize: 12, color: "#007AFF", fontWeight: "700" }}>
            STEP {i + 1}
          </Text>
          <Text style={{ fontSize: 16, fontWeight: "600", color: "#000", marginTop: 4 }}>
            {s.title}
          </Text>
          <Text style={{ fontSize: 14, color: "#666", marginTop: 4 }}>{s.desc}</Text>
        </GlassView>
      ))}
    </StackScreen>
  );
}
